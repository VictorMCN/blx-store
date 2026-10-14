import type { INestApplication } from '@nestjs/common';
import {
  Test,
  type TestingModule,
} from '@nestjs/testing';
import type Stripe from 'stripe';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { StripeService } from '../src/payment/stripe.service.js';

class FakeStripeRetryService {
  createCalls = 0;
  retrieveCalls: string[] = [];

  private paymentIntentContext: {
    paymentId: string;
    orderId: string;
    orderNumber: string;
    amountInCents: number;
    currency: string;
  } | null = null;

  setPaymentIntentContext(
    context: {
      paymentId: string;
      orderId: string;
      orderNumber: string;
      amountInCents: number;
      currency: string;
    },
  ) {
    this.paymentIntentContext =
      context;
  }

  async createPaymentIntent(): Promise<Stripe.PaymentIntent> {
    this.createCalls += 1;

    throw new Error(
      'A new Stripe PaymentIntent must not be created.',
    );
  }

  async retrievePaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    this.retrieveCalls.push(
      paymentIntentId,
    );

    if (!this.paymentIntentContext) {
      throw new Error(
        'Fake Stripe payment context was not configured.',
      );
    }

    return {
      id: paymentIntentId,
      object: 'payment_intent',
      amount:
        this.paymentIntentContext
          .amountInCents,
      currency:
        this.paymentIntentContext
          .currency.toLowerCase(),
      client_secret:
        'secret_existing_retry',
      status:
        'requires_payment_method',
      metadata: {
        paymentId:
          this.paymentIntentContext
            .paymentId,
        orderId:
          this.paymentIntentContext
            .orderId,
        orderNumber:
          this.paymentIntentContext
            .orderNumber,
      },
    } as Stripe.PaymentIntent;
  }
}

describe('Payment retry (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeStripe: FakeStripeRetryService;

  let userId: string;
  let sessionCookie: string;

  const uniqueId = Date.now();

  const email =
    `payment-retry-${uniqueId}@example.com`;

  const password =
    'SecurePassword123!';

  beforeAll(async () => {
    fakeStripe =
      new FakeStripeRetryService();

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
      moduleFixture.createNestApplication();

    configureApp(app);

    prisma =
      moduleFixture.get<PrismaService>(
        PrismaService,
      );

    await app.init();

    await request(
      app.getHttpServer(),
    )
      .post('/api/auth/register')
      .send({
        email,
        password,
      })
      .expect(201);

    const user =
      await prisma.user.findUniqueOrThrow({
        where: {
          email,
        },
      });

    userId = user.id;

    const loginResponse =
      await request(
        app.getHttpServer(),
      )
        .post('/api/auth/login')
        .send({
          email,
          password,
        })
        .expect(200);

    const cookies =
      loginResponse.headers[
        'set-cookie'
      ];

    if (
      !Array.isArray(cookies) ||
      !cookies[0]
    ) {
      throw new Error(
        'Authentication cookie was not returned.',
      );
    }

    sessionCookie =
      cookies[0].split(';')[0];
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({
      where: {
        order: {
          customerEmail: email,
        },
      },
    });

    await prisma.order.deleteMany({
      where: {
        customerEmail: email,
      },
    });

    await prisma.user.deleteMany({
      where: {
        email,
      },
    });

    await app.close();
  });

  it('reuses the same Stripe PaymentIntent after a failed payment attempt', async () => {
    const order =
      await prisma.order.create({
        data: {
          orderNumber:
            `BLX-RTRY-${uniqueId}`,

          userId,

          status:
            'PENDING_PAYMENT',

          currency: 'BRL',

          subtotalInCents:
            125000,

          shippingInCents: 0,

          totalInCents:
            125000,

          customerAccountType:
            'INDIVIDUAL',

          customerName:
            'Retry Customer',

          customerEmail: email,

          customerTaxId:
            '12345678901',

          customerPhone:
            '+5561999999999',

          shippingRecipientName:
            'Retry Customer',

          shippingStreet:
            'Retry Avenue',

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
        },
      });

    const paymentIntentId =
      `pi_retry_${order.id}`;

    const failedPayment =
      await prisma.payment.create({
        data: {
          orderId: order.id,

          status: 'FAILED',

          amountInCents:
            order.totalInCents,

          currency:
            order.currency,

          providerPaymentIntentId:
            paymentIntentId,

          failureCode:
            'card_declined',

          failureMessage:
            'The card was declined.',
        },
      });

    fakeStripe.setPaymentIntentContext({
      paymentId:
        failedPayment.id,
      orderId:
        order.id,
      orderNumber:
        order.orderNumber,
      amountInCents:
        order.totalInCents,
      currency:
        order.currency,
    });

    const response =
      await request(
        app.getHttpServer(),
      )
        .post(
          `/api/orders/${order.id}/payment`,
        )
        .set(
          'Cookie',
          sessionCookie,
        )
        .expect(201);

    expect(
      response.body,
    ).toMatchObject({
      payment: {
        id: failedPayment.id,
        provider: 'STRIPE',
        status: 'PENDING',
        amountInCents:
          order.totalInCents,
        currency: 'BRL',
      },
      clientSecret:
        'secret_existing_retry',
    });

    expect(
      fakeStripe.createCalls,
    ).toBe(0);

    expect(
      fakeStripe.retrieveCalls,
    ).toEqual([
      paymentIntentId,
    ]);

    const payments =
      await prisma.payment.findMany({
        where: {
          orderId: order.id,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

    expect(payments).toHaveLength(
      1,
    );

    expect(payments[0]).toMatchObject({
      id: failedPayment.id,
      status: 'PENDING',
      providerPaymentIntentId:
        paymentIntentId,
    });
  });
});
