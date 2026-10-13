import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { SESSION_COOKIE_NAME } from './auth.constants.js';
import type { AuthenticatedUser } from './auth.types.js';

export interface AuthenticatedRequest extends Request {
  cookies: Record<string, string | undefined>;
  user?: AuthenticatedUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const sessionToken =
      request.cookies?.[SESSION_COOKIE_NAME];

    request.user =
      await this.authService.authenticateSession(sessionToken);

    return true;
  }
}
