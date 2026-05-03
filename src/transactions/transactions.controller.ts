import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUserPayload } from '../auth/types/auth-user.type';
import { TransactionSearchQueryDto } from './dto/transaction-search.dto';
import {
  CreateTransactionDto,
  CreateTransactionTaxStrategyDto,
  UpdateTransactionTaxStrategyDto,
} from './dto/transaction.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'List all transactions for the current user' })
  findAll(@Query() query: TransactionSearchQueryDto, @CurrentUser() user: AuthUserPayload) {
    return this.transactionsService.search(query, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  @ApiOperation({ summary: 'Search transactions with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Transaction search results returned successfully' })
  search(@Query() query: TransactionSearchQueryDto, @CurrentUser() user: AuthUserPayload) {
    return this.transactionsService.search(query, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/history')
  @ApiOperation({ summary: 'Get transaction history audit log' })
  @ApiResponse({ status: 200, description: 'Transaction history returned successfully' })
  getHistory(@Param('id') transactionId: string, @CurrentUser() user: AuthUserPayload) {
    return this.transactionsService.getTransactionHistory(transactionId, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createTransactionDto: CreateTransactionDto, @CurrentUser() user: AuthUserPayload) {
    return this.transactionsService.createTransaction(createTransactionDto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/tax-strategies')
  listTaxStrategies(@Param('id') transactionId: string, @CurrentUser() user: AuthUserPayload) {
    return this.transactionsService.listTaxStrategies(transactionId, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/tax-strategies')
  createTaxStrategySuggestion(
    @Param('id') transactionId: string,
    @Body() createTaxStrategyDto: CreateTransactionTaxStrategyDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.transactionsService.createTaxStrategySuggestion(
      transactionId,
      createTaxStrategyDto,
      user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/tax-strategies/:strategyId')
  updateTaxStrategySuggestion(
    @Param('id') transactionId: string,
    @Param('strategyId') strategyId: string,
    @Body() updateTaxStrategyDto: UpdateTransactionTaxStrategyDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.transactionsService.updateTaxStrategySuggestion(
      transactionId,
      strategyId,
      updateTaxStrategyDto,
      user,
    );
  }
}
