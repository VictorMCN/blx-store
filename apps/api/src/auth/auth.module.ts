import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module.js';
import { AdminGuard } from './admin.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthEmailService } from './auth-email.service.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [
    PrismaModule,
  ],

  controllers: [
    AuthController,
  ],

  providers: [
    AuthService,
    AuthEmailService,
    AuthGuard,
    AdminGuard,
  ],

  exports: [
    AuthService,
    AuthGuard,
    AdminGuard,
  ],
})
export class AuthModule {}
