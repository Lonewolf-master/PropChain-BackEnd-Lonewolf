import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { SearchModule } from './search/search.module';
import { AuditController } from './audit/audit.controller';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env.development', '.env'],
      cache: true,
      expandVariables: true,
    }),
    PrismaModule,
    HealthModule,
    SearchModule,
    AuditModule,
  ],
  controllers: [AuditController],
})
export class AppCiModule {}
