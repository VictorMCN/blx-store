import {
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard.js';
import type { AuthenticatedUser } from './auth.types.js';

export const CurrentUser = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): AuthenticatedUser | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    return request.user;
  },
);
