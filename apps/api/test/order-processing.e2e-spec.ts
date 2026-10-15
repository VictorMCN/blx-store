import type { INestApplication } from '@nestjs/common';
import {
  Test,
  type TestingModule,
} from '@nestjs/testing';
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
import type { OrderStatus } from '../src/generated/prisma/enums.js';

describe('Admin order processing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminCookie: string;
  let customerCookie: string;
  let customerId: string;

  const uniqueId = Date.now();

  const adminEmail =
    `order-admin-${uniqueId}@example.com`;

  const customerEmail =
    `order-processing-${uniqueId}@example.com`;

  const password =
    'OrderProcessing123!';

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

    await register(
      adminEmail,
    );

    await register(
      customerEmail,
    );

    await prisma.user.update({
      where: {
        email: adminEmail,
      },
      data: {
        role: 'ADMIN',
      },
    });

    const customer =
      await prisma.user.findUniqueOrThrow({
        where: {
          email: customerEmail,
        },
      });

    customerId =
      customer.id;

    adminCookie =
      await login(adminEmail);

    customerCookie =
      await login(customerEmail);
  });

  afterAll(async () => {
    await prisma.order.deleteMany({
      where: {
        userId: customerId,
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            adminEmail,
            customerEmail,
          ],
        },
      },
    });

    await app.close();
  });

  async function register(
    email: string,
  ) {
    await request(
      app.getHttpServer(),
    )
      .post('/api/auth/register')
      .send({
        email,
        password,
      })
      .expect(201);
  }

  async function login(
    email: string,
  ): Promise<string> {
    const response =
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
      response.headers['set-cookie'];

    if (
      !Array.isArray(cookies) ||
      !cookies[0]
    ) {
      throw new Error(
        'Authentication cookie was not returned.',
      );
    }

    return cookies[0].split(';')[0];
  }

  async function createOrder(
    status: OrderStatus,
  ) {
    const suffix =
      randomUUID().slice(0, 8);

    return prisma.order.create({
      data: {
        orderNumber:
          `BLX-A-${suffix}`,

        userId: customerId,

        status,

        currency: 'BRL',

        subtotalInCents: 150000,

        shippingInCents: 0,

        totalInCents: 150000,

        customerAccountType:
          'INDIVIDUAL',

        customerName:
          'Order Processing Customer',

        customerEmail,

        customerTaxId:
          '12345678901',

        customerPhone:
          '+5561999999999',

        shippingRecipientName:
          'Order Processing Customer',

        shippingStreet:
          'Processing Avenue',

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
  }

  function updateStatusRequest(
    orderId: string,
    status: string,
    cookie = adminCookie,
  ) {
    return request(
      app.getHttpServer(),
    )
      .patch(
        `/api/admin/orders/${orderId}/status`,
      )
      .set(
        'Cookie',
        cookie,
      )
      .send({
        status,
      });
  }

  it('requires authentication', async () => {
    const order =
      await createOrder('PAID');

    await request(
      app.getHttpServer(),
    )
      .patch(
        `/api/admin/orders/${order.id}/status`,
      )
      .send({
        status: 'PROCESSING',
      })
      .expect(401);
  });

  it('rejects customer access', async () => {
    const order =
      await createOrder('PAID');

    await updateStatusRequest(
      order.id,
      'PROCESSING',
      customerCookie,
    ).expect(403);
  });

  it('transitions a paid order to processing', async () => {
    const order =
      await createOrder('PAID');

    const response =
      await updateStatusRequest(
        order.id,
        'PROCESSING',
      ).expect(200);

    expect(
      response.body.order,
    ).toMatchObject({
      id: order.id,
      status: 'PROCESSING',
    });
  });

  it('transitions a processing order to shipped', async () => {
    const order =
      await createOrder(
        'PROCESSING',
      );

    const response =
      await updateStatusRequest(
        order.id,
        'SHIPPED',
      ).expect(200);

    expect(
      response.body.order.status,
    ).toBe('SHIPPED');
  });

  it('transitions a shipped order to delivered', async () => {
    const order =
      await createOrder(
        'SHIPPED',
      );

    const response =
      await updateStatusRequest(
        order.id,
        'DELIVERED',
      ).expect(200);

    expect(
      response.body.order.status,
    ).toBe('DELIVERED');
  });

  it('rejects skipping fulfillment states', async () => {
    const order =
      await createOrder('PAID');

    await updateStatusRequest(
      order.id,
      'SHIPPED',
    ).expect(409);

    const unchanged =
      await prisma.order.findUniqueOrThrow({
        where: {
          id: order.id,
        },
      });

    expect(
      unchanged.status,
    ).toBe('PAID');
  });

  it('rejects backwards transitions', async () => {
    const order =
      await createOrder(
        'SHIPPED',
      );

    await updateStatusRequest(
      order.id,
      'PROCESSING',
    ).expect(409);

    const unchanged =
      await prisma.order.findUniqueOrThrow({
        where: {
          id: order.id,
        },
      });

    expect(
      unchanged.status,
    ).toBe('SHIPPED');
  });

  it('rejects unsupported target statuses', async () => {
    const order =
      await createOrder('PAID');

    await updateStatusRequest(
      order.id,
      'CANCELED',
    ).expect(400);
  });

  it('returns not found for an unknown order', async () => {
    await updateStatusRequest(
      randomUUID(),
      'PROCESSING',
    ).expect(404);
  });

  it('handles repeated concurrent transitions idempotently', async () => {
    const order =
      await createOrder('PAID');

    const [
      firstResponse,
      secondResponse,
    ] = await Promise.all([
      updateStatusRequest(
        order.id,
        'PROCESSING',
      ),
      updateStatusRequest(
        order.id,
        'PROCESSING',
      ),
    ]);

    expect(
      [
        firstResponse.status,
        secondResponse.status,
      ].sort((a, b) => a - b),
    ).toEqual([
      200,
      200,
    ]);

    const updatedOrder =
      await prisma.order.findUniqueOrThrow({
        where: {
          id: order.id,
        },
      });

    expect(
      updatedOrder.status,
    ).toBe('PROCESSING');
  });
});
