import { Injectable } from '@nestjs/common';
import { PrismaService } from './database/prisma.service.js';

export interface HealthResponse {
  status: 'ok';
  service: string;
  database: 'ok';
  timestamp: string;
}

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth(): Promise<HealthResponse> {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      service: 'blx-store-api',
      database: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
