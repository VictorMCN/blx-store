import { ForbiddenException } from '@nestjs/common';
import type { RequestHandler } from 'express';

const UNSAFE_METHODS = new Set([
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);

const STRIPE_WEBHOOK_PATH =
  '/api/payments/stripe/webhook';

const DEVELOPMENT_PROXY_ORIGIN =
  'https://localhost:3000';

function getTrustedOrigin(): string {
  const appUrl =
    process.env.APP_URL ??
    'http://localhost:3000';

  return new URL(appUrl).origin;
}

function isLoopbackAddress(
  address: string | undefined,
): boolean {
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1'
  );
}

export const csrfOriginMiddleware: RequestHandler = (
  request,
  _response,
  next,
) => {
  if (
    !UNSAFE_METHODS.has(request.method) ||
    request.path === STRIPE_WEBHOOK_PATH
  ) {
    next();
    return;
  }

  const origin = request.get('origin');
  const fetchSite = request.get('sec-fetch-site');

  const trustedOrigin = getTrustedOrigin();

  const trustedDevelopmentProxy =
    process.env.NODE_ENV !== 'production' &&
    origin === DEVELOPMENT_PROXY_ORIGIN &&
    fetchSite === 'same-origin' &&
    isLoopbackAddress(
      request.socket.remoteAddress,
    );

  const validOrigin =
    origin === undefined ||
    origin === trustedOrigin ||
    trustedDevelopmentProxy;

  const invalidFetchSite =
    fetchSite === 'cross-site' ||
    (
      fetchSite === 'same-site' &&
      origin === undefined
    );

  if (!validOrigin || invalidFetchSite) {
    next(
      new ForbiddenException(
        'Cross-origin request denied.',
      ),
    );
    return;
  }

  next();
};
