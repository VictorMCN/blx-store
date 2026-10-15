import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { AdminOrderController } from './admin-order.controller.js';
import { OrderController } from './order.controller.js';
import { OrderProcessingService } from './order-processing.service.js';
import { OrderService } from './order.service.js';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
  ],
  controllers: [
    OrderController,
    AdminOrderController,
  ],
  providers: [
    OrderService,
    OrderProcessingService,
  ],
})
export class OrderModule {}
