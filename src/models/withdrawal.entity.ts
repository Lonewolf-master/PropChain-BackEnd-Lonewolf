import { WithdrawalStatus } from '@prisma/client';

export class Withdrawal {
  id: string;
  projectId?: string;
  amount: number;
  status: WithdrawalStatus;
  transactionHash?: string;
  createdAt: Date;
  updatedAt: Date;
}
