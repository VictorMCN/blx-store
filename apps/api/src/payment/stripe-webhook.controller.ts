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
import { recordPaymentMetric } from '../observability/payment-metrics.service.js';
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
      recordPaymentMetric('webhookRejected');

      throw new BadRequestException(
        'Missing Stripe signature.',
      );
    }

    if (!request.rawBody) {
      recordPaymentMetric('webhookRejected');

      throw new BadRequestException(
        'Raw request body is required.',
      );
    }

    let event: Stripe.Event;

    try {
      event =
        this.stripeService.constructWebhookEvent(
          request.rawBody,
          signature,
        );
    } catch (error) {
      recordPaymentMetric('webhookRejected');
      throw error;
    }

    try {
      await this.paymentService.handleStripeWebhook(
        event,
      );

      if (
        event.type ===
        'payment_intent.succeeded'
      ) {
        const paymentIntent =
          event.data.object as Stripe.PaymentIntent;

        await this.emailService.sendOrderConfirmedForPaymentIntent(
          paymentIntent.id,
        );
      }
    } catch (error) {
      recordPaymentMetric('webhookProcessingFailed');
      throw error;
    }

    recordPaymentMetric('webhookAccepted');

    // These count successfully handled Stripe event deliveries.
    // They do not represent unique payment state transitions.
    switch (event.type) {
      case 'payment_intent.succeeded':
        recordPaymentMetric('paymentSucceeded');
        break;

      case 'payment_intent.payment_failed':
        recordPaymentMetric('paymentFailed');
        break;

      case 'payment_intent.canceled':
        recordPaymentMetric('paymentCanceled');
        break;

      default:
        break;
    }

    return {
      received: true,
    };
  }
}
