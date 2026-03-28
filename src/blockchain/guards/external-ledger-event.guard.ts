import { Injectable, CanActivate, ExecutionContext, BadRequestException, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ExternalLedgerEventDto, ExternalLedgerEventBatchDto } from '../dto/external-ledger-event.dto';
import { ExternalLedgerEventValidator } from '../validators/external-ledger-event.validator';

@Injectable()
export class ExternalLedgerEventGuard implements CanActivate {
  private readonly logger = new Logger(ExternalLedgerEventGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body;

    // Check if request body exists
    if (!body) {
      throw new BadRequestException('Request body is required');
    }

    // Determine if this is a single event or batch based on the route
    const route = request.route?.path;
    
    try {
      if (route?.includes('/batch')) {
        // Validate batch request
        const batch: ExternalLedgerEventBatchDto = body;
        const validation = ExternalLedgerEventValidator.validateBatch(batch);
        
        if (!validation.isValid) {
          this.logger.warn(`Batch validation failed: ${validation.errors.join(', ')}`);
          throw new BadRequestException({
            message: 'Batch validation failed',
            errors: validation.errors,
          });
        }
        
        this.logger.debug(`Batch validation passed for batch: ${batch.batchId}`);
      } else {
        // Validate single event request
        const event: ExternalLedgerEventDto = body;
        const validation = ExternalLedgerEventValidator.validateEvent(event);
        
        if (!validation.isValid) {
          this.logger.warn(`Event validation failed: ${validation.errors.join(', ')}`);
          throw new BadRequestException({
            message: 'Event validation failed',
            errors: validation.errors,
          });
        }
        
        this.logger.debug(`Event validation passed for event: ${event.eventId}`);
      }
      
      return true;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      this.logger.error('Unexpected error during validation:', error);
      throw new BadRequestException('Invalid request format');
    }
  }
}
