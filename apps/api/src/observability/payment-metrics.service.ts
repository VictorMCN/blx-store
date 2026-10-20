import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

export type PaymentMetricEvent =
  | 'paymentIntentCreated'
  | 'paymentIntentCreationFailed'
  | 'webhookAccepted'
  | 'webhookRejected'
  | 'webhookProcessingFailed'
  | 'paymentSucceeded'
  | 'paymentFailed'
  | 'paymentCanceled'
  | 'reservationExpired'
  | 'reservationExpirationFailed';

type PaymentMetricCounters = Record<
  PaymentMetricEvent,
  number
>;

export interface PaymentMetricsSnapshot
  extends PaymentMetricCounters {
  windowStartedAt: string;
  windowEndedAt: string;
}

interface PaymentMetricsWindow {
  startedAt: number;
  counters: PaymentMetricCounters;
}

const HISTORY_LIMIT = 30;

function createCounters(): PaymentMetricCounters {
  return {
    paymentIntentCreated: 0,
    paymentIntentCreationFailed: 0,
    webhookAccepted: 0,
    webhookRejected: 0,
    webhookProcessingFailed: 0,
    paymentSucceeded: 0,
    paymentFailed: 0,
    paymentCanceled: 0,
    reservationExpired: 0,
    reservationExpirationFailed: 0,
  };
}

function createWindow(): PaymentMetricsWindow {
  return {
    startedAt: Date.now(),
    counters: createCounters(),
  };
}

let currentWindow = createWindow();

const recentSnapshots: PaymentMetricsSnapshot[] = [];

export function recordPaymentMetric(
  event: PaymentMetricEvent,
): void {
  currentWindow.counters[event] += 1;
}

export function consumePaymentMetrics():
  PaymentMetricsSnapshot | null {
  const total = Object.values(
    currentWindow.counters,
  ).reduce(
    (sum, count) => sum + count,
    0,
  );

  if (total === 0) {
    return null;
  }

  const completed = currentWindow;
  currentWindow = createWindow();

  return {
    windowStartedAt: new Date(
      completed.startedAt,
    ).toISOString(),
    windowEndedAt: new Date().toISOString(),
    ...completed.counters,
  };
}

export function getRecentPaymentMetrics():
  PaymentMetricsSnapshot[] {
  return recentSnapshots.map((snapshot) => ({
    ...snapshot,
  }));
}

@Injectable()
export class PaymentMetricsReporter {
  private readonly logger = new Logger(
    PaymentMetricsReporter.name,
  );

  @Interval(60_000)
  reportMetrics(): void {
    const snapshot = consumePaymentMetrics();

    if (!snapshot) {
      return;
    }

    recentSnapshots.push(snapshot);

    if (recentSnapshots.length > HISTORY_LIMIT) {
      recentSnapshots.shift();
    }

    this.logger.log(
      JSON.stringify({
        event: 'payment_metrics_summary',
        ...snapshot,
      }),
    );
  }
}
