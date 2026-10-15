import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { OrderStatus } from '../generated/prisma/enums.js';

const REVENUE_STATUSES: OrderStatus[] = [
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
];

const ACTIVE_FULFILLMENT_STATUSES: OrderStatus[] = [
  'PAID',
  'PROCESSING',
  'SHIPPED',
];

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  customerName: true,
  customerEmail: true,
  currency: true,
  subtotalInCents: true,
  shippingInCents: true,
  totalInCents: true,
  createdAt: true,
  updatedAt: true,

  items: {
    select: {
      productName: true,
      productSku: true,
      quantity: true,
    },
  },

  _count: {
    select: {
      items: true,
    },
  },
} as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getDashboard() {
    const [
      totalOrders,
      revenue,
      revenueCurrency,
      activeFulfillmentOrders,
      recentOrders,
      products,
    ] = await this.prisma.$transaction([
      this.prisma.order.count(),

      this.prisma.order.aggregate({
        where: {
          status: {
            in: REVENUE_STATUSES,
          },
        },
        _sum: {
          totalInCents: true,
        },
      }),

      this.prisma.order.findFirst({
        where: {
          status: {
            in: REVENUE_STATUSES,
          },
        },
        select: {
          currency: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),

      this.prisma.order.count({
        where: {
          status: {
            in: ACTIVE_FULFILLMENT_STATUSES,
          },
        },
      }),

      this.prisma.order.findMany({
        select: ORDER_SELECT,
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      }),

      this.prisma.product.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          inventory: {
            select: {
              quantity: true,
              reservedQuantity: true,
              reorderPoint: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      }),
    ]);

    const inventory =
      this.toInventoryRows(products);

    return {
      metrics: {
        paidRevenueInCents:
          revenue._sum.totalInCents ?? 0,
        currency:
          revenueCurrency?.currency ??
          'BRL',
        totalOrders,
        activeFulfillmentOrders,
        lowStockProducts:
          inventory.filter(
            (item) =>
              item.isLowStock,
          ).length,
      },

      recentOrders:
        recentOrders.map(
          ({ _count, ...order }) => ({
            ...order,
            itemCount:
              _count.items,
          }),
        ),
    };
  }

  async listOrders() {
    const orders =
      await this.prisma.order.findMany({
        select: ORDER_SELECT,
        orderBy: {
          createdAt: 'desc',
        },
        take: 100,
      });

    return {
      orders: orders.map(
        ({ _count, ...order }) => ({
          ...order,
          itemCount:
            _count.items,
        }),
      ),
    };
  }

  async listInventory() {
    const products =
      await this.prisma.product.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          inventory: {
            select: {
              quantity: true,
              reservedQuantity: true,
              reorderPoint: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

    return {
      inventory:
        this.toInventoryRows(
          products,
        ).sort(
          (
            first,
            second,
          ) => {
            if (
              first.isLowStock !==
              second.isLowStock
            ) {
              return first.isLowStock
                ? -1
                : 1;
            }

            return first.name.localeCompare(
              second.name,
            );
          },
        ),
    };
  }

  private toInventoryRows(
    products: Array<{
      id: string;
      name: string;
      sku: string;
      inventory: {
        quantity: number;
        reservedQuantity: number;
        reorderPoint: number;
      } | null;
    }>,
  ) {
    return products.map(
      (product) => {
        const quantity =
          product.inventory
            ?.quantity ?? 0;

        const reservedQuantity =
          product.inventory
            ?.reservedQuantity ??
          0;

        const reorderPoint =
          product.inventory
            ?.reorderPoint ?? 0;

        const availableQuantity =
          Math.max(
            quantity -
              reservedQuantity,
            0,
          );

        const hasInventory =
          product.inventory !==
          null;

        return {
          productId:
            product.id,
          name:
            product.name,
          sku:
            product.sku,
          quantity,
          reservedQuantity,
          availableQuantity,
          reorderPoint,
          hasInventory,
          isOutOfStock:
            availableQuantity ===
            0,
          isLowStock:
            !hasInventory ||
            availableQuantity <=
              reorderPoint,
        };
      },
    );
  }
}
