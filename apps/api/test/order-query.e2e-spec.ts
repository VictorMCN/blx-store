import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
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

describe('Order queries (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let customerId: string;
  let secondCustomerId: string;

  let customerCookie: string;
  let secondCustomerCookie: string;

  let newestOrderId: string;
  let paidOrderId: string;
  let secondCustomerOrderId: string;

  const uniqueId = Date.now();

  const password =
    'OrderQueryPassword123!';

  const customerEmail =
    `order-query-${uniqueId}@example.com`;

  const secondCustomerEmail =
    `order-query-second-${uniqueId}@example.com`;

  function extractCookie(
    setCookieHeader: string[] | undefined,
  ): string {
    const cookie = setCookieHeader?.[0];

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

    const response =
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
        response.headers['set-cookie'],
      ),
    };
  }

  function createOrderData(
    userId: string,
    customerEmailSnapshot: string,
    orderNumber: string,
    createdAt: Date,
    status:
      | 'PENDING_PAYMENT'
      | 'PAID'
      | 'PROCESSING',
  ) {
    return {
      orderNumber,
      userId,
      status,
      currency: 'BRL',

      subtotalInCents: 100000,
      shippingInCents: 0,
      totalInCents: 100000,

      customerAccountType:
        'INDIVIDUAL' as const,
      customerName:
        'Order Query Customer',
      customerEmail:
        customerEmailSnapshot,
      customerTaxId:
        '12345678901',
      customerPhone:
        '+5561999999999',

      shippingRecipientName:
        'Order Query Customer',
      shippingStreet:
        'Historical Street',
      shippingNumber: '123',
      shippingComplement: null,
      shippingNeighborhood:
        'Central District',
      shippingCity: 'Brasilia',
      shippingState: 'DF',
      shippingPostalCode:
        '70000000',
      shippingCountry: 'BR',

      reservationExpiresAt:
        new Date(
          createdAt.getTime() +
            30 * 60 * 1000,
        ),

      createdAt,

      items: {
        create: [
          {
            productId: null,
            productName:
              'Historical Product',
            productSlug:
              'historical-product',
            productSku:
              `HIST-${orderNumber}`,
            unitPriceInCents: 100000,
            quantity: 1,
            lineTotalInCents: 100000,
          },
        ],
      },
    };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

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
    customerCookie = customer.cookie;

    const secondCustomer =
      await registerAndLogin(
        secondCustomerEmail,
      );

    secondCustomerId =
      secondCustomer.userId;

    secondCustomerCookie =
      secondCustomer.cookie;

    const oldest =
      await prisma.order.create({
        data: createOrderData(
          customerId,
          customerEmail,
          `BLX-Q-${uniqueId}-001`,
          new Date(
            '2026-10-14T10:00:00.000Z',
          ),
          'PENDING_PAYMENT',
        ),
      });

    const paid =
      await prisma.order.create({
        data: createOrderData(
          customerId,
          customerEmail,
          `BLX-Q-${uniqueId}-002`,
          new Date(
            '2026-10-14T11:00:00.000Z',
          ),
          'PAID',
        ),
      });

    paidOrderId = paid.id;

    const newest =
      await prisma.order.create({
        data: createOrderData(
          customerId,
          customerEmail,
          `BLX-Q-${uniqueId}-003`,
          new Date(
            '2026-10-14T12:00:00.000Z',
          ),
          'PROCESSING',
        ),
      });

    newestOrderId = newest.id;

    const secondOrder =
      await prisma.order.create({
        data: createOrderData(
          secondCustomerId,
          secondCustomerEmail,
          `BLX-Q-${uniqueId}-004`,
          new Date(
            '2026-10-14T12:30:00.000Z',
          ),
          'PAID',
        ),
      });

    secondCustomerOrderId =
      secondOrder.id;

    expect(oldest.id).toBeDefined();
  });

  afterAll(async () => {
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

  it('requires authentication to list orders', async () => {
    await request(app.getHttpServer())
      .get('/api/orders')
      .expect(401);
  });

  it('lists only the authenticated customer orders from newest to oldest', async () => {
    const response =
      await request(app.getHttpServer())
        .get('/api/orders')
        .set('Cookie', customerCookie)
        .expect(200);

    expect(
      response.body.orders,
    ).toHaveLength(3);

    expect(
      response.body.orders.map(
        (order: {
          id: string;
        }) => order.id,
      ),
    ).toEqual([
      newestOrderId,
      paidOrderId,
      expect.any(String),
    ]);

    expect(
      response.body.orders.some(
        (order: {
          id: string;
        }) =>
          order.id ===
          secondCustomerOrderId,
      ),
    ).toBe(false);

    expect(
      response.body.pagination,
    ).toEqual({
      page: 1,
      limit: 10,
      total: 3,
      totalPages: 1,
    });

    expect(
      response.body.orders[0]
        .itemCount,
    ).toBe(1);
  });

  it('supports pagination', async () => {
    const firstPage =
      await request(app.getHttpServer())
        .get(
          '/api/orders?page=1&limit=2',
        )
        .set('Cookie', customerCookie)
        .expect(200);

    expect(
      firstPage.body.orders,
    ).toHaveLength(2);

    expect(
      firstPage.body.pagination,
    ).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });

    const secondPage =
      await request(app.getHttpServer())
        .get(
          '/api/orders?page=2&limit=2',
        )
        .set('Cookie', customerCookie)
        .expect(200);

    expect(
      secondPage.body.orders,
    ).toHaveLength(1);

    expect(
      secondPage.body.pagination,
    ).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
  });

  it('filters order history by status', async () => {
    const response =
      await request(app.getHttpServer())
        .get(
          '/api/orders?status=PAID',
        )
        .set('Cookie', customerCookie)
        .expect(200);

    expect(
      response.body.orders,
    ).toHaveLength(1);

    expect(
      response.body.orders[0],
    ).toMatchObject({
      id: paidOrderId,
      status: 'PAID',
    });

    expect(
      response.body.pagination.total,
    ).toBe(1);
  });

  it('rejects invalid list query parameters', async () => {
    await request(app.getHttpServer())
      .get('/api/orders?page=0')
      .set('Cookie', customerCookie)
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/orders?limit=51')
      .set('Cookie', customerCookie)
      .expect(400);

    await request(app.getHttpServer())
      .get(
        '/api/orders?status=INVALID',
      )
      .set('Cookie', customerCookie)
      .expect(400);

    await request(app.getHttpServer())
      .get(
        '/api/orders?unexpected=true',
      )
      .set('Cookie', customerCookie)
      .expect(400);
  });

  it('returns the authenticated customer order detail using historical snapshots', async () => {
    const response =
      await request(app.getHttpServer())
        .get(
          `/api/orders/${paidOrderId}`,
        )
        .set('Cookie', customerCookie)
        .expect(200);

    expect(
      response.body.order,
    ).toMatchObject({
      id: paidOrderId,
      status: 'PAID',
      currency: 'BRL',
      subtotalInCents: 100000,
      shippingInCents: 0,
      totalInCents: 100000,
      customerName:
        'Order Query Customer',
      customerEmail,
      shippingStreet:
        'Historical Street',
      shippingNumber: '123',
      shippingCity: 'Brasilia',
      shippingState: 'DF',
      shippingCountry: 'BR',
    });

    expect(
      response.body.order,
    ).not.toHaveProperty(
      'customerTaxId',
    );

    expect(
      response.body.order
        .customerTaxIdMasked,
    ).toBe('*******8901');

    expect(
      response.body.order.items,
    ).toHaveLength(1);

    expect(
      response.body.order.items[0],
    ).toMatchObject({
      productId: null,
      productName:
        'Historical Product',
      productSlug:
        'historical-product',
      unitPriceInCents: 100000,
      quantity: 1,
      lineTotalInCents: 100000,
    });
  });

  it('does not expose another customer order', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/orders/${secondCustomerOrderId}`,
      )
      .set('Cookie', customerCookie)
      .expect(404);

    const ownerResponse =
      await request(app.getHttpServer())
        .get(
          `/api/orders/${secondCustomerOrderId}`,
        )
        .set(
          'Cookie',
          secondCustomerCookie,
        )
        .expect(200);

    expect(
      ownerResponse.body.order.id,
    ).toBe(
      secondCustomerOrderId,
    );
  });

  it('returns not found for an unknown order identifier', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/orders/${randomUUID()}`,
      )
      .set('Cookie', customerCookie)
      .expect(404);
  });

  it('rejects malformed order identifiers', async () => {
    await request(app.getHttpServer())
      .get(
        '/api/orders/not-a-uuid',
      )
      .set('Cookie', customerCookie)
      .expect(400);
  });
});
