import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WithdrawalsService } from './withdrawals.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { UpdateWithdrawalStatusDto } from './dto/update-withdrawal-status.dto';
import { GetWithdrawalsDto } from './dto/get-withdrawals.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('withdrawals')
@ApiBearerAuth()
@Controller('withdrawals')
@UseGuards(JwtAuthGuard)
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Post('request')
  @UseGuards(RbacGuard)
  @Roles('withdrawals', 'create')
  async requestWithdrawal(@Request() req: any, @Body() payload: CreateWithdrawalDto) {
    return this.withdrawalsService.requestWithdrawal(req.user, payload);
  }

  @Post()
  async createWithdrawal(@Body() payload: CreateWithdrawalDto) {
    return this.withdrawalsService.createWithdrawal(payload);
  }

  @Get()
  async listWithdrawals(@Query() query: GetWithdrawalsDto) {
    return this.withdrawalsService.getWithdrawals(query);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() payload: UpdateWithdrawalStatusDto) {
    return this.withdrawalsService.updateWithdrawalStatus(id, payload);
  }
}
