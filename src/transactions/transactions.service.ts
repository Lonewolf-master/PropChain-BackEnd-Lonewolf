import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TransactionHistoryQueryDto } from './dto/transactions.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

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
