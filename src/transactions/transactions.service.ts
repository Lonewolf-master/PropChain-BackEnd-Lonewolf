import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { AuthUserPayload } from '../auth/types/auth-user.type';
import { PrismaService } from '../database/prisma.service';
import { TransactionStatus, TransactionType, UserRole } from '../types/prisma.types';
import {
  canTransitionTransactionStatus,
  DEFAULT_TRANSACTION_STATUS,
} from './transaction-status.constants';

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

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.transaction.create({
      data: {
        propertyId: input.propertyId,
        buyerId: input.buyerId,
        sellerId: input.sellerId,
        amount: new Decimal(input.amount.toString()),
        type: input.type ?? TransactionType.SALE,
        blockchainHash: input.blockchainHash,
        contractAddress: input.contractAddress,
        notes: input.notes,
        status: input.status ?? DEFAULT_TRANSACTION_STATUS,
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            address: true,
          },
        },
        buyer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        seller: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async updateTransactionStatus(transactionId: string, status: TransactionStatus) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    if (!canTransitionTransactionStatus(transaction.status as TransactionStatus, status)) {
      throw new BadRequestException(
        `Transaction status cannot transition from ${transaction.status} to ${status}`,
      );
    }

    if (transaction.status === status) {
      return transaction;
    }

    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status },
    });
  }
}
