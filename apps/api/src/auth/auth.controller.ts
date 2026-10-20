import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type {
  Request,
  Response,
} from 'express';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { SESSION_COOKIE_NAME } from './auth.constants.js';
import type { AuthenticatedUser } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';

interface RequestWithCookies
  extends Request {
  cookies: Record<
    string,
    string | undefined
  >;
}

function getSessionCookieOptions() {
  return {
    httpOnly: true,

    secure:
      process.env.NODE_ENV ===
      'production',

    sameSite:
      'lax' as const,

    path:
      '/',
  };
}

function getAppUrl(): string {
  return (
    process.env.APP_URL ??
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService:
      AuthService,
  ) {}

  @Post('register')
  register(
    @Body()
    registerDto: RegisterDto,
  ) {
    return this.authService.register(
      registerDto,
    );
  }

  @Get('verify-email')
  async verifyEmail(
    @Query('token')
    token: string | undefined,

    @Res()
    response: Response,
  ) {
    const appUrl =
      getAppUrl();

    try {
      if (!token) {
        throw new BadRequestException(
          'Verification token is required.',
        );
      }

      await this.authService
        .verifyEmail(
          token,
        );

      response.redirect(
        `${appUrl}/email-verified`,
      );
    } catch (error) {
      if (
        error instanceof
        BadRequestException
      ) {
        response.redirect(
          `${appUrl}/email-verification-failed`,
        );

        return;
      }

      throw error;
    }
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerification(
    @Body()
    dto: ResendVerificationDto,
  ) {
    return this.authService
      .resendVerificationEmail(
        dto.email,
      );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body()
    loginDto: LoginDto,

    @Res({
      passthrough: true,
    })
    response: Response,
  ) {
    const result =
      await this.authService.login(
        loginDto,
      );

    response.cookie(
      SESSION_COOKIE_NAME,
      result.sessionToken,
      {
        ...getSessionCookieOptions(),
        expires:
          result.expiresAt,
      },
    );

    return {
      user:
        result.user,
    };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  getCurrentUser(
    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return {
      user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req()
    request: RequestWithCookies,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<void> {
    await this.authService.logout(
      request.cookies[
        SESSION_COOKIE_NAME
      ],
    );

    response.clearCookie(
      SESSION_COOKIE_NAME,
      getSessionCookieOptions(),
    );
  }
}
