import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../database/prisma.module';
import { UsersModule } from '../users/users.module';
import { SessionsModule } from '../sessions/sessions.module';
import { EmailModule } from '../email/email.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginRateLimitService } from './login-rate-limit.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';
import { GoogleStrategy } from './strategies/google.strategy';

@Module({
  imports: [PrismaModule, UsersModule, PassportModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, ApiKeyAuthGuard, GoogleStrategy],
  exports: [AuthService],
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [PrismaModule, UsersModule, SessionsModule, EmailModule],
  controllers: [AuthController],
  providers: [AuthService, LoginRateLimitService, JwtAuthGuard, ApiKeyAuthGuard, RolesGuard],
  exports: [AuthService, RolesGuard, LoginRateLimitService],
})
export class AuthModule {}
