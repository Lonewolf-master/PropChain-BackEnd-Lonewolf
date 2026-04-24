import { Module } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { PrismaModule } from '../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PropertiesResolver } from './properties.resolver';
import { PubSub } from 'graphql-subscriptions';
import { SavedSearchService } from './saved-search.service';
import { SavedSearchAlertService } from './saved-search.service';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CacheModule.register(), // For search caching
    ScheduleModule.forRoot(), // For cron jobs (alert checking)
  ],
  controllers: [PropertiesController],
  providers: [
    PropertiesService,
    PropertiesResolver,
    SavedSearchService,
    SavedSearchAlertService,
    {
      provide: 'PUB_SUB',
      useValue: new PubSub(),
    },
  ],
  exports: [PropertiesService, SavedSearchService],
})
export class PropertiesModule {}
