import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
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

describe('Cart activity timestamp (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let userId: string;
  let productId: string;
  let customerCookie: string;

  const uniqueId = Date.now();

  const email =
    `cart-activity-${uniqueId}@example.com`;

  const password =
    'CartActivityPassword123!';

  const categorySlug =
    `cart-activity-${uniqueId}`;

  const productSlug =
    `cart-activity-product-${uniqueId}`;

  const oldTimestamp =
    new Date('2020-01-01T00:00:00.000Z');

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

    const category =
      await prisma.category.create({
        data: {
          name:
            `Cart Activity ${uniqueId}`,
          slug: categorySlug,
          description:
            'Category used to test cart activity timestamps.',
          isActive: true,
        },
      });

    const product =
      await prisma.product.create({
        data: {
          categoryId: category.id,
          name:
            'Cart Activity Product',
          slug: productSlug,
          sku:
            `CART-ACTIVITY-${uniqueId}`,
          description:
            'Product used to test cart activity timestamps.',
          priceInCents: 10000,
          currency: 'BRL',
          isActive: true,
          inventory: {
            create: {
              quantity: 20,
              reservedQuantity: 0,
              reorderPoint: 2,
            },
          },
        },
      });

    productId = product.id;

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

    userId = user.id;

    const loginResponse =
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email,
          password,
        })
        .expect(200);

    customerCookie = extractCookie(
      loginResponse.headers['set-cookie'],
    );

    await prisma.cart.create({
      data: {
        userId,
        updatedAt: oldTimestamp,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email,
      },
    });

    await prisma.product.deleteMany({
      where: {
        slug: productSlug,
      },
    });

    await prisma.category.deleteMany({
      where: {
        slug: categorySlug,
      },
    });

    await app.close();
  });

  it('updates cart activity when an item is added', async () => {
    const response =
      await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Cookie', customerCookie)
        .send({
          productId,
          quantity: 1,
        })
        .expect(201);

    expect(
      new Date(
        response.body.cart.updatedAt,
      ).getTime(),
    ).toBeGreaterThan(
      oldTimestamp.getTime(),
    );
  });

  it('updates cart activity when an item quantity changes', async () => {
    await prisma.cart.update({
      where: {
        userId,
      },
      data: {
        updatedAt: oldTimestamp,
      },
    });

    const response =
      await request(app.getHttpServer())
        .put(
          `/api/cart/items/${productId}`,
        )
        .set('Cookie', customerCookie)
        .send({
          quantity: 2,
        })
        .expect(200);

    expect(
      new Date(
        response.body.cart.updatedAt,
      ).getTime(),
    ).toBeGreaterThan(
      oldTimestamp.getTime(),
    );
  });

  it('updates cart activity when an item is removed', async () => {
    await prisma.cart.update({
      where: {
        userId,
      },
      data: {
        updatedAt: oldTimestamp,
      },
    });

    await request(app.getHttpServer())
      .delete(
        `/api/cart/items/${productId}`,
      )
      .set('Cookie', customerCookie)
      .expect(204);

    const cart =
      await prisma.cart.findUniqueOrThrow({
        where: {
          userId,
        },
        select: {
          updatedAt: true,
        },
      });

    expect(
      cart.updatedAt.getTime(),
    ).toBeGreaterThan(
      oldTimestamp.getTime(),
    );
  });
});
