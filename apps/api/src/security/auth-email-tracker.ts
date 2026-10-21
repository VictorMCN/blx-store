import { createHash } from 'node:crypto';

interface AuthThrottleRequest {
  body?: unknown;
  ip?: string;
}

export function authEmailTracker(
  request: AuthThrottleRequest,
): string {
  const body = request.body;

  if (
    body !== null &&
    typeof body === 'object' &&
    'email' in body &&
    typeof body.email === 'string'
  ) {
    const email = body.email
      .trim()
      .toLowerCase();

    if (email.length > 0) {
      const emailHash = createHash('sha256')
        .update(email)
        .digest('hex');

      return `email:${emailHash}`;
    }
  }

  return `invalid-email:${request.ip ?? 'unknown'}`;
}
