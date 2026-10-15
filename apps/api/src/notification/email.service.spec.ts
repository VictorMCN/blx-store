import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { PrismaService } from '../database/prisma.service.js';

const {
  resendSendMock,
} = vi.hoisted(() => ({
  resendSendMock:
    vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send:
        resendSendMock,
    };
  },
}));

import { EmailService } from './email.service.js';

describe('EmailService', () => {
  const originalNodeEnv =
    process.env.NODE_ENV;

  const originalDeliveryEnabled =
    process.env.EMAIL_DELIVERY_ENABLED;

  const originalResendApiKey =
    process.env.RESEND_API_KEY;

  const originalEmailFrom =
    process.env.EMAIL_FROM;

  const originalAppUrl =
    process.env.APP_URL;

  const order = {
    id:
      '11111111-1111-4111-8111-111111111111',
    orderNumber:
      'BLX-TEST-001',
    status:
      'PAID' as const,
    customerName:
      'Test Customer',
    customerEmail:
      'customer@example.com',
    currency:
      'BRL',
    subtotalInCents:
      100000,
    shippingInCents:
      0,
    totalInCents:
      100000,
    items: [
      {
        productName:
          'BLX Test Product',
        quantity:
          1,
        unitPriceInCents:
          100000,
        lineTotalInCents:
          100000,
      },
    ],
  };

  beforeEach(() => {
    resendSendMock
      .mockReset();

    resendSendMock
      .mockResolvedValue({
        data: {
          id:
            'email_test_1',
        },
        error:
          null,
      });

    process.env.NODE_ENV =
      'development';

    process.env.EMAIL_DELIVERY_ENABLED =
      'true';

    process.env.RESEND_API_KEY =
      're_test_key';

    process.env.EMAIL_FROM =
      'BLX Store <orders@example.com>';

    process.env.APP_URL =
      'https://store.example.com';
  });

  afterEach(() => {
    restoreEnv(
      'NODE_ENV',
      originalNodeEnv,
    );

    restoreEnv(
      'EMAIL_DELIVERY_ENABLED',
      originalDeliveryEnabled,
    );

    restoreEnv(
      'RESEND_API_KEY',
      originalResendApiKey,
    );

    restoreEnv(
      'EMAIL_FROM',
      originalEmailFrom,
    );

    restoreEnv(
      'APP_URL',
      originalAppUrl,
    );
  });

  it('does not deliver email when delivery is disabled', async () => {
    process.env.EMAIL_DELIVERY_ENABLED =
      'false';

    const {
      prisma,
    } =
      createPrismaMock();

    const service =
      new EmailService(
        prisma,
      );

    await service.sendOrderConfirmed(
      order.id,
    );

    expect(
      resendSendMock,
    ).not.toHaveBeenCalled();
  });

  it('never delivers email in test environment', async () => {
    process.env.NODE_ENV =
      'test';

    const {
      prisma,
    } =
      createPrismaMock();

    const service =
      new EmailService(
        prisma,
      );

    await service.sendOrderConfirmed(
      order.id,
    );

    expect(
      resendSendMock,
    ).not.toHaveBeenCalled();
  });

  it('sends an idempotent order confirmation email', async () => {
    const {
      prisma,
    } =
      createPrismaMock();

    const service =
      new EmailService(
        prisma,
      );

    await service.sendOrderConfirmed(
      order.id,
    );

    expect(
      resendSendMock,
    ).toHaveBeenCalledTimes(
      1,
    );

    expect(
      resendSendMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        from:
          'BLX Store <orders@example.com>',
        to: [
          'customer@example.com',
        ],
        subject:
          'Order BLX-TEST-001 confirmed',
        html:
          expect.stringContaining(
            'Your order is confirmed',
          ),
      }),
      {
        idempotencyKey:
          `order-${order.id}-confirmed`,
      },
    );
  });

  it('sends an idempotent shipped notification', async () => {
    const {
      prisma,
    } =
      createPrismaMock({
        ...order,
        status:
          'SHIPPED',
      });

    const service =
      new EmailService(
        prisma,
      );

    await service.sendFulfillmentUpdate(
      order.id,
      'SHIPPED',
    );

    expect(
      resendSendMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        subject:
          'Your order has shipped: BLX-TEST-001',
        html:
          expect.stringContaining(
            'Your order is on the way',
          ),
      }),
      {
        idempotencyKey:
          `order-${order.id}-shipped`,
      },
    );
  });

  it('ignores a payment that is not successful', async () => {
    const {
      prisma,
      orderFindUniqueMock,
      paymentFindUniqueMock,
    } =
      createPrismaMock();

    paymentFindUniqueMock
      .mockResolvedValue({
        status:
          'PENDING',
        orderId:
          order.id,
        order: {
          status:
            'PENDING_PAYMENT',
        },
      });

    const service =
      new EmailService(
        prisma,
      );

    await service.sendOrderConfirmedForPaymentIntent(
      'pi_test_pending',
    );

    expect(
      resendSendMock,
    ).not.toHaveBeenCalled();

    expect(
      orderFindUniqueMock,
    ).not.toHaveBeenCalled();
  });

  function createPrismaMock(
    storedOrder = order,
  ) {
    const orderFindUniqueMock =
      vi
        .fn()
        .mockResolvedValue(
          storedOrder,
        );

    const paymentFindUniqueMock =
      vi
        .fn()
        .mockResolvedValue(
          null,
        );

    const prisma = {
      order: {
        findUnique: (
          ...args: unknown[]
        ) =>
          orderFindUniqueMock(
            ...args,
          ),
      },

      payment: {
        findUnique: (
          ...args: unknown[]
        ) =>
          paymentFindUniqueMock(
            ...args,
          ),
      },
    } as unknown as PrismaService;

    return {
      prisma,
      orderFindUniqueMock,
      paymentFindUniqueMock,
    };
  }

  function restoreEnv(
    key: string,
    value:
      | string
      | undefined,
  ) {
    if (
      value === undefined
    ) {
      delete process.env[
        key
      ];

      return;
    }

    process.env[key] =
      value;
  }
});
