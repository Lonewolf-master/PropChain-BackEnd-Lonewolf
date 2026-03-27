import { IsEnum, IsNotEmpty } from 'class-validator';

export enum WithdrawalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
}

export class UpdateWithdrawalStatusDto {
  @IsNotEmpty()
  @IsEnum(WithdrawalStatus)
  status: WithdrawalStatus;
}
