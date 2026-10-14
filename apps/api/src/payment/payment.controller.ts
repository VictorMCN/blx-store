import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PaymentService } from './payment.service.js';

@Controller('orders')
@UseGuards(AuthGuard)
export class PaymentController {
  constructor(
    private readonly paymentService:
      PaymentService,
  ) {}

  @Post(':orderId/payment')
  createPaymentIntent(
    @CurrentUser()
    user: AuthenticatedUser,
    @Param(
      'orderId',
      new ParseUUIDPipe(),
    )
    orderId: string,
  ) {
    return this.paymentService.createPaymentIntent(
      user.id,
      orderId,
    );
  }
}
