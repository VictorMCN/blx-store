import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import type { AuthenticatedUser } from './auth.types.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(registerDto: RegisterDto) {
    const email = registerDto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
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

    const passwordHash = await argon2.hash(registerDto.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      return {
        user,
      };
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }

      throw error;
    }
  }

  async login(loginDto: LoginDto) {
    const email = loginDto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Invalid email or password.',
      );
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      loginDto.password,
    );

    if (!passwordMatches || !user.isActive) {
      throw new UnauthorizedException(
        'Invalid email or password.',
      );
    }

    const sessionToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashSessionToken(sessionToken);
    const expiresAt = new Date(
      Date.now() + SESSION_DURATION_MS,
    );

    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      sessionToken,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }

  async authenticateSession(
    sessionToken: string | undefined,
  ): Promise<AuthenticatedUser> {
    if (
      !sessionToken ||
      !SESSION_TOKEN_PATTERN.test(sessionToken)
    ) {
      throw new UnauthorizedException(
        'Authentication required.',
      );
    }

    const tokenHash = this.hashSessionToken(sessionToken);

    const session = await this.prisma.session.findUnique({
      where: {
        tokenHash,
      },
      select: {
        id: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
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
      session.expiresAt.getTime() <= Date.now() ||
      !session.user.isActive
    ) {
      await this.prisma.session.deleteMany({
        where: {
          id: session.id,
        },
      });

      throw new UnauthorizedException(
        'Authentication required.',
      );
    }

    await this.prisma.session.updateMany({
      where: {
        id: session.id,
      },
      data: {
        lastUsedAt: new Date(),
      },
    });

    return {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      createdAt: session.user.createdAt,
    };
  }

  async logout(
    sessionToken: string | undefined,
  ): Promise<void> {
    if (
      !sessionToken ||
      !SESSION_TOKEN_PATTERN.test(sessionToken)
    ) {
      return;
    }

    const tokenHash = this.hashSessionToken(sessionToken);

    await this.prisma.session.deleteMany({
      where: {
        tokenHash,
      },
    });
  }

  private hashSessionToken(token: string): string {
    return createHash('sha256')
      .update(token)
      .digest('hex');
  }

  private isUniqueConstraintError(
    error: unknown,
  ): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
