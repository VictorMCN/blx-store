import {
  type INestApplication,
} from '@nestjs/common';
import {
  Test,
  type TestingModule,
} from '@nestjs/testing';
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
import { ErpInventorySyncService } from '../src/erp/erp-inventory-sync.service.js';

describe('Admin dashboard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const timestamp =
    Date.now();

  const adminEmail =
    `admin-dashboard-${timestamp}@example.com`;

  const customerEmail =
    `admin-customer-${timestamp}@example.com`;

  const password =
    'AdminDashboard123!';

  const categorySlug =
    `admin-category-${timestamp}`;

  const productSlug =
    `admin-product-${timestamp}`;

  const productSku =
    `ADM-${timestamp}`;

  const orderNumber =
    `ADM-${timestamp}`;

  let adminCookie = '';
  let customerCookie = '';

  beforeAll(async () => {
    const moduleFixture:
      TestingModule =
      await Test.createTestingModule({
        imports: [
          AppModule,
        ],
      }).compile();

    app =
      moduleFixture.createNestApplication();

    configureApp(app);

    await app.init();

    prisma =
      app.get(PrismaService);

    await register(
      adminEmail,
    );

    await register(
      customerEmail,
    );

    adminCookie =
      await login(
        adminEmail,
      );

    customerCookie =
      await login(
        customerEmail,
      );

    await prisma.user.update({
      where: {
        email:
          adminEmail,
      },
      data: {
        role: 'ADMIN',
      },
    });

    const customer =
      await prisma.user.findUniqueOrThrow({
        where: {
          email:
            customerEmail,
        },
      });

    const category =
      await prisma.category.create({
        data: {
          name:
            `Admin Category ${timestamp}`,
          slug:
            categorySlug,
          description:
            'Temporary category for admin dashboard tests.',
        },
      });

    const product =
      await prisma.product.create({
        data: {
          name:
            `Admin Product ${timestamp}`,
          slug:
            productSlug,
          sku:
            productSku,
          description:
            'Temporary product for admin dashboard tests.',
          priceInCents:
            100000,
          currency:
            'BRL',

          category: {
            connect: {
              id:
                category.id,
            },
          },

          inventory: {
            create: {
              quantity: 2,
              reservedQuantity: 0,
              reorderPoint: 3,
            },
          },
        },
      });

    await prisma.order.create({
      data: {
        orderNumber,
        status:
          'PAID',
        currency:
          'BRL',
        subtotalInCents:
          100000,
        shippingInCents:
          0,
        totalInCents:
          100000,

        customerAccountType:
          'INDIVIDUAL',
        customerName:
          'Admin Test Customer',
        customerEmail,
        customerTaxId:
          '52998224725',
        customerPhone:
          '+5561999999999',

        shippingRecipientName:
          'Admin Test Customer',
        shippingStreet:
          'Test Avenue',
        shippingNumber:
          '100',
        shippingComplement:
          null,
        shippingNeighborhood:
          'Test District',
        shippingCity:
          'Brasilia',
        shippingState:
          'DF',
        shippingPostalCode:
          '70000000',
        shippingCountry:
          'BR',

        reservationExpiresAt:
          new Date(
            Date.now() +
              30 * 60 * 1000,
          ),

        user: {
          connect: {
            id:
              customer.id,
          },
        },

        items: {
          create: {
            productName:
              product.name,
            productSlug:
              product.slug,
            productSku:
              product.sku,
            unitPriceInCents:
              100000,
            quantity:
              1,
            lineTotalInCents:
              100000,

            product: {
              connect: {
                id:
                  product.id,
              },
            },
          },
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.order.deleteMany({
      where: {
        orderNumber,
      },
    });

    await prisma.product.deleteMany({
      where: {
        sku:
          productSku,
      },
    });

    await prisma.category.deleteMany({
      where: {
        slug:
          categorySlug,
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
        fullName: 'Test Customer',
        email,
        password,
      })
      .expect(201);
  }

  async function login(
    email: string,
  ) {
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
      response.headers[
        'set-cookie'
      ];

    if (
      !cookies
    ) {
      throw new Error(
        'Login did not return a session cookie.',
      );
    }

    return Array.isArray(
      cookies,
    )
      ? cookies[0]
      : cookies;
  }

  it('requires authentication', async () => {
    await request(
      app.getHttpServer(),
    )
      .get(
        '/api/admin/dashboard',
      )
      .expect(401);
  });

  it('rejects customer access', async () => {
    await request(
      app.getHttpServer(),
    )
      .get(
        '/api/admin/dashboard',
      )
      .set(
        'Cookie',
        customerCookie,
      )
      .expect(403);
  });

  it('returns dashboard metrics for admins', async () => {
    const response =
      await request(
        app.getHttpServer(),
      )
        .get(
          '/api/admin/dashboard',
        )
        .set(
          'Cookie',
          adminCookie,
        )
        .expect(200);

    expect(
      response.body.metrics,
    ).toMatchObject({
      currency:
        'BRL',
    });

    expect(
      response.body.metrics
        .totalOrders,
    ).toBeGreaterThanOrEqual(
      1,
    );

    expect(
      response.body.metrics
        .paidRevenueInCents,
    ).toBeGreaterThanOrEqual(
      100000,
    );

    expect(
      Array.isArray(
        response.body
          .recentOrders,
      ),
    ).toBe(true);
  });

  it('returns orders with customer and product data', async () => {
    const response =
      await request(
        app.getHttpServer(),
      )
        .get(
          '/api/admin/orders',
        )
        .set(
          'Cookie',
          adminCookie,
        )
        .expect(200);

    const order =
      response.body.orders.find(
        (candidate: {
          orderNumber:
            string;
        }) =>
          candidate.orderNumber ===
          orderNumber,
      );

    expect(order).toBeDefined();

    expect(order).toMatchObject({
      customerName:
        'Admin Test Customer',
      customerEmail,
      status:
        'PAID',
      itemCount:
        1,
    });

    expect(
      order.items,
    ).toEqual([
      expect.objectContaining({
        productSku,
        quantity: 1,
      }),
    ]);
  });

  it('returns inventory availability and low-stock information', async () => {
    const response =
      await request(
        app.getHttpServer(),
      )
        .get(
          '/api/admin/inventory',
        )
        .set(
          'Cookie',
          adminCookie,
        )
        .expect(200);

    const item =
      response.body.inventory.find(
        (candidate: {
          sku: string;
        }) =>
          candidate.sku ===
          productSku,
      );

    expect(item).toMatchObject({
      quantity: 2,
      reservedQuantity: 0,
      availableQuantity: 2,
      reorderPoint: 3,
      isLowStock: true,
      isOutOfStock: false,
    });
  });

  it('allows admins to correct fulfillment status in both directions', async () => {
    const order =
      await prisma.order.findUniqueOrThrow({
        where: {
          orderNumber,
        },
      });

    await request(
      app.getHttpServer(),
    )
      .patch(
        `/api/admin/orders/${order.id}/fulfillment-status`,
      )
      .set(
        'Cookie',
        adminCookie,
      )
      .send({
        status:
          'DELIVERED',
      })
      .expect(200);

    const delivered =
      await prisma.order.findUniqueOrThrow({
        where: {
          id:
            order.id,
        },
      });

    expect(
      delivered.status,
    ).toBe(
      'DELIVERED',
    );

    await request(
      app.getHttpServer(),
    )
      .patch(
        `/api/admin/orders/${order.id}/fulfillment-status`,
      )
      .set(
        'Cookie',
        adminCookie,
      )
      .send({
        status:
          'PROCESSING',
      })
      .expect(200);

    const corrected =
      await prisma.order.findUniqueOrThrow({
        where: {
          id:
            order.id,
        },
      });

    expect(
      corrected.status,
    ).toBe(
      'PROCESSING',
    );
  });

  it('does not allow manual fulfillment changes for payment states', async () => {
    const order =
      await prisma.order.findUniqueOrThrow({
        where: {
          orderNumber,
        },
      });

    await prisma.order.update({
      where: {
        id:
          order.id,
      },
      data: {
        status:
          'PENDING_PAYMENT',
      },
    });

    await request(
      app.getHttpServer(),
    )
      .patch(
        `/api/admin/orders/${order.id}/fulfillment-status`,
      )
      .set(
        'Cookie',
        adminCookie,
      )
      .send({
        status:
          'DELIVERED',
      })
      .expect(409);
  });

  it('requires authentication for system monitoring', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .get('/api/admin/monitoring')
      .expect(401);

    expect(response.body).not.toHaveProperty('http');
    expect(response.body).not.toHaveProperty('ai');
    expect(response.body).not.toHaveProperty('payments');
  });

  it('forbids customer access to system monitoring', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .get('/api/admin/monitoring')
      .set('Cookie', customerCookie)
      .expect(403);

    expect(response.body).not.toHaveProperty('http');
    expect(response.body).not.toHaveProperty('ai');
    expect(response.body).not.toHaveProperty('payments');
  });

  it('allows administrators to view system monitoring', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .get('/api/admin/monitoring')
      .set('Cookie', adminCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      service: 'blx-store-api',
      health: {
        api: 'ok',
        database: 'ok',
      },
      http: {
        history: expect.any(Array),
      },
      ai: {
        history: expect.any(Array),
      },
      payments: {
        history: expect.any(Array),
      },
    });

    expect(response.body.generatedAt).toEqual(
      expect.any(String),
    );
  });


  it('requires authentication for ERP synchronization', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .get('/api/admin/erp/jobs')
      .expect(401);

    expect(response.body).not.toHaveProperty('jobs');
    expect(response.body).not.toHaveProperty('counts');
  });

  it('forbids customer access to ERP synchronization', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .get('/api/admin/erp/jobs')
      .set('Cookie', customerCookie)
      .expect(403);

    expect(response.body).not.toHaveProperty('jobs');
  });

  it('allows administrators to inspect ERP jobs', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .get('/api/admin/erp/jobs')
      .set('Cookie', adminCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      provider: 'mock',
      counts: {
        PENDING: expect.any(Number),
        PROCESSING: expect.any(Number),
        RETRY: expect.any(Number),
        SYNCED: expect.any(Number),
        FAILED: expect.any(Number),
      },
      jobs: expect.any(Array),
    });
  });

  it('forbids customer retries of ERP jobs', async () => {
    await request(
      app.getHttpServer(),
    )
      .post(
        '/api/admin/erp/jobs/00000000-0000-4000-8000-000000000001/retry',
      )
      .set('Cookie', customerCookie)
      .expect(403);
  });

  it('rejects retries of nonexistent ERP jobs', async () => {
    await request(
      app.getHttpServer(),
    )
      .post(
        '/api/admin/erp/jobs/00000000-0000-4000-8000-000000000001/retry',
      )
      .set('Cookie', adminCookie)
      .expect(404);
  });


  it('requires authentication for mock ERP inventory', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/erp/inventory')
      .expect(401);
  });

  it('forbids customer access to mock ERP inventory', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/erp/inventory')
      .set('Cookie', customerCookie)
      .expect(403);
  });

  it('allows administrators to view mock ERP inventory', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/admin/erp/inventory')
      .set('Cookie', adminCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      provider: 'mock',
      inventory: expect.any(Array),
    });
  });

  it('synchronizes the actual product inventory into the mock ERP', async () => {
    const inventorySync = app.get(ErpInventorySyncService);

    try {
      await inventorySync.syncInventory();

      const response = await request(app.getHttpServer())
        .get('/api/admin/erp/inventory')
        .set('Cookie', adminCookie)
        .expect(200);

      const item = response.body.inventory.find(
        (entry: { sku: string }) => entry.sku === productSku,
      );

      expect(item).toMatchObject({
        sku: productSku,
        onHandQuantity: expect.any(Number),
        reservedQuantity: expect.any(Number),
        availableQuantity: expect.any(Number),
      });

      expect(item.availableQuantity).toBe(
        item.onHandQuantity - item.reservedQuantity,
      );

      expect(
        await prisma.erpMockInventory.count({
          where: { sku: productSku },
        }),
      ).toBe(1);
    } finally {
      await prisma.erpMockInventory.deleteMany({
        where: { sku: productSku },
      });
    }
  });

});
