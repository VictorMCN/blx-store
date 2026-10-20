import { Logger } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { PrismaService } from '../database/prisma.service.js';
import { consumePaymentMetrics } from '../observability/payment-metrics.service.js';
import { PaymentExpirationService } from './payment-expiration.service.js';
import type { PaymentService } from './payment.service.js';
import type { StripeService } from './stripe.service.js';

describe('PaymentExpirationService metrics', () => {
  const order = {
    id: 'order-test',
    orderNumber: 'BLX-TEST',
    status: 'PENDING_PAYMENT',
    reservationExpiresAt: new Date(
      Date.now() - 60_000,
    ),
    items: [
      {
        productId: 'product-test',
        quantity: 1,
      },
    ],
  };

  const transaction = {
    order: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    inventory: {
      updateMany: vi.fn(),
    },
    payment: {
      updateMany: vi.fn(),
    },
  };

  const prisma = {
    order: {
      findMany: vi.fn(),
    },
    payment: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const service = new PaymentExpirationService(
    prisma as unknown as PrismaService,
    {} as StripeService,
    {} as PaymentService,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    consumePaymentMetrics();

    prisma.order.findMany.mockResolvedValue([order]);
    prisma.payment.findMany.mockResolvedValue([]);

    transaction.order.findUnique.mockResolvedValue(
      order,
    );
    transaction.order.updateMany.mockResolvedValue({
      count: 1,
    });
    transaction.inventory.updateMany.mockResolvedValue({
      count: 1,
    });
    transaction.payment.updateMany.mockResolvedValue({
      count: 0,
    });

    prisma.$transaction.mockImplementation(
      async (
        callback: (
          tx: typeof transaction,
        ) => Promise<boolean>,
      ) => callback(transaction),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    consumePaymentMetrics();
  });

  it('counts only a successfully committed expiration', async () => {
    await service.expirePendingOrders();

    expect(
      transaction.order.updateMany,
    ).toHaveBeenCalledOnce();

    expect(
      transaction.inventory.updateMany,
    ).toHaveBeenCalledOnce();

    expect(consumePaymentMetrics()).toMatchObject({
      reservationExpired: 1,
      reservationExpirationFailed: 0,
    });
  });

  it('does not count an expiration when another process claimed the order', async () => {
    transaction.order.updateMany.mockResolvedValue({
      count: 0,
    });

    await service.expirePendingOrders();

    expect(
      transaction.inventory.updateMany,
    ).not.toHaveBeenCalled();

    expect(consumePaymentMetrics()).toBeNull();
  });

  it('counts failures without logging database error details', async () => {
    const warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    transaction.inventory.updateMany.mockResolvedValue({
      count: 0,
    });

    await service.expirePendingOrders();

    expect(consumePaymentMetrics()).toMatchObject({
      reservationExpired: 0,
      reservationExpirationFailed: 1,
    });

    expect(warnSpy).toHaveBeenCalledWith(
      'Payment reservation expiration failed.',
    );

    expect(
      JSON.stringify(warnSpy.mock.calls),
    ).not.toContain('BLX-TEST');
  });
});
