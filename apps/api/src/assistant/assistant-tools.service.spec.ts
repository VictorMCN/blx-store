import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { PrismaService } from '../database/prisma.service.js';
import { AssistantToolsService } from './assistant-tools.service.js';

describe('AssistantToolsService', () => {
  const productFindManyMock =
    vi.fn();

  const productFindFirstMock =
    vi.fn();

  const orderFindManyMock =
    vi.fn();

  const orderFindFirstMock =
    vi.fn();

  const prisma = {
    product: {
      findMany: (
        ...args: unknown[]
      ) =>
        productFindManyMock(
          ...args,
        ),

      findFirst: (
        ...args: unknown[]
      ) =>
        productFindFirstMock(
          ...args,
        ),
    },

    order: {
      findMany: (
        ...args: unknown[]
      ) =>
        orderFindManyMock(
          ...args,
        ),

      findFirst: (
        ...args: unknown[]
      ) =>
        orderFindFirstMock(
          ...args,
        ),
    },
  } as unknown as PrismaService;

  let service:
    AssistantToolsService;

  beforeEach(() => {
    productFindManyMock
      .mockReset();

    productFindFirstMock
      .mockReset();

    orderFindManyMock
      .mockReset();

    orderFindFirstMock
      .mockReset();

    service =
      new AssistantToolsService(
        prisma,
      );
  });

  it('searches only active products and limits results', async () => {
    productFindManyMock
      .mockResolvedValue([]);

    await service.searchProducts(
      'laptop',
      100,
    );

    expect(
      productFindManyMock,
    ).toHaveBeenCalledTimes(
      1,
    );

    expect(
      productFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where:
          expect.objectContaining({
            isActive: true,
          }),
        take: 5,
      }),
    );
  });

  it('calculates available stock without exposing reserved stock as available', async () => {
    productFindFirstMock
      .mockResolvedValue({
        name:
          'BLX Test Laptop',
        slug:
          'blx-test-laptop',
        sku:
          'BLX-TEST',
        description:
          'Test laptop.',
        priceInCents:
          500000,
        currency:
          'BRL',

        category: {
          name:
            'Laptops',
          slug:
            'laptops',
        },

        inventory: {
          quantity: 10,
          reservedQuantity: 3,
        },

        images: [],
      });

    const result =
      await service.getProductDetails(
        'BLX-TEST-LAPTOP',
      );

    expect(result).toMatchObject({
      found: true,

      product: {
        slug:
          'blx-test-laptop',
        availableQuantity: 7,
        inStock: true,
      },
    });
  });

  it('queries recent orders only for the authenticated customer', async () => {
    orderFindManyMock
      .mockResolvedValue([]);

    await service.getMyOrders(
      'customer-a',
      5,
    );

    expect(
      orderFindManyMock,
    ).toHaveBeenCalledTimes(
      1,
    );

    expect(
      orderFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId:
            'customer-a',
        },
        take: 5,
      }),
    );
  });

  it('clamps the number of customer orders returned', async () => {
    orderFindManyMock
      .mockResolvedValue([]);

    await service.getMyOrders(
      'customer-a',
      999,
    );

    expect(
      orderFindManyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId:
            'customer-a',
        },
        take: 5,
      }),
    );
  });

  it('checks both user ownership and order number when reading order status', async () => {
    orderFindFirstMock
      .mockResolvedValue(null);

    const result =
      await service.getMyOrderStatus(
        'customer-a',
        'blx-123-test',
      );

    expect(
      orderFindFirstMock,
    ).toHaveBeenCalledTimes(
      1,
    );

    expect(
      orderFindFirstMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId:
            'customer-a',
          orderNumber:
            'BLX-123-TEST',
        },
      }),
    );

    expect(result).toEqual({
      found: false,
      message:
        'Order not found for the authenticated customer.',
    });
  });

  it('never returns another customer order when ownership lookup fails', async () => {
    orderFindFirstMock
      .mockResolvedValue(null);

    const result =
      await service.getMyOrderStatus(
        'customer-b',
        'BLX-PRIVATE-ORDER',
      );

    expect(result).toEqual({
      found: false,
      message:
        'Order not found for the authenticated customer.',
    });

    expect(
      orderFindFirstMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId:
            'customer-b',
          orderNumber:
            'BLX-PRIVATE-ORDER',
        },
      }),
    );
  });
});
