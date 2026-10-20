import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type {
  NextFunction,
  Request,
  Response,
} from 'express';
import { recordHttpMetric } from './http-metrics.service.js';

const logger = new Logger('HttpObservability');

interface HttpLogEntry {
  event: 'http_request';
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
}

function isHealthRoute(route: string): boolean {
  return (
    route === '/api/health' ||
    route.startsWith('/api/health/') ||
    route === '/health' ||
    route.startsWith('/health/')
  );
}

function isMonitoringPoll(
  method: string,
  route: string,
): boolean {
  return (
    method === 'GET' &&
    route === '/api/admin/monitoring'
  );
}

export function httpLoggingMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const requestId = randomUUID();
  const startedAt = process.hrtime.bigint();

  response.setHeader('X-Request-ID', requestId);

  response.once('finish', () => {
    const durationMs = Math.round(
      (
        Number(
          process.hrtime.bigint() - startedAt,
        ) / 1_000_000
      ) * 100,
    ) / 100;

    // Only use matched route templates.
    // Never record URLs, query parameters,
    // request bodies, cookies or credentials.
    const matchedPath: unknown =
      request.route?.path;

    const route =
      typeof matchedPath === 'string'
        ? matchedPath
        : 'unmatched';

    const statusCode = response.statusCode;

    if (
      statusCode < 400 &&
      (
        isHealthRoute(route) ||
        isMonitoringPoll(request.method, route)
      )
    ) {
      return;
    }

    recordHttpMetric(statusCode, durationMs);

    const entry: HttpLogEntry = {
      event: 'http_request',
      requestId,
      method: request.method,
      route,
      statusCode,
      durationMs,
    };

    const serialized = JSON.stringify(entry);

    if (statusCode >= 500) {
      logger.error(serialized);
    } else if (statusCode >= 400) {
      logger.warn(serialized);
    } else {
      logger.log(serialized);
    }
  });

  next();
}
