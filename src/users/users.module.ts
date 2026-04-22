import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AvatarUploadController } from './avatar-upload.controller';
import { AvatarUploadService } from './avatar-upload.service';
import { ScheduledDeletionService } from './scheduled-deletion.service';
import { PrismaModule } from '../database/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule, ScheduleModule.forRoot()],
  controllers: [UsersController, AvatarUploadController],
  providers: [UsersService, AvatarUploadService, ScheduledDeletionService],
  exports: [UsersService, AvatarUploadService, ScheduledDeletionService],
})
export class UsersModule {}
