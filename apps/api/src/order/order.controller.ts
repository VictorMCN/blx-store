import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto.js';
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

  @Get()
  listOrders(
    @CurrentUser()
    user: AuthenticatedUser,
    @Query()
    query: ListOrdersQueryDto,
  ) {
    return this.orderService.listOrders(
      user.id,
      query,
    );
  }

  @Get(':orderId')
  getOrder(
    @CurrentUser()
    user: AuthenticatedUser,
    @Param(
      'orderId',
      new ParseUUIDPipe(),
    )
    orderId: string,
  ) {
    return this.orderService.getOrder(
      user.id,
      orderId,
    );
  }
}
