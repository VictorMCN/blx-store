import {
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { consumePaymentMetrics } from '../observability/payment-metrics.service.js';
import { StripeService } from './stripe.service.js';

describe('StripeService payment metrics', () => {
  const input = {
    paymentId: 'payment-test-123',
    orderId: 'order-test-123',
    orderNumber: 'BLX-TEST-123',
    amountInCents: 249900,
    currency: 'BRL',
  };

  function createService(
    createPaymentIntent: ReturnType<typeof vi.fn>,
  ): StripeService {
    const configService = {
      get: vi.fn(),
    } as unknown as ConfigService;

    const service = new StripeService(
      configService,
    );

    Object.defineProperty(service, 'stripe', {
      value: {
        paymentIntents: {
          create: createPaymentIntent,
        },
      },
      configurable: true,
      writable: true,
    });

    return service;
  }

  beforeEach(() => {
    consumePaymentMetrics();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    consumePaymentMetrics();
  });

  it('records a successful PaymentIntent creation', async () => {
    const paymentIntent = {
      id: 'pi_test_success',
      status: 'requires_payment_method',
    };

    const create = vi.fn().mockResolvedValue(
      paymentIntent,
    );

    const service = createService(create);

    await expect(
      service.createPaymentIntent(input),
    ).resolves.toEqual(paymentIntent);

    expect(create).toHaveBeenCalledWith(
      {
        amount: 249900,
        currency: 'brl',
        automatic_payment_methods: {
          enabled: true,
        },
        description:
          'BLX Store order BLX-TEST-123',
        metadata: {
          paymentId: 'payment-test-123',
          orderId: 'order-test-123',
          orderNumber: 'BLX-TEST-123',
        },
      },
      {
        idempotencyKey: 'payment-test-123',
      },
    );

    expect(consumePaymentMetrics()).toMatchObject({
      paymentIntentCreated: 1,
      paymentIntentCreationFailed: 0,
    });
  });

  it('records provider failures without exposing details', async () => {
    const create = vi.fn().mockRejectedValue(
      new Error(
        'Sensitive internal provider information',
      ),
    );

    const service = createService(create);

    await expect(
      service.createPaymentIntent(input),
    ).rejects.toThrow(
      'Payment provider request failed.',
    );

    expect(consumePaymentMetrics()).toMatchObject({
      paymentIntentCreated: 0,
      paymentIntentCreationFailed: 1,
    });
  });

  it('records missing Stripe configuration as a failure', async () => {
    const configService = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    const service = new StripeService(
      configService,
    );

    await expect(
      service.createPaymentIntent(input),
    ).rejects.toThrow(
      'Stripe is not configured.',
    );

    expect(consumePaymentMetrics()).toMatchObject({
      paymentIntentCreated: 0,
      paymentIntentCreationFailed: 1,
    });
  });

  it('preserves the ServiceUnavailableException type', async () => {
    const create = vi.fn().mockRejectedValue(
      new Error('Network failure'),
    );

    const service = createService(create);

    await expect(
      service.createPaymentIntent(input),
    ).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('counts successful provider calls rather than unique payments', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'pi_same_payment',
    });

    const service = createService(create);

    await service.createPaymentIntent(input);
    await service.createPaymentIntent(input);

    expect(create).toHaveBeenCalledTimes(2);

    expect(consumePaymentMetrics()).toMatchObject({
      paymentIntentCreated: 2,
      paymentIntentCreationFailed: 0,
    });

    expect(
      create.mock.calls[0]?.[1],
    ).toEqual(
      create.mock.calls[1]?.[1],
    );
  });
});
