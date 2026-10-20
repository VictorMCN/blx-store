import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

const LATENCY_THRESHOLDS_MS = [
  50, 100, 250, 500, 1000, 2000, 5000,
] as const;

const HISTORY_LIMIT = 30;

interface MetricsWindow {
  startedAt: number;
  requests: number;
  http2xx: number;
  http3xx: number;
  http4xx: number;
  http5xx: number;
  otherStatuses: number;
  totalDurationMs: number;
  maxDurationMs: number;
  latencyBuckets: number[];
}

export interface HttpMetricsSnapshot {
  windowStartedAt: string;
  windowEndedAt: string;
  requests: number;
  http2xx: number;
  http3xx: number;
  http4xx: number;
  http5xx: number;
  otherStatuses: number;
  averageDurationMs: number;
  maxDurationMs: number;
  p95LatencyBucket: string;
}

function createMetricsWindow(): MetricsWindow {
  return {
    startedAt: Date.now(),
    requests: 0,
    http2xx: 0,
    http3xx: 0,
    http4xx: 0,
    http5xx: 0,
    otherStatuses: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
    latencyBuckets: Array.from(
      { length: LATENCY_THRESHOLDS_MS.length + 1 },
      () => 0,
    ),
  };
}

let currentWindow = createMetricsWindow();
const recentSnapshots: HttpMetricsSnapshot[] = [];

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function getLatencyBucketIndex(durationMs: number): number {
  const index = LATENCY_THRESHOLDS_MS.findIndex(
    (threshold) => durationMs <= threshold,
  );

  return index === -1
    ? LATENCY_THRESHOLDS_MS.length
    : index;
}

function getP95LatencyBucket(
  buckets: readonly number[],
  requestCount: number,
): string {
  const target = Math.ceil(requestCount * 0.95);
  let cumulativeCount = 0;

  for (let index = 0; index < buckets.length; index += 1) {
    cumulativeCount += buckets[index] ?? 0;

    if (cumulativeCount >= target) {
      const threshold = LATENCY_THRESHOLDS_MS[index];

      return threshold === undefined
        ? '>5000ms'
        : `<=${threshold}ms`;
    }
  }

  return '>5000ms';
}

export function recordHttpMetric(
  statusCode: number,
  durationMs: number,
): void {
  const duration = Number.isFinite(durationMs)
    ? Math.max(0, durationMs)
    : 0;

  currentWindow.requests += 1;

  if (statusCode >= 200 && statusCode < 300) {
    currentWindow.http2xx += 1;
  } else if (statusCode >= 300 && statusCode < 400) {
    currentWindow.http3xx += 1;
  } else if (statusCode >= 400 && statusCode < 500) {
    currentWindow.http4xx += 1;
  } else if (statusCode >= 500 && statusCode < 600) {
    currentWindow.http5xx += 1;
  } else {
    currentWindow.otherStatuses += 1;
  }

  currentWindow.totalDurationMs += duration;
  currentWindow.maxDurationMs = Math.max(
    currentWindow.maxDurationMs,
    duration,
  );

  const index = getLatencyBucketIndex(duration);

  currentWindow.latencyBuckets[index] =
    (currentWindow.latencyBuckets[index] ?? 0) + 1;
}

export function consumeHttpMetrics():
  HttpMetricsSnapshot | null {
  if (currentWindow.requests === 0) {
    return null;
  }

  const completed = currentWindow;
  currentWindow = createMetricsWindow();

  return {
    windowStartedAt: new Date(
      completed.startedAt,
    ).toISOString(),
    windowEndedAt: new Date().toISOString(),
    requests: completed.requests,
    http2xx: completed.http2xx,
    http3xx: completed.http3xx,
    http4xx: completed.http4xx,
    http5xx: completed.http5xx,
    otherStatuses: completed.otherStatuses,
    averageDurationMs: round(
      completed.totalDurationMs / completed.requests,
    ),
    maxDurationMs: round(completed.maxDurationMs),
    p95LatencyBucket: getP95LatencyBucket(
      completed.latencyBuckets,
      completed.requests,
    ),
  };
}

export function getRecentHttpMetrics():
  HttpMetricsSnapshot[] {
  return recentSnapshots.map((snapshot) => ({
    ...snapshot,
  }));
}

@Injectable()
export class HttpMetricsReporter {
  private readonly logger = new Logger(
    HttpMetricsReporter.name,
  );

  @Interval(60_000)
  reportMetrics(): void {
    const snapshot = consumeHttpMetrics();

    if (!snapshot) {
      return;
    }

    recentSnapshots.push(snapshot);

    if (recentSnapshots.length > HISTORY_LIMIT) {
      recentSnapshots.shift();
    }

    this.logger.log(
      JSON.stringify({
        event: 'http_metrics_summary',
        ...snapshot,
      }),
    );
  }
}
