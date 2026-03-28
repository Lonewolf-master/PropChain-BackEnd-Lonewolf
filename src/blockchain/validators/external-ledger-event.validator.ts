import { ExternalLedgerEventDto, ExternalLedgerEventBatchDto } from '../dto/external-ledger-event.dto';
import { Logger } from '@nestjs/common';

export class ExternalLedgerEventValidator {
  private static readonly logger = new Logger(ExternalLedgerEventValidator.name);

  /**
   * Validates a single external ledger event with enhanced security checks
   */
  static validateEvent(event: ExternalLedgerEventDto): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic structure validation (handled by class-validator)
    if (!event.type || !event.source || !event.eventId || !event.timestamp) {
      errors.push('Missing required fields: type, source, eventId, timestamp');
    }

    // Timestamp validation
    if (event.timestamp) {
      const eventTime = new Date(event.timestamp);
      const now = new Date();
      const maxFutureTime = 5 * 60 * 1000; // 5 minutes
      const maxPastTime = 24 * 60 * 60 * 1000; // 24 hours

      if (isNaN(eventTime.getTime())) {
        errors.push('Invalid timestamp format');
      } else if (eventTime.getTime() > now.getTime() + maxFutureTime) {
        errors.push('Event timestamp is too far in the future');
      } else if (eventTime.getTime() < now.getTime() - maxPastTime) {
        errors.push('Event timestamp is too far in the past');
      }
    }

    // Event ID format validation
    if (event.eventId && !/^[a-zA-Z0-9_-]{1,100}$/.test(event.eventId)) {
      errors.push('Invalid event ID format');
    }

    // Block number validation
    if (event.blockNumber !== undefined) {
      if (event.blockNumber < 0 || event.blockNumber > Number.MAX_SAFE_INTEGER) {
        errors.push('Invalid block number range');
      }
    }

    // Type-specific validations
    switch (event.type) {
      case 'transaction_created':
      case 'transaction_updated':
        if (!event.transaction) {
          errors.push('Transaction data required for transaction events');
        } else {
          errors.push(...this.validateTransactionData(event.transaction));
        }
        break;

      case 'block_created':
        if (!event.block) {
          errors.push('Block data required for block events');
        } else {
          errors.push(...this.validateBlockData(event.block));
        }
        break;

      case 'smart_contract_event':
        if (!event.smartContractEvent) {
          errors.push('Smart contract event data required for smart contract events');
        } else {
          errors.push(...this.validateSmartContractEventData(event.smartContractEvent));
        }
        break;
    }

    // Signature validation if present
    if (event.signature) {
      if (!/^[a-fA-F0-9]{128,512}$/.test(event.signature)) {
        errors.push('Invalid signature format');
      }
    }

    // Metadata validation
    if (event.metadata) {
      errors.push(...this.validateMetadata(event.metadata));
    }

    const isValid = errors.length === 0;

    if (!isValid) {
      this.logger.warn(`Event validation failed for event ${event.eventId}: ${errors.join(', ')}`);
    }

