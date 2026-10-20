import {
  ServiceUnavailableException,
  type INestApplication,
} from '@nestjs/common';
import {
  Test,
  type TestingModule,
} from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
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

interface FakePaymentIntentInput {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amountInCents: number;
  currency: string;
}

interface FakePaymentIntent {
  id: string;
  object: 'payment_intent';
  amount: number;
  currency: string;
  client_secret: string;
  status:
    | 'requires_payment_method'
    | 'processing';
  metadata: {
    paymentId: string;
    orderId: string;
    orderNumber: string;
  };
}

class FakeStripeService {
  createCalls: FakePaymentIntentInput[] = [];
  retrieveCalls: string[] = [];

  nextStatus:
    FakePaymentIntent['status'] =
    'requires_payment_method';

  failNextCreate = false;
  delayMs = 0;

  private intentsByPaymentId =
    new Map<string, FakePaymentIntent>();

  private intentsById =
    new Map<string, FakePaymentIntent>();

  reset() {
    this.createCalls = [];
    this.retrieveCalls = [];
    this.nextStatus =
      'requires_payment_method';
    this.failNextCreate = false;
    this.delayMs = 0;
    this.intentsByPaymentId.clear();
    this.intentsById.clear();
  }

  async createPaymentIntent(
    input: FakePaymentIntentInput,
  ): Promise<FakePaymentIntent> {
    this.createCalls.push(input);

    if (this.failNextCreate) {
      this.failNextCreate = false;

      throw new ServiceUnavailableException(
        'Payment provider request failed.',
      );
    }

    const existing =
      this.intentsByPaymentId.get(
        input.paymentId,
      );

    if (existing) {
      return existing;
    }

    const intent: FakePaymentIntent = {
      id: `pi_fake_${input.paymentId}`,
      object: 'payment_intent',
      amount:
        input.amountInCents,
      currency:
        input.currency.toLowerCase(),
      client_secret:
        `secret_${input.paymentId}`,
      status: this.nextStatus,
      metadata: {
        paymentId:
          input.paymentId,
        orderId:
          input.orderId,
        orderNumber:
          input.orderNumber,
      },
    };

    this.intentsByPaymentId.set(
      input.paymentId,
      intent,
    );

    this.intentsById.set(
      intent.id,
      intent,
    );

    if (this.delayMs > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, this.delayMs);
      });
    }

    return intent;
  }

  async retrievePaymentIntent(
    paymentIntentId: string,
  ): Promise<FakePaymentIntent> {
    this.retrieveCalls.push(
      paymentIntentId,
    );

    const intent =
      this.intentsById.get(
        paymentIntentId,
      );

    if (!intent) {
      throw new ServiceUnavailableException(
        'Payment provider request failed.',
      );
    }

    return intent;
  }
}

