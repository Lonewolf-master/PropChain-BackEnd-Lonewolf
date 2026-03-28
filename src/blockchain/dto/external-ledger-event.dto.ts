import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsBoolean, IsArray, IsObject, ValidateNested, IsEnum, IsDateString, Matches, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum ExternalLedgerEventType {
  TRANSACTION_CREATED = 'transaction_created',
  TRANSACTION_UPDATED = 'transaction_updated',
  BLOCK_CREATED = 'block_created',
  ACCOUNT_CREATED = 'account_created',
  CONTRACT_DEPLOYED = 'contract_deployed',
  TOKEN_TRANSFER = 'token_transfer',
  SMART_CONTRACT_EVENT = 'smart_contract_event',
}

export enum ExternalLedgerSource {
  ETHEREUM = 'ethereum',
  STELLAR = 'stellar',
  BITCOIN = 'bitcoin',
  POLYGON = 'polygon',
  ARBITRUM = 'arbitrum',
}

export class TransactionDataDto {
  @ApiProperty({ description: 'Transaction hash', example: '0xabc123...' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/, { message: 'Invalid transaction hash format' })
  hash: string;

  @ApiProperty({ description: 'From address', example: '0x123...' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid from address format' })
  from: string;

  @ApiProperty({ description: 'To address', example: '0x456...' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid to address format' })
  to: string;

  @ApiProperty({ description: 'Transaction amount', example: 1000000000000000000 })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty({ description: 'Gas price', example: 20000000000 })
  @IsNumber()
  @Min(0)
  gasPrice?: number;

  @ApiProperty({ description: 'Gas limit', example: 21000 })
  @IsNumber()
  @Min(0)
  gas?: number;

  @ApiProperty({ description: 'Nonce', example: 42 })
  @IsNumber()
  @Min(0)
  nonce: number;

  @ApiPropertyOptional({ description: 'Transaction input data', example: '0x...' })
  @IsOptional()
  @IsString()
  data?: string;

  @ApiPropertyOptional({ description: 'Transaction signature components' })
  @IsOptional()
  @IsObject()
  signature?: {
    v: number;
    r: string;
    s: string;
  };
}

export class BlockDataDto {
  @ApiProperty({ description: 'Block number', example: 12345678 })
  @IsNumber()
  @Min(0)
  number: number;

  @ApiProperty({ description: 'Block hash', example: '0xdef456...' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/, { message: 'Invalid block hash format' })
  hash: string;

  @ApiProperty({ description: 'Parent block hash', example: '0xabc123...' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/, { message: 'Invalid parent hash format' })
  parentHash: string;

  @ApiProperty({ description: 'Block timestamp' })
  @IsDateString()
  timestamp: string;

  @ApiProperty({ description: 'Gas limit for the block', example: 15000000 })
  @IsNumber()
  @Min(0)
  gasLimit: number;

  @ApiProperty({ description: 'Gas used by the block', example: 12345678 })
  @IsNumber()
  @Min(0)
  gasUsed: number;

  @ApiProperty({ description: 'Miner address', example: '0x789...' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid miner address format' })
  miner: string;

  @ApiPropertyOptional({ description: 'Transaction hashes in this block' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  transactions?: string[];
}

export class SmartContractEventDataDto {
  @ApiProperty({ description: 'Contract address', example: '0xcontract...' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid contract address format' })
  contractAddress: string;

  @ApiProperty({ description: 'Event name', example: 'Transfer' })
  @IsString()
  eventName: string;

  @ApiProperty({ description: 'Event signature', example: '0x...' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/, { message: 'Invalid event signature format' })
  eventSignature: string;

  @ApiPropertyOptional({ description: 'Event parameters' })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Log index', example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  logIndex?: number;
}

export class ExternalLedgerEventDto {
  @ApiProperty({ description: 'Event type', enum: ExternalLedgerEventType })
  @IsEnum(ExternalLedgerEventType)
  type: ExternalLedgerEventType;

  @ApiProperty({ description: 'Source ledger', enum: ExternalLedgerSource })
  @IsEnum(ExternalLedgerSource)
  source: ExternalLedgerSource;

  @ApiProperty({ description: 'Event ID from source', example: 'evt_123456789' })
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{1,100}$/, { message: 'Invalid event ID format' })
  eventId: string;

  @ApiProperty({ description: 'Event timestamp' })
  @IsDateString()
  timestamp: string;

  @ApiPropertyOptional({ description: 'Block number', example: 12345678 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  blockNumber?: number;

  @ApiPropertyOptional({ description: 'Transaction data for transaction events' })
  @IsOptional()
  @ValidateNested()
  @Type(() => TransactionDataDto)
  transaction?: TransactionDataDto;

  @ApiPropertyOptional({ description: 'Block data for block events' })
  @IsOptional()
  @ValidateNested()
  @Type(() => BlockDataDto)
  block?: BlockDataDto;

  @ApiPropertyOptional({ description: 'Smart contract event data' })
  @IsOptional()
  @ValidateNested()
  @Type(() => SmartContractEventDataDto)
  smartContractEvent?: SmartContractEventDataDto;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Event signature for verification' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-fA-F0-9]{128,512}$/, { message: 'Invalid signature format' })
  signature?: string;

  @ApiPropertyOptional({ description: 'Previous event hash for chain verification' })
  @IsOptional()
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/, { message: 'Invalid previous hash format' })
  previousEventHash?: string;
}

export class ExternalLedgerEventBatchDto {
  @ApiProperty({ description: 'Array of external ledger events' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExternalLedgerEventDto)
  events: ExternalLedgerEventDto[];

  @ApiProperty({ description: 'Batch ID for tracking', example: 'batch_123456789' })
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{1,100}$/, { message: 'Invalid batch ID format' })
  batchId: string;

  @ApiProperty({ description: 'Total number of events in batch', example: 10 })
  @IsNumber()
  @Min(1)
  @Max(1000)
  totalCount: number;

  @ApiProperty({ description: 'Batch creation timestamp' })
  @IsDateString()
  createdAt: string;

  @ApiPropertyOptional({ description: 'Source identifier', example: 'external_api_v1' })
  @IsOptional()
  @IsString()
  sourceIdentifier?: string;
}
