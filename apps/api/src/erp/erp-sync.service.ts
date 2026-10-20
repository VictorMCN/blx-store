import {
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  Cron,
  CronExpression,
} from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service.js';
import type { ErpSyncStatus } from '../generated/prisma/enums.js';
import { MockErpProvider } from './mock-erp.provider.js';

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 5;
const LEASE_DURATION_MS = 2 * 60_000;

interface SyncCandidate {
  id: string;
  orderId: string;
  status: ErpSyncStatus;
  attempts: number;
}

@Injectable()
export class ErpSyncService {
  private readonly logger = new Logger(
    ErpSyncService.name,
  );

  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: MockErpProvider,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'sync-orders-to-erp',
    disabled: process.env.NODE_ENV === 'test',
  })
  async processPendingJobs(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      await this.enqueueMissingPaidOrders();

      const now = new Date();

      const candidates =
        await this.prisma.erpSyncJob.findMany({
          where: {
            OR: [
              {
                status: {
                  in: ['PENDING', 'RETRY'],
                },
                nextAttemptAt: {
                  lte: now,
                },
              },
              {
                status: 'PROCESSING',
                lockedUntil: {
                  lte: now,
                },
              },
            ],
          },
          select: {
            id: true,
            orderId: true,
            status: true,
            attempts: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: BATCH_SIZE,
        });

      for (const candidate of candidates) {
        await this.processJob(candidate);
      }
    } catch {
      this.logger.error(
        'ERP synchronization batch failed.',
      );
    } finally {
      this.running = false;
    }
  }

  private async enqueueMissingPaidOrders(): Promise<void> {
    const orders = await this.prisma.order.findMany({
      where: {
        status: {
          in: [
            'PAID',
            'PROCESSING',
            'SHIPPED',
            'DELIVERED',
          ],
        },
        erpSyncJob: {
          is: null,
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: BATCH_SIZE,
    });

    if (orders.length === 0) {
      return;
    }

    await this.prisma.erpSyncJob.createMany({
      data: orders.map((order) => ({
        orderId: order.id,
      })),
      skipDuplicates: true,
    });
  }

  private async processJob(
    candidate: SyncCandidate,
  ): Promise<void> {
    const now = new Date();
    const lockedUntil = new Date(
      now.getTime() + LEASE_DURATION_MS,
    );

    const expectedCondition =
      candidate.status === 'PROCESSING'
        ? {
            lockedUntil: {
              lte: now,
            },
          }
        : {
            nextAttemptAt: {
              lte: now,
            },
          };

    try {
      const claim =
        await this.prisma.erpSyncJob.updateMany({
          where: {
            id: candidate.id,
            status: candidate.status,
            ...expectedCondition,
          },
          data: {
            status: 'PROCESSING',
            attempts: {
              increment: 1,
            },
            lockedUntil,
            lastErrorCode: null,
          },
        });

      if (claim.count !== 1) {
        return;
      }

      const attempt = candidate.attempts + 1;

      try {
        const order =
          await this.prisma.order.findUnique({
            where: {
              id: candidate.orderId,
            },
            select: {
              id: true,
              orderNumber: true,
              status: true,
              currency: true,
              totalInCents: true,
              items: {
                select: {
                  productSku: true,
                  quantity: true,
                  unitPriceInCents: true,
                },
              },
            },
          });

        if (
          !order ||
          ![
            'PAID',
            'PROCESSING',
            'SHIPPED',
            'DELIVERED',
          ].includes(order.status)
        ) {
          throw new Error(
            'Order not eligible for ERP export.',
          );
        }

        const externalReference =
          await this.provider.exportOrder({
            id: order.id,
            orderNumber: order.orderNumber,
            currency: order.currency,
            totalInCents: order.totalInCents,
            items: order.items.map((item) => ({
              sku: item.productSku,
              quantity: item.quantity,
              unitPriceInCents:
                item.unitPriceInCents,
            })),
          });

        await this.prisma.erpSyncJob.updateMany({
          where: {
            id: candidate.id,
            status: 'PROCESSING',
            lockedUntil,
          },
          data: {
            status: 'SYNCED',
            externalReference,
            syncedAt: new Date(),
            lockedUntil: null,
            lastErrorCode: null,
          },
        });
      } catch {
        const failedPermanently =
          attempt >= MAX_ATTEMPTS;

        const delayMinutes = Math.min(
          2 ** (attempt - 1),
          30,
        );

        await this.prisma.erpSyncJob.updateMany({
          where: {
            id: candidate.id,
            status: 'PROCESSING',
            lockedUntil,
          },
          data: {
            status: failedPermanently
              ? 'FAILED'
              : 'RETRY',
            nextAttemptAt: new Date(
              Date.now() + delayMinutes * 60_000,
            ),
            lockedUntil: null,
            lastErrorCode: 'EXPORT_FAILED',
          },
        });

        this.logger.warn(
          JSON.stringify({
            event: 'erp_sync_failed',
            jobId: candidate.id,
            attempt,
            terminal: failedPermanently,
          }),
        );
      }
    } catch {
      this.logger.error(
        'ERP synchronization job could not be updated.',
      );
    }
  }
}
