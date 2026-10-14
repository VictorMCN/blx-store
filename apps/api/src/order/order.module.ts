import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { OrderController } from './order.controller.js';
import { OrderService } from './order.service.js';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
  ],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
