import { Controller, Post, Body, HttpCode, HttpStatus, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ExternalLedgerEventDto, ExternalLedgerEventBatchDto } from '../dto/external-ledger-event.dto';
import { ExternalLedgerEventService } from '../services/external-ledger-event.service';

@ApiTags('external-ledger-events')
@Controller('external-ledger-events')
export class ExternalLedgerEventController {
  constructor(private readonly externalLedgerEventService: ExternalLedgerEventService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process a single external ledger event' })
  @ApiBody({ type: ExternalLedgerEventDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Event processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        eventId: { type: 'string' }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid event payload',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        errors: { type: 'array', items: { type: 'string' } },
        eventId: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async processEvent(
    @Body(new ValidationPipe({ 
      whitelist: true, 
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true 
    })) 
    event: ExternalLedgerEventDto
  ) {
    return this.externalLedgerEventService.processEvent(event);
  }

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process a batch of external ledger events' })
  @ApiBody({ type: ExternalLedgerEventBatchDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Batch processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        batchId: { type: 'string' },
        processedCount: { type: 'number' },
        errors: { type: 'array', items: { type: 'string' } }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid batch payload',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        errors: { type: 'array', items: { type: 'string' } },
        batchId: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async processEventBatch(
    @Body(new ValidationPipe({ 
      whitelist: true, 
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true 
    })) 
    batch: ExternalLedgerEventBatchDto
  ) {
    return this.externalLedgerEventService.processEventBatch(batch);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a single external ledger event without processing' })
  @ApiBody({ type: ExternalLedgerEventDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Event validation result',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        errors: { type: 'array', items: { type: 'string' } }
      }
    }
  })
  async validateEvent(
    @Body(new ValidationPipe({ 
      whitelist: true, 
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true 
    })) 
    event: ExternalLedgerEventDto
  ) {
    return this.externalLedgerEventService.validateEvent(event);
  }

  @Post('batch/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a batch of external ledger events without processing' })
  @ApiBody({ type: ExternalLedgerEventBatchDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Batch validation result',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        errors: { type: 'array', items: { type: 'string' } }
      }
    }
  })
  async validateEventBatch(
    @Body(new ValidationPipe({ 
      whitelist: true, 
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true 
    })) 
    batch: ExternalLedgerEventBatchDto
  ) {
    return this.externalLedgerEventService.validateEventBatch(batch);
  }
}
