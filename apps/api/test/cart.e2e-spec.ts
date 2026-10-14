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

describe('Cart (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let customerCookie: string;
  let secondCustomerCookie: string;

  let standardProductId: string;
  let limitedProductId: string;
  let outOfStockProductId: string;
  let inactiveProductId: string;
  let inactiveCategoryProductId: string;
  let mutableStockProductId: string;
  let deactivatingProductId: string;

  const uniqueId = Date.now();

  const customerEmail =
    `cart-customer-${uniqueId}@example.com`;

  const secondCustomerEmail =
    `cart-second-${uniqueId}@example.com`;

  const password = 'CartPassword123!';

  const activeCategorySlug =
    `cart-active-${uniqueId}`;

  const inactiveCategorySlug =
    `cart-inactive-${uniqueId}`;

  const productSlugs = {
    standard: `cart-standard-${uniqueId}`,
    limited: `cart-limited-${uniqueId}`,
    outOfStock: `cart-out-of-stock-${uniqueId}`,
    inactive: `cart-inactive-product-${uniqueId}`,
    inactiveCategory:
      `cart-inactive-category-product-${uniqueId}`,
    mutableStock:
      `cart-mutable-stock-${uniqueId}`,
    deactivating:
      `cart-deactivating-${uniqueId}`,
  };

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

    app = moduleFixture.createNestApplication();

    configureApp(app);

    prisma =
      moduleFixture.get<PrismaService>(
        PrismaService,
      );

    await app.init();

    const activeCategory =
      await prisma.category.create({
        data: {
          name: `Cart Active ${uniqueId}`,
          slug: activeCategorySlug,
          description:
            'Active category used by cart tests.',
          isActive: true,
        },
      });

    const inactiveCategory =
      await prisma.category.create({
        data: {
          name: `Cart Inactive ${uniqueId}`,
          slug: inactiveCategorySlug,
          description:
            'Inactive category used by cart tests.',
          isActive: false,
        },
      });

    const standardProduct =
      await prisma.product.create({
        data: {
          categoryId: activeCategory.id,
          name: 'Cart Standard Product',
          slug: productSlugs.standard,
          sku: `CART-STD-${uniqueId}`,
          description:
            'Standard product used by cart tests.',
          priceInCents: 129900,
          currency: 'BRL',
          isActive: true,
          images: {
            create: [
              {
                url: 'https://example.com/cart-standard-secondary.jpg',
                altText:
                  'Cart standard secondary image',
                position: 1,
              },
              {
                url: 'https://example.com/cart-standard-primary.jpg',
                altText:
                  'Cart standard primary image',
                position: 0,
              },
            ],
          },
          inventory: {
            create: {
              quantity: 10,
              reservedQuantity: 2,
              reorderPoint: 2,
            },
          },
        },
      });

    standardProductId = standardProduct.id;

    const limitedProduct =
      await prisma.product.create({
        data: {
          categoryId: activeCategory.id,
          name: 'Cart Limited Product',
          slug: productSlugs.limited,
          sku: `CART-LIMITED-${uniqueId}`,
          description:
            'Product with almost all inventory reserved.',
          priceInCents: 49900,
          currency: 'BRL',
          isActive: true,
          inventory: {
            create: {
              quantity: 5,
              reservedQuantity: 4,
              reorderPoint: 1,
            },
          },
        },
      });

    limitedProductId = limitedProduct.id;

    const outOfStockProduct =
      await prisma.product.create({
        data: {
          categoryId: activeCategory.id,
          name: 'Cart Out Of Stock Product',
          slug: productSlugs.outOfStock,
          sku: `CART-OOS-${uniqueId}`,
          description:
            'Product with no currently available inventory.',
          priceInCents: 29900,
          currency: 'BRL',
          isActive: true,
          inventory: {
            create: {
              quantity: 4,
              reservedQuantity: 4,
              reorderPoint: 1,
            },
          },
        },
      });

    outOfStockProductId =
      outOfStockProduct.id;

    const inactiveProduct =
      await prisma.product.create({
        data: {
          categoryId: activeCategory.id,
          name: 'Cart Inactive Product',
          slug: productSlugs.inactive,
          sku: `CART-INACTIVE-${uniqueId}`,
          description:
            'Inactive product used by cart tests.',
          priceInCents: 19900,
          currency: 'BRL',
          isActive: false,
          inventory: {
            create: {
              quantity: 20,
              reservedQuantity: 0,
              reorderPoint: 2,
            },
          },
        },
      });

    inactiveProductId = inactiveProduct.id;

    const inactiveCategoryProduct =
      await prisma.product.create({
        data: {
          categoryId: inactiveCategory.id,
          name:
            'Cart Inactive Category Product',
          slug:
            productSlugs.inactiveCategory,
          sku: `CART-INACTIVE-CATEGORY-${uniqueId}`,
          description:
            'Active product inside an inactive category.',
          priceInCents: 39900,
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

    inactiveCategoryProductId =
      inactiveCategoryProduct.id;

    const mutableStockProduct =
      await prisma.product.create({
        data: {
          categoryId: activeCategory.id,
          name: 'Cart Mutable Stock Product',
          slug: productSlugs.mutableStock,
          sku: `CART-MUTABLE-${uniqueId}`,
          description:
            'Product whose available inventory changes during tests.',
          priceInCents: 79900,
          currency: 'BRL',
          isActive: true,
          inventory: {
            create: {
              quantity: 6,
              reservedQuantity: 0,
              reorderPoint: 1,
            },
          },
        },
      });

    mutableStockProductId =
      mutableStockProduct.id;

    const deactivatingProduct =
      await prisma.product.create({
        data: {
          categoryId: activeCategory.id,
          name: 'Cart Deactivating Product',
          slug: productSlugs.deactivating,
          sku: `CART-DEACT-${uniqueId}`,
          description:
            'Product that becomes unavailable after being added.',
          priceInCents: 59900,
          currency: 'BRL',
          isActive: true,
          inventory: {
            create: {
              quantity: 10,
              reservedQuantity: 0,
              reorderPoint: 2,
            },
          },
        },
      });

    deactivatingProductId =
      deactivatingProduct.id;

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: customerEmail,
        password,
      })
      .expect(201);

    const loginResponse =
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: customerEmail,
          password,
        })
        .expect(200);

    customerCookie = extractCookie(
      loginResponse.headers['set-cookie'],
    );

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: secondCustomerEmail,
        password,
      })
      .expect(201);

    const secondLoginResponse =
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: secondCustomerEmail,
          password,
        })
        .expect(200);

    secondCustomerCookie = extractCookie(
      secondLoginResponse.headers[
        'set-cookie'
      ],
    );
  });

  afterAll(async () => {
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

    await prisma.product.deleteMany({
      where: {
        slug: {
          in: Object.values(productSlugs),
        },
      },
    });

    await prisma.category.deleteMany({
      where: {
        slug: {
          in: [
            activeCategorySlug,
            inactiveCategorySlug,
          ],
        },
      },
    });

    await app.close();
  });

  it('rejects cart access without authentication', async () => {
    await request(app.getHttpServer())
      .get('/api/cart')
      .expect(401);
  });

  it('returns an empty cart before any item is added', async () => {
    const response =
      await request(app.getHttpServer())
        .get('/api/cart')
        .set('Cookie', customerCookie)
        .expect(200);

    expect(response.body).toEqual({
      cart: {
        id: null,
        items: [],
        distinctItemCount: 0,
        totalItemCount: 0,
        subtotalInCents: 0,
        currency: null,
        canCheckout: false,
        createdAt: null,
        updatedAt: null,
      },
    });
  });

  it('adds an available product and calculates totals on the server', async () => {
    const response =
      await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Cookie', customerCookie)
        .send({
          productId: standardProductId,
          quantity: 2,
        })
        .expect(201);

    expect(response.body.cart).toMatchObject({
      distinctItemCount: 1,
      totalItemCount: 2,
      subtotalInCents: 259800,
      currency: 'BRL',
      canCheckout: true,
    });

    expect(
      response.body.cart.items,
    ).toHaveLength(1);

    expect(
      response.body.cart.items[0],
    ).toMatchObject({
      quantity: 2,
      lineTotalInCents: 259800,
      product: {
        id: standardProductId,
        name: 'Cart Standard Product',
        priceInCents: 129900,
        currency: 'BRL',
        primaryImage: {
          position: 0,
        },
      },
      availability: {
        isAvailable: true,
        reason: null,
      },
    });
  });

  it('increments the existing line instead of duplicating the product', async () => {
    const response =
      await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Cookie', customerCookie)
        .send({
          productId: standardProductId,
          quantity: 3,
        })
        .expect(201);

    expect(
      response.body.cart.items,
    ).toHaveLength(1);

    expect(
      response.body.cart.items[0].quantity,
    ).toBe(5);

    expect(
      response.body.cart.totalItemCount,
    ).toBe(5);
  });

  it('keeps carts isolated between authenticated users', async () => {
    const emptySecondCart =
      await request(app.getHttpServer())
        .get('/api/cart')
        .set(
          'Cookie',
          secondCustomerCookie,
        )
        .expect(200);

    expect(
      emptySecondCart.body.cart.items,
    ).toHaveLength(0);

    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set(
        'Cookie',
        secondCustomerCookie,
      )
      .send({
        productId: standardProductId,
        quantity: 1,
      })
      .expect(201);

    const firstCustomerCart =
      await request(app.getHttpServer())
        .get('/api/cart')
        .set('Cookie', customerCookie)
        .expect(200);

    expect(
      firstCustomerCart.body.cart.items[0]
        .quantity,
    ).toBe(5);
  });

  it('rejects an unknown product', async () => {
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Cookie', customerCookie)
      .send({
        productId: randomUUID(),
        quantity: 1,
      })
      .expect(404);
  });

  it('rejects an inactive product', async () => {
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Cookie', customerCookie)
      .send({
        productId: inactiveProductId,
        quantity: 1,
      })
      .expect(404);
  });

  it('rejects a product inside an inactive category', async () => {
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Cookie', customerCookie)
      .send({
        productId:
          inactiveCategoryProductId,
        quantity: 1,
      })
      .expect(404);
  });

  it('rejects a product with no available inventory', async () => {
    const response =
      await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Cookie', customerCookie)
        .send({
          productId:
            outOfStockProductId,
          quantity: 1,
        })
        .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      message: 'Product is out of stock.',
    });
  });

  it('respects reserved inventory when validating quantity', async () => {
    const response =
      await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Cookie', customerCookie)
        .send({
          productId: limitedProductId,
          quantity: 2,
        })
        .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      message:
        'Requested quantity exceeds available stock.',
    });
  });

  it('rejects invalid quantities and undeclared ownership fields', async () => {
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Cookie', customerCookie)
      .send({
        productId: standardProductId,
        quantity: 100,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Cookie', customerCookie)
      .send({
        productId: standardProductId,
        quantity: 1,
        userId: randomUUID(),
      })
      .expect(400);
  });

  it('updates the quantity of an owned cart item', async () => {
    const response =
      await request(app.getHttpServer())
        .put(
          `/api/cart/items/${standardProductId}`,
        )
        .set('Cookie', customerCookie)
        .send({
          quantity: 4,
        })
        .expect(200);

    expect(
      response.body.cart.items[0].quantity,
    ).toBe(4);

    expect(
      response.body.cart.subtotalInCents,
    ).toBe(519600);
  });

  it('rejects an update that exceeds currently available stock', async () => {
    const response =
      await request(app.getHttpServer())
        .put(
          `/api/cart/items/${standardProductId}`,
        )
        .set('Cookie', customerCookie)
        .send({
          quantity: 9,
        })
        .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      message:
        'Requested quantity exceeds available stock.',
    });

    const cart =
      await request(app.getHttpServer())
        .get('/api/cart')
        .set('Cookie', customerCookie)
        .expect(200);

    const standardItem =
      cart.body.cart.items.find(
        (item: {
          product: {
            id: string;
          };
          quantity: number;
        }) =>
          item.product.id ===
          standardProductId,
      );

    expect(standardItem.quantity).toBe(4);
  });

  it('detects inventory changes after an item was added and blocks checkout', async () => {
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Cookie', customerCookie)
      .send({
        productId:
          mutableStockProductId,
        quantity: 3,
      })
      .expect(201);

    await prisma.inventory.update({
      where: {
        productId:
          mutableStockProductId,
      },
      data: {
        reservedQuantity: 5,
      },
    });

    const response =
      await request(app.getHttpServer())
        .get('/api/cart')
        .set('Cookie', customerCookie)
        .expect(200);

    const mutableItem =
      response.body.cart.items.find(
        (item: {
          product: {
            id: string;
          };
          availability: {
            isAvailable: boolean;
            reason: string | null;
          };
        }) =>
          item.product.id ===
          mutableStockProductId,
      );

    expect(
      mutableItem.availability,
    ).toEqual({
      isAvailable: false,
      reason: 'INSUFFICIENT_STOCK',
    });

    expect(
      response.body.cart.canCheckout,
    ).toBe(false);
  });

  it('detects when a product becomes inactive after being added', async () => {
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Cookie', customerCookie)
      .send({
        productId:
          deactivatingProductId,
        quantity: 1,
      })
      .expect(201);

    await prisma.product.update({
      where: {
        id: deactivatingProductId,
      },
      data: {
        isActive: false,
      },
    });

    const response =
      await request(app.getHttpServer())
        .get('/api/cart')
        .set('Cookie', customerCookie)
        .expect(200);

    const deactivatedItem =
      response.body.cart.items.find(
        (item: {
          product: {
            id: string;
          };
          availability: {
            isAvailable: boolean;
            reason: string | null;
          };
        }) =>
          item.product.id ===
          deactivatingProductId,
      );

    expect(
      deactivatedItem.availability,
    ).toEqual({
      isAvailable: false,
      reason: 'PRODUCT_UNAVAILABLE',
    });

    expect(
      response.body.cart.canCheckout,
    ).toBe(false);
  });

  it('rejects malformed product identifiers', async () => {
    await request(app.getHttpServer())
      .put(
        '/api/cart/items/not-a-uuid',
      )
      .set('Cookie', customerCookie)
      .send({
        quantity: 1,
      })
      .expect(400);

    await request(app.getHttpServer())
      .delete(
        '/api/cart/items/not-a-uuid',
      )
      .set('Cookie', customerCookie)
      .expect(400);
  });

  it('removes an item only from the authenticated customer cart', async () => {
    await request(app.getHttpServer())
      .delete(
        `/api/cart/items/${standardProductId}`,
      )
      .set('Cookie', customerCookie)
      .expect(204);

    const firstCart =
      await request(app.getHttpServer())
        .get('/api/cart')
        .set('Cookie', customerCookie)
        .expect(200);

    expect(
      firstCart.body.cart.items.some(
        (item: {
          product: {
            id: string;
          };
        }) =>
          item.product.id ===
          standardProductId,
      ),
    ).toBe(false);

    const secondCart =
      await request(app.getHttpServer())
        .get('/api/cart')
        .set(
          'Cookie',
          secondCustomerCookie,
        )
        .expect(200);

    expect(
      secondCart.body.cart.items.some(
        (item: {
          product: {
            id: string;
          };
        }) =>
          item.product.id ===
          standardProductId,
      ),
    ).toBe(true);
  });

  it('clears only the authenticated customer cart', async () => {
    await request(app.getHttpServer())
      .delete('/api/cart')
      .set('Cookie', customerCookie)
      .expect(204);

    const firstCart =
      await request(app.getHttpServer())
        .get('/api/cart')
        .set('Cookie', customerCookie)
        .expect(200);

    expect(
      firstCart.body.cart.items,
    ).toEqual([]);

    expect(
      firstCart.body.cart.canCheckout,
    ).toBe(false);

    const secondCart =
      await request(app.getHttpServer())
        .get('/api/cart')
        .set(
          'Cookie',
          secondCustomerCookie,
        )
        .expect(200);

    expect(
      secondCart.body.cart.items,
    ).toHaveLength(1);
  });
});
