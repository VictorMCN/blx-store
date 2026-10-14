import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';

describe('Catalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const uniqueId = Date.now();

  const audioCategorySlug =
    `audio-${uniqueId}`;
  const accessoriesCategorySlug =
    `accessories-${uniqueId}`;
  const inactiveCategorySlug =
    `legacy-${uniqueId}`;

  const alphaSlug =
    `alpha-headphones-${uniqueId}`;
  const betaSlug =
    `beta-speaker-${uniqueId}`;
  const gammaSlug =
    `gamma-cable-${uniqueId}`;
  const hiddenSlug =
    `hidden-product-${uniqueId}`;
  const legacySlug =
    `legacy-product-${uniqueId}`;

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

    const audioCategory =
      await prisma.category.create({
        data: {
          name: `Audio ${uniqueId}`,
          slug: audioCategorySlug,
          description:
            'Demo audio products for catalog tests.',
          isActive: true,
        },
      });

    const accessoriesCategory =
      await prisma.category.create({
        data: {
          name: `Accessories ${uniqueId}`,
          slug: accessoriesCategorySlug,
          description:
            'Demo accessory products for catalog tests.',
          isActive: true,
        },
      });

    const inactiveCategory =
      await prisma.category.create({
        data: {
          name: `Legacy ${uniqueId}`,
          slug: inactiveCategorySlug,
          description:
            'Inactive category used by catalog tests.',
          isActive: false,
        },
      });

    await prisma.product.create({
      data: {
        categoryId: audioCategory.id,
        name: 'Alpha Headphones',
        slug: alphaSlug,
        sku: `ALPHA-${uniqueId}`,
        description:
          'Wireless headphones with active noise cancellation.',
        priceInCents: 12999,
        currency: 'USD',
        isActive: true,
        images: {
          create: [
            {
              url: 'https://example.com/alpha-secondary.jpg',
              altText:
                'Alpha Headphones secondary view',
              position: 1,
            },
            {
              url: 'https://example.com/alpha-primary.jpg',
              altText:
                'Alpha Headphones primary view',
              position: 0,
            },
          ],
        },
        inventory: {
          create: {
            quantity: 10,
            reservedQuantity: 3,
            reorderPoint: 2,
          },
        },
      },
    });

    await prisma.product.create({
      data: {
        categoryId: audioCategory.id,
        name: 'Beta Speaker',
        slug: betaSlug,
        sku: `BETA-${uniqueId}`,
        description:
          'Portable wireless speaker for everyday listening.',
        priceInCents: 8999,
        currency: 'USD',
        isActive: true,
        inventory: {
          create: {
            quantity: 5,
            reservedQuantity: 5,
            reorderPoint: 1,
          },
        },
      },
    });

    await prisma.product.create({
      data: {
        categoryId:
          accessoriesCategory.id,
        name: 'Gamma USB-C Cable',
        slug: gammaSlug,
        sku: `GAMMA-${uniqueId}`,
        description:
          'Durable USB-C charging and data cable.',
        priceInCents: 1999,
        currency: 'USD',
        isActive: true,
      },
    });

    await prisma.product.create({
      data: {
        categoryId: audioCategory.id,
        name: 'Hidden Headphones',
        slug: hiddenSlug,
        sku: `HIDDEN-${uniqueId}`,
        description:
          'Inactive product that must never appear publicly.',
        priceInCents: 4999,
        currency: 'USD',
        isActive: false,
        inventory: {
          create: {
            quantity: 50,
            reservedQuantity: 0,
            reorderPoint: 5,
          },
        },
      },
    });

    await prisma.product.create({
      data: {
        categoryId:
          inactiveCategory.id,
        name: 'Legacy Device',
        slug: legacySlug,
        sku: `LEGACY-${uniqueId}`,
        description:
          'Active product inside an inactive category.',
        priceInCents: 5999,
        currency: 'USD',
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
  });

  afterAll(async () => {
    await prisma.product.deleteMany({
      where: {
        slug: {
          in: [
            alphaSlug,
            betaSlug,
            gammaSlug,
            hiddenSlug,
            legacySlug,
          ],
        },
      },
    });

    await prisma.category.deleteMany({
      where: {
        slug: {
          in: [
            audioCategorySlug,
            accessoriesCategorySlug,
            inactiveCategorySlug,
          ],
        },
      },
    });

    await app.close();
  });

  it('lists active categories that contain active products', async () => {
    const response =
      await request(app.getHttpServer())
        .get('/api/catalog/categories')
        .expect(200);

    const audioCategory =
      response.body.categories.find(
        (category: {
          slug: string;
        }) =>
          category.slug ===
          audioCategorySlug,
      );

    const accessoriesCategory =
      response.body.categories.find(
        (category: {
          slug: string;
        }) =>
          category.slug ===
          accessoriesCategorySlug,
      );

    const inactiveCategory =
      response.body.categories.find(
        (category: {
          slug: string;
        }) =>
          category.slug ===
          inactiveCategorySlug,
      );

    expect(audioCategory).toMatchObject({
      slug: audioCategorySlug,
      productCount: 2,
    });

    expect(accessoriesCategory).toMatchObject({
      slug: accessoriesCategorySlug,
      productCount: 1,
    });

    expect(inactiveCategory).toBeUndefined();
  });

  it('lists only publicly visible products without authentication', async () => {
    const response =
      await request(app.getHttpServer())
        .get(
          '/api/catalog/products?sort=name_asc&limit=50',
        )
        .expect(200);

    const slugs = response.body.products.map(
      (product: {
        slug: string;
      }) => product.slug,
    );

    expect(slugs).toContain(alphaSlug);
    expect(slugs).toContain(betaSlug);
    expect(slugs).toContain(gammaSlug);

    expect(slugs).not.toContain(hiddenSlug);
    expect(slugs).not.toContain(legacySlug);
  });

  it('calculates public availability from unreserved inventory', async () => {
    const response =
      await request(app.getHttpServer())
        .get(
          '/api/catalog/products?limit=50',
        )
        .expect(200);

    const alpha =
      response.body.products.find(
        (product: {
          slug: string;
        }) => product.slug === alphaSlug,
      );

    const beta =
      response.body.products.find(
        (product: {
          slug: string;
        }) => product.slug === betaSlug,
      );

    const gamma =
      response.body.products.find(
        (product: {
          slug: string;
        }) => product.slug === gammaSlug,
      );

    expect(alpha.availability.inStock).toBe(
      true,
    );

    expect(beta.availability.inStock).toBe(
      false,
    );

    expect(gamma.availability.inStock).toBe(
      false,
    );

    expect(alpha).not.toHaveProperty(
      'inventory',
    );
  });

  it('filters products that are currently in stock', async () => {
    const response =
      await request(app.getHttpServer())
        .get(
          '/api/catalog/products?inStock=true&limit=50',
        )
        .expect(200);

    const slugs = response.body.products.map(
      (product: {
        slug: string;
      }) => product.slug,
    );

    expect(slugs).toContain(alphaSlug);
    expect(slugs).not.toContain(betaSlug);
    expect(slugs).not.toContain(gammaSlug);
  });

  it('filters products that are currently out of stock', async () => {
    const response =
      await request(app.getHttpServer())
        .get(
          '/api/catalog/products?inStock=false&limit=50',
        )
        .expect(200);

    const slugs = response.body.products.map(
      (product: {
        slug: string;
      }) => product.slug,
    );

    expect(slugs).toContain(betaSlug);
    expect(slugs).toContain(gammaSlug);
    expect(slugs).not.toContain(alphaSlug);
  });

  it('searches products case-insensitively', async () => {
    const response =
      await request(app.getHttpServer())
        .get(
          '/api/catalog/products?search=ALPHA&limit=50',
        )
        .expect(200);

    expect(response.body.products).toHaveLength(
      1,
    );

    expect(
      response.body.products[0].slug,
    ).toBe(alphaSlug);
  });

  it('filters products by category slug', async () => {
    const response =
      await request(app.getHttpServer())
        .get(
          `/api/catalog/products?category=${audioCategorySlug}&sort=name_asc&limit=50`,
        )
        .expect(200);

    const slugs = response.body.products.map(
      (product: {
        slug: string;
      }) => product.slug,
    );

    expect(slugs).toEqual([
      alphaSlug,
      betaSlug,
    ]);
  });

  it('filters products by price range', async () => {
    const response =
      await request(app.getHttpServer())
        .get(
          '/api/catalog/products?minPriceInCents=8000&maxPriceInCents=10000&limit=50',
        )
        .expect(200);

    const matchingProduct =
      response.body.products.find(
        (product: {
          slug: string;
        }) => product.slug === betaSlug,
      );

    expect(matchingProduct).toBeDefined();

    expect(
      response.body.products.some(
        (product: {
          slug: string;
        }) => product.slug === alphaSlug,
      ),
    ).toBe(false);

    expect(
      response.body.products.some(
        (product: {
          slug: string;
        }) => product.slug === gammaSlug,
      ),
    ).toBe(false);
  });

  it('rejects an inverted price range', async () => {
    const response =
      await request(app.getHttpServer())
        .get(
          '/api/catalog/products?minPriceInCents=10000&maxPriceInCents=5000',
        )
        .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      message:
        'Minimum price cannot be greater than maximum price.',
    });
  });

  it('supports sorting and pagination', async () => {
    const firstPage =
      await request(app.getHttpServer())
        .get(
          '/api/catalog/products?sort=price_asc&page=1&limit=2',
        )
        .expect(200);

    expect(
      firstPage.body.products,
    ).toHaveLength(2);

    expect(
      firstPage.body.products[0].priceInCents,
    ).toBeLessThanOrEqual(
      firstPage.body.products[1].priceInCents,
    );

    expect(
      firstPage.body.pagination,
    ).toMatchObject({
      page: 1,
      limit: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });

    const secondPage =
      await request(app.getHttpServer())
        .get(
          '/api/catalog/products?sort=price_asc&page=2&limit=2',
        )
        .expect(200);

    expect(
      secondPage.body.pagination,
    ).toMatchObject({
      page: 2,
      limit: 2,
      hasPreviousPage: true,
    });
  });

  it('returns a product by slug with ordered images', async () => {
    const response =
      await request(app.getHttpServer())
        .get(
          `/api/catalog/products/${alphaSlug}`,
        )
        .expect(200);

    expect(response.body).toMatchObject({
      product: {
        name: 'Alpha Headphones',
        slug: alphaSlug,
        priceInCents: 12999,
        currency: 'USD',
        availability: {
          inStock: true,
        },
      },
    });

    expect(
      response.body.product.images,
    ).toHaveLength(2);

    expect(
      response.body.product.images[0].position,
    ).toBe(0);

    expect(
      response.body.product.images[1].position,
    ).toBe(1);

    expect(
      response.body.product,
    ).not.toHaveProperty('inventory');
  });

  it('returns 404 for an inactive product', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/catalog/products/${hiddenSlug}`,
      )
      .expect(404);
  });

  it('returns 404 for a product inside an inactive category', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/catalog/products/${legacySlug}`,
      )
      .expect(404);
  });

  it('returns 404 for an unknown product slug', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/catalog/products/not-found-${uniqueId}`,
      )
      .expect(404);
  });

  it('rejects invalid catalog query parameters', async () => {
    await request(app.getHttpServer())
      .get(
        '/api/catalog/products?page=0',
      )
      .expect(400);

    await request(app.getHttpServer())
      .get(
        '/api/catalog/products?limit=51',
      )
      .expect(400);

    await request(app.getHttpServer())
      .get(
        '/api/catalog/products?sort=invalid',
      )
      .expect(400);

    await request(app.getHttpServer())
      .get(
        '/api/catalog/products?inStock=maybe',
      )
      .expect(400);
  });
});
