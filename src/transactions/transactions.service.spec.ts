import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionsService } from './transactions.service';
import { TransactionStatus, UserRole } from '../types/prisma.types';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: {
    transaction: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    transactionHistory: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let notificationsService: {
    sendNotification: jest.Mock;
    handleTransactionUpdate: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      transaction: {
        findMany: jest.fn().mockResolvedValue([{ id: 'tx-1' }]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      transactionHistory: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    notificationsService = {
      sendNotification: jest.fn(),
      handleTransactionUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
      ],
    }).compile();

    service = module.get(TransactionsService);
  });

  it('searches user transactions with status, date, amount, property filters, and pagination', async () => {
    const result = await service.search(
      {
        status: TransactionStatus.COMPLETED,
        dateFrom: '2026-04-01',
        dateTo: '2026-04-29',
        minAmount: 100000,
        maxAmount: 250000,
        property: 'Lagos',
        propertyId: '550e8400-e29b-41d4-a716-446655440000',
        page: 2,
        limit: 10,
      },
      {
        sub: 'user-1',
        email: 'buyer@example.com',
        role: UserRole.USER as any,
        type: 'access',
      },
    );

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'desc' },
        where: {
          AND: expect.arrayContaining([
            { OR: [{ buyerId: 'user-1' }, { sellerId: 'user-1' }] },
            { status: TransactionStatus.COMPLETED },
            { propertyId: '550e8400-e29b-41d4-a716-446655440000' },
            {
              property: {
                OR: expect.arrayContaining([
                  { title: { contains: 'Lagos', mode: 'insensitive' } },
                  { address: { contains: 'Lagos', mode: 'insensitive' } },
                ]),
              },
            },
            {
              createdAt: {
                gte: new Date('2026-04-01'),
                lte: new Date('2026-04-29T23:59:59.999Z'),
              },
            },
            {
              amount: {
                gte: expect.any(Object),
                lte: expect.any(Object),
              },
            },
          ]),
        },
      }),
    );
    expect(prisma.transaction.count).toHaveBeenCalledWith({
      where: prisma.transaction.findMany.mock.calls[0][0].where,
    });
    expect(result).toEqual({
      total: 1,
      page: 2,
      limit: 10,
      totalPages: 1,
      items: [{ id: 'tx-1' }],
    });
  });

  it('lets admins search all transactions without buyer or seller scoping', async () => {
    await service.search(
      { page: 1, limit: 20 },
      {
        sub: 'admin-1',
        email: 'admin@example.com',
        role: UserRole.ADMIN as any,
        type: 'access',
      },
    );

    expect(prisma.transaction.findMany.mock.calls[0][0].where).toEqual({});
  });

  describe('updateStatus', () => {
    it('updates status and logs history in a transaction', async () => {
      const mockTx = { id: 'tx-123', status: TransactionStatus.PENDING };
      prisma.transaction.findUnique.mockResolvedValue(mockTx);
      prisma.transaction.update.mockResolvedValue({ ...mockTx, status: TransactionStatus.COMPLETED });
      prisma.transactionHistory.create.mockResolvedValue({ id: 'hist-1' });
      prisma.$transaction.mockImplementation(async (cb) => cb(prisma));

      const result = await service.updateStatus('tx-123', TransactionStatus.COMPLETED, 'actor-1');

      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-123' },
        data: { status: TransactionStatus.COMPLETED },
      });
      expect(prisma.transactionHistory.create).toHaveBeenCalledWith({
        data: {
          transactionId: 'tx-123',
          status: TransactionStatus.COMPLETED,
          actorId: 'actor-1',
          notes: 'Status updated from PENDING to COMPLETED',
        },
      });
      expect(notificationsService.handleTransactionUpdate).toHaveBeenCalledWith('tx-123');
      expect(result.status).toBe(TransactionStatus.COMPLETED);
    });
  });
});
