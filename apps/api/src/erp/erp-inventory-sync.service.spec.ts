import { Logger } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { PrismaService } from '../database/prisma.service.js';
import { ErpInventorySyncService } from './erp-inventory-sync.service.js';
import type { MockErpProvider } from './mock-erp.provider.js';

describe('ErpInventorySyncService', () => {
  const prisma = {
    product: {
      findMany: vi.fn(),
    },
  };

  const provider = {
    syncInventory: vi.fn(),
  };

  const service = new ErpInventorySyncService(
    prisma as unknown as PrismaService,
    provider as unknown as MockErpProvider,
  );

  beforeEach(() => {
    vi.resetAllMocks();

    prisma.product.findMany.mockResolvedValue([
      {
        sku: 'NOTEBOOK-001',
        inventory: {
          quantity: 10,
          reservedQuantity: 3,
        },
      },
      {
        sku: 'PHONE-001',
        inventory: {
          quantity: 5,
          reservedQuantity: 0,
        },
      },
    ]);

    provider.syncInventory.mockResolvedValue(2);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports correct available stock quantities', async () => {
    await expect(
      service.syncInventory(),
    ).resolves.toBe(2);

    expect(provider.syncInventory).toHaveBeenCalledWith([
      {
        sku: 'NOTEBOOK-001',
        onHandQuantity: 10,
        reservedQuantity: 3,
        availableQuantity: 7,
      },
      {
        sku: 'PHONE-001',
        onHandQuantity: 5,
        reservedQuantity: 0,
        availableQuantity: 5,
      },
    ]);
  });

  it('skips products without inventory', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        sku: 'NO-STOCK',
        inventory: null,
      },
    ]);

    provider.syncInventory.mockResolvedValue(0);

    await expect(
      service.syncInventory(),
    ).resolves.toBe(0);

    expect(provider.syncInventory).toHaveBeenCalledWith([]);
  });

  it('rejects inconsistent reserved quantities', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        sku: 'INVALID-STOCK',
        inventory: {
          quantity: 2,
          reservedQuantity: 5,
        },
      },
    ]);

    await expect(
      service.syncInventory(),
    ).rejects.toThrow('Invalid inventory quantities.');

    expect(provider.syncInventory).not.toHaveBeenCalled();
  });

  it('does not expose provider errors in scheduled logs', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    provider.syncInventory.mockRejectedValue(
      new Error('PRIVATE_PROVIDER_DETAILS'),
    );

    await service.syncInventoryCron();

    expect(warn).toHaveBeenCalledWith(
      'Mock ERP inventory synchronization failed.',
    );

    expect(JSON.stringify(warn.mock.calls)).not.toContain(
      'PRIVATE_PROVIDER_DETAILS',
    );
  });
});
