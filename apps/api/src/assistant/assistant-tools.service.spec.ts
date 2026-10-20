import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service.js';
import { AssistantToolsService } from './assistant-tools.service.js';

describe('AssistantToolsService', () => {
  const productFindManyMock = vi.fn();
  const productFindFirstMock = vi.fn();
  const orderFindManyMock = vi.fn();
  const orderFindFirstMock = vi.fn();

  const prisma = {
    product: {
      findMany: (...args: unknown[]) =>
        productFindManyMock(...args),
      findFirst: (...args: unknown[]) =>
        productFindFirstMock(...args),
    },
    order: {
      findMany: (...args: unknown[]) =>
        orderFindManyMock(...args),
      findFirst: (...args: unknown[]) =>
        orderFindFirstMock(...args),
    },
  } as unknown as PrismaService;

  let service: AssistantToolsService;

  beforeEach(() => {
    productFindManyMock.mockReset();
    productFindFirstMock.mockReset();
    orderFindManyMock.mockReset();
    orderFindFirstMock.mockReset();

    service = new AssistantToolsService(prisma);
  });

  it('searches only active products and limits results', async () => {
    productFindManyMock.mockResolvedValue([]);

    await service.searchProducts('laptop', 100);

    expect(productFindManyMock).toHaveBeenCalledTimes(1);

    expect(productFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
        }),
        take: 5,
      }),
    );
  });

  it.each([
    ['quais fones vocês têm?', 'headphones', 'audio'],
    ['fones', 'headphones', 'audio'],
    ['fone-de-ouvido', 'headphones', 'audio'],
    ['show me headphones', 'headphones', 'audio'],
    ['celular', 'smartphones', 'smartphones'],
    ['CÉLULARES', 'smartphones', 'smartphones'],
    ['phone', 'smartphones', 'smartphones'],
    ['notebook', 'laptops', 'laptops'],
    ['monitor', 'monitors', 'monitors'],
    ['teclado', 'keyboards', 'accessories'],
    ['mouse', 'mice', 'accessories'],
    ['adaptador', 'hubs', 'accessories'],
    ['caixas de som', 'speakers', 'audio'],
  ])(
    'recognizes "%s" as %s',
    async (query, label, category) => {
      productFindManyMock.mockResolvedValue([]);

      const result = await service.searchProducts(query, 5);

      const request = productFindManyMock.mock.calls[0]?.[0] as {
        where: {
          isActive: boolean;
          OR: unknown[];
        };
      };

      expect(result.interpretedSearchTerms).toEqual([label]);
      expect(request.where.isActive).toBe(true);
      expect(request.where.OR).toHaveLength(1);

      expect(
        JSON.stringify(request.where.OR),
      ).toContain(`"slug":"${category}"`);
    },
  );

  it('does not confuse headphones with smartphones', async () => {
    productFindManyMock.mockResolvedValue([]);

    await service.searchProducts('headphones', 5);

    const filters = JSON.stringify(
      productFindManyMock.mock.calls[0]?.[0],
    );

    expect(filters).toContain('"slug":"audio"');
    expect(filters).not.toContain('"slug":"smartphones"');
  });

  it('distinguishes headphones and speakers within Audio', async () => {
    productFindManyMock.mockResolvedValue([]);

    await service.searchProducts('fones', 5);

    const headphoneFilter = JSON.stringify(
      productFindManyMock.mock.calls[0]?.[0],
    );

    productFindManyMock.mockClear();

    await service.searchProducts('caixas de som', 5);

    const speakerFilter = JSON.stringify(
      productFindManyMock.mock.calls[0]?.[0],
    );

    expect(headphoneFilter).toContain('"contains":"headset"');
    expect(headphoneFilter).not.toContain('"contains":"speaker"');

    expect(speakerFilter).toContain('"contains":"speaker"');
    expect(speakerFilter).not.toContain('"contains":"headset"');
  });

  it('can search multiple product concepts in one question', async () => {
    productFindManyMock.mockResolvedValue([]);

    const result = await service.searchProducts(
      'celular e fone',
      5,
    );

    const request = productFindManyMock.mock.calls[0]?.[0] as {
      where: { OR: unknown[] };
    };

    expect(result.interpretedSearchTerms).toEqual([
      'smartphones',
      'headphones',
    ]);

    expect(request.where.OR).toHaveLength(2);
  });

  it('keeps name and SKU searches when no concept matches', async () => {
    productFindManyMock.mockResolvedValue([]);

    const result = await service.searchProducts(
      'BLX-NB14-001',
      5,
    );

    const request = JSON.stringify(
      productFindManyMock.mock.calls[0]?.[0],
    );

    expect(result.interpretedSearchTerms).toEqual([
      'BLX-NB14-001',
    ]);

    expect(request).toContain('"sku"');
    expect(request).toContain('"contains":"BLX-NB14-001"');
  });

  it('returns no products for empty input', async () => {
    expect(
      await service.searchProducts('   ', 5),
    ).toEqual({
      query: '',
      interpretedSearchTerms: [],
      count: 0,
      products: [],
    });

    expect(productFindManyMock).not.toHaveBeenCalled();
  });

  it('calculates stock without counting reserved units', async () => {
    productFindFirstMock.mockResolvedValue({
      name: 'BLX Test Laptop',
      slug: 'blx-test-laptop',
      sku: 'BLX-TEST',
      description: 'Test laptop.',
      priceInCents: 500000,
      currency: 'BRL',
      category: {
        name: 'Laptops',
        slug: 'laptops',
      },
      inventory: {
        quantity: 10,
        reservedQuantity: 3,
      },
      images: [],
    });

    const result = await service.getProductDetails(
      'BLX-TEST-LAPTOP',
    );

    expect(result).toMatchObject({
      found: true,
      product: {
        slug: 'blx-test-laptop',
        availableQuantity: 7,
        inStock: true,
      },
    });
  });

  it('reads recent orders only for the authenticated user', async () => {
    orderFindManyMock.mockResolvedValue([]);

    await service.getMyOrders('customer-a', 5);

    expect(orderFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'customer-a',
        },
        take: 5,
      }),
    );
  });

  it('clamps the number of customer orders', async () => {
    orderFindManyMock.mockResolvedValue([]);

    await service.getMyOrders('customer-a', 999);

    expect(orderFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'customer-a',
        },
        take: 5,
      }),
    );
  });

  it('checks both user ownership and order number', async () => {
    orderFindFirstMock.mockResolvedValue(null);

    const result = await service.getMyOrderStatus(
      'customer-a',
      'blx-123-test',
    );

    expect(orderFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'customer-a',
          orderNumber: 'BLX-123-TEST',
        },
      }),
    );

    expect(result).toEqual({
      found: false,
      message:
        'Order not found for the authenticated customer.',
    });
  });

  it('never reads another customer order', async () => {
    orderFindFirstMock.mockResolvedValue(null);

    const result = await service.getMyOrderStatus(
      'customer-b',
      'BLX-PRIVATE-ORDER',
    );

    expect(result).toEqual({
      found: false,
      message:
        'Order not found for the authenticated customer.',
    });

    expect(orderFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'customer-b',
          orderNumber: 'BLX-PRIVATE-ORDER',
        },
      }),
    );
  });
});
