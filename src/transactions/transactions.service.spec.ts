import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../database/prisma.service';
import { TransactionSortField, SortOrder } from './dto/transactions.dto';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    transaction: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTransactions', () => {
    it('should call prisma findMany and count with correct arguments', async () => {
      const query = {
        page: 1,
        limit: 10,
        sortBy: TransactionSortField.CREATED_AT,
        sortOrder: SortOrder.DESC,
      };
      const userId = 'user-1';

      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockPrismaService.transaction.count.mockResolvedValue(0);

      const result = await service.getTransactions(query, userId);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ buyerId: userId }, { sellerId: userId }],
          }),
          skip: 0,
          take: 10,
        }),
      );
      expect(prisma.transaction.count).toHaveBeenCalled();
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
    });
  });

  describe('getTransactionById', () => {
    it('should return transaction if user is buyer', async () => {
      const mockTransaction = { id: 't-1', buyerId: 'user-1', sellerId: 'user-2' };
      mockPrismaService.transaction.findUnique.mockResolvedValue(mockTransaction);

      const result = await service.getTransactionById('t-1', 'user-1');
      expect(result).toEqual(mockTransaction);
    });

    it('should return null if user is not buyer, seller or admin', async () => {
      const mockTransaction = { id: 't-1', buyerId: 'user-1', sellerId: 'user-2' };
      mockPrismaService.transaction.findUnique.mockResolvedValue(mockTransaction);

      const result = await service.getTransactionById('t-1', 'user-3', false);
      expect(result).toBeNull();
    });
  });
});
