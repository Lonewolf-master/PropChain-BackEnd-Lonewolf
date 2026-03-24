import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiKeyService } from './api-key.service';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyAnalyticsService } from './api-key-analytics.service';
import { ApiKeyRotationScheduler } from './api-key-rotation.scheduler';
import { PrismaModule } from '../database/prisma/prisma.module';
import { PaginationService } from '../common/pagination';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [ApiKeyController],
  providers: [ApiKeyService, ApiKeyAnalyticsService, ApiKeyRotationScheduler, PaginationService],
  exports: [ApiKeyService, ApiKeyAnalyticsService],
})
export class ApiKeysModule {}
