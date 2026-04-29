import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../database/prisma.service';
import { AuthUserPayload } from '../auth/types/auth-user.type';
import { TransactionSearchQueryDto } from './dto/transaction-search.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: TransactionSearchQueryDto, user: AuthUserPayload) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.buildSearchWhere(query, user);

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          seller: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    };
  }

  private buildSearchWhere(query: TransactionSearchQueryDto, user: AuthUserPayload) {
    const filters: Record<string, unknown>[] = [];

    if (user.role !== 'ADMIN') {
      filters.push({
        OR: [{ buyerId: user.sub }, { sellerId: user.sub }],
      });
    }

    if (query.status) {
      filters.push({ status: query.status });
    }

    if (query.propertyId) {
      filters.push({ propertyId: query.propertyId });
    }

    if (query.property) {
      filters.push({
        property: {
          OR: [
            { title: { contains: query.property, mode: 'insensitive' } },
            { address: { contains: query.property, mode: 'insensitive' } },
            { city: { contains: query.property, mode: 'insensitive' } },
            { state: { contains: query.property, mode: 'insensitive' } },
          ],
        },
      });
    }

    const createdAt: Record<string, Date> = {};
    if (query.dateFrom) {
      createdAt.gte = new Date(query.dateFrom);
    }
    if (query.dateTo) {
      createdAt.lte = this.endOfDay(query.dateTo);
    }
    if (Object.keys(createdAt).length > 0) {
      filters.push({ createdAt });
    }

    const amount: Record<string, Decimal> = {};
    if (query.minAmount !== undefined) {
      amount.gte = new Decimal(query.minAmount);
    }
    if (query.maxAmount !== undefined) {
      amount.lte = new Decimal(query.maxAmount);
    }
    if (Object.keys(amount).length > 0) {
      filters.push({ amount });
    }

    return filters.length > 0 ? { AND: filters } : {};
  }

  private endOfDay(date: string): Date {
    const parsed = new Date(date);
    if (date.length <= 10) {
      parsed.setUTCHours(23, 59, 59, 999);
    }
    return parsed;
  }
}
