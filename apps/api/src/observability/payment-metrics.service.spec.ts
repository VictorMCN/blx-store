import { Logger } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  PaymentMetricsReporter,
  consumePaymentMetrics,
  recordPaymentMetric,
} from './payment-metrics.service.js';

describe('Payment metrics', () => {
  beforeEach(() => {
    consumePaymentMetrics();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    consumePaymentMetrics();
  });

  it('counts payment events by category', () => {
    recordPaymentMetric('paymentIntentCreated');
    recordPaymentMetric('paymentIntentCreated');
    recordPaymentMetric('paymentSucceeded');
    recordPaymentMetric('paymentFailed');

    expect(consumePaymentMetrics()).toMatchObject({
      paymentIntentCreated: 2,
      paymentSucceeded: 1,
      paymentFailed: 1,
      paymentCanceled: 0,
    });
  });

  it('tracks webhook and reservation failures', () => {
    recordPaymentMetric('webhookAccepted');
    recordPaymentMetric('webhookRejected');
    recordPaymentMetric('webhookProcessingFailed');
    recordPaymentMetric('reservationExpired');
    recordPaymentMetric('reservationExpirationFailed');

    expect(consumePaymentMetrics()).toMatchObject({
      webhookAccepted: 1,
      webhookRejected: 1,
      webhookProcessingFailed: 1,
      reservationExpired: 1,
      reservationExpirationFailed: 1,
    });
  });

  it('resets counters after consumption', () => {
    recordPaymentMetric('paymentSucceeded');

    expect(
      consumePaymentMetrics()?.paymentSucceeded,
    ).toBe(1);

    expect(consumePaymentMetrics()).toBeNull();
  });

  it('does not emit logs without payment events', () => {
    const logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    new PaymentMetricsReporter().reportMetrics();

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('publishes a structured aggregate summary', () => {
    const logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    recordPaymentMetric('paymentIntentCreated');
    recordPaymentMetric('webhookAccepted');
    recordPaymentMetric('paymentSucceeded');

    new PaymentMetricsReporter().reportMetrics();

    expect(logSpy).toHaveBeenCalledOnce();

    const logged = JSON.parse(
      String(logSpy.mock.calls[0]?.[0]),
    ) as Record<string, unknown>;

    expect(logged).toMatchObject({
      event: 'payment_metrics_summary',
      paymentIntentCreated: 1,
      webhookAccepted: 1,
      paymentSucceeded: 1,
    });

    expect(logged.windowStartedAt).toEqual(
      expect.any(String),
    );

    expect(logged.windowEndedAt).toEqual(
      expect.any(String),
    );

    expect(Object.keys(logged)).not.toContain(
      'customerId',
    );

    expect(Object.keys(logged)).not.toContain(
      'paymentIntentId',
    );

    expect(consumePaymentMetrics()).toBeNull();
  });
});
