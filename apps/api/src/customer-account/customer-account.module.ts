import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { CustomerAccountController } from './customer-account.controller.js';
import { CustomerAccountService } from './customer-account.service.js';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
  ],
  controllers: [
    CustomerAccountController,
  ],
  providers: [
    CustomerAccountService,
  ],
})
export class CustomerAccountModule {}
