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
import { StripeService } from '../src/payment/stripe.service.js';

class FakeStripeExpirationService {
  private readonly paymentIntents =
    new Map<
      string,
      Stripe.PaymentIntent
    >();

  readonly retrieveCalls: string[] = [];
  readonly cancelCalls: string[] = [];

  setPaymentIntent(
    paymentIntent: Stripe.PaymentIntent,
  ) {
    this.paymentIntents.set(
      paymentIntent.id,
      paymentIntent,
    );
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

    const canceledPaymentIntent = {
      ...paymentIntent,
      status: 'canceled',
      cancellation_reason:
        'requested_by_customer',
    } as Stripe.PaymentIntent;

    this.paymentIntents.set(
      paymentIntentId,
      canceledPaymentIntent,
    );

    return canceledPaymentIntent;
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
    this.retrieveCalls.length = 0;
    this.cancelCalls.length = 0;
  }
}

describe(
  'Payment reservation expiration (e2e)',
  () => {
    let moduleRef: TestingModule;
    let prisma: PrismaService;
    let expirationService:
      PaymentExpirationService;
    let fakeStripe:
      FakeStripeExpirationService;

    let categoryId: string;

    const createdOrderIds: string[] =
      [];
    const createdProductIds: string[] =
      [];

    const uniqueId = Date.now();
    let scenarioCounter = 0;

    function createPaymentIntent(
      input: {
        id: string;
        paymentId: string;
        orderId: string;
        status:
          Stripe.PaymentIntent.Status;
      },
    ): Stripe.PaymentIntent {
      return {
        id: input.id,
        object: 'payment_intent',
        amount: 100000,
        currency: 'brl',
        status: input.status,
        metadata: {
          paymentId:
            input.paymentId,
          orderId:
            input.orderId,
        },
      } as Stripe.PaymentIntent;
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
      scenarioCounter += 1;

      const quantity =
        options?.quantity ?? 2;

      const expired =
        options?.expired ?? true;

      const suffix =
        `${String(uniqueId).slice(-7)}-${scenarioCounter}`;

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

            priceInCents: 50000,
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

      const order =
        await prisma.order.create({
          data: {
            orderNumber:
              `BLX-EXP-${String(uniqueId).slice(-6)}-${scenarioCounter}`,

            status:
              'PENDING_PAYMENT',

            currency: 'BRL',

            subtotalInCents:
              50000 * quantity,

            shippingInCents: 0,

            totalInCents:
              50000 * quantity,

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

            shippingState: 'DF',

            shippingPostalCode:
              '70000000',

            shippingCountry:
              'BR',

            createdAt:
              expired
                ? new Date(
                    Date.now() -
                      35 *
                        60 *
                        1000,
                  )
                : new Date(),

            reservationExpiresAt:
              new Date(
                Date.now() +
                  (expired
                    ? -5 * 60 * 1000
                    : 30 *
                      60 *
                      1000),
              ),

            items: {
              create: [
                {
                  productId:
                    product.id,

                  productName:
                    'Expiration Product',

                  productSlug:
                    `payment-expiration-${suffix}`,

                  productSku:
                    `EXP-${suffix}`,

                  unitPriceInCents:
                    50000,

                  quantity,

                  lineTotalInCents:
                    50000 *
                    quantity,
                },
              ],
            },
          },
        });

      createdOrderIds.push(
        order.id,
      );

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
            reservedQuantity: true,
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

      createdOrderIds.length = 0;
      createdProductIds.length = 0;
    }

    beforeAll(async () => {
      fakeStripe =
        new FakeStripeExpirationService();

      moduleRef =
        await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              isGlobal: true,
              envFilePath: ['.env', '../../.env'],
            }),
            PrismaModule,
          ],
          providers: [
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
      'expires an order without a provider PaymentIntent and releases its reservation',
      async () => {
        const scenario =
          await createScenario({
            providerStatus: null,
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
          state.payment.failureCode,
        ).toBe(
          'reservation_expired',
        );

        expect(
          state.inventory.quantity,
        ).toBe(10);

        expect(
          state.inventory
            .reservedQuantity,
        ).toBe(0);

        expect(
          fakeStripe.retrieveCalls,
        ).toHaveLength(0);

        expect(
          fakeStripe.cancelCalls,
        ).toHaveLength(0);
      },
    );

    it(
      'cancels a payable Stripe PaymentIntent before releasing the reservation',
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

        expect(
          fakeStripe.getPaymentIntent(
            scenario.paymentIntentId!,
          )?.status,
        ).toBe('canceled');
      },
    );

    it(
      'expires a failed payment attempt that still has a reusable PaymentIntent',
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

        expect(
          fakeStripe.cancelCalls,
        ).toEqual([
          scenario.paymentIntentId,
        ]);
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
          state.payment.status,
        ).toBe('CANCELED');

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
          state.inventory.quantity,
        ).toBe(10);

        expect(
          state.inventory
            .reservedQuantity,
        ).toBe(
          scenario.quantity,
        );

        expect(
          fakeStripe.retrieveCalls,
        ).toHaveLength(0);

        expect(
          fakeStripe.cancelCalls,
        ).toHaveLength(0);
      },
    );

    it(
      'does not expire or release inventory when Stripe already reports a successful payment',
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
        ).toBe(
          'PENDING_PAYMENT',
        );

        expect(
          state.payment.status,
        ).toBe('PENDING');

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
          fakeStripe.retrieveCalls,
        ).toEqual([
          scenario.paymentIntentId,
        ]);

        expect(
          fakeStripe.cancelCalls,
        ).toHaveLength(0);
      },
    );
  },
);
