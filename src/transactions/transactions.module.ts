import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { DisputesService } from './disputes.service';
import { TimelineService } from './timeline.service';
import { DisputesController } from './disputes.controller';
import { TimelineController } from './timeline.controller';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [TransactionsController, DisputesController, TimelineController],
  providers: [TransactionsService, DisputesService, TimelineService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
