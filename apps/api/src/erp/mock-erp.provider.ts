import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

export interface ErpOrderPayload {
  id: string;
  orderNumber: string;
  currency: string;
  totalInCents: number;
  items: Array<{
    sku: string;
    quantity: number;
    unitPriceInCents: number;
  }>;
}

export interface ErpInventoryPayload {
  sku: string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

@Injectable()
export class MockErpProvider {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async exportOrder(
    order: ErpOrderPayload,
  ): Promise<string> {
    const reference = `MOCK-${order.id}`;

    const imported =
      await this.prisma.erpMockOrder.upsert({
        where: {
          sourceOrderId: order.id,
        },
        create: {
          sourceOrderId: order.id,
          reference,
          orderNumber: order.orderNumber,
          currency: order.currency,
          totalInCents: order.totalInCents,
          items: order.items,
        },
        update: {},
        select: {
          reference: true,
        },
      });

    return imported.reference;
  }

  async syncInventory(
    snapshot: ErpInventoryPayload[],
  ): Promise<number> {
    const syncedAt = new Date();

    for (const item of snapshot) {
      await this.prisma.erpMockInventory.upsert({
        where: {
          sku: item.sku,
        },
        create: {
          ...item,
          syncedAt,
        },
        update: {
          onHandQuantity: item.onHandQuantity,
          reservedQuantity: item.reservedQuantity,
          availableQuantity: item.availableQuantity,
          syncedAt,
        },
      });
    }

    return snapshot.length;
  }
}