    return { isValid, errors };
  }

  /**
   * Validates a batch of external ledger events
   */
  static validateBatch(batch: ExternalLedgerEventBatchDto): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic batch validation
    if (!batch.events || !Array.isArray(batch.events)) {
      errors.push('Events must be an array');
      return { isValid: false, errors };
    }

    if (batch.events.length === 0) {
      errors.push('Batch cannot be empty');
      return { isValid: false, errors };
    }

    if (batch.events.length !== batch.totalCount) {
      errors.push('Batch total count does not match actual event count');
    }

    if (batch.events.length > 1000) {
      errors.push('Batch size exceeds maximum limit of 1000 events');
    }

    // Batch ID validation
    if (!batch.batchId || !/^[a-zA-Z0-9_-]{1,100}$/.test(batch.batchId)) {
      errors.push('Invalid batch ID format');
    }

    // Batch timestamp validation
    if (batch.createdAt) {
      const batchTime = new Date(batch.createdAt);
      const now = new Date();
      const maxFutureTime = 5 * 60 * 1000; // 5 minutes
      const maxPastTime = 24 * 60 * 60 * 1000; // 24 hours

      if (isNaN(batchTime.getTime())) {
        errors.push('Invalid batch timestamp format');
      } else if (batchTime.getTime() > now.getTime() + maxFutureTime) {
        errors.push('Batch timestamp is too far in the future');
      } else if (batchTime.getTime() < now.getTime() - maxPastTime) {
        errors.push('Batch timestamp is too far in the past');
      }
    }

    // Validate each event in the batch
    const eventValidationErrors: string[] = [];
    batch.events.forEach((event, index) => {
      const eventValidation = this.validateEvent(event);
      if (!eventValidation.isValid) {
        eventValidationErrors.push(`Event ${index} (${event.eventId}): ${eventValidation.errors.join(', ')}`);
      }
    });

    if (eventValidationErrors.length > 0) {
      errors.push(...eventValidationErrors);
    }

    // Check for duplicate event IDs within batch
    const eventIds = batch.events.map(e => e.eventId);
    const duplicateIds = eventIds.filter((id, index) => eventIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate event IDs found in batch: ${duplicateIds.join(', ')}`);
    }

    const isValid = errors.length === 0;

    if (!isValid) {
      this.logger.warn(`Batch validation failed for batch ${batch.batchId}: ${errors.join(', ')}`);
    }

    return { isValid, errors };
  }

  /**
   * Validates transaction data
   */
  private static validateTransactionData(transaction: any): string[] {
    const errors: string[] = [];

    // Hash validation
    if (!transaction.hash || !/^0x[a-fA-F0-9]{64}$/.test(transaction.hash)) {
      errors.push('Invalid transaction hash format');
    }

    // Address validation
    if (!transaction.from || !/^0x[a-fA-F0-9]{40}$/.test(transaction.from)) {
      errors.push('Invalid from address format');
    }

    if (!transaction.to || !/^0x[a-fA-F0-9]{40}$/.test(transaction.to)) {
      errors.push('Invalid to address format');
    }

    // Value validation
    if (transaction.value === undefined || transaction.value < 0 || transaction.value > Number.MAX_SAFE_INTEGER) {
      errors.push('Invalid transaction value');
    }

    // Nonce validation
    if (transaction.nonce === undefined || transaction.nonce < 0 || transaction.nonce > Number.MAX_SAFE_INTEGER) {
      errors.push('Invalid transaction nonce');
    }

    // Gas validation
    if (transaction.gasPrice !== undefined && (transaction.gasPrice < 0 || transaction.gasPrice > Number.MAX_SAFE_INTEGER)) {
      errors.push('Invalid gas price');
    }

    if (transaction.gas !== undefined && (transaction.gas < 0 || transaction.gas > Number.MAX_SAFE_INTEGER)) {
      errors.push('Invalid gas limit');
    }

    // Data validation
    if (transaction.data && !/^0x([0-9a-fA-F]*)$/.test(transaction.data)) {
      errors.push('Invalid transaction data format');
    }

    return errors;
  }

  /**
   * Validates block data
   */
  private static validateBlockData(block: any): string[] {
    const errors: string[] = [];

    // Block number validation
    if (block.number === undefined || block.number < 0 || block.number > Number.MAX_SAFE_INTEGER) {
      errors.push('Invalid block number');
    }

    // Hash validation
    if (!block.hash || !/^0x[a-fA-F0-9]{64}$/.test(block.hash)) {
      errors.push('Invalid block hash format');
    }

    // Parent hash validation
    if (!block.parentHash || !/^0x[a-fA-F0-9]{64}$/.test(block.parentHash)) {
      errors.push('Invalid parent hash format');
    }

    // Miner address validation
    if (!block.miner || !/^0x[a-fA-F0-9]{40}$/.test(block.miner)) {
      errors.push('Invalid miner address format');
    }

    // Gas validation
    if (block.gasLimit === undefined || block.gasLimit < 0 || block.gasLimit > Number.MAX_SAFE_INTEGER) {
      errors.push('Invalid gas limit');
    }

    if (block.gasUsed === undefined || block.gasUsed < 0 || block.gasUsed > Number.MAX_SAFE_INTEGER) {
      errors.push('Invalid gas used');
    }

    if (block.gasUsed > block.gasLimit) {
      errors.push('Gas used cannot exceed gas limit');
    }

    // Timestamp validation
    if (!block.timestamp) {
      errors.push('Block timestamp is required');
    } else {
      const blockTime = new Date(block.timestamp);
      if (isNaN(blockTime.getTime())) {
        errors.push('Invalid block timestamp format');
      }
    }

    return errors;
  }

  /**
   * Validates smart contract event data
   */
  private static validateSmartContractEventData(eventData: any): string[] {
    const errors: string[] = [];

    // Contract address validation
    if (!eventData.contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(eventData.contractAddress)) {
      errors.push('Invalid contract address format');
    }

    // Event name validation
    if (!eventData.eventName || typeof eventData.eventName !== 'string' || eventData.eventName.length > 100) {
      errors.push('Invalid event name');
    }

    // Event signature validation
    if (!eventData.eventSignature || !/^0x[a-fA-F0-9]{64}$/.test(eventData.eventSignature)) {
      errors.push('Invalid event signature format');
    }

    // Log index validation
    if (eventData.logIndex !== undefined && (eventData.logIndex < 0 || eventData.logIndex > Number.MAX_SAFE_INTEGER)) {
      errors.push('Invalid log index');
    }

    return errors;
  }

  /**
   * Validates metadata object
   */
  private static validateMetadata(metadata: Record<string, unknown>): string[] {
    const errors: string[] = [];

    if (typeof metadata !== 'object' || metadata === null) {
      errors.push('Metadata must be an object');
      return errors;
    }

    // Size validation
    const metadataSize = JSON.stringify(metadata).length;
    if (metadataSize > 10240) { // 10KB limit
      errors.push('Metadata size exceeds maximum limit of 10KB');
    }

    // Key validation
    for (const [key, value] of Object.entries(metadata)) {
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(key)) {
        errors.push(`Invalid metadata key format: ${key}`);
      }

      // Value type validation
      if (value !== null && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        errors.push(`Invalid metadata value type for key: ${key}`);
      }

      // String value length validation
      if (typeof value === 'string' && value.length > 1000) {
        errors.push(`Metadata string value too long for key: ${key}`);
      }
    }

    return errors;
  }
}
