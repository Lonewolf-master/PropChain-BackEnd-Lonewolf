import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../database/prisma.module';
import { FraudModule } from '../fraud/fraud.module';
import { BackupModule } from '../backup/backup.module';

@Module({
  imports: [PrismaModule, FraudModule, BackupModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
