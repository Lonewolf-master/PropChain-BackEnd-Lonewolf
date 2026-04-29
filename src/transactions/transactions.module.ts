import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { DisputesService } from './disputes.service';
import { TransactionsController } from './transactions.controller';
import { DisputesController } from './disputes.controller';
import { PrismaModule } from '../database/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [TransactionsController, DisputesController],
  providers: [TransactionsService, DisputesService],
  exports: [TransactionsService, DisputesService],
})
export class TransactionsModule {}
