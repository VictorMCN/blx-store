import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  type RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { EmailService } from '../notification/email.service.js';
import { PaymentService } from './payment.service.js';
import { StripeService } from './stripe.service.js';

@Controller('payments/stripe')
export class StripeWebhookController {
  constructor(
    private readonly stripeService:
      StripeService,
    private readonly paymentService:
      PaymentService,
    private readonly emailService:
      EmailService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req()
    request: RawBodyRequest<Request>,
    @Headers('stripe-signature')
    signature: string | undefined,
  ) {
    if (!signature) {
      throw new BadRequestException(
        'Missing Stripe signature.',
      );
    }

    if (!request.rawBody) {
      throw new BadRequestException(
        'Raw request body is required.',
      );
    }

    const event =
      this.stripeService.constructWebhookEvent(
        request.rawBody,
        signature,
      );

    await this.paymentService.handleStripeWebhook(
      event,
    );

    if (
      event.type ===
      'payment_intent.succeeded'
    ) {
      const paymentIntent =
        event.data
          .object as Stripe.PaymentIntent;

      await this.emailService.sendOrderConfirmedForPaymentIntent(
        paymentIntent.id,
      );
    }

    return {
      received: true,
    };
  }
}
