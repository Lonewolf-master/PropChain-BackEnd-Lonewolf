import { Module } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { PrismaModule } from '../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PropertiesResolver } from './properties.resolver';
import { PubSub } from 'graphql-subscriptions';
import { FraudModule } from '../fraud/fraud.module';
import { SavedSearchAlertService, SavedSearchService } from './saved-search.service';

@Module({
  imports: [PrismaModule, AuthModule, FraudModule],
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
