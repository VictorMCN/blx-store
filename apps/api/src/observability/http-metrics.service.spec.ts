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
  consumeHttpMetrics,
  HttpMetricsReporter,
  recordHttpMetric,
} from './http-metrics.service.js';

describe('HTTP metrics', () => {
  beforeEach(() => {
    consumeHttpMetrics();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('counts requests by HTTP status category', () => {
    recordHttpMetric(200, 25);
    recordHttpMetric(302, 75);
    recordHttpMetric(404, 125);
    recordHttpMetric(503, 275);

    const snapshot = consumeHttpMetrics();

    expect(snapshot).toMatchObject({
      requests: 4,
      http2xx: 1,
      http3xx: 1,
      http4xx: 1,
      http5xx: 1,
      otherStatuses: 0,
      averageDurationMs: 125,
      maxDurationMs: 275,
      p95LatencyBucket: '<=500ms',
    });
  });

  it('calculates the p95 latency bucket', () => {
    for (let index = 0; index < 18; index += 1) {
      recordHttpMetric(200, 20);
    }

    recordHttpMetric(200, 700);
    recordHttpMetric(200, 800);

    const snapshot = consumeHttpMetrics();

    expect(snapshot?.requests).toBe(20);
    expect(snapshot?.p95LatencyBucket).toBe('<=1000ms');
  });

  it('resets counters after consuming a snapshot', () => {
    recordHttpMetric(200, 10);

    expect(consumeHttpMetrics()?.requests).toBe(1);
    expect(consumeHttpMetrics()).toBeNull();
  });

  it('does not emit empty metric summaries', () => {
    const logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    const reporter = new HttpMetricsReporter();

    reporter.reportMetrics();

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('emits a structured metrics summary', () => {
    const logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    recordHttpMetric(200, 40);
    recordHttpMetric(500, 120);

    const reporter = new HttpMetricsReporter();

    reporter.reportMetrics();

    expect(logSpy).toHaveBeenCalledOnce();

    const logged = String(
      logSpy.mock.calls[0]?.[0],
    );

    const entry = JSON.parse(logged) as Record<
      string,
      unknown
    >;

    expect(entry).toMatchObject({
      event: 'http_metrics_summary',
      requests: 2,
      http2xx: 1,
      http5xx: 1,
      averageDurationMs: 80,
      maxDurationMs: 120,
      p95LatencyBucket: '<=250ms',
    });

    expect(entry.windowStartedAt).toEqual(
      expect.any(String),
    );

    expect(entry.windowEndedAt).toEqual(
      expect.any(String),
    );

    expect(consumeHttpMetrics()).toBeNull();
  });
});
