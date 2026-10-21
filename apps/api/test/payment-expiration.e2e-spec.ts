import { ConfigModule } from '@nestjs/config';
import {
  Test,
  type TestingModule,
} from '@nestjs/testing';
import type Stripe from 'stripe';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';
import { PrismaModule } from '../src/database/prisma.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { PaymentExpirationService } from '../src/payment/payment-expiration.service.js';
import { PaymentService } from '../src/payment/payment.service.js';
import { StripeService } from '../src/payment/stripe.service.js';

interface CreatePaymentIntentInput {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amountInCents: number;
  currency: string;
}

class FakeStripeExpirationService {
  private readonly paymentIntents =
    new Map<
      string,
      Stripe.PaymentIntent
    >();

  createCalls: string[] = [];
  retrieveCalls: string[] = [];
  cancelCalls: string[] = [];

  onCreate:
    | ((
        paymentIntent:
          Stripe.PaymentIntent,
      ) => Promise<void>)
    | null = null;

  async createPaymentIntent(
    input: CreatePaymentIntentInput,
  ): Promise<Stripe.PaymentIntent> {
    this.createCalls.push(
      input.paymentId,
    );

    const existing =
      Array.from(
        this.paymentIntents.values(),
      ).find(
        (paymentIntent) =>
          paymentIntent.metadata
            .paymentId ===
          input.paymentId,
      );

    if (existing) {
      return existing;
    }

    const paymentIntent = {
      id:
        `pi_exp_${input.paymentId}`,
      object: 'payment_intent',
      amount:
        input.amountInCents,
      currency:
        input.currency.toLowerCase(),
      status:
        'requires_payment_method',
      client_secret:
        `secret_${input.paymentId}`,
      metadata: {
        paymentId:
          input.paymentId,
        orderId:
          input.orderId,
        orderNumber:
          input.orderNumber,
      },
    } as Stripe.PaymentIntent;

    this.paymentIntents.set(
      paymentIntent.id,
      paymentIntent,
    );

    if (this.onCreate) {
      await this.onCreate(
        paymentIntent,
      );
    }

    return paymentIntent;
  }

  async retrievePaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    this.retrieveCalls.push(
      paymentIntentId,
    );

    const paymentIntent =
      this.paymentIntents.get(
        paymentIntentId,
      );

    if (!paymentIntent) {
      throw new Error(
        'Fake PaymentIntent not found.',
      );
    }

    return paymentIntent;
  }

  async cancelPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    this.cancelCalls.push(
      paymentIntentId,
    );

    const paymentIntent =
      this.paymentIntents.get(
        paymentIntentId,
      );

    if (!paymentIntent) {
      throw new Error(
        'Fake PaymentIntent not found.',
      );
    }

    const canceled = {
      ...paymentIntent,
      status: 'canceled',
      cancellation_reason:
        'requested_by_customer',
    } as Stripe.PaymentIntent;

    this.paymentIntents.set(
      paymentIntentId,
      canceled,
    );

    return canceled;
  }

  setPaymentIntent(
    paymentIntent: Stripe.PaymentIntent,
  ) {
    this.paymentIntents.set(
      paymentIntent.id,
      paymentIntent,
    );
  }

  getPaymentIntent(
    paymentIntentId: string,
  ) {
    return this.paymentIntents.get(
      paymentIntentId,
    );
  }

  reset() {
    this.paymentIntents.clear();

    this.createCalls = [];
    this.retrieveCalls = [];
    this.cancelCalls = [];

    this.onCreate = null;
  }
}

