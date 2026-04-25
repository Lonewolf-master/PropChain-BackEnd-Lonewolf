import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailWebhookController } from './email-webhook.controller';
import { PrismaModule } from '../database/prisma.module';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
  imports: [PrismaModule, TrackingModule],
  controllers: [EmailWebhookController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
