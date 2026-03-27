import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum WithdrawalsScope {
  PROJECT = 'project',
  ALL = 'all',
}

export class GetWithdrawalsDto {
  @IsOptional()
  @IsEnum(WithdrawalsScope)
  scope?: WithdrawalsScope = WithdrawalsScope.ALL;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}