describe(
  'Payment reservation expiration (e2e)',
  () => {
    let moduleRef: TestingModule;
    let prisma: PrismaService;

    let expirationService:
      PaymentExpirationService;

    let paymentService:
      PaymentService;

    let fakeStripe:
      FakeStripeExpirationService;

    let categoryId: string;

    const createdOrderIds: string[] =
      [];

    const createdProductIds: string[] =
      [];

    const createdUserIds: string[] =
      [];

    const uniqueId = Date.now();

    let scenarioCounter = 0;

    function createPaymentIntent(
      input: {
        id: string;
        paymentId: string;
        orderId: string;
        amountInCents: number;
        status:
          Stripe.PaymentIntent.Status;
      },
    ): Stripe.PaymentIntent {
      return {
        id: input.id,
        object: 'payment_intent',
        amount:
          input.amountInCents,
        currency: 'brl',
        status: input.status,
        client_secret:
          `secret_${input.id}`,
        metadata: {
          paymentId:
            input.paymentId,
          orderId:
            input.orderId,
        },
      } as Stripe.PaymentIntent;
    }

    async function createProduct(
      quantity: number,
    ) {
      scenarioCounter += 1;

      const suffix =
        `${String(uniqueId).slice(-6)}-${scenarioCounter}`;

      const product =
        await prisma.product.create({
          data: {
            categoryId,

            name:
              `Expiration Product ${scenarioCounter}`,

            slug:
              `payment-expiration-${suffix}`,

            sku:
              `EXP-${suffix}`,

            description:
              'Product used to verify payment reservation expiration.',

            priceInCents:
              50000,

            currency: 'BRL',

            inventory: {
              create: {
                quantity: 10,

                reservedQuantity:
                  quantity,

                reorderPoint: 1,
              },
            },
          },
          select: {
            id: true,
            slug: true,
            sku: true,

            inventory: {
              select: {
                id: true,
              },
            },
          },
        });

      createdProductIds.push(
        product.id,
      );

      if (!product.inventory) {
        throw new Error(
          'Expiration test inventory was not created.',
        );
      }

      return product;
    }

    async function createOrder(
      input: {
        productId: string;
        productSlug: string;
        productSku: string;
        quantity: number;
        expired: boolean;
        userId?: string;
      },
    ) {
      const now = Date.now();

      const order =
        await prisma.order.create({
          data: {
            userId:
              input.userId,

            orderNumber:
              `BLX-E-${String(uniqueId).slice(-5)}-${scenarioCounter}`,

            status:
              'PENDING_PAYMENT',

            currency: 'BRL',

            subtotalInCents:
              50000 *
              input.quantity,

            shippingInCents: 0,

            totalInCents:
              50000 *
              input.quantity,

            customerAccountType:
              'INDIVIDUAL',

            customerName:
              'Expiration Customer',

            customerEmail:
              `expiration-${uniqueId}-${scenarioCounter}@example.com`,

            customerTaxId:
              '12345678901',

            customerPhone:
              '+5561999999999',

            shippingRecipientName:
              'Expiration Customer',

            shippingStreet:
              'Expiration Avenue',

            shippingNumber:
              '100',

            shippingComplement:
              null,

            shippingNeighborhood:
              'Central District',

            shippingCity:
              'Brasilia',

            shippingState:
              'DF',

            shippingPostalCode:
              '70000000',

            shippingCountry:
              'BR',

            createdAt:
              input.expired
                ? new Date(
                    now -
                      35 *
                        60 *
                        1000,
                  )
                : new Date(),

            reservationExpiresAt:
              input.expired
                ? new Date(
                    now -
                      5 *
                        60 *
                        1000,
                  )
                : new Date(
                    now +
                      30 *
                        60 *
                        1000,
                  ),

            items: {
              create: [
                {
                  productId:
                    input.productId,

                  productName:
                    'Expiration Product',

                  productSlug:
                    input.productSlug,

                  productSku:
                    input.productSku,

                  unitPriceInCents:
                    50000,

                  quantity:
                    input.quantity,

                  lineTotalInCents:
                    50000 *
                    input.quantity,
                },
              ],
            },
          },
        });

      createdOrderIds.push(
        order.id,
      );

      return order;
    }

    async function createScenario(
      options?: {
        expired?: boolean;
        quantity?: number;

        paymentStatus?:
          | 'PENDING'
          | 'PROCESSING'
          | 'FAILED';

        providerStatus?:
          | Stripe.PaymentIntent.Status
          | null;
      },
    ) {
      const quantity =
        options?.quantity ?? 2;

      const product =
        await createProduct(
          quantity,
        );

      const order =
        await createOrder({
          productId:
            product.id,

          productSlug:
            product.slug,

          productSku:
            product.sku,

          quantity,

          expired:
            options?.expired ??
            true,
        });

      const providerStatus =
        options?.providerStatus ===
        undefined
          ? 'requires_payment_method'
          : options.providerStatus;

      const paymentIntentId =
        providerStatus
          ? `pi_exp_${uniqueId}_${scenarioCounter}`
          : null;

      const payment =
        await prisma.payment.create({
          data: {
            orderId:
              order.id,

            status:
              options?.paymentStatus ??
              'PENDING',

            amountInCents:
              50000 *
              quantity,

            currency:
              'BRL',

            providerPaymentIntentId:
              paymentIntentId,
          },
        });

      if (
        paymentIntentId &&
        providerStatus
      ) {
        fakeStripe.setPaymentIntent(
          createPaymentIntent({
            id:
              paymentIntentId,

            paymentId:
              payment.id,

            orderId:
              order.id,

            amountInCents:
              50000 *
              quantity,

            status:
              providerStatus,
          }),
        );
      }

      return {
        orderId:
          order.id,

        paymentId:
          payment.id,

        productId:
          product.id,

        inventoryId:
          product.inventory.id,

        paymentIntentId,

        quantity,
      };
    }

    async function readScenario(
      scenario: {
        orderId: string;
        paymentId: string;
        inventoryId: string;
      },
    ) {
      const [
        order,
        payment,
        inventory,
      ] = await Promise.all([
        prisma.order.findUniqueOrThrow({
          where: {
            id: scenario.orderId,
          },
          select: {
            status: true,
          },
        }),

        prisma.payment.findUniqueOrThrow({
          where: {
            id: scenario.paymentId,
          },
          select: {
            status: true,

            providerPaymentIntentId:
              true,

            failureCode: true,

            failureMessage: true,
          },
        }),

        prisma.inventory.findUniqueOrThrow({
          where: {
            id:
              scenario.inventoryId,
          },
          select: {
            quantity: true,

            reservedQuantity:
              true,
          },
        }),
      ]);

      return {
        order,
        payment,
        inventory,
      };
    }

    async function cleanupScenarios() {
      if (
        createdOrderIds.length >
        0
      ) {
        await prisma.payment.deleteMany({
          where: {
            orderId: {
              in:
                createdOrderIds,
            },
          },
        });

        await prisma.order.deleteMany({
          where: {
            id: {
              in:
                createdOrderIds,
            },
          },
        });
      }

      if (
        createdProductIds.length >
        0
      ) {
        await prisma.product.deleteMany({
          where: {
            id: {
              in:
                createdProductIds,
            },
          },
        });
      }

      if (
        createdUserIds.length >
        0
      ) {
        await prisma.user.deleteMany({
          where: {
            id: {
              in:
                createdUserIds,
            },
          },
        });
      }

      createdOrderIds.length = 0;
      createdProductIds.length = 0;
      createdUserIds.length = 0;
    }

    beforeAll(async () => {
      fakeStripe =
        new FakeStripeExpirationService();

      moduleRef =
        await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              isGlobal: true,
              envFilePath: [
                '.env',
                '../../.env',
              ],
            }),

            PrismaModule,
          ],

          providers: [
            PaymentService,
            PaymentExpirationService,

            {
              provide:
                StripeService,

              useValue:
                fakeStripe,
            },
          ],
        }).compile();

      await moduleRef.init();

      prisma =
        moduleRef.get(
          PrismaService,
        );

      paymentService =
        moduleRef.get(
          PaymentService,
        );

      expirationService =
        moduleRef.get(
          PaymentExpirationService,
        );

      const category =
        await prisma.category.create({
          data: {
            name:
              `Payment Expiration ${uniqueId}`,

            slug:
              `payment-expiration-${uniqueId}`,

            description:
              'Category used by payment expiration tests.',

            isActive: true,
          },
        });

      categoryId =
        category.id;
    });

    afterEach(async () => {
      await cleanupScenarios();

      fakeStripe.reset();
    });

    afterAll(async () => {
      await cleanupScenarios();

      if (categoryId) {
        await prisma.category.deleteMany({
          where: {
            id: categoryId,
          },
        });
      }

      if (moduleRef) {
        await moduleRef.close();
      }
    });

    it(
      'keeps inventory consistent when two worker instances expire the same order',
      async () => {
        const scenario = await createScenario();

        const secondWorker =
          new PaymentExpirationService(
            prisma,
            fakeStripe as unknown as StripeService,
            paymentService,
          );

        await Promise.all([
          expirationService.expirePendingOrders(),
          secondWorker.expirePendingOrders(),
        ]);

        const state = await readScenario(scenario);

        expect(state.order.status).toBe('EXPIRED');
        expect(state.payment.status).toBe('CANCELED');

        expect(state.inventory.quantity).toBe(10);
        expect(
          state.inventory.reservedQuantity,
        ).toBe(0);

        expect(fakeStripe.cancelCalls).toContain(
          scenario.paymentIntentId,
        );
      },
    );

    it(
      'recovers an unlinked provider PaymentIntent before releasing an expired reservation',
      async () => {
        const scenario =
          await createScenario({
            providerStatus:
              null,
          });

        await expirationService.expirePendingOrders();

        const state =
          await readScenario(
            scenario,
          );

        expect(
          state.order.status,
        ).toBe('EXPIRED');

        expect(
          state.payment.status,
        ).toBe('CANCELED');

        expect(
          state.payment
            .providerPaymentIntentId,
        ).not.toBeNull();

        expect(
          state.inventory.quantity,
        ).toBe(10);

        expect(
          state.inventory
            .reservedQuantity,
        ).toBe(0);

        expect(
          fakeStripe.createCalls,
        ).toEqual([
          scenario.paymentId,
        ]);

        expect(
          fakeStripe.cancelCalls,
        ).toHaveLength(1);
      },
    );

    it(
      'cancels an existing payable PaymentIntent before releasing the reservation',
      async () => {
        const scenario =
          await createScenario();

        await expirationService.expirePendingOrders();

        const state =
          await readScenario(
            scenario,
          );

        expect(
          state.order.status,
        ).toBe('EXPIRED');

        expect(
          state.payment.status,
        ).toBe('CANCELED');

        expect(
          state.inventory
            .reservedQuantity,
        ).toBe(0);

        expect(
          fakeStripe.retrieveCalls,
        ).toEqual([
          scenario.paymentIntentId,
        ]);

        expect(
          fakeStripe.cancelCalls,
        ).toEqual([
          scenario.paymentIntentId,
        ]);
      },
    );

    it(
      'expires a failed reusable payment attempt safely',
      async () => {
        const scenario =
          await createScenario({
            paymentStatus:
              'FAILED',

            providerStatus:
              'requires_payment_method',
          });

        await expirationService.expirePendingOrders();

        const state =
          await readScenario(
            scenario,
          );

        expect(
          state.order.status,
        ).toBe('EXPIRED');

        expect(
          state.payment.status,
        ).toBe('CANCELED');

        expect(
          state.inventory
            .reservedQuantity,
        ).toBe(0);
      },
    );

    it(
      'is idempotent when expiration runs more than once',
      async () => {
        const scenario =
          await createScenario();

        await expirationService.expirePendingOrders();

        await expirationService.expirePendingOrders();

        const state =
          await readScenario(
            scenario,
          );

        expect(
          state.order.status,
        ).toBe('EXPIRED');

        expect(
          state.inventory.quantity,
        ).toBe(10);

        expect(
          state.inventory
            .reservedQuantity,
        ).toBe(0);

        expect(
          fakeStripe.cancelCalls,
        ).toHaveLength(1);
      },
    );

    it(
      'does not touch a reservation that has not expired',
      async () => {
        const scenario =
          await createScenario({
            expired: false,
          });

        await expirationService.expirePendingOrders();

        const state =
          await readScenario(
            scenario,
          );

        expect(
          state.order.status,
        ).toBe(
          'PENDING_PAYMENT',
        );

        expect(
          state.payment.status,
        ).toBe('PENDING');

        expect(
          state.inventory
            .reservedQuantity,
        ).toBe(
          scenario.quantity,
        );

        expect(
          fakeStripe.retrieveCalls,
        ).toHaveLength(0);
      },
    );

    it(
      'reconciles a successful provider payment instead of expiring the order',
      async () => {
        const scenario =
          await createScenario({
            providerStatus:
              'succeeded',
          });

        await expirationService.expirePendingOrders();

        const state =
          await readScenario(
            scenario,
          );

        expect(
          state.order.status,
        ).toBe('PAID');

        expect(
          state.payment.status,
        ).toBe('SUCCEEDED');

        expect(
          state.inventory.quantity,
        ).toBe(
          10 -
            scenario.quantity,
        );

        expect(
          state.inventory
            .reservedQuantity,
        ).toBe(0);

        expect(
          fakeStripe.cancelCalls,
        ).toHaveLength(0);
      },
    );

    it(
      'keeps inventory reserved while a provider payment is processing',
      async () => {
        const scenario =
          await createScenario({
            paymentStatus:
              'PROCESSING',

            providerStatus:
              'processing',
          });

        await expirationService.expirePendingOrders();

        const state =
          await readScenario(
            scenario,
          );

        expect(
          state.order.status,
        ).toBe(
          'PENDING_PAYMENT',
        );

        expect(
          state.payment.status,
        ).toBe(
          'PROCESSING',
        );

        expect(
          state.inventory.quantity,
        ).toBe(10);

        expect(
          state.inventory
            .reservedQuantity,
        ).toBe(
          scenario.quantity,
        );

        expect(
          fakeStripe.cancelCalls,
        ).toHaveLength(0);
      },
    );

    it(
      'persists the provider PaymentIntent before rejecting a payment that expires during initialization',
      async () => {
        const user =
          await prisma.user.create({
            data: {
              email:
                `expiration-race-${uniqueId}@example.com`,

              passwordHash:
                'test-password-hash',
            },
          });

        createdUserIds.push(
          user.id,
        );

        const product =
          await createProduct(1);

        const order =
          await createOrder({
            productId:
              product.id,

            productSlug:
              product.slug,

            productSku:
              product.sku,

            quantity: 1,

            expired: false,

            userId:
              user.id,
          });

        await prisma.order.update({
          where: {
            id: order.id,
          },
          data: {
            createdAt:
              new Date(
                Date.now() -
                  35 *
                    60 *
                    1000,
              ),
          },
        });

        fakeStripe.onCreate =
          async () => {
            await prisma.order.update({
              where: {
                id: order.id,
              },
              data: {
                reservationExpiresAt:
                  new Date(
                    Date.now() -
                      60 *
                        1000,
                  ),
              },
            });
          };

        await expect(
          paymentService.createPaymentIntent(
            user.id,
            order.id,
          ),
        ).rejects.toThrow(
          'Order payment reservation has expired.',
        );

        const payment =
          await prisma.payment.findFirstOrThrow({
            where: {
              orderId:
                order.id,
            },
          });

        expect(
          payment.providerPaymentIntentId,
        ).not.toBeNull();

        expect(
          fakeStripe.cancelCalls,
        ).toEqual([
          payment.providerPaymentIntentId,
        ]);

        await expirationService.expirePendingOrders();

        const [
          expiredOrder,
          expiredPayment,
          inventory,
        ] = await Promise.all([
          prisma.order.findUniqueOrThrow({
            where: {
              id: order.id,
            },
          }),

          prisma.payment.findUniqueOrThrow({
            where: {
              id: payment.id,
            },
          }),

          prisma.inventory.findUniqueOrThrow({
            where: {
              productId:
                product.id,
            },
          }),
        ]);

        expect(
          expiredOrder.status,
        ).toBe('EXPIRED');

        expect(
          expiredPayment.status,
        ).toBe('CANCELED');

        expect(
          inventory.quantity,
        ).toBe(10);

        expect(
          inventory.reservedQuantity,
        ).toBe(0);
      },
    );
  },
);