describe('Payment initialization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeStripe: FakeStripeService;

  let customerId: string;
  let secondCustomerId: string;

  let customerCookie: string;
  let secondCustomerCookie: string;

  const uniqueId = Date.now();

  const password =
    'PaymentPassword123!';

  const customerEmail =
    `payment-customer-${uniqueId}@example.com`;

  const secondCustomerEmail =
    `payment-second-${uniqueId}@example.com`;

  function extractCookie(
    setCookieHeader: string[] | undefined,
  ): string {
    const cookie =
      setCookieHeader?.[0];

    if (!cookie) {
      throw new Error(
        'Authentication response did not include a session cookie.',
      );
    }

    return cookie.split(';')[0];
  }

  async function registerAndLogin(
    email: string,
  ) {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        fullName: 'Test Customer',
        email,
        password,
      })
      .expect(201);

    const user =
      await prisma.user.findUniqueOrThrow({
        where: {
          email,
        },
        select: {
          id: true,
        },
      });

    const loginResponse =
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email,
          password,
        })
        .expect(200);

    return {
      userId: user.id,
      cookie: extractCookie(
        loginResponse.headers[
          'set-cookie'
        ],
      ),
    };
  }

  async function createOrder(
    userId: string,
    email: string,
    options?: {
      status?:
        | 'PENDING_PAYMENT'
        | 'PAID'
        | 'PROCESSING';
      totalInCents?: number;
      currency?: string;
      expired?: boolean;
    },
  ) {
    const status =
      options?.status ??
      'PENDING_PAYMENT';

    const totalInCents =
      options?.totalInCents ??
      125000;

    const currency =
      options?.currency ?? 'BRL';

    const now = Date.now();

    const createdAt =
      options?.expired
        ? new Date(
            now - 2 * 60 * 60 * 1000,
          )
        : new Date();

    const reservationExpiresAt =
      options?.expired
        ? new Date(
            now - 60 * 60 * 1000,
          )
        : new Date(
            now + 30 * 60 * 1000,
          );

    return prisma.order.create({
      data: {
        orderNumber:
          `BLX-PAY-${uniqueId}-${randomUUID().slice(0, 8)}`,

        userId,
        status,
        currency,

        subtotalInCents:
          totalInCents,
        shippingInCents: 0,
        totalInCents,

        customerAccountType:
          'INDIVIDUAL',
        customerName:
          'Payment Customer',
        customerEmail: email,
        customerTaxId:
          '12345678901',
        customerPhone:
          '+5561999999999',

        shippingRecipientName:
          'Payment Customer',
        shippingStreet:
          'Payment Avenue',
        shippingNumber: '100',
        shippingComplement: null,
        shippingNeighborhood:
          'Central District',
        shippingCity: 'Brasilia',
        shippingState: 'DF',
        shippingPostalCode:
          '70000000',
        shippingCountry: 'BR',

        reservationExpiresAt,
        createdAt,
      },
    });
  }

  beforeAll(async () => {
    fakeStripe =
      new FakeStripeService();

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

    const customer =
      await registerAndLogin(
        customerEmail,
      );

    customerId = customer.userId;
    customerCookie =
      customer.cookie;

    const secondCustomer =
      await registerAndLogin(
        secondCustomerEmail,
      );

    secondCustomerId =
      secondCustomer.userId;

    secondCustomerCookie =
      secondCustomer.cookie;
  });

  beforeEach(async () => {
    fakeStripe.reset();

    await prisma.payment.deleteMany({
      where: {
        order: {
          customerEmail: {
            in: [
              customerEmail,
              secondCustomerEmail,
            ],
          },
        },
      },
    });

    await prisma.order.deleteMany({
      where: {
        customerEmail: {
          in: [
            customerEmail,
            secondCustomerEmail,
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({
      where: {
        order: {
          customerEmail: {
            in: [
              customerEmail,
              secondCustomerEmail,
            ],
          },
        },
      },
    });

    await prisma.order.deleteMany({
      where: {
        customerEmail: {
          in: [
            customerEmail,
            secondCustomerEmail,
          ],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            customerEmail,
            secondCustomerEmail,
          ],
        },
      },
    });

    await app.close();
  });

  it('requires authentication', async () => {
    const order =
      await createOrder(
        customerId,
        customerEmail,
      );

    await request(app.getHttpServer())
      .post(
        `/api/orders/${order.id}/payment`,
      )
      .expect(401);
  });

  it('rejects malformed order identifiers', async () => {
    await request(app.getHttpServer())
      .post(
        '/api/orders/not-a-uuid/payment',
      )
      .set('Cookie', customerCookie)
      .expect(400);
  });

  it('returns not found for an unknown order', async () => {
    await request(app.getHttpServer())
      .post(
        `/api/orders/${randomUUID()}/payment`,
      )
      .set('Cookie', customerCookie)
      .expect(404);

    expect(
      fakeStripe.createCalls,
    ).toHaveLength(0);
  });

  it('does not expose another customer order', async () => {
    const order =
      await createOrder(
        secondCustomerId,
        secondCustomerEmail,
      );

    await request(app.getHttpServer())
      .post(
        `/api/orders/${order.id}/payment`,
      )
      .set('Cookie', customerCookie)
      .expect(404);

    await request(app.getHttpServer())
      .post(
        `/api/orders/${order.id}/payment`,
      )
      .set(
        'Cookie',
        secondCustomerCookie,
      )
      .expect(201);
  });

  it('rejects an order that is no longer awaiting payment', async () => {
    const order =
      await createOrder(
        customerId,
        customerEmail,
        {
          status: 'PAID',
        },
      );

    const response =
      await request(app.getHttpServer())
        .post(
          `/api/orders/${order.id}/payment`,
        )
        .set('Cookie', customerCookie)
        .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      message:
        'Order is not awaiting payment.',
    });

    expect(
      await prisma.payment.count({
        where: {
          orderId: order.id,
        },
      }),
    ).toBe(0);
  });

  it('rejects an expired payment reservation', async () => {
    const order =
      await createOrder(
        customerId,
        customerEmail,
        {
          expired: true,
        },
      );

    const response =
      await request(app.getHttpServer())
        .post(
          `/api/orders/${order.id}/payment`,
        )
        .set('Cookie', customerCookie)
        .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      message:
        'Order payment reservation has expired.',
    });

    expect(
      fakeStripe.createCalls,
    ).toHaveLength(0);
  });

  it('creates a payment using server-side order amount and currency', async () => {
    const order =
      await createOrder(
        customerId,
        customerEmail,
        {
          totalInCents: 189900,
          currency: 'BRL',
        },
      );

    const response =
      await request(app.getHttpServer())
        .post(
          `/api/orders/${order.id}/payment`,
        )
        .set('Cookie', customerCookie)
        .send({
          amountInCents: 1,
          currency: 'USD',
        })
        .expect(201);

    expect(response.body).toMatchObject({
      payment: {
        provider: 'STRIPE',
        status: 'PENDING',
        amountInCents: 189900,
        currency: 'BRL',
      },
    });

    expect(
      response.body.clientSecret,
    ).toBe(
      `secret_${response.body.payment.id}`,
    );

    expect(
      fakeStripe.createCalls,
    ).toHaveLength(1);

    expect(
      fakeStripe.createCalls[0],
    ).toEqual({
      paymentId:
        response.body.payment.id,
      orderId: order.id,
      orderNumber:
        order.orderNumber,
      amountInCents: 189900,
      currency: 'BRL',
    });

    const payment =
      await prisma.payment.findUniqueOrThrow({
        where: {
          id: response.body.payment.id,
        },
      });

    expect(payment).toMatchObject({
      orderId: order.id,
      provider: 'STRIPE',
      status: 'PENDING',
      amountInCents: 189900,
      currency: 'BRL',
      providerPaymentIntentId:
        `pi_fake_${payment.id}`,
    });

    const storedOrder =
      await prisma.order.findUniqueOrThrow({
        where: {
          id: order.id,
        },
      });

    expect(storedOrder.status).toBe(
      'PENDING_PAYMENT',
    );
  });

  it('reuses an existing pending payment attempt', async () => {
    const order =
      await createOrder(
        customerId,
        customerEmail,
      );

    const firstResponse =
      await request(app.getHttpServer())
        .post(
          `/api/orders/${order.id}/payment`,
        )
        .set('Cookie', customerCookie)
        .expect(201);

    const secondResponse =
      await request(app.getHttpServer())
        .post(
          `/api/orders/${order.id}/payment`,
        )
        .set('Cookie', customerCookie)
        .expect(201);

    expect(
      secondResponse.body.payment.id,
    ).toBe(
      firstResponse.body.payment.id,
    );

    expect(
      secondResponse.body.clientSecret,
    ).toBe(
      firstResponse.body.clientSecret,
    );

    expect(
      await prisma.payment.count({
        where: {
          orderId: order.id,
        },
      }),
    ).toBe(1);

    expect(
      fakeStripe.createCalls,
    ).toHaveLength(1);

    expect(
      fakeStripe.retrieveCalls,
    ).toEqual([
      `pi_fake_${firstResponse.body.payment.id}`,
    ]);
  });

  it('creates a new attempt after a previous payment failed', async () => {
    const order =
      await createOrder(
        customerId,
        customerEmail,
      );

    const failedPayment =
      await prisma.payment.create({
        data: {
          orderId: order.id,
          status: 'FAILED',
          amountInCents:
            order.totalInCents,
          currency: order.currency,
          failureCode:
            'card_declined',
          failureMessage:
            'The card was declined.',
        },
      });

    const response =
      await request(app.getHttpServer())
        .post(
          `/api/orders/${order.id}/payment`,
        )
        .set('Cookie', customerCookie)
        .expect(201);

    expect(
      response.body.payment.id,
    ).not.toBe(failedPayment.id);

    const payments =
      await prisma.payment.findMany({
        where: {
          orderId: order.id,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

    expect(payments).toHaveLength(2);

    expect(payments[0].status).toBe(
      'FAILED',
    );

    expect(payments[1].status).toBe(
      'PENDING',
    );
  });

  it('keeps a payment attempt recoverable when the provider request fails', async () => {
    const order =
      await createOrder(
        customerId,
        customerEmail,
      );

    fakeStripe.failNextCreate = true;

    await request(app.getHttpServer())
      .post(
        `/api/orders/${order.id}/payment`,
      )
      .set('Cookie', customerCookie)
      .expect(503);

    const paymentAfterFailure =
      await prisma.payment.findFirstOrThrow({
        where: {
          orderId: order.id,
        },
      });

    expect(
      paymentAfterFailure.status,
    ).toBe('PENDING');

    expect(
      paymentAfterFailure
        .providerPaymentIntentId,
    ).toBeNull();

    const retryResponse =
      await request(app.getHttpServer())
        .post(
          `/api/orders/${order.id}/payment`,
        )
        .set('Cookie', customerCookie)
        .expect(201);

    expect(
      retryResponse.body.payment.id,
    ).toBe(
      paymentAfterFailure.id,
    );

    expect(
      await prisma.payment.count({
        where: {
          orderId: order.id,
        },
      }),
    ).toBe(1);

    const recoveredPayment =
      await prisma.payment.findUniqueOrThrow({
        where: {
          id: paymentAfterFailure.id,
        },
      });

    expect(
      recoveredPayment
        .providerPaymentIntentId,
    ).toBe(
      `pi_fake_${paymentAfterFailure.id}`,
    );
  });

  it('persists processing provider status', async () => {
    const order =
      await createOrder(
        customerId,
        customerEmail,
      );

    fakeStripe.nextStatus =
      'processing';

    const response =
      await request(app.getHttpServer())
        .post(
          `/api/orders/${order.id}/payment`,
        )
        .set('Cookie', customerCookie)
        .expect(201);

    expect(
      response.body.payment.status,
    ).toBe('PROCESSING');

    const payment =
      await prisma.payment.findUniqueOrThrow({
        where: {
          id: response.body.payment.id,
        },
      });

    expect(payment.status).toBe(
      'PROCESSING',
    );
  });

  it('keeps concurrent initialization to one database payment attempt', async () => {
    const order =
      await createOrder(
        customerId,
        customerEmail,
      );

    fakeStripe.delayMs = 40;

    const [
      firstResponse,
      secondResponse,
    ] = await Promise.all([
      request(app.getHttpServer())
        .post(
          `/api/orders/${order.id}/payment`,
        )
        .set('Cookie', customerCookie),

      request(app.getHttpServer())
        .post(
          `/api/orders/${order.id}/payment`,
        )
        .set('Cookie', customerCookie),
    ]);

    expect(
      [
        firstResponse.status,
        secondResponse.status,
      ].sort((a, b) => a - b),
    ).toEqual([201, 201]);

    expect(
      firstResponse.body.payment.id,
    ).toBe(
      secondResponse.body.payment.id,
    );

    expect(
      firstResponse.body.clientSecret,
    ).toBe(
      secondResponse.body.clientSecret,
    );

    const payments =
      await prisma.payment.findMany({
        where: {
          orderId: order.id,
        },
      });

    expect(payments).toHaveLength(1);

    expect(
      payments[0].amountInCents,
    ).toBe(order.totalInCents);

    expect(
      payments[0].currency,
    ).toBe(order.currency);
  });
});
