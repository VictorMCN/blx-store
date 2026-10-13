import { ConflictException, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { PrismaService } from '../database/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';

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
      throw new ConflictException('An account with this email already exists.');
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
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }

      throw error;
    }
  }
}
