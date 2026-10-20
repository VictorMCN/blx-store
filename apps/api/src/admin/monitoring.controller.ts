import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { PrismaService } from '../database/prisma.service.js';
import { getRecentAiMetrics } from '../observability/ai-metrics.service.js';
import { getRecentHttpMetrics } from '../observability/http-metrics.service.js';
import { getRecentPaymentMetrics } from '../observability/payment-metrics.service.js';

@Controller('admin/monitoring')
@UseGuards(AuthGuard, AdminGuard)
export class MonitoringController {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getMonitoring() {
    let database: 'ok' | 'unavailable' = 'ok';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'unavailable';
    }

    return {
      service: 'blx-store-api',
      generatedAt: new Date().toISOString(),
      health: {
        api: 'ok' as const,
        database,
      },
      retention: {
        type: 'memory' as const,
        intervalSeconds: 60,
        maxSnapshotsPerCategory: 30,
      },
      http: {
        history: getRecentHttpMetrics(),
      },
      ai: {
        history: getRecentAiMetrics(),
      },
      payments: {
        history: getRecentPaymentMetrics(),
      },
    };
  }
}
