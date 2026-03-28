import { Test, TestingModule } from '@nestjs/testing';
import { ExternalLedgerEventService } from '../services/external-ledger-event.service';
import { ExternalLedgerEventDto, ExternalLedgerEventBatchDto, ExternalLedgerEventType, ExternalLedgerSource } from '../dto/external-ledger-event.dto';
import { BadRequestException } from '@nestjs/common';

describe('ExternalLedgerEventService', () => {
  let service: ExternalLedgerEventService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExternalLedgerEventService],
    }).compile();

    service = module.get<ExternalLedgerEventService>(ExternalLedgerEventService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processEvent', () => {
    const validEvent: ExternalLedgerEventDto = {
      type: ExternalLedgerEventType.TRANSACTION_CREATED,
      source: ExternalLedgerSource.ETHEREUM,
      eventId: 'evt_123456789',
      timestamp: new Date().toISOString(),
      blockNumber: 12345678,
      transaction: {
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        from: '0x1234567890abcdef1234567890abcdef12345678',
        to: '0x1234567890abcdef1234567890abcdef12345678',
        value: 1000000000000000000,
        nonce: 42,
        gasPrice: 20000000000,
        gas: 21000,
      },
    };

    it('should process a valid event successfully', async () => {
      const result = await service.processEvent(validEvent);
      expect(result.success).toBe(true);
      expect(result.eventId).toBe(validEvent.eventId);
    });

    it('should throw BadRequestException for invalid event', async () => {
      const invalidEvent = {
        ...validEvent,
        transaction: {
          ...validEvent.transaction,
          hash: 'invalid_hash',
        },
      };

      await expect(service.processEvent(invalidEvent as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for missing required fields', async () => {
      const incompleteEvent = {
        type: validEvent.type,
        // Missing required fields
      };

      await expect(service.processEvent(incompleteEvent as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for future timestamp', async () => {
      const futureEvent = {
        ...validEvent,
        timestamp: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes in future
      };

      await expect(service.processEvent(futureEvent)).rejects.toThrow(BadRequestException);
    });
  });

  describe('processEventBatch', () => {
    const validEvents: ExternalLedgerEventDto[] = [
      {
        type: ExternalLedgerEventType.TRANSACTION_CREATED,
        source: ExternalLedgerSource.ETHEREUM,
        eventId: 'evt_123456789',
        timestamp: new Date().toISOString(),
        blockNumber: 12345678,
        transaction: {
          hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          from: '0x1234567890abcdef1234567890abcdef12345678',
          to: '0x1234567890abcdef1234567890abcdef12345678',
          value: 1000000000000000000,
          nonce: 42,
        },
      },
      {
        type: ExternalLedgerEventType.BLOCK_CREATED,
        source: ExternalLedgerSource.ETHEREUM,
        eventId: 'evt_123456790',
        timestamp: new Date().toISOString(),
        blockNumber: 12345679,
        block: {
          number: 12345679,
          hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          parentHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          timestamp: new Date().toISOString(),
          gasLimit: 15000000,
          gasUsed: 12345678,
          miner: '0x1234567890abcdef1234567890abcdef12345678',
        },
      },
    ];

    const validBatch: ExternalLedgerEventBatchDto = {
      events: validEvents,
      batchId: 'batch_123456789',
      totalCount: validEvents.length,
      createdAt: new Date().toISOString(),
    };

    it('should process a valid batch successfully', async () => {
      const result = await service.processEventBatch(validBatch);
      expect(result.success).toBe(true);
      expect(result.batchId).toBe(validBatch.batchId);
      expect(result.processedCount).toBe(validBatch.totalCount);
      expect(result.errors).toBeUndefined();
    });

    it('should throw BadRequestException for invalid batch', async () => {
      const invalidBatch = {
        ...validBatch,
        events: [
          ...validEvents,
          {
            ...validEvents[0],
            transaction: {
              ...validEvents[0].transaction,
              hash: 'invalid_hash',
            },
          },
        ],
        totalCount: 3,
      };

      await expect(service.processEventBatch(invalidBatch as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for mismatched total count', async () => {
      const invalidBatch = {
        ...validBatch,
        totalCount: 5, // Mismatch with actual events count
      };

      await expect(service.processEventBatch(invalidBatch)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate event IDs', async () => {
      const duplicateBatch = {
        ...validBatch,
        events: [
          validEvents[0],
          validEvents[0], // Duplicate
        ],
        totalCount: 2,
      };

      await expect(service.processEventBatch(duplicateBatch)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for oversized batch', async () => {
      const oversizedEvents = Array(1001).fill(validEvents[0]);
      const oversizedBatch = {
        events: oversizedEvents,
        batchId: 'batch_oversized',
        totalCount: 1001,
        createdAt: new Date().toISOString(),
      };

      await expect(service.processEventBatch(oversizedBatch)).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateEvent', () => {
    const validEvent: ExternalLedgerEventDto = {
      type: ExternalLedgerEventType.TRANSACTION_CREATED,
      source: ExternalLedgerSource.ETHEREUM,
      eventId: 'evt_123456789',
      timestamp: new Date().toISOString(),
      blockNumber: 12345678,
      transaction: {
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        from: '0x1234567890abcdef1234567890abcdef12345678',
        to: '0x1234567890abcdef1234567890abcdef12345678',
        value: 1000000000000000000,
        nonce: 42,
      },
    };

    it('should validate a correct event', () => {
      const result = service.validateEvent(validEvent);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject event with invalid hash format', () => {
      const invalidEvent = {
        ...validEvent,
        transaction: {
          ...validEvent.transaction,
          hash: 'invalid_hash',
        },
      };

      const result = service.validateEvent(invalidEvent as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid transaction hash format');
    });

    it('should reject event with invalid address format', () => {
      const invalidEvent = {
        ...validEvent,
        transaction: {
          ...validEvent.transaction,
          from: 'invalid_address',
        },
      };

      const result = service.validateEvent(invalidEvent as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid from address format');
    });

    it('should reject event with negative value', () => {
      const invalidEvent = {
        ...validEvent,
        transaction: {
          ...validEvent.transaction,
          value: -1,
        },
      };

      const result = service.validateEvent(invalidEvent as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid transaction value');
    });
  });

  describe('validateEventBatch', () => {
    const validEvents: ExternalLedgerEventDto[] = [
      {
        type: ExternalLedgerEventType.TRANSACTION_CREATED,
        source: ExternalLedgerSource.ETHEREUM,
        eventId: 'evt_123456789',
        timestamp: new Date().toISOString(),
        transaction: {
          hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          from: '0x1234567890abcdef1234567890abcdef12345678',
          to: '0x1234567890abcdef1234567890abcdef12345678',
          value: 1000000000000000000,
          nonce: 42,
        },
      },
    ];

    const validBatch: ExternalLedgerEventBatchDto = {
      events: validEvents,
      batchId: 'batch_123456789',
      totalCount: validEvents.length,
      createdAt: new Date().toISOString(),
    };

    it('should validate a correct batch', () => {
      const result = service.validateEventBatch(validBatch);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty batch', () => {
      const emptyBatch = {
        events: [],
        batchId: 'batch_empty',
        totalCount: 0,
        createdAt: new Date().toISOString(),
      };

      const result = service.validateEventBatch(emptyBatch);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Batch cannot be empty');
    });

    it('should reject batch with invalid batch ID format', () => {
      const invalidBatch = {
        ...validBatch,
        batchId: 'invalid@batch#id',
      };

      const result = service.validateEventBatch(invalidBatch);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid batch ID format');
    });
  });
});
