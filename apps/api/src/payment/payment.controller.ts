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
import { EmailService } from '../notification/email.service.js';
import { PaymentService } from './payment.service.js';

@Controller('orders')
@UseGuards(AuthGuard)
export class PaymentController {
  constructor(
    private readonly paymentService:
      PaymentService,
    private readonly emailService:
      EmailService,
  ) {}

  @Post(':orderId/payment')
  async createPaymentIntent(
    @CurrentUser()
    user: AuthenticatedUser,
    @Param(
      'orderId',
      new ParseUUIDPipe(),
    )
    orderId: string,
  ) {
    const result =
      await this.paymentService.createPaymentIntent(
        user.id,
        orderId,
      );

    if (
      result.payment.status ===
      'SUCCEEDED'
    ) {
      await this.emailService.sendOrderConfirmed(
        orderId,
      );
    }

    return result;
  }
}
