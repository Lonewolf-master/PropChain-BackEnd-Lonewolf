import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsPositive, IsUUID } from 'class-validator';
import { TransactionType } from '../../types/prisma.types';

export class CreateTransactionDto {
  @IsUUID('4')
  propertyId!: string;

  @IsUUID('4')
  buyerId!: string;

  @IsUUID('4')
  sellerId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;
}
