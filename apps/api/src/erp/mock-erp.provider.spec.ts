import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { PrismaService } from '../database/prisma.service.js';
import {
  MockErpProvider,
  type ErpOrderPayload,
} from './mock-erp.provider.js';

describe('MockErpProvider', () => {
  const upsert = vi.fn();

  const provider = new MockErpProvider({
    erpMockOrder: {
      upsert,
    },
  } as unknown as PrismaService);

  const order: ErpOrderPayload = {
    id: 'order-123',
    orderNumber: 'BLX-123',
    currency: 'BRL',
    totalInCents: 249900,
    items: [
      {
        sku: 'NOTEBOOK-001',
        quantity: 1,
        unitPriceInCents: 249900,
      },
    ],
  };

  beforeEach(() => {
    vi.resetAllMocks();

    upsert.mockResolvedValue({
      reference: 'MOCK-order-123',
    });
  });

  it('exports orders using a stable reference', async () => {
    await expect(
      provider.exportOrder(order),
    ).resolves.toBe('MOCK-order-123');

    expect(upsert).toHaveBeenCalledWith({
      where: {
        sourceOrderId: 'order-123',
      },
      create: {
        sourceOrderId: 'order-123',
        reference: 'MOCK-order-123',
        orderNumber: 'BLX-123',
        currency: 'BRL',
        totalInCents: 249900,
        items: order.items,
      },
      update: {},
      select: {
        reference: true,
      },
    });
  });

  it('reuses the same idempotency key on repeated exports', async () => {
    await provider.exportOrder(order);
    await provider.exportOrder(order);

    expect(upsert).toHaveBeenCalledTimes(2);

    expect(
      upsert.mock.calls[0]?.[0].where,
    ).toEqual(
      upsert.mock.calls[1]?.[0].where,
    );
  });

  it('does not include customer personal information', async () => {
    await provider.exportOrder(order);

    const payload = JSON.stringify(
      upsert.mock.calls[0]?.[0],
    );

    expect(payload).not.toContain('customerEmail');
    expect(payload).not.toContain('customerTaxId');
    expect(payload).not.toContain('shippingStreet');
  });
});
