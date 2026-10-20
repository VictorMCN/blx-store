import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { PrismaService } from '../database/prisma.service.js';
import { MockErpProvider } from './mock-erp.provider.js';

describe('MockErpProvider inventory', () => {
  const upsert = vi.fn();

  const provider = new MockErpProvider({
    erpMockInventory: {
      upsert,
    },
  } as unknown as PrismaService);

  const snapshot = [
    {
      sku: 'NOTEBOOK-001',
      onHandQuantity: 10,
      reservedQuantity: 3,
      availableQuantity: 7,
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    upsert.mockResolvedValue({});
  });

  it('stores inventory using SKU as its unique key', async () => {
    await expect(
      provider.syncInventory(snapshot),
    ).resolves.toBe(1);

    expect(upsert).toHaveBeenCalledWith({
      where: {
        sku: 'NOTEBOOK-001',
      },
      create: {
        ...snapshot[0],
        syncedAt: expect.any(Date),
      },
      update: {
        onHandQuantity: 10,
        reservedQuantity: 3,
        availableQuantity: 7,
        syncedAt: expect.any(Date),
      },
    });
  });

  it('reuses the same SKU during repeated synchronization', async () => {
    await provider.syncInventory(snapshot);
    await provider.syncInventory(snapshot);

    expect(upsert).toHaveBeenCalledTimes(2);

    expect(
      upsert.mock.calls[0]?.[0].where,
    ).toEqual(
      upsert.mock.calls[1]?.[0].where,
    );
  });
});
