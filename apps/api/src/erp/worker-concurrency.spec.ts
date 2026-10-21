import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service.js';
import { PaymentExpirationService } from '../payment/payment-expiration.service.js';
import type { PaymentService } from '../payment/payment.service.js';
import type { StripeService } from '../payment/stripe.service.js';
import { ErpSyncService } from './erp-sync.service.js';
import type { MockErpProvider } from './mock-erp.provider.js';

describe('Background worker concurrency', () => {
  it('releases an expired reservation only once across two workers', async () => {
    let orderStatus = 'PENDING_PAYMENT';
    let reservedQuantity = 2;
    let successfulClaims = 0;
    let pendingReads = 0;

    let releaseReads: (() => void) | undefined;

    const readBarrier = new Promise<void>((resolve) => {
      releaseReads = resolve;
    });

    const order = {
      id: 'order-test',
      status: 'PENDING_PAYMENT',
      reservationExpiresAt: new Date(
        Date.now() - 60_000,
      ),
      items: [
        {
          productId: 'product-test',
          quantity: 2,
        },
      ],
    };

    const transaction = {
      order: {
        findUnique: vi.fn(async () => {
          const snapshot = {
            ...order,
            status: orderStatus,
          };

          pendingReads += 1;

          if (pendingReads === 2) {
            releaseReads?.();
          }

          await readBarrier;

          return snapshot;
        }),

        updateMany: vi.fn(async () => {
          if (orderStatus !== 'PENDING_PAYMENT') {
            return { count: 0 };
          }

          orderStatus = 'EXPIRED';
          successfulClaims += 1;

          return { count: 1 };
        }),
      },

      inventory: {
        updateMany: vi.fn(async () => {
          if (reservedQuantity < 2) {
            return { count: 0 };
          }

          reservedQuantity -= 2;

          return { count: 1 };
        }),
      },

      payment: {
        updateMany: vi.fn(async () => ({
          count: 0,
        })),
      },
    };

    const prisma = {
      order: {
        findMany: vi.fn(async () => [
          { id: order.id },
        ]),
      },

      payment: {
        findMany: vi.fn(async () => []),
      },

      $transaction: vi.fn(
        async (
          callback: (
            tx: typeof transaction,
          ) => Promise<boolean>,
        ) => callback(transaction),
      ),
    } as unknown as PrismaService;

    const createWorker = () =>
      new PaymentExpirationService(
        prisma,
        {} as StripeService,
        {} as PaymentService,
      );

    await Promise.all([
      createWorker().expirePendingOrders(),
      createWorker().expirePendingOrders(),
    ]);

    expect(pendingReads).toBe(2);

    expect(
      transaction.order.updateMany,
    ).toHaveBeenCalledTimes(2);

    expect(successfulClaims).toBe(1);
    expect(orderStatus).toBe('EXPIRED');

    expect(
      transaction.inventory.updateMany,
    ).toHaveBeenCalledTimes(1);

    expect(reservedQuantity).toBe(0);
  });

  it('allows only one ERP worker to claim the same job', async () => {
    let jobStatus = 'PENDING';

    const candidate = {
      id: 'job-test',
      orderId: 'order-test',
      status: 'PENDING' as const,
      attempts: 0,
    };

    const prisma = {
      order: {
        findMany: vi.fn(async () => []),

        findUnique: vi.fn(async () => ({
          id: 'order-test',
          orderNumber: 'BLX-TEST',
          status: 'PAID',
          currency: 'BRL',
          totalInCents: 150000,
          items: [
            {
              productSku: 'SKU-TEST',
              quantity: 1,
              unitPriceInCents: 150000,
            },
          ],
        })),
      },

      erpSyncJob: {
        findMany: vi.fn(async () => [candidate]),

        createMany: vi.fn(async () => ({
          count: 0,
        })),

        updateMany: vi.fn(
          async (args: {
            where: { status: string };
            data: { status: string };
          }) => {
            if (args.data.status === 'PROCESSING') {
              if (
                jobStatus !== 'PENDING' ||
                args.where.status !== 'PENDING'
              ) {
                return { count: 0 };
              }

              jobStatus = 'PROCESSING';

              return { count: 1 };
            }

            if (
              args.data.status === 'SYNCED' &&
              jobStatus === 'PROCESSING'
            ) {
              jobStatus = 'SYNCED';

              return { count: 1 };
            }

            return { count: 0 };
          },
        ),
      },
    } as unknown as PrismaService;

    const exportOrder = vi.fn(
      async () => 'MOCK-order-test',
    );

    const provider = {
      exportOrder,
    } as unknown as MockErpProvider;

    const createWorker = () =>
      new ErpSyncService(prisma, provider);

    await Promise.all([
      createWorker().processPendingJobs(),
      createWorker().processPendingJobs(),
    ]);

    expect(exportOrder).toHaveBeenCalledTimes(1);
    expect(jobStatus).toBe('SYNCED');
  });
});
