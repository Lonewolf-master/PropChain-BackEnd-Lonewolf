import { Test } from '@nestjs/testing';
import { WithdrawalsService } from '../../src/withdrawals/withdrawals.service';
import { PrismaService } from '../../src/database/prisma/prisma.service';
import { MultichannelService } from '../../src/communication/multichannel/multichannel.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('WithdrawalsService', () => {
  let service: WithdrawalsService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      property: {
        findUnique: jest.fn(),
      },
      withdrawal: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WithdrawalsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MultichannelService, useValue: { sendInAppNotification: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get<WithdrawalsService>(WithdrawalsService);
  });

  it('should create a withdrawal when project exists', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'proj-1' });
    prismaMock.withdrawal.create.mockResolvedValue({ id: 'w1', projectId: 'proj-1', amount: 100, status: 'PENDING', transactionHash: '0xabc' });

    const result = await service.createWithdrawal({ projectId: 'proj-1', amount: 100, transactionHash: '0xabc' } as any);

    expect(result.status).toBe('PENDING');
    expect(prismaMock.withdrawal.create).toHaveBeenCalled();
  });

  it('should throw NotFoundException when project not found', async () => {
    prismaMock.property.findUnique.mockResolvedValue(null);
    await expect(service.createWithdrawal({ projectId: 'proj-1', amount: 100 } as any)).rejects.toThrow(NotFoundException);
  });

  it('should enforce valid status transitions', async () => {
    prismaMock.withdrawal.findUnique.mockResolvedValue({ id: 'w1', status: 'PENDING' });
    prismaMock.withdrawal.update.mockResolvedValue({ id: 'w1', status: 'APPROVED' });

    const updated = await service.updateWithdrawalStatus('w1', { status: 'APPROVED' } as any);
    expect(updated.status).toBe('APPROVED');

    prismaMock.withdrawal.findUnique.mockResolvedValue({ id: 'w1', status: 'PAID' });
    await expect(service.updateWithdrawalStatus('w1', { status: 'APPROVED' } as any)).rejects.toThrow(BadRequestException);
  });

  it('should create request withdrawal for creator with funds', async () => {
    const user = { id: 'creator-1', role: 'CREATOR', name: 'Creator' };

    prismaMock.property.findUnique.mockResolvedValue({ id: 'proj-1', ownerId: 'creator-1', status: 'SOLD', title: 'Project A' });
    prismaMock.donation.aggregate.mockResolvedValue({ _sum: { amount: 1000 } });
    prismaMock.withdrawal.aggregate.mockResolvedValue({ _sum: { amount: 200 } });
    prismaMock.withdrawal.create.mockResolvedValue({ id: 'w2', projectId: 'proj-1', amount: 200, status: 'PENDING' });
    prismaMock.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
    const multichannelMock = jest.spyOn((service as any).multichannelService, 'sendInAppNotification').mockResolvedValue({} as any);

    const result = await service.requestWithdrawal(user as any, { projectId: 'proj-1', amount: 300 } as any);

    expect(result.id).toBe('w2');
    expect(multichannelMock).toHaveBeenCalled();
  });

  it('should reject request if user is not creator', async () => {
    const user = { id: 'user-1', role: 'USER' };
    await expect(service.requestWithdrawal(user as any, { projectId: 'proj-1', amount: 10 } as any)).rejects.toThrow(ForbiddenException);
  });

  it('should reject if request amount exceeds balance', async () => {
    const user = { id: 'creator-1', role: 'CREATOR' };

    prismaMock.property.findUnique.mockResolvedValue({ id: 'proj-1', ownerId: 'creator-1', status: 'SOLD', title: 'Project A' });
    prismaMock.donation.aggregate.mockResolvedValue({ _sum: { amount: 500 } });
    prismaMock.withdrawal.aggregate.mockResolvedValue({ _sum: { amount: 500 } });

    await expect(service.requestWithdrawal(user as any, { projectId: 'proj-1', amount: 100 } as any)).rejects.toThrow(BadRequestException);
  });
});
