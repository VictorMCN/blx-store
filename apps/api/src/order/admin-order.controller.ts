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
import { SetFulfillmentStatusDto } from './dto/set-fulfillment-status.dto.js';
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

  @Patch(':orderId/fulfillment-status')
  setFulfillmentStatus(
    @Param(
      'orderId',
      new ParseUUIDPipe(),
    )
    orderId: string,
    @Body()
    dto: SetFulfillmentStatusDto,
  ) {
    return this.orderProcessingService.setFulfillmentStatus(
      orderId,
      dto.status,
    );
  }
}
