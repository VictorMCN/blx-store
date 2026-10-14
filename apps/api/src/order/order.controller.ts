import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderService } from './order.service.js';

@Controller('orders')
@UseGuards(AuthGuard)
export class OrderController {
  constructor(
    private readonly orderService:
      OrderService,
  ) {}

  @Post()
  createOrder(
    @CurrentUser()
    user: AuthenticatedUser,
    @Body()
    dto: CreateOrderDto,
  ) {
    return this.orderService.createOrder(
      user.id,
      dto,
    );
  }
}
