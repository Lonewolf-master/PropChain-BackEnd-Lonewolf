import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUserPayload } from '../auth/types/auth-user.type';
import { TransactionSearchQueryDto } from './dto/transaction-search.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search transactions with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Transaction search results returned successfully' })
  search(@Query() query: TransactionSearchQueryDto, @CurrentUser() user: AuthUserPayload) {
    return this.transactionsService.search(query, user);
  }
}
