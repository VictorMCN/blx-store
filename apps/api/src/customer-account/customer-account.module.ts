import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { CustomerAccountController } from './customer-account.controller.js';
import { CustomerAccountService } from './customer-account.service.js';
import { CustomerAddressController } from './customer-address.controller.js';
import { CustomerAddressService } from './customer-address.service.js';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
  ],
  controllers: [
    CustomerAccountController,
    CustomerAddressController,
  ],
  providers: [
    CustomerAccountService,
    CustomerAddressService,
  ],
})
export class CustomerAccountModule {}
