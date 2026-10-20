import {
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { PrismaService } from '../database/prisma.service.js';
import type { ErpSyncStatus } from '../generated/prisma/enums.js';

@Controller('admin/erp')
@UseGuards(AuthGuard, AdminGuard)
export class ErpAdminController {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  @Get('jobs')
  async listJobs() {
    const [jobs, groups] = await Promise.all([
      this.prisma.erpSyncJob.findMany({
        select: {
          id: true,
          status: true,
          attempts: true,
          nextAttemptAt: true,
          externalReference: true,
          lastErrorCode: true,
          createdAt: true,
          updatedAt: true,
          syncedAt: true,
          order: {
            select: {
              orderNumber: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100,
      }),
      this.prisma.erpSyncJob.groupBy({
        by: ['status'],
        _count: {
          _all: true,
        },
      }),
    ]);

    const counts: Record<ErpSyncStatus, number> = {
      PENDING: 0,
      PROCESSING: 0,
      RETRY: 0,
      SYNCED: 0,
      FAILED: 0,
    };

    for (const group of groups) {
      counts[group.status] = group._count._all;
    }

    return {
      provider: 'mock' as const,
      generatedAt: new Date().toISOString(),
      counts,
      jobs: jobs.map(({ order, ...job }) => ({
        ...job,
        orderNumber: order.orderNumber,
      })),
    };
  }

  @Get('inventory')
  async listInventory() {
    const inventory =
      await this.prisma.erpMockInventory.findMany({
        select: {
          sku: true,
          onHandQuantity: true,
          reservedQuantity: true,
          availableQuantity: true,
          syncedAt: true,
        },
        orderBy: {
          sku: 'asc',
        },
        take: 100,
      });

    return {
      provider: 'mock' as const,
      generatedAt: new Date().toISOString(),
      inventory,
    };
  }

  @Post('jobs/:jobId/retry')
  async retryJob(
    @Param('jobId', new ParseUUIDPipe())
    jobId: string,
  ) {
    const updated =
      await this.prisma.erpSyncJob.updateMany({
        where: {
          id: jobId,
          status: {
            in: ['FAILED', 'RETRY'],
          },
        },
        data: {
          status: 'PENDING',
          attempts: 0,
          nextAttemptAt: new Date(),
          lockedUntil: null,
          lastErrorCode: null,
        },
      });

    if (updated.count === 1) {
      return {
        queued: true,
      };
    }

    const existing =
      await this.prisma.erpSyncJob.findUnique({
        where: {
          id: jobId,
        },
        select: {
          status: true,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'ERP synchronization job not found.',
      );
    }

    throw new ConflictException(
      'Only failed or retryable ERP jobs can be requeued.',
    );
  }
}
