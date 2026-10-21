import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const databaseUrl =
      configService.getOrThrow<string>('DATABASE_URL');

    if (process.env.NODE_ENV === 'test') {
      const url = new URL(databaseUrl);

      const localHosts = new Set([
        'localhost',
        '127.0.0.1',
        '[::1]',
      ]);

      const database = decodeURIComponent(
        url.pathname.slice(1),
      );

      if (
        !localHosts.has(url.hostname.toLowerCase()) ||
        database !== 'blx_store_test'
      ) {
        throw new Error(
          'Test environment refused a non-isolated database connection.',
        );
      }
    }

    const adapter = new PrismaPg({
      connectionString: databaseUrl,
    });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
