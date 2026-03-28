import { ExternalLedgerEventValidator } from '../validators/external-ledger-event.validator';
import { ExternalLedgerEventDto, ExternalLedgerEventBatchDto, ExternalLedgerEventType, ExternalLedgerSource } from '../dto/external-ledger-event.dto';

describe('ExternalLedgerEventValidator', () => {
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
        gasPrice: 20000000000,
        gas: 21000,
      },
    };

    it('should validate a correct event', () => {
      const result = ExternalLedgerEventValidator.validateEvent(validEvent);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject event with missing required fields', () => {
      const incompleteEvent = {
        type: validEvent.type,
        // Missing source, eventId, timestamp
      };

      const result = ExternalLedgerEventValidator.validateEvent(incompleteEvent as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required fields: type, source, eventId, timestamp');
    });

    it('should reject event with invalid timestamp format', () => {
      const invalidEvent = {
        ...validEvent,
        timestamp: 'invalid-timestamp',
      };

      const result = ExternalLedgerEventValidator.validateEvent(invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid timestamp format');
    });

    it('should reject event with future timestamp', () => {
      const futureEvent = {
        ...validEvent,
        timestamp: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes in future
      };

      const result = ExternalLedgerEventValidator.validateEvent(futureEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Event timestamp is too far in the future');
    });

    it('should reject event with past timestamp', () => {
      const pastEvent = {
        ...validEvent,
        timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours in past
      };

      const result = ExternalLedgerEventValidator.validateEvent(pastEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Event timestamp is too far in the past');
    });

    it('should reject event with invalid event ID format', () => {
      const invalidEvent = {
        ...validEvent,
        eventId: 'invalid@event#id',
      };

      const result = ExternalLedgerEventValidator.validateEvent(invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid event ID format');
    });

    it('should reject event with invalid block number', () => {
      const invalidEvent = {
        ...validEvent,
        blockNumber: -1,
      };

      const result = ExternalLedgerEventValidator.validateEvent(invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid block number range');
    });

    it('should reject transaction event without transaction data', () => {
      const invalidEvent = {
        ...validEvent,
        transaction: undefined,
      };

      const result = ExternalLedgerEventValidator.validateEvent(invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Transaction data required for transaction events');
    });

    it('should reject block event without block data', () => {
      const blockEvent = {
        ...validEvent,
        type: ExternalLedgerEventType.BLOCK_CREATED,
        block: undefined,
      };

      const result = ExternalLedgerEventValidator.validateEvent(blockEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Block data required for block events');
    });

    it('should reject smart contract event without event data', () => {
      const contractEvent = {
        ...validEvent,
        type: ExternalLedgerEventType.SMART_CONTRACT_EVENT,
        smartContractEvent: undefined,
      };

      const result = ExternalLedgerEventValidator.validateEvent(contractEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Smart contract event data required for smart contract events');
    });

    it('should reject event with invalid signature format', () => {
      const invalidEvent = {
        ...validEvent,
        signature: 'invalid-signature',
      };

      const result = ExternalLedgerEventValidator.validateEvent(invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid signature format');
    });

    it('should reject event with oversized metadata', () => {
      const largeMetadata = { data: 'x'.repeat(10241) }; // > 10KB
      const invalidEvent = {
        ...validEvent,
        metadata: largeMetadata,
      };

      const result = ExternalLedgerEventValidator.validateEvent(invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Metadata size exceeds maximum limit of 10KB');
    });
  });

  describe('validateBatch', () => {
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
      {
        type: ExternalLedgerEventType.BLOCK_CREATED,
        source: ExternalLedgerSource.ETHEREUM,
        eventId: 'evt_123456790',
        timestamp: new Date().toISOString(),
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

    it('should validate a correct batch', () => {
      const result = ExternalLedgerEventValidator.validateBatch(validBatch);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject batch with non-array events', () => {
      const invalidBatch = {
        ...validBatch,
        events: 'not-an-array',
      };

      const result = ExternalLedgerEventValidator.validateBatch(invalidBatch as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Events must be an array');
    });

    it('should reject empty batch', () => {
      const emptyBatch = {
        events: [],
        batchId: 'batch_empty',
        totalCount: 0,
        createdAt: new Date().toISOString(),
      };

      const result = ExternalLedgerEventValidator.validateBatch(emptyBatch);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Batch cannot be empty');
    });

    it('should reject batch with mismatched total count', () => {
      const invalidBatch = {
        ...validBatch,
        totalCount: 5, // Mismatch with actual events count
      };

      const result = ExternalLedgerEventValidator.validateBatch(invalidBatch);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Batch total count does not match actual event count');
    });

    it('should reject oversized batch', () => {
      const oversizedEvents = Array(1001).fill(validEvents[0]);
      const oversizedBatch = {
        events: oversizedEvents,
        batchId: 'batch_oversized',
        totalCount: 1001,
        createdAt: new Date().toISOString(),
      };

      const result = ExternalLedgerEventValidator.validateBatch(oversizedBatch);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Batch size exceeds maximum limit of 1000 events');
    });

    it('should reject batch with invalid batch ID format', () => {
      const invalidBatch = {
        ...validBatch,
        batchId: 'invalid@batch#id',
      };

      const result = ExternalLedgerEventValidator.validateBatch(invalidBatch);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid batch ID format');
    });

    it('should reject batch with invalid timestamp format', () => {
      const invalidBatch = {
        ...validBatch,
        createdAt: 'invalid-timestamp',
      };

      const result = ExternalLedgerEventValidator.validateBatch(invalidBatch);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid batch timestamp format');
    });

    it('should reject batch with future timestamp', () => {
      const futureBatch = {
        ...validBatch,
        createdAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes in future
      };

      const result = ExternalLedgerEventValidator.validateBatch(futureBatch);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Batch timestamp is too far in the future');
    });

    it('should reject batch with past timestamp', () => {
      const pastBatch = {
        ...validBatch,
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours in past
      };

      const result = ExternalLedgerEventValidator.validateBatch(pastBatch);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Batch timestamp is too far in the past');
    });

    it('should reject batch with duplicate event IDs', () => {
      const duplicateBatch = {
        events: [
          validEvents[0],
          validEvents[0], // Duplicate
        ],
        batchId: 'batch_duplicate',
        totalCount: 2,
        createdAt: new Date().toISOString(),
      };

      const result = ExternalLedgerEventValidator.validateBatch(duplicateBatch);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate event IDs found in batch: evt_123456789');
    });

    it('should reject batch with invalid events', () => {
      const invalidEventsBatch = {
        events: [
          validEvents[0],
          {
            ...validEvents[0],
            transaction: {
              ...validEvents[0].transaction,
              hash: 'invalid_hash',
            },
          },
        ],
        batchId: 'batch_invalid_events',
        totalCount: 2,
        createdAt: new Date().toISOString(),
      };

      const result = ExternalLedgerEventValidator.validateBatch(invalidEventsBatch);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Invalid transaction hash format'))).toBe(true);
    });
  });
});
