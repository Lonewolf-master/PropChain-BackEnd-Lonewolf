import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { DisputesService } from './disputes.service';
import { TimelineService } from './timeline.service';
import { TransactionsController } from './transactions.controller';
import { DisputesController } from './disputes.controller';
import { TimelineController } from './timeline.controller';
import { PrismaModule } from '../database/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [TransactionsController, DisputesController, TimelineController],
  providers: [TransactionsService, DisputesService, TimelineService],
  exports: [TransactionsService, DisputesService, TimelineService],
})
export class TransactionsModule {}
