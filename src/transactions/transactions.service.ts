import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TransactionHistoryQueryDto } from './dto/transactions.dto';
import { Prisma } from '@prisma/client';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { TransactionStatus, TransactionType } from '../types/prisma.types';
import {
  canTransitionTransactionStatus,
  DEFAULT_TRANSACTION_STATUS,
} from './transaction-status.constants';
import {
  CreateTransactionTaxStrategyDto,
  UpdateTransactionTaxStrategyDto,
} from './dto/transaction.dto';
import { TransactionSearchQueryDto } from './dto/transaction-search.dto';

export interface CreateTransactionInput {
  propertyId: string;
  buyerId: string;
  sellerId: string;
  amount: Decimal | number | string;
  type?: TransactionType;
  status?: TransactionStatus;
  blockchainHash?: string | null;
  contractAddress?: string | null;
  notes?: string | null;
}

const TAX_STRATEGY_DISCLAIMER =
  'Informational only. Tax strategy suggestions are non-binding and are not legal or tax advice.';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createTransaction(input: CreateTransactionInput, actor?: AuthUserPayload) {
    if (actor && actor.role !== UserRole.ADMIN && actor.sub !== input.buyerId) {
      throw new ForbiddenException('You can only create transactions as the authenticated buyer');
    }

    const [property, buyer, seller] = await Promise.all([
      this.prisma.property.findUnique({
        where: { id: input.propertyId },
        select: {
          id: true,
          title: true,
          address: true,
          ownerId: true,
        },
      }),
      this.prisma.user.findUnique({
        where: { id: input.buyerId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      }),
      this.prisma.user.findUnique({
        where: { id: input.sellerId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      }),
    ]);

    if (!property) {
      throw new NotFoundException(`Property ${input.propertyId} not found`);
    }

    if (!buyer) {
      throw new NotFoundException(`Buyer ${input.buyerId} not found`);
    }

    if (!seller) {
      throw new NotFoundException(`Seller ${input.sellerId} not found`);
    }

    if (property.ownerId !== input.sellerId) {
      throw new BadRequestException('Seller must match the property owner');
    }

  async getTransactions(query: TransactionHistoryQueryDto, userId?: string) {
    const {
      status,
      type,
      startDate,
      endDate,
      propertyId,
      userId: queryUserId,
      page,
      limit,
      sortBy,
      sortOrder,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {
      status,
      type,
      propertyId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    // If userId is provided, filter by that user (as buyer or seller)
    // This is for "my transactions" view
    if (userId) {
      where.OR = [
        { buyerId: userId },
        { sellerId: userId },
      ];
    } else if (queryUserId) {
      // If userId is in query (admin view), filter by that user
      where.OR = [
        { buyerId: queryUserId },
        { sellerId: queryUserId },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          property: {
            select: {
              id: true,
              title: true,
              address: true,
              city: true,
              state: true,
            },
          },
          buyer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          seller: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTransactionById(id: string, userId?: string, isAdmin: boolean = false) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        property: true,
        buyer: true,
        seller: true,
      },
    });

    if (!transaction) {
      return null;
    }

    // Authorization check: User must be buyer, seller, or admin
    if (!isAdmin && userId && transaction.buyerId !== userId && transaction.sellerId !== userId) {
      return null;
    }

    return transaction;
  }
}
