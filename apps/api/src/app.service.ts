import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from './database/prisma.service.js';

export interface LivenessResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

export interface HealthResponse extends LivenessResponse {
  database: 'ok';
}

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  getLiveness(): LivenessResponse {
    return {
      status: 'ok',
      service: 'blx-store-api',
      timestamp: new Date().toISOString(),
    };
  }

  async getHealth(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException(
        'Database is unavailable.',
      );
    }

    return {
      status: 'ok',
      service: 'blx-store-api',
      database: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
