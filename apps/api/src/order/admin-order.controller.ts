import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { OrderProcessingService } from './order-processing.service.js';

@Controller('admin/orders')
@UseGuards(
  AuthGuard,
  AdminGuard,
)
export class AdminOrderController {
  constructor(
    private readonly orderProcessingService:
      OrderProcessingService,
  ) {}

  @Patch(':orderId/status')
  updateStatus(
    @Param(
      'orderId',
      new ParseUUIDPipe(),
    )
    orderId: string,
    @Body()
    dto: UpdateOrderStatusDto,
  ) {
    return this.orderProcessingService.updateStatus(
      orderId,
      dto.status,
    );
  }
}
