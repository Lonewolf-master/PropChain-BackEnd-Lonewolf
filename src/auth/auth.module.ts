import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginRateLimitService } from './login-rate-limit.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [PrismaModule, UsersModule, EmailModule],
  controllers: [AuthController],
  providers: [AuthService, LoginRateLimitService, JwtAuthGuard, ApiKeyAuthGuard, RolesGuard],
  exports: [AuthService, RolesGuard, LoginRateLimitService],
})
export class AuthModule {}
