import { Module } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsController } from './withdrawals.controller';
import { PrismaModule } from '../database/prisma/prisma.module';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [PrismaModule, CommunicationModule],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
})
export class WithdrawalsModule {}
