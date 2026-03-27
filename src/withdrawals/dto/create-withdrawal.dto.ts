import { IsDecimal, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateWithdrawalDto {
  @IsNotEmpty()
  @IsString()
  projectId: string;

  @IsNotEmpty()
  @Transform(({ value }) => parseFloat(value))
  @IsDecimal({ decimal_digits: '0,18' }, { message: 'amount must be a valid decimal' })
  amount: number;

  @IsOptional()
  @IsString()
  transactionHash?: string;
}
