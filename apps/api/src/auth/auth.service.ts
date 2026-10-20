import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import argon2 from 'argon2';
import {
  createHash,
  randomBytes,
} from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { AuthEmailService } from './auth-email.service.js';
import type { AuthenticatedUser } from './auth.types.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

const SESSION_DURATION_MS =
  7 * 24 * 60 * 60 * 1000;

const EMAIL_VERIFICATION_DURATION_MS =
  30 * 60 * 1000;

const SESSION_TOKEN_PATTERN =
  /^[a-f0-9]{64}$/;

const EMAIL_VERIFICATION_TOKEN_PATTERN =
  /^[a-f0-9]{64}$/;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly authEmailService:
      AuthEmailService,
  ) {}

  async register(
    registerDto: RegisterDto,
  ) {
    const fullName =
      registerDto.fullName
        .trim()
        .replace(/\s+/g, ' ');

    const email =
      registerDto.email
        .trim()
        .toLowerCase();

    const existingUser =
      await this.prisma.user.findUnique({
        where: {
          email,
        },

        select: {
          id: true,
        },
      });

    if (existingUser) {
      throw new ConflictException(
        'An account with this email already exists.',
      );
    }

    const passwordHash =
      await argon2.hash(
        registerDto.password,
        {
          type:
            argon2.argon2id,

          memoryCost:
            19456,

          timeCost:
            2,

          parallelism:
            1,
        },
      );

    const verificationRequired =
      this.authEmailService
        .isVerificationRequired();

    const verification =
      verificationRequired
        ? this.createEmailVerification()
        : null;

    try {
      const user =
        await this.prisma.user.create({
          data: {
            fullName,
            email,
            passwordHash,

            emailVerifiedAt:
              verificationRequired
                ? null
                : new Date(),

            emailVerificationTokenHash:
              verification?.tokenHash ??
              null,

            emailVerificationExpiresAt:
              verification?.expiresAt ??
              null,
          },

          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            createdAt: true,
          },
        });

      let emailSent = false;

      if (verification) {
        emailSent =
          await this.authEmailService
            .sendVerificationEmail({
              email:
                user.email,

              fullName:
                user.fullName ??
                fullName,

              token:
                verification.token,
            });
      }

      return {
        user,
        verificationRequired,
        emailSent,
      };
    } catch (error: unknown) {
      if (
        this.isUniqueConstraintError(
          error,
        )
      ) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }

      throw error;
    }
  }

  async login(
    loginDto: LoginDto,
  ) {
    const email =
      loginDto.email
        .trim()
        .toLowerCase();

    const user =
      await this.prisma.user.findUnique({
        where: {
          email,
        },

        select: {
          id: true,
          fullName: true,
          email: true,
          passwordHash: true,
          role: true,
          isActive: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
      });

    if (!user) {
      throw new UnauthorizedException(
        'Invalid email or password.',
      );
    }

    const passwordMatches =
      await argon2.verify(
        user.passwordHash,
        loginDto.password,
      );

    if (
      !passwordMatches ||
      !user.isActive
    ) {
      throw new UnauthorizedException(
        'Invalid email or password.',
      );
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Please verify your email before signing in.',
      );
    }

    const sessionToken =
      randomBytes(32).toString(
        'hex',
      );

    const tokenHash =
      this.hashToken(
        sessionToken,
      );

    const expiresAt =
      new Date(
        Date.now() +
          SESSION_DURATION_MS,
      );

    await this.prisma.session.create({
      data: {
        userId:
          user.id,

        tokenHash,
        expiresAt,
      },
    });

    return {
      sessionToken,
      expiresAt,

      user: {
        id:
          user.id,

        fullName:
          user.fullName,

        email:
          user.email,

        role:
          user.role,

        createdAt:
          user.createdAt,
      },
    };
  }

  async verifyEmail(
    token: string,
  ) {
    const normalizedToken =
      token
        .trim()
        .toLowerCase();

    if (
      !EMAIL_VERIFICATION_TOKEN_PATTERN.test(
        normalizedToken,
      )
    ) {
      throw new BadRequestException(
        'The email verification link is invalid or expired.',
      );
    }

    const tokenHash =
      this.hashToken(
        normalizedToken,
      );

    const user =
      await this.prisma.user.findUnique({
        where: {
          emailVerificationTokenHash:
            tokenHash,
        },

        select: {
          id: true,
          emailVerifiedAt: true,
          emailVerificationExpiresAt:
            true,
        },
      });

    if (
      !user ||
      user.emailVerifiedAt ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt
        .getTime() <= Date.now()
    ) {
      throw new BadRequestException(
        'The email verification link is invalid or expired.',
      );
    }

    await this.prisma.user.update({
      where: {
        id:
          user.id,
      },

      data: {
        emailVerifiedAt:
          new Date(),

        emailVerificationTokenHash:
          null,

        emailVerificationExpiresAt:
          null,
      },
    });

    return {
      verified: true,
    };
  }

  async resendVerificationEmail(
    rawEmail: string,
  ) {
    const email =
      rawEmail
        .trim()
        .toLowerCase();

    if (
      !this.authEmailService
        .isVerificationRequired()
    ) {
      return {
        message:
          'If the account requires verification, a new email has been sent.',
      };
    }

    const user =
      await this.prisma.user.findUnique({
        where: {
          email,
        },

        select: {
          id: true,
          fullName: true,
          email: true,
          isActive: true,
          emailVerifiedAt: true,
        },
      });

    if (
      !user ||
      !user.isActive ||
      user.emailVerifiedAt
    ) {
      return {
        message:
          'If the account requires verification, a new email has been sent.',
      };
    }

    const verification =
      this.createEmailVerification();

    await this.prisma.user.update({
      where: {
        id:
          user.id,
      },

      data: {
        emailVerificationTokenHash:
          verification.tokenHash,

        emailVerificationExpiresAt:
          verification.expiresAt,
      },
    });

    await this.authEmailService
      .sendVerificationEmail({
        email:
          user.email,

        fullName:
          user.fullName ??
          'BLX customer',

        token:
          verification.token,
      });

    return {
      message:
        'If the account requires verification, a new email has been sent.',
    };
  }

  async authenticateSession(
    sessionToken:
      | string
      | undefined,
  ): Promise<AuthenticatedUser> {
    if (
      !sessionToken ||
      !SESSION_TOKEN_PATTERN.test(
        sessionToken,
      )
    ) {
      throw new UnauthorizedException(
        'Authentication required.',
      );
    }

    const tokenHash =
      this.hashToken(
        sessionToken,
      );

    const session =
      await this.prisma.session.findUnique({
        where: {
          tokenHash,
        },

        select: {
          id: true,
          expiresAt: true,

          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              isActive: true,
              emailVerifiedAt: true,
              createdAt: true,
            },
          },
        },
      });

    if (!session) {
      throw new UnauthorizedException(
        'Authentication required.',
      );
    }

    if (
      session.expiresAt.getTime() <=
        Date.now() ||
      !session.user.isActive ||
      !session.user.emailVerifiedAt
    ) {
      await this.prisma.session.deleteMany({
        where: {
          id:
            session.id,
        },
      });

      throw new UnauthorizedException(
        'Authentication required.',
      );
    }

    await this.prisma.session.updateMany({
      where: {
        id:
          session.id,
      },

      data: {
        lastUsedAt:
          new Date(),
      },
    });

    return {
      id:
        session.user.id,

      fullName:
        session.user.fullName,

      email:
        session.user.email,

      role:
        session.user.role,

      createdAt:
        session.user.createdAt,
    };
  }

  async logout(
    sessionToken:
      | string
      | undefined,
  ): Promise<void> {
    if (
      !sessionToken ||
      !SESSION_TOKEN_PATTERN.test(
        sessionToken,
      )
    ) {
      return;
    }

    const tokenHash =
      this.hashToken(
        sessionToken,
      );

    await this.prisma.session.deleteMany({
      where: {
        tokenHash,
      },
    });
  }

  private createEmailVerification() {
    const token =
      randomBytes(32).toString(
        'hex',
      );

    return {
      token,

      tokenHash:
        this.hashToken(
          token,
        ),

      expiresAt:
        new Date(
          Date.now() +
            EMAIL_VERIFICATION_DURATION_MS,
        ),
    };
  }

  private hashToken(
    token: string,
  ): string {
    return createHash(
      'sha256',
    )
      .update(token)
      .digest('hex');
  }

  private isUniqueConstraintError(
    error: unknown,
  ): boolean {
    return (
      typeof error ===
        'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
