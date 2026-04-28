import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../database/prisma.service';
import { TransactionStatus, TransactionType } from '../types/prisma.types';
import {
  canTransitionTransactionStatus,
  DEFAULT_TRANSACTION_STATUS,
} from './transaction-status.constants';

export interface CreateTransactionInput {
  propertyId: string;
  buyerId: string;
  sellerId: string;
  amount: Decimal | number | string;
  type: TransactionType;
  status?: TransactionStatus;
  blockchainHash?: string | null;
  contractAddress?: string | null;
  notes?: string | null;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createTransaction(input: CreateTransactionInput) {
    return this.prisma.transaction.create({
      data: {
        ...input,
        status: input.status ?? DEFAULT_TRANSACTION_STATUS,
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
