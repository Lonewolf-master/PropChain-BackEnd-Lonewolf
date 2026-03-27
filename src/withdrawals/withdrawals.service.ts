import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { MultichannelService } from '../communication/multichannel/multichannel.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { UpdateWithdrawalStatusDto, WithdrawalStatus } from './dto/update-withdrawal-status.dto';

const statusTransitions: Record<WithdrawalStatus, WithdrawalStatus[]> = {
  PENDING: [WithdrawalStatus.APPROVED, WithdrawalStatus.REJECTED],
  APPROVED: [WithdrawalStatus.PAID],
  REJECTED: [],
  PAID: [],
};

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly multichannelService: MultichannelService,
  ) {}

  async createWithdrawal(dto: CreateWithdrawalDto) {
    const project = await (this.prisma as any).property.findUnique({ where: { id: dto.projectId } });
    if (!project) {
      throw new NotFoundException(`Project not found: ${dto.projectId}`);
    }

    return (this.prisma as any).withdrawal.create({
      data: {
        projectId: dto.projectId,
        amount: dto.amount as any,
        transactionHash: dto.transactionHash,
        status: WithdrawalStatus.PENDING,
      },
    });
  }

  async requestWithdrawal(user: any, dto: CreateWithdrawalDto) {
    if (user.role !== 'CREATOR') {
      throw new ForbiddenException('Only creators may request withdrawals');
    }

    const project = await (this.prisma as any).property.findUnique({ where: { id: dto.projectId } });
    if (!project) {
      throw new NotFoundException(`Project not found: ${dto.projectId}`);
    }

    if (project.ownerId !== user.id) {
      throw new ForbiddenException('User does not own selected project');
    }

    // Must be completed project status to request withdrawal
    if (project.status !== 'SOLD' && project.status !== 'COMPLETED') {
      throw new BadRequestException('Withdrawals may only be requested for completed projects');
    }

    const donationSum = await (this.prisma as any).donation.aggregate({
      where: { projectId: dto.projectId, status: 'CONFIRMED' },
      _sum: { amount: true },
    });

    const approvedWithdrawalSum = await (this.prisma as any).withdrawal.aggregate({
      where: { projectId: dto.projectId, status: { in: ['PENDING', 'APPROVED', 'PAID'] } },
      _sum: { amount: true },
    });

    const totalRaised = Number(donationSum._sum.amount || 0);
    const totalRequested = Number(approvedWithdrawalSum._sum.amount || 0);
    const availableBalance = totalRaised - totalRequested;

    if (dto.amount > availableBalance) {
      throw new BadRequestException('Requested amount exceeds available funds');
    }

    const withdrawal = await (this.prisma as any).withdrawal.create({
      data: {
        projectId: dto.projectId,
        amount: dto.amount as any,
        status: WithdrawalStatus.PENDING,
      },
    });

    const admins = await (this.prisma as any).user.findMany({ where: { role: 'ADMIN' } });
    const message = {
      title: 'New withdrawal request',
      message: `Project ${project.title || project.id} has a new withdrawal request for ${dto.amount}`,
      type: 'info',
      priority: 'high',
      data: { withdrawalId: withdrawal.id, projectId: dto.projectId },
    };

    await Promise.all(
      admins.map(admin =>
        this.multichannelService.sendInAppNotification(admin.id, {
          ...message,
          title: `Withdrawal request from ${user.name || user.id}`,
          userId: admin.id,
        }),
      ),
    );

    return withdrawal;
  }

  async getWithdrawals(query: { scope?: string; projectId?: string; page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: any = {};

    if (query.scope === 'project' || (query.projectId && !query.scope)) {
      if (!query.projectId) {
        throw new BadRequestException('projectId is required for project scope');
      }
      where.projectId = query.projectId;
    }

    const withdrawals = await (this.prisma as any).withdrawal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await (this.prisma as any).withdrawal.count({ where });

    return {
      data: withdrawals,
      total,
      page,
      limit,
    };
  }

  async updateWithdrawalStatus(withdrawalId: string, dto: UpdateWithdrawalStatusDto) {
    const existing = await (this.prisma as any).withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!existing) {
      throw new NotFoundException(`Withdrawal not found: ${withdrawalId}`);
    }

    if (existing.status === dto.status) {
      return existing;
    }

    const allowed = statusTransitions[existing.status as WithdrawalStatus];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(`Invalid status transition from ${existing.status} to ${dto.status}`);
    }

    return (this.prisma as any).withdrawal.update({
      where: { id: withdrawalId },
      data: { status: dto.status },
    });
  }
}
