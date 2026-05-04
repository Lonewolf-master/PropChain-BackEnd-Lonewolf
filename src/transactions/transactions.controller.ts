import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUserPayload } from '../auth/types/auth-user.type';
import { UserRole } from '../types/prisma.types';
import { TransactionsService } from './transactions.service';
import { TransactionHistoryQueryDto } from './dto/transactions.dto';

@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('me')
  getMyTransactions(
    @CurrentUser() user: AuthUserPayload,
    @Query() query: TransactionHistoryQueryDto,
  ) {
    return this.transactionsService.getTransactions(query, user.sub);
  }

  @Get('property/:propertyId')
  getPropertyTransactions(
    @Param('propertyId') propertyId: string,
    @Query() query: TransactionHistoryQueryDto,
  ) {
    // Note: In a real scenario, we might want to check if the user has access to this property's history
    // For now, we allow authenticated users to see property history as requested.
    const propertyQuery = { ...query, propertyId };
    return this.transactionsService.getTransactions(propertyQuery);
  }

  @Roles(UserRole.ADMIN)
  @Get()
  getAllTransactions(@Query() query: TransactionHistoryQueryDto) {
    return this.transactionsService.getTransactions(query);
  }

  @Get(':id')
  async getTransactionDetails(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const isAdmin = user.role === UserRole.ADMIN;
    const transaction = await this.transactionsService.getTransactionById(id, user.sub, isAdmin);

    if (!transaction) {
      throw new NotFoundException('Transaction not found or access denied');
    }

    return transaction;
  }
}
