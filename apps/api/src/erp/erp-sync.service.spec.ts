import { Logger } from '@nestjs/common';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { PrismaService } from '../database/prisma.service.js';
import { ErpSyncService } from './erp-sync.service.js';
import type { MockErpProvider } from './mock-erp.provider.js';

describe('ErpSyncService', () => {
  const candidate = {
    id: 'job-test',
    orderId: 'order-test',
    status: 'PENDING' as const,
    attempts: 0,
  };

  const order = {
    id: 'order-test',
    orderNumber: 'BLX-TEST',
    status: 'PAID',
    currency: 'BRL',
    totalInCents: 150000,
    items: [
      {
        productSku: 'SKU-TEST',
        quantity: 1,
        unitPriceInCents: 150000,
      },
    ],
  };

  const prisma = {
    order: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    erpSyncJob: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  const provider = {
    exportOrder: vi.fn(),
  };

  const service = new ErpSyncService(
    prisma as unknown as PrismaService,
    provider as unknown as MockErpProvider,
  );

  beforeEach(() => {
    vi.resetAllMocks();

    prisma.order.findMany.mockResolvedValue([]);
    prisma.order.findUnique.mockResolvedValue(order);

    prisma.erpSyncJob.findMany.mockResolvedValue([
      candidate,
    ]);
    prisma.erpSyncJob.updateMany.mockResolvedValue({
      count: 1,
    });
    prisma.erpSyncJob.createMany.mockResolvedValue({
      count: 0,
    });

    provider.exportOrder.mockResolvedValue(
      'MOCK-order-test',
    );
  });

  it('exports paid orders and marks their jobs as synced', async () => {
    await service.processPendingJobs();

    expect(provider.exportOrder).toHaveBeenCalledWith({
      id: 'order-test',
      orderNumber: 'BLX-TEST',
      currency: 'BRL',
      totalInCents: 150000,
      items: [
        {
          sku: 'SKU-TEST',
          quantity: 1,
          unitPriceInCents: 150000,
        },
      ],
    });

    expect(
      prisma.erpSyncJob.updateMany,
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SYNCED',
          externalReference: 'MOCK-order-test',
          lockedUntil: null,
        }),
      }),
    );
  });

  it('does not export a job claimed by another worker', async () => {
    prisma.erpSyncJob.updateMany.mockResolvedValueOnce({
      count: 0,
    });

    await service.processPendingJobs();

    expect(provider.exportOrder).not.toHaveBeenCalled();
  });

  it('schedules retries without logging provider details', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    provider.exportOrder.mockRejectedValue(
      new Error('PRIVATE_PROVIDER_ERROR'),
    );

    await service.processPendingJobs();

    expect(
      prisma.erpSyncJob.updateMany,
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'RETRY',
          lastErrorCode: 'EXPORT_FAILED',
        }),
      }),
    );

    expect(
      JSON.stringify(warn.mock.calls),
    ).not.toContain('PRIVATE_PROVIDER_ERROR');

    warn.mockRestore();
  });

  it('marks a job failed after the last attempt', async () => {
    prisma.erpSyncJob.findMany.mockResolvedValue([
      {
        ...candidate,
        attempts: 4,
      },
    ]);

    provider.exportOrder.mockRejectedValue(
      new Error('Provider unavailable'),
    );

    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await service.processPendingJobs();

    expect(
      prisma.erpSyncJob.updateMany,
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
        }),
      }),
    );

    warn.mockRestore();
  });

  it('recovers historical paid orders without duplicate jobs', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'historical-order',
      },
    ]);

    prisma.erpSyncJob.findMany.mockResolvedValue([]);

    await service.processPendingJobs();

    expect(
      prisma.erpSyncJob.createMany,
    ).toHaveBeenCalledWith({
      data: [
        {
          orderId: 'historical-order',
        },
      ],
      skipDuplicates: true,
    });
  });
});
