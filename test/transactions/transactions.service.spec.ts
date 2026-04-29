import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../src/database/prisma.service';
import { TransactionStatus, TransactionType } from '../../src/types/prisma.types';
import { TransactionsService } from '../../src/transactions/transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;

  const mockPrismaService = {
    transaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get(TransactionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates transactions with PENDING status by default', async () => {
    mockPrismaService.transaction.create.mockResolvedValue({
      id: 'txn-1',
      status: TransactionStatus.PENDING,
    });

    await service.createTransaction({
      propertyId: 'property-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      amount: 1000,
      type: TransactionType.SALE,
    });

    expect(mockPrismaService.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        propertyId: 'property-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        amount: 1000,
        type: TransactionType.SALE,
        status: TransactionStatus.PENDING,
      }),
    });
  });

  it('allows a valid transition from PENDING to COMPLETED', async () => {
    mockPrismaService.transaction.findUnique.mockResolvedValue({
      id: 'txn-1',
      status: TransactionStatus.PENDING,
    });
    mockPrismaService.transaction.update.mockResolvedValue({
      id: 'txn-1',
      status: TransactionStatus.COMPLETED,
    });

    const result = await service.updateTransactionStatus('txn-1', TransactionStatus.COMPLETED);

    expect(mockPrismaService.transaction.update).toHaveBeenCalledWith({
      where: { id: 'txn-1' },
      data: { status: TransactionStatus.COMPLETED },
    });
    expect(result.status).toBe(TransactionStatus.COMPLETED);
  });

  it('allows a valid transition from PENDING to CANCELLED', async () => {
    mockPrismaService.transaction.findUnique.mockResolvedValue({
      id: 'txn-2',
      status: TransactionStatus.PENDING,
    });
    mockPrismaService.transaction.update.mockResolvedValue({
      id: 'txn-2',
      status: TransactionStatus.CANCELLED,
    });

    const result = await service.updateTransactionStatus('txn-2', TransactionStatus.CANCELLED);

    expect(mockPrismaService.transaction.update).toHaveBeenCalledWith({
      where: { id: 'txn-2' },
      data: { status: TransactionStatus.CANCELLED },
    });
    expect(result.status).toBe(TransactionStatus.CANCELLED);
  });

  it('rejects invalid status transitions', async () => {
    mockPrismaService.transaction.findUnique.mockResolvedValue({
      id: 'txn-3',
      status: TransactionStatus.COMPLETED,
    });

    await expect(
      service.updateTransactionStatus('txn-3', TransactionStatus.CANCELLED),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockPrismaService.transaction.update).not.toHaveBeenCalled();
  });

  it('rejects updates for missing transactions', async () => {
    mockPrismaService.transaction.findUnique.mockResolvedValue(null);

    await expect(
      service.updateTransactionStatus('missing-txn', TransactionStatus.COMPLETED),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
