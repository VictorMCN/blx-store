import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import type {
  NextFunction,
  Request,
  Response,
} from 'express';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { httpLoggingMiddleware } from './http-logging.middleware.js';

interface TestRequestOptions {
  method?: string;
  route?: string;
  originalUrl?: string;
  statusCode?: number;
}

function createTestRequest(
  options: TestRequestOptions = {},
) {
  const emitter = new EventEmitter();

  const request = {
    method: options.method ?? 'GET',
    route: options.route
      ? { path: options.route }
      : undefined,
    originalUrl: options.originalUrl ?? '/api/products',
  } as unknown as Request;

  const setHeader = vi.fn();

  const response = Object.assign(emitter, {
    statusCode: options.statusCode ?? 200,
    setHeader,
  }) as unknown as Response;

  const next = vi.fn() as NextFunction;

  return {
    request,
    response,
    setHeader,
    next,
    finish: () => emitter.emit('finish'),
  };
}

describe('httpLoggingMiddleware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates a request ID and continues processing', () => {
    const context = createTestRequest();

    const logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    httpLoggingMiddleware(
      context.request,
      context.response,
      context.next,
    );

    expect(context.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      ),
    );

    expect(context.next).toHaveBeenCalledOnce();

    context.finish();

    expect(logSpy).toHaveBeenCalledOnce();
  });

  it('records safe request metadata without sensitive URL values', () => {
    const context = createTestRequest({
      method: 'GET',
      route: '/api/products/:slug',
      originalUrl:
        '/api/products/test?token=PRIVATE_SECRET&email=private@example.com',
    });

    const logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    httpLoggingMiddleware(
      context.request,
      context.response,
      context.next,
    );

    context.finish();

    const logged = String(
      logSpy.mock.calls[0]?.[0],
    );

    const entry = JSON.parse(logged) as Record<
      string,
      unknown
    >;

    expect(entry).toMatchObject({
      event: 'http_request',
      method: 'GET',
      route: '/api/products/:slug',
      statusCode: 200,
      requestId: expect.any(String),
      durationMs: expect.any(Number),
    });

    expect(logged).not.toContain('PRIVATE_SECRET');
    expect(logged).not.toContain('private@example.com');
    expect(logged).not.toContain('/products/test');
  });

  it('does not log successful health checks', () => {
    const context = createTestRequest({
      route: '/api/health/ready',
    });

    const logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    httpLoggingMiddleware(
      context.request,
      context.response,
      context.next,
    );

    context.finish();

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('records HTTP 503 failures as errors', () => {
    const context = createTestRequest({
      route: '/api/health/ready',
      statusCode: 503,
    });

    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    httpLoggingMiddleware(
      context.request,
      context.response,
      context.next,
    );

    context.finish();

    expect(errorSpy).toHaveBeenCalledOnce();

    expect(
      String(errorSpy.mock.calls[0]?.[0]),
    ).toContain('"statusCode":503');
  });

  it('records HTTP 401 failures as warnings', () => {
    const context = createTestRequest({
      method: 'GET',
      route: '/api/account',
      statusCode: 401,
    });

    const warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    httpLoggingMiddleware(
      context.request,
      context.response,
      context.next,
    );

    context.finish();

    expect(warnSpy).toHaveBeenCalledOnce();

    expect(
      String(warnSpy.mock.calls[0]?.[0]),
    ).toContain('"statusCode":401');
  });
});
