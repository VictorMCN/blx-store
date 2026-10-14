import {
  BadRequestException,
  type INestApplication,
} from '@nestjs/common';
import {
  Test,
  type TestingModule,
} from '@nestjs/testing';
import type Stripe from 'stripe';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { StripeService } from '../src/payment/stripe.service.js';

class FakeStripeWebhookService {
  lastRawBody: Buffer | null = null;
  lastSignature: string | null = null;

  constructWebhookEvent(
    rawBody: Buffer,
    signature: string,
  ): Stripe.Event {
    this.lastRawBody = rawBody;
    this.lastSignature = signature;

    if (signature !== 'valid-signature') {
      throw new BadRequestException(
        'Invalid Stripe webhook signature.',
      );
    }

    return JSON.parse(
      rawBody.toString('utf8'),
    ) as Stripe.Event;
  }

  reset() {
    this.lastRawBody = null;
    this.lastSignature = null;
  }
}

describe('Stripe payment webhook (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeStripe: FakeStripeWebhookService;

  let categoryId: string;
  let productId: string;

  const uniqueId = Date.now();

  const categorySlug =
    `payment-webhook-${uniqueId}`;

  const productSlug =
    `payment-webhook-product-${uniqueId}`;

  const productSku =
    `PAY-WEBHOOK-${uniqueId}`;

  function createEvent(
    type: string,
    paymentIntent: Partial<Stripe.PaymentIntent>,
  ): Stripe.Event {
    return {
      id:
        `evt_${uniqueId}_${Math.random()
          .toString(16)
          .slice(2)}`,
      object: 'event',
      created: Math.floor(
        Date.now() / 1000,
      ),
      type,
      data: {
        object: paymentIntent,
      },
    } as Stripe.Event;
  }

  function createPaymentIntent(
    options: {
      id: string;
      paymentId: string;
      orderId: string;
      amountInCents?: number;
      currency?: string;
      status?: Stripe.PaymentIntent.Status;
      failureCode?: string | null;
      failureMessage?: string | null;
      cancellationReason?:
        | Stripe.PaymentIntent.CancellationReason
        | null;
    },
  ): Stripe.PaymentIntent {
    return {
      id: options.id,
      object: 'payment_intent',
      amount:
        options.amountInCents ??
        100000,
      currency:
        options.currency ?? 'brl',
      status:
        options.status ??
        'requires_payment_method',
      metadata: {
        paymentId: options.paymentId,
        orderId: options.orderId,
      },
      last_payment_error:
        options.failureCode ||
        options.failureMessage
          ? ({
              code:
                options.failureCode ??
                undefined,
              message:
                options.failureMessage ??
                undefined,
            } as Stripe.PaymentIntent
              .LastPaymentError)
          : null,
      cancellation_reason:
        options.cancellationReason ??
        null,
    } as Stripe.PaymentIntent;
  }

  async function createScenario(
    options?: {
      paymentStatus?:
        | 'PENDING'
        | 'PROCESSING'
        | 'FAILED'
        | 'CANCELED'
        | 'SUCCEEDED';
      orderStatus?:
        | 'PENDING_PAYMENT'
        | 'PAID';
      quantity?: number;
    },
  ) {
    const quantity =
      options?.quantity ?? 2;

    const order =
      await prisma.order.create({
        data: {
          orderNumber:
            `BLX-WH-${uniqueId}-${Math.random()
              .toString(16)
              .slice(2, 8)
              .toUpperCase()}`,

          status:
            options?.orderStatus ??
            'PENDING_PAYMENT',

          currency: 'BRL',

          subtotalInCents:
            50000 * quantity,

          shippingInCents: 0,

          totalInCents:
            50000 * quantity,

          customerAccountType:
            'INDIVIDUAL',

          customerName:
            'Webhook Customer',

          customerEmail:
            `webhook-${uniqueId}@example.com`,

          customerTaxId:
            '12345678901',

          customerPhone:
            '+5561999999999',

          shippingRecipientName:
            'Webhook Customer',

          shippingStreet:
            'Webhook Avenue',

          shippingNumber: '100',

          shippingComplement: null,

          shippingNeighborhood:
            'Central District',

          shippingCity:
            'Brasilia',

          shippingState: 'DF',

          shippingPostalCode:
            '70000000',

          shippingCountry: 'BR',

          reservationExpiresAt:
            new Date(
              Date.now() +
                30 * 60 * 1000,
            ),

          items: {
            create: [
              {
                productId,

                productName:
                  'Webhook Product',

                productSlug,

                productSku,

                unitPriceInCents:
                  50000,

                quantity,

                lineTotalInCents:
                  50000 * quantity,
              },
            ],
          },
        },
      });

    const paymentIntentId =
      `pi_webhook_${order.id}`;

    const paymentStatus =
      options?.paymentStatus ??
      'PENDING';

    const payment =
      await prisma.payment.create({
        data: {
          orderId: order.id,

          status:
            paymentStatus,

          amountInCents:
            order.totalInCents,

          currency:
            order.currency,

          providerPaymentIntentId:
            paymentIntentId,

          succeededAt:
            paymentStatus ===
            'SUCCEEDED'
              ? new Date()
              : null,
        },
      });

    return {
      order,
      payment,
      paymentIntentId,
      quantity,
    };
  }

  function sendWebhook(
    event: Stripe.Event,
    signature = 'valid-signature',
  ) {
    return request(
      app.getHttpServer(),
    )
      .post(
        '/api/payments/stripe/webhook',
      )
      .set(
        'stripe-signature',
        signature,
      )
      .send(event);
  }

  beforeAll(async () => {
    fakeStripe =
      new FakeStripeWebhookService();

    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(
          StripeService,
        )
        .useValue(fakeStripe)
        .compile();

    app =
      moduleFixture.createNestApplication({
        rawBody: true,
      });

    configureApp(app);

    prisma =
      moduleFixture.get<PrismaService>(
        PrismaService,
      );

    await app.init();

    const category =
      await prisma.category.create({
        data: {
          name:
            `Payment Webhook ${uniqueId}`,

          slug: categorySlug,

          description:
            'Category used by payment webhook tests.',

          isActive: true,
        },
      });

    categoryId = category.id;

    const product =
      await prisma.product.create({
        data: {
          categoryId,

          name:
            'Webhook Product',

          slug: productSlug,

          sku: productSku,

          description:
            'Product used by payment webhook tests.',

          priceInCents: 50000,

          currency: 'BRL',

          isActive: true,

          inventory: {
            create: {
              quantity: 10,
              reservedQuantity: 2,
              reorderPoint: 1,
            },
          },
        },
      });

    productId = product.id;
  });

  beforeEach(async () => {
    fakeStripe.reset();

    await prisma.payment.deleteMany({
      where: {
        order: {
          customerEmail:
            `webhook-${uniqueId}@example.com`,
        },
      },
    });

    await prisma.order.deleteMany({
      where: {
        customerEmail:
          `webhook-${uniqueId}@example.com`,
      },
    });

    await prisma.inventory.update({
      where: {
        productId,
      },
      data: {
        quantity: 10,
        reservedQuantity: 2,
      },
    });
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({
      where: {
        order: {
          customerEmail:
            `webhook-${uniqueId}@example.com`,
        },
      },
    });

    await prisma.order.deleteMany({
      where: {
        customerEmail:
          `webhook-${uniqueId}@example.com`,
      },
    });

    await prisma.product.delete({
      where: {
        id: productId,
      },
    });

    await prisma.category.delete({
      where: {
        id: categoryId,
      },
    });

    await app.close();
  });

  it('rejects a webhook without a Stripe signature', async () => {
    await request(
      app.getHttpServer(),
    )
      .post(
        '/api/payments/stripe/webhook',
      )
      .send({
        type:
          'payment_intent.succeeded',
      })
      .expect(400);

    expect(
      fakeStripe.lastRawBody,
    ).toBeNull();
  });

  it('rejects an invalid Stripe signature', async () => {
    const event =
      createEvent(
        'payment_intent.processing',
        {
          id: 'pi_invalid_signature',
        },
      );

    const response =
      await sendWebhook(
        event,
        'invalid-signature',
      ).expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      message:
        'Invalid Stripe webhook signature.',
    });

    expect(
      fakeStripe.lastRawBody,
    ).toBeInstanceOf(Buffer);
  });

  it('preserves the raw request body for signature verification', async () => {
    const event =
      createEvent(
        'unhandled.event',
        {
          id: 'pi_raw_body',
        },
      );

    await sendWebhook(event).expect(
      200,
    );

    expect(
      fakeStripe.lastSignature,
    ).toBe('valid-signature');

    expect(
      fakeStripe.lastRawBody,
    ).toBeInstanceOf(Buffer);

    expect(
      JSON.parse(
        fakeStripe.lastRawBody!.toString(
          'utf8',
        ),
      ),
    ).toEqual(event);
  });

  it('acknowledges unsupported Stripe events without changing payments', async () => {
    const scenario =
      await createScenario();

    const event =
      createEvent(
        'charge.succeeded',
        createPaymentIntent({
          id:
            scenario.paymentIntentId,

          paymentId:
            scenario.payment.id,

          orderId:
            scenario.order.id,
        }),
      );

    await sendWebhook(event).expect(
      200,
    );

    const payment =
      await prisma.payment.findUniqueOrThrow({
        where: {
          id:
            scenario.payment.id,
        },
      });

    expect(payment.status).toBe(
      'PENDING',
    );
  });

  it('marks a payment as processing', async () => {
    const scenario =
      await createScenario();

    const event =
      createEvent(
        'payment_intent.processing',
        createPaymentIntent({
          id:
            scenario.paymentIntentId,

          paymentId:
            scenario.payment.id,

          orderId:
            scenario.order.id,

          status: 'processing',
        }),
      );

    await sendWebhook(event).expect(
      200,
    );

    const payment =
      await prisma.payment.findUniqueOrThrow({
        where: {
          id:
            scenario.payment.id,
        },
      });

    expect(payment.status).toBe(
      'PROCESSING',
    );

    expect(
      payment.succeededAt,
    ).toBeNull();
  });

  it('records a failed payment without consuming reserved inventory', async () => {
    const scenario =
      await createScenario();

    const event =
      createEvent(
        'payment_intent.payment_failed',
        createPaymentIntent({
          id:
            scenario.paymentIntentId,

          paymentId:
            scenario.payment.id,

          orderId:
            scenario.order.id,

          status:
            'requires_payment_method',

          failureCode:
            'card_declined',

          failureMessage:
            'The card was declined.',
        }),
      );

    await sendWebhook(event).expect(
      200,
    );

    const payment =
      await prisma.payment.findUniqueOrThrow({
        where: {
          id:
            scenario.payment.id,
        },
      });

    expect(payment).toMatchObject({
      status: 'FAILED',

      failureCode:
        'card_declined',

      failureMessage:
        'The card was declined.',
    });

    const inventory =
      await prisma.inventory.findUniqueOrThrow({
        where: {
          productId,
        },
      });

    expect(inventory.quantity).toBe(
      10,
    );

    expect(
      inventory.reservedQuantity,
    ).toBe(2);

    const order =
      await prisma.order.findUniqueOrThrow({
        where: {
          id: scenario.order.id,
        },
      });

    expect(order.status).toBe(
      'PENDING_PAYMENT',
    );
  });

  it('records a canceled payment without consuming reserved inventory', async () => {
    const scenario =
      await createScenario();

    const event =
      createEvent(
        'payment_intent.canceled',
        createPaymentIntent({
          id:
            scenario.paymentIntentId,

          paymentId:
            scenario.payment.id,

          orderId:
            scenario.order.id,

          status: 'canceled',

          cancellationReason:
            'requested_by_customer',
        }),
      );

    await sendWebhook(event).expect(
      200,
    );

    const payment =
      await prisma.payment.findUniqueOrThrow({
        where: {
          id:
            scenario.payment.id,
        },
      });

    expect(payment).toMatchObject({
      status: 'CANCELED',

      failureCode:
        'requested_by_customer',

      failureMessage:
        'Payment was canceled by the payment provider.',
    });

    const inventory =
      await prisma.inventory.findUniqueOrThrow({
        where: {
          productId,
        },
      });

    expect(inventory.quantity).toBe(
      10,
    );

    expect(
      inventory.reservedQuantity,
    ).toBe(2);
  });

  it('finalizes a successful payment and consumes exactly the reserved inventory', async () => {
    const scenario =
      await createScenario({
        quantity: 2,
      });

    const event =
      createEvent(
        'payment_intent.succeeded',
        createPaymentIntent({
          id:
            scenario.paymentIntentId,

          paymentId:
            scenario.payment.id,

          orderId:
            scenario.order.id,

          status: 'succeeded',
        }),
      );

    await sendWebhook(event).expect(
      200,
    );

    const payment =
      await prisma.payment.findUniqueOrThrow({
        where: {
          id:
            scenario.payment.id,
        },
      });

    expect(payment.status).toBe(
      'SUCCEEDED',
    );

    expect(
      payment.succeededAt,
    ).not.toBeNull();

    const order =
      await prisma.order.findUniqueOrThrow({
        where: {
          id: scenario.order.id,
        },
      });

    expect(order.status).toBe(
      'PAID',
    );

    const inventory =
      await prisma.inventory.findUniqueOrThrow({
        where: {
          productId,
        },
      });

    expect(inventory.quantity).toBe(
      8,
    );

    expect(
      inventory.reservedQuantity,
    ).toBe(0);
  });

  it('processes a repeated success webhook idempotently', async () => {
    const scenario =
      await createScenario({
        quantity: 2,
      });

    const paymentIntent =
      createPaymentIntent({
        id:
          scenario.paymentIntentId,

        paymentId:
          scenario.payment.id,

        orderId:
          scenario.order.id,

        status: 'succeeded',
      });

    const firstEvent =
      createEvent(
        'payment_intent.succeeded',
        paymentIntent,
      );

    const secondEvent =
      createEvent(
        'payment_intent.succeeded',
        paymentIntent,
      );

    await sendWebhook(
      firstEvent,
    ).expect(200);

    await sendWebhook(
      secondEvent,
    ).expect(200);

    const inventory =
      await prisma.inventory.findUniqueOrThrow({
        where: {
          productId,
        },
      });

    expect(inventory.quantity).toBe(
      8,
    );

    expect(
      inventory.reservedQuantity,
    ).toBe(0);

    const payment =
      await prisma.payment.findUniqueOrThrow({
        where: {
          id:
            scenario.payment.id,
        },
      });

    expect(payment.status).toBe(
      'SUCCEEDED',
    );
  });

  it('does not downgrade a successful payment when an older failure event arrives later', async () => {
    const scenario =
      await createScenario({
        quantity: 2,
      });

    const succeededIntent =
      createPaymentIntent({
        id:
          scenario.paymentIntentId,

        paymentId:
          scenario.payment.id,

        orderId:
          scenario.order.id,

        status: 'succeeded',
      });

    await sendWebhook(
      createEvent(
        'payment_intent.succeeded',
        succeededIntent,
      ),
    ).expect(200);

    const failedIntent =
      createPaymentIntent({
        id:
          scenario.paymentIntentId,

        paymentId:
          scenario.payment.id,

        orderId:
          scenario.order.id,

        status:
          'requires_payment_method',

        failureCode:
          'card_declined',

        failureMessage:
          'Delayed failure event.',
      });

    await sendWebhook(
      createEvent(
        'payment_intent.payment_failed',
        failedIntent,
      ),
    ).expect(200);

    const payment =
      await prisma.payment.findUniqueOrThrow({
        where: {
          id:
            scenario.payment.id,
        },
      });

    expect(payment.status).toBe(
      'SUCCEEDED',
    );

    expect(
      payment.succeededAt,
    ).not.toBeNull();

    const inventory =
      await prisma.inventory.findUniqueOrThrow({
        where: {
          productId,
        },
      });

    expect(inventory.quantity).toBe(
      8,
    );

    expect(
      inventory.reservedQuantity,
    ).toBe(0);
  });

  it('rejects mismatched Stripe payment data without mutating the order or inventory', async () => {
    const scenario =
      await createScenario({
        quantity: 2,
      });

    const event =
      createEvent(
        'payment_intent.succeeded',
        createPaymentIntent({
          id:
            scenario.paymentIntentId,

          paymentId:
            scenario.payment.id,

          orderId:
            scenario.order.id,

          amountInCents: 1,

          status: 'succeeded',
        }),
      );

    await sendWebhook(event).expect(
      409,
    );

    const payment =
      await prisma.payment.findUniqueOrThrow({
        where: {
          id:
            scenario.payment.id,
        },
      });

    expect(payment.status).toBe(
      'PENDING',
    );

    expect(
      payment.succeededAt,
    ).toBeNull();

    const order =
      await prisma.order.findUniqueOrThrow({
        where: {
          id: scenario.order.id,
        },
      });

    expect(order.status).toBe(
      'PENDING_PAYMENT',
    );

    const inventory =
      await prisma.inventory.findUniqueOrThrow({
        where: {
          productId,
        },
      });

    expect(inventory.quantity).toBe(
      10,
    );

    expect(
      inventory.reservedQuantity,
    ).toBe(2);
  });

  it('safely acknowledges a webhook for an unknown PaymentIntent', async () => {
    const event =
      createEvent(
        'payment_intent.succeeded',
        createPaymentIntent({
          id:
            'pi_unknown_payment_intent',

          paymentId:
            'unknown-payment',

          orderId:
            'unknown-order',

          status: 'succeeded',
        }),
      );

    await sendWebhook(event).expect(
      200,
    );

    const inventory =
      await prisma.inventory.findUniqueOrThrow({
        where: {
          productId,
        },
      });

    expect(inventory.quantity).toBe(
      10,
    );

    expect(
      inventory.reservedQuantity,
    ).toBe(2);
  });
});
