import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

const SESSION_COOKIE_NAME = 'blx_session';

interface RequestWithCookies extends Request {
  cookies: Record<string, string | undefined>;
}

function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto);

    response.cookie(SESSION_COOKIE_NAME, result.sessionToken, {
      ...getSessionCookieOptions(),
      expires: result.expiresAt,
    });

    return {
      user: result.user,
    };
  }

  @Get('me')
  getCurrentUser(@Req() request: RequestWithCookies) {
    return this.authService.getCurrentUser(
      request.cookies[SESSION_COOKIE_NAME],
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(
      request.cookies[SESSION_COOKIE_NAME],
    );

    response.clearCookie(
      SESSION_COOKIE_NAME,
      getSessionCookieOptions(),
    );
  }
}
