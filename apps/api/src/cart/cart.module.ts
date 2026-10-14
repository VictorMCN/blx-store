import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
  ],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
