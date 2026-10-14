import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

interface CreateStripePaymentIntentInput {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amountInCents: number;
  currency: string;
}

@Injectable()
export class StripeService {
  private stripe: Stripe | null = null;

  constructor(
    private readonly configService: ConfigService,
  ) {}

  async createPaymentIntent(
    input: CreateStripePaymentIntentInput,
  ) {
    const stripe = this.getClient();

    try {
      return await stripe.paymentIntents.create(
        {
          amount: input.amountInCents,
          currency:
            input.currency.toLowerCase(),
          automatic_payment_methods: {
            enabled: true,
          },
          description:
            `BLX Store order ${input.orderNumber}`,
          metadata: {
            paymentId: input.paymentId,
            orderId: input.orderId,
            orderNumber:
              input.orderNumber,
          },
        },
        {
          idempotencyKey:
            input.paymentId,
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        'Payment provider request failed.',
      );
    }
  }

  async retrievePaymentIntent(
    paymentIntentId: string,
  ) {
    const stripe = this.getClient();

    try {
      return await stripe.paymentIntents.retrieve(
        paymentIntentId,
      );
    } catch {
      throw new ServiceUnavailableException(
        'Payment provider request failed.',
      );
    }
  }

  private getClient(): Stripe {
    if (this.stripe) {
      return this.stripe;
    }

    const secretKey =
      this.configService.get<string>(
        'STRIPE_SECRET_KEY',
      );

    if (!secretKey) {
      throw new ServiceUnavailableException(
        'Stripe is not configured.',
      );
    }

    this.stripe = new Stripe(secretKey);

    return this.stripe;
  }
}
