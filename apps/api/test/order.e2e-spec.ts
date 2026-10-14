import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
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

describe('Order checkout (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let customerId: string;
  let noProfileUserId: string;
  let secondCustomerId: string;
  let businessCustomerId: string;
  let competitorId: string;

  let customerCookie: string;
  let noProfileCookie: string;
  let secondCustomerCookie: string;
  let businessCookie: string;
  let competitorCookie: string;

  let customerProfileId: string;
  let secondCustomerProfileId: string;
  let businessProfileId: string;
  let competitorProfileId: string;

  let customerAddressId: string;
  let secondCustomerAddressId: string;
  let businessAddressId: string;
  let competitorAddressId: string;

  let standardProductId: string;
  let secondaryProductId: string;
  let inactiveProductId: string;
  let usdProductId: string;
  let concurrencyProductId: string;

  const uniqueId = Date.now();
  const password = 'OrderPassword123!';

  const emails = {
    customer: `order-customer-${uniqueId}@example.com`,
    noProfile: `order-no-profile-${uniqueId}@example.com`,
    secondCustomer: `order-second-${uniqueId}@example.com`,
    business: `order-business-${uniqueId}@example.com`,
    competitor: `order-competitor-${uniqueId}@example.com`,
  };

  const categorySlug =
    `order-category-${uniqueId}`;

  const productSlugs = {
    standard: `order-standard-${uniqueId}`,
    secondary: `order-secondary-${uniqueId}`,
    inactive: `order-inactive-${uniqueId}`,
    usd: `order-usd-${uniqueId}`,
    concurrency: `order-concurrency-${uniqueId}`,
  };

  const taxIds = {
    customer: makeNumericId(11, 1),
    secondCustomer: makeNumericId(11, 2),
    business: makeNumericId(14, 3),
    competitor: makeNumericId(11, 4),
  };

  function makeNumericId(
    length: number,
    suffix: number,
  ): string {
    const source = `${uniqueId}${suffix}`;
    return source
      .padStart(length, '0')
      .slice(-length);
  }

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
        loginResponse.headers['set-cookie'],
      ),
    };
  }

  async function createIndividualProfile(
    userId: string,
    taxId: string,
    fullName: string,
  ) {
    return prisma.customerProfile.create({
      data: {
        userId,
        accountType: 'INDIVIDUAL',
        fullName,
        taxId,
        phone: '+5561999999999',
      },
      select: {
        id: true,
      },
    });
  }

  async function createAddress(
    customerId: string,
    recipientName: string,
  ) {
    return prisma.address.create({
      data: {
        customerId,
        label: 'Home',
        recipientName,
        street: 'Snapshot Avenue',
        number: '100',
        complement: 'Apartment 10',
        neighborhood: 'Central District',
        city: 'Brasilia',
        state: 'DF',
        postalCode: '70000000',
        country: 'BR',
        isDefault: true,
      },
      select: {
        id: true,
      },
    });
  }

  async function createCart(
    userId: string,
    items: Array<{
      productId: string;
      quantity: number;
    }>,
  ) {
    return prisma.cart.create({
      data: {
        userId,
        items: {
          create: items,
        },
      },
    });
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
        emails.customer,
      );

    customerId = customer.userId;
    customerCookie = customer.cookie;

    const noProfile =
      await registerAndLogin(
        emails.noProfile,
      );

    noProfileUserId =
      noProfile.userId;
    noProfileCookie =
      noProfile.cookie;

    const secondCustomer =
      await registerAndLogin(
        emails.secondCustomer,
      );

    secondCustomerId =
      secondCustomer.userId;
    secondCustomerCookie =
      secondCustomer.cookie;

    const business =
      await registerAndLogin(
        emails.business,
      );

    businessCustomerId =
      business.userId;
    businessCookie =
      business.cookie;

    const competitor =
      await registerAndLogin(
        emails.competitor,
      );

    competitorId =
      competitor.userId;
    competitorCookie =
      competitor.cookie;

    const customerProfile =
      await createIndividualProfile(
        customerId,
        taxIds.customer,
        'Order Customer',
      );

    customerProfileId =
      customerProfile.id;

    const secondProfile =
      await createIndividualProfile(
        secondCustomerId,
        taxIds.secondCustomer,
        'Second Order Customer',
      );

    secondCustomerProfileId =
      secondProfile.id;

    const businessProfile =
      await prisma.customerProfile.create({
        data: {
          userId: businessCustomerId,
          accountType: 'BUSINESS',
          legalName:
            'BLX Order Test Company Ltd.',
          tradeName:
            'BLX Order Test',
          taxId: taxIds.business,
          phone: '+5561888888888',
        },
        select: {
          id: true,
        },
      });

    businessProfileId =
      businessProfile.id;

    const competitorProfile =
      await createIndividualProfile(
        competitorId,
        taxIds.competitor,
        'Concurrent Customer',
      );

    competitorProfileId =
      competitorProfile.id;

    const customerAddress =
      await createAddress(
        customerProfileId,
        'Order Customer',
      );

    customerAddressId =
      customerAddress.id;

    const secondAddress =
      await createAddress(
        secondCustomerProfileId,
        'Second Order Customer',
      );

    secondCustomerAddressId =
      secondAddress.id;

    const businessAddress =
      await createAddress(
        businessProfileId,
        'Business Receiving',
      );

    businessAddressId =
      businessAddress.id;

    const competitorAddress =
      await createAddress(
        competitorProfileId,
        'Concurrent Customer',
      );

    competitorAddressId =
      competitorAddress.id;

    const category =
      await prisma.category.create({
        data: {
          name:
            `Order Category ${uniqueId}`,
          slug: categorySlug,
          description:
            'Category used by order checkout tests.',
          isActive: true,
        },
      });

    const standardProduct =
      await prisma.product.create({
        data: {
          categoryId: category.id,
          name: 'Order Standard Product',
          slug: productSlugs.standard,
          sku: `ORDER-STD-${uniqueId}`,
          description:
            'Primary product used by order tests.',
          priceInCents: 100000,
          currency: 'BRL',
          isActive: true,
          inventory: {
            create: {
              quantity: 10,
              reservedQuantity: 2,
              reorderPoint: 2,
            },
          },
        },
      });

    standardProductId =
      standardProduct.id;

    const secondaryProduct =
      await prisma.product.create({
        data: {
          categoryId: category.id,
          name: 'Order Secondary Product',
          slug: productSlugs.secondary,
          sku: `ORDER-SECOND-${uniqueId}`,
          description:
            'Secondary product used by order tests.',
          priceInCents: 25000,
          currency: 'BRL',
          isActive: true,
          inventory: {
            create: {
              quantity: 5,
              reservedQuantity: 1,
              reorderPoint: 1,
            },
          },
        },
      });

    secondaryProductId =
      secondaryProduct.id;

    const inactiveProduct =
      await prisma.product.create({
        data: {
          categoryId: category.id,
          name: 'Order Inactive Product',
          slug: productSlugs.inactive,
          sku: `ORDER-INACTIVE-${uniqueId}`,
          description:
            'Inactive product used by order tests.',
          priceInCents: 40000,
          currency: 'BRL',
          isActive: false,
          inventory: {
            create: {
              quantity: 10,
              reservedQuantity: 0,
              reorderPoint: 1,
            },
          },
        },
      });

    inactiveProductId =
      inactiveProduct.id;

    const usdProduct =
      await prisma.product.create({
        data: {
          categoryId: category.id,
          name: 'Order USD Product',
          slug: productSlugs.usd,
          sku: `ORDER-USD-${uniqueId}`,
          description:
            'Different-currency product used by order tests.',
          priceInCents: 5000,
          currency: 'USD',
          isActive: true,
          inventory: {
            create: {
              quantity: 10,
              reservedQuantity: 0,
              reorderPoint: 1,
            },
          },
        },
      });

    usdProductId =
      usdProduct.id;

    const concurrencyProduct =
      await prisma.product.create({
        data: {
          categoryId: category.id,
          name:
            'Order Concurrency Product',
          slug:
            productSlugs.concurrency,
          sku:
            `ORDER-CONCURRENT-${uniqueId}`,
          description:
            'Single-stock product used to test concurrent checkout.',
          priceInCents: 90000,
          currency: 'BRL',
          isActive: true,
          inventory: {
            create: {
              quantity: 1,
              reservedQuantity: 0,
              reorderPoint: 1,
            },
          },
        },
      });

    concurrencyProductId =
      concurrencyProduct.id;
  });

  beforeEach(async () => {
    await prisma.order.deleteMany({
      where: {
        customerEmail: {
          in: Object.values(emails),
        },
      },
    });

    await prisma.cart.deleteMany({
      where: {
        userId: {
          in: [
            customerId,
            noProfileUserId,
            secondCustomerId,
            businessCustomerId,
            competitorId,
          ],
        },
      },
    });

    await prisma.product.update({
      where: {
        id: standardProductId,
      },
      data: {
        name: 'Order Standard Product',
        slug: productSlugs.standard,
        sku: `ORDER-STD-${uniqueId}`,
        priceInCents: 100000,
        currency: 'BRL',
        isActive: true,
      },
    });

    await prisma.product.update({
      where: {
        id: secondaryProductId,
      },
      data: {
        name:
          'Order Secondary Product',
        priceInCents: 25000,
        currency: 'BRL',
        isActive: true,
      },
    });

    await prisma.product.update({
      where: {
        id: inactiveProductId,
      },
      data: {
        isActive: false,
      },
    });

    await prisma.product.update({
      where: {
        id: usdProductId,
      },
      data: {
        currency: 'USD',
        isActive: true,
      },
    });

    await prisma.inventory.update({
      where: {
        productId: standardProductId,
      },
      data: {
        quantity: 10,
        reservedQuantity: 2,
      },
    });

    await prisma.inventory.update({
      where: {
        productId:
          secondaryProductId,
      },
      data: {
        quantity: 5,
        reservedQuantity: 1,
      },
    });

    await prisma.inventory.update({
      where: {
        productId: inactiveProductId,
      },
      data: {
        quantity: 10,
        reservedQuantity: 0,
      },
    });

    await prisma.inventory.update({
      where: {
        productId: usdProductId,
      },
      data: {
        quantity: 10,
        reservedQuantity: 0,
      },
    });

    await prisma.inventory.update({
      where: {
        productId:
          concurrencyProductId,
      },
      data: {
        quantity: 1,
        reservedQuantity: 0,
      },
    });

    await prisma.customerProfile.update({
      where: {
        id: customerProfileId,
      },
      data: {
        accountType: 'INDIVIDUAL',
        fullName: 'Order Customer',
        legalName: null,
        phone: '+5561999999999',
      },
    });

    await prisma.address.update({
      where: {
        id: customerAddressId,
      },
      data: {
        recipientName:
          'Order Customer',
        street: 'Snapshot Avenue',
        number: '100',
        complement: 'Apartment 10',
        neighborhood:
          'Central District',
        city: 'Brasilia',
        state: 'DF',
        postalCode: '70000000',
        country: 'BR',
      },
    });
  });

  afterAll(async () => {
    await prisma.order.deleteMany({
      where: {
        customerEmail: {
          in: Object.values(emails),
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          in: Object.values(emails),
        },
      },
    });

    await prisma.product.deleteMany({
      where: {
        slug: {
          in: Object.values(
            productSlugs,
          ),
        },
      },
    });

    await prisma.category.deleteMany({
      where: {
        slug: categorySlug,
      },
    });

    await app.close();
  });

  it('rejects checkout without authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .send({
        addressId:
          customerAddressId,
      })
      .expect(401);
  });

  it('rejects malformed checkout input and undeclared fields', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Cookie', customerCookie)
      .send({
        addressId: 'not-a-uuid',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Cookie', customerCookie)
      .send({
        addressId:
          customerAddressId,
        subtotalInCents: 1,
      })
      .expect(400);
  });

  it('requires a customer profile before checkout', async () => {
    await createCart(
      noProfileUserId,
      [
        {
          productId:
            standardProductId,
          quantity: 1,
        },
      ],
    );

    const response =
      await request(app.getHttpServer())
        .post('/api/orders')
        .set(
          'Cookie',
          noProfileCookie,
        )
        .send({
          addressId:
            customerAddressId,
        })
        .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      message:
        'Complete your customer profile before checkout.',
    });
  });

  it('rejects an address owned by another customer', async () => {
    await createCart(customerId, [
      {
        productId:
          standardProductId,
        quantity: 1,
      },
    ]);

    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Cookie', customerCookie)
      .send({
        addressId:
          secondCustomerAddressId,
      })
      .expect(404);

    const cart =
      await prisma.cart.findUnique({
        where: {
          userId: customerId,
        },
      });

    expect(cart).not.toBeNull();
  });

  it('rejects checkout when the cart is empty', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Cookie', customerCookie)
      .send({
        addressId:
          customerAddressId,
      })
      .expect(400);
  });

  it('rejects carts containing multiple currencies without mutating the cart or inventory', async () => {
    await createCart(customerId, [
      {
        productId:
          standardProductId,
        quantity: 1,
      },
      {
        productId: usdProductId,
        quantity: 1,
      },
    ]);

    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Cookie', customerCookie)
      .send({
        addressId:
          customerAddressId,
      })
      .expect(409);

    const cart =
      await prisma.cart.findUnique({
        where: {
          userId: customerId,
        },
        include: {
          items: true,
        },
      });

    expect(cart?.items).toHaveLength(2);

    const inventory =
      await prisma.inventory.findUniqueOrThrow({
        where: {
          productId:
            standardProductId,
        },
      });

    expect(
      inventory.reservedQuantity,
    ).toBe(2);

    const orderCount =
      await prisma.order.count({
        where: {
          userId: customerId,
        },
      });

    expect(orderCount).toBe(0);
  });

  it('rejects unavailable products without creating a partial order', async () => {
    await createCart(customerId, [
      {
        productId:
          inactiveProductId,
        quantity: 1,
      },
    ]);

    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Cookie', customerCookie)
      .send({
        addressId:
          customerAddressId,
      })
      .expect(409);

    const orderCount =
      await prisma.order.count({
        where: {
          userId: customerId,
        },
      });

    expect(orderCount).toBe(0);

    const cart =
      await prisma.cart.findUnique({
        where: {
          userId: customerId,
        },
      });

    expect(cart).not.toBeNull();
  });

  it('rejects insufficient stock without changing the reservation', async () => {
    await createCart(customerId, [
      {
        productId:
          standardProductId,
        quantity: 9,
      },
    ]);

    const response =
      await request(app.getHttpServer())
        .post('/api/orders')
        .set('Cookie', customerCookie)
        .send({
          addressId:
            customerAddressId,
        })
        .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      message:
        'Some products no longer have sufficient stock.',
    });

    const inventory =
      await prisma.inventory.findUniqueOrThrow({
        where: {
          productId:
            standardProductId,
        },
      });

    expect(inventory.quantity).toBe(10);
    expect(
      inventory.reservedQuantity,
    ).toBe(2);

    expect(
      await prisma.order.count({
        where: {
          userId: customerId,
        },
      }),
    ).toBe(0);

    expect(
      await prisma.cart.findUnique({
        where: {
          userId: customerId,
        },
      }),
    ).not.toBeNull();
  });

  it('creates a pending order, snapshots cart data, reserves stock, and removes the cart', async () => {
    await createCart(customerId, [
      {
        productId:
          standardProductId,
        quantity: 2,
      },
      {
        productId:
          secondaryProductId,
        quantity: 3,
      },
    ]);

    const response =
      await request(app.getHttpServer())
        .post('/api/orders')
        .set('Cookie', customerCookie)
        .send({
          addressId:
            customerAddressId,
        })
        .expect(201);

    expect(response.body.order).toMatchObject({
      status: 'PENDING_PAYMENT',
      currency: 'BRL',
      subtotalInCents: 275000,
      shippingInCents: 0,
      totalInCents: 275000,
      customerAccountType:
        'INDIVIDUAL',
      customerName:
        'Order Customer',
      customerEmail:
        emails.customer,
      customerPhone:
        '+5561999999999',
      shippingRecipientName:
        'Order Customer',
      shippingStreet:
        'Snapshot Avenue',
      shippingNumber: '100',
      shippingComplement:
        'Apartment 10',
      shippingNeighborhood:
        'Central District',
      shippingCity: 'Brasilia',
      shippingState: 'DF',
      shippingPostalCode:
        '70000000',
      shippingCountry: 'BR',
    });

    expect(
      response.body.order.orderNumber,
    ).toMatch(
      /^BLX-\d+-[A-F0-9]{8}$/,
    );

    expect(
      response.body.order,
    ).not.toHaveProperty(
      'customerTaxId',
    );

    expect(
      response.body.order
        .customerTaxIdMasked,
    ).toBe(
      `${'*'.repeat(
        taxIds.customer.length - 4,
      )}${taxIds.customer.slice(-4)}`,
    );

    expect(
      response.body.order.items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId:
            standardProductId,
          productName:
            'Order Standard Product',
          productSku:
            `ORDER-STD-${uniqueId}`,
          unitPriceInCents: 100000,
          quantity: 2,
          lineTotalInCents: 200000,
        }),
        expect.objectContaining({
          productId:
            secondaryProductId,
          productName:
            'Order Secondary Product',
          unitPriceInCents: 25000,
          quantity: 3,
          lineTotalInCents: 75000,
        }),
      ]),
    );

    const createdAt =
      new Date(
        response.body.order.createdAt,
      ).getTime();

    const expiresAt =
      new Date(
        response.body.order
          .reservationExpiresAt,
      ).getTime();

    const reservationMinutes =
      (expiresAt - createdAt) /
      60_000;

    expect(
      reservationMinutes,
    ).toBeGreaterThan(29);

    expect(
      reservationMinutes,
    ).toBeLessThanOrEqual(31);

    const standardInventory =
      await prisma.inventory.findUniqueOrThrow({
        where: {
          productId:
            standardProductId,
        },
      });

    expect(
      standardInventory.quantity,
    ).toBe(10);

    expect(
      standardInventory.reservedQuantity,
    ).toBe(4);

    const secondaryInventory =
      await prisma.inventory.findUniqueOrThrow({
        where: {
          productId:
            secondaryProductId,
        },
      });

    expect(
      secondaryInventory.quantity,
    ).toBe(5);

    expect(
      secondaryInventory.reservedQuantity,
    ).toBe(4);

    const cart =
      await prisma.cart.findUnique({
        where: {
          userId: customerId,
        },
      });

    expect(cart).toBeNull();
  });

  it('uses the current product price at checkout and preserves the order snapshot afterward', async () => {
    await createCart(customerId, [
      {
        productId:
          standardProductId,
        quantity: 2,
      },
    ]);

    await prisma.product.update({
      where: {
        id: standardProductId,
      },
      data: {
        name:
          'Updated Before Checkout',
        priceInCents: 120000,
      },
    });

    const response =
      await request(app.getHttpServer())
        .post('/api/orders')
        .set('Cookie', customerCookie)
        .send({
          addressId:
            customerAddressId,
        })
        .expect(201);

    expect(
      response.body.order
        .subtotalInCents,
    ).toBe(240000);

    expect(
      response.body.order.items[0],
    ).toMatchObject({
      productName:
        'Updated Before Checkout',
      unitPriceInCents: 120000,
      quantity: 2,
      lineTotalInCents: 240000,
    });

    await prisma.product.update({
      where: {
        id: standardProductId,
      },
      data: {
        name:
          'Changed After Checkout',
        priceInCents: 999999,
      },
    });

    const storedOrder =
      await prisma.order.findUniqueOrThrow({
        where: {
          id: response.body.order.id,
        },
        include: {
          items: true,
        },
      });

    expect(
      storedOrder.subtotalInCents,
    ).toBe(240000);

    expect(
      storedOrder.items[0],
    ).toMatchObject({
      productName:
        'Updated Before Checkout',
      unitPriceInCents: 120000,
      lineTotalInCents: 240000,
    });
  });

  it('preserves customer and shipping snapshots after account data changes', async () => {
    await createCart(customerId, [
      {
        productId:
          standardProductId,
        quantity: 1,
      },
    ]);

    const response =
      await request(app.getHttpServer())
        .post('/api/orders')
        .set('Cookie', customerCookie)
        .send({
          addressId:
            customerAddressId,
        })
        .expect(201);

    await prisma.customerProfile.update({
      where: {
        id: customerProfileId,
      },
      data: {
        fullName:
          'Changed Customer Name',
        phone:
          '+5561777777777',
      },
    });

    await prisma.address.update({
      where: {
        id: customerAddressId,
      },
      data: {
        recipientName:
          'Different Recipient',
        street:
          'Changed Street',
        number: '999',
        city: 'Goiania',
        state: 'GO',
        postalCode: '74000000',
      },
    });

    const storedOrder =
      await prisma.order.findUniqueOrThrow({
        where: {
          id: response.body.order.id,
        },
      });

    expect(storedOrder).toMatchObject({
      customerName:
        'Order Customer',
      customerPhone:
        '+5561999999999',
      shippingRecipientName:
        'Order Customer',
      shippingStreet:
        'Snapshot Avenue',
      shippingNumber: '100',
      shippingCity: 'Brasilia',
      shippingState: 'DF',
      shippingPostalCode:
        '70000000',
    });
  });

  it('creates the correct business customer snapshot', async () => {
    await createCart(
      businessCustomerId,
      [
        {
          productId:
            standardProductId,
          quantity: 1,
        },
      ],
    );

    const response =
      await request(app.getHttpServer())
        .post('/api/orders')
        .set('Cookie', businessCookie)
        .send({
          addressId:
            businessAddressId,
        })
        .expect(201);

    expect(response.body.order).toMatchObject({
      customerAccountType:
        'BUSINESS',
      customerName:
        'BLX Order Test Company Ltd.',
      customerEmail:
        emails.business,
    });

    const storedOrder =
      await prisma.order.findUniqueOrThrow({
        where: {
          id: response.body.order.id,
        },
      });

    expect(
      storedOrder.customerTaxId,
    ).toBe(taxIds.business);
  });

  it('rolls back checkout when an order snapshot violates a database constraint', async () => {
    await prisma.address.update({
      where: {
        id: customerAddressId,
      },
      data: {
        country: 'br',
      },
    });

    await createCart(customerId, [
      {
        productId:
          standardProductId,
        quantity: 2,
      },
    ]);

    const response =
      await request(app.getHttpServer())
        .post('/api/orders')
        .set('Cookie', customerCookie)
        .send({
          addressId:
            customerAddressId,
        });

    expect(
      response.status,
    ).toBeGreaterThanOrEqual(400);

    const orderCount =
      await prisma.order.count({
        where: {
          userId: customerId,
        },
      });

    expect(orderCount).toBe(0);

    const inventory =
      await prisma.inventory.findUniqueOrThrow({
        where: {
          productId:
            standardProductId,
        },
      });

    expect(
      inventory.reservedQuantity,
    ).toBe(2);

    const cart =
      await prisma.cart.findUnique({
        where: {
          userId: customerId,
        },
        include: {
          items: true,
        },
      });

    expect(cart).not.toBeNull();
    expect(
      cart?.items,
    ).toHaveLength(1);
  });

  it('prevents concurrent checkouts from overselling the same inventory', async () => {
    await createCart(customerId, [
      {
        productId:
          concurrencyProductId,
        quantity: 1,
      },
    ]);

    await createCart(competitorId, [
      {
        productId:
          concurrencyProductId,
        quantity: 1,
      },
    ]);

    const [
      firstResponse,
      secondResponse,
    ] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/orders')
        .set('Cookie', customerCookie)
        .send({
          addressId:
            customerAddressId,
        }),
      request(app.getHttpServer())
        .post('/api/orders')
        .set(
          'Cookie',
          competitorCookie,
        )
        .send({
          addressId:
            competitorAddressId,
        }),
    ]);

    const statuses = [
      firstResponse.status,
      secondResponse.status,
    ].sort((a, b) => a - b);

    expect(statuses).toEqual([
      201,
      409,
    ]);

    const inventory =
      await prisma.inventory.findUniqueOrThrow({
        where: {
          productId:
            concurrencyProductId,
        },
      });

    expect(inventory.quantity).toBe(1);

    expect(
      inventory.reservedQuantity,
    ).toBe(1);

    const successfulOrders =
      await prisma.order.count({
        where: {
          customerEmail: {
            in: [
              emails.customer,
              emails.competitor,
            ],
          },
          items: {
            some: {
              productId:
                concurrencyProductId,
            },
          },
        },
      });

    expect(successfulOrders).toBe(1);

    const remainingCarts =
      await prisma.cart.count({
        where: {
          userId: {
            in: [
              customerId,
              competitorId,
            ],
          },
        },
      });

    expect(remainingCarts).toBe(1);
  });

  it('does not expose another customer address through checkout behavior', async () => {
    await createCart(
      secondCustomerId,
      [
        {
          productId:
            secondaryProductId,
          quantity: 1,
        },
      ],
    );

    await request(app.getHttpServer())
      .post('/api/orders')
      .set(
        'Cookie',
        secondCustomerCookie,
      )
      .send({
        addressId:
          customerAddressId,
      })
      .expect(404);

    expect(
      await prisma.order.count({
        where: {
          userId:
            secondCustomerId,
        },
      }),
    ).toBe(0);
  });

  it('rejects a valid UUID that does not identify an owned address', async () => {
    await createCart(customerId, [
      {
        productId:
          standardProductId,
        quantity: 1,
      },
    ]);

    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Cookie', customerCookie)
      .send({
        addressId: randomUUID(),
      })
      .expect(404);

    expect(
      await prisma.cart.findUnique({
        where: {
          userId: customerId,
        },
      }),
    ).not.toBeNull();
  });
});
