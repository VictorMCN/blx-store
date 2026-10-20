import { Injectable, Logger } from '@nestjs/common';
import {
  Cron,
  CronExpression,
} from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service.js';
import { MockErpProvider } from './mock-erp.provider.js';

@Injectable()
export class ErpInventorySyncService {
  private readonly logger = new Logger(
    ErpInventorySyncService.name,
  );

  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: MockErpProvider,
  ) {}

  async syncInventory(): Promise<number> {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
      },
      select: {
        sku: true,
        inventory: {
          select: {
            quantity: true,
            reservedQuantity: true,
          },
        },
      },
      orderBy: {
        sku: 'asc',
      },
    });

    const snapshot = products
      .filter((product) => product.inventory !== null)
      .map((product) => {
        const inventory = product.inventory!;

        if (
          inventory.quantity < 0 ||
          inventory.reservedQuantity < 0 ||
          inventory.reservedQuantity > inventory.quantity
        ) {
          throw new Error(
            'Invalid inventory quantities.',
          );
        }

        return {
          sku: product.sku,
          onHandQuantity: inventory.quantity,
          reservedQuantity: inventory.reservedQuantity,
          availableQuantity:
            inventory.quantity - inventory.reservedQuantity,
        };
      });

    return this.provider.syncInventory(snapshot);
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'sync-inventory-to-erp',
    disabled: process.env.NODE_ENV === 'test',
  })
  async syncInventoryCron(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const synced = await this.syncInventory();

      this.logger.log(
        JSON.stringify({
          event: 'erp_inventory_synced',
          provider: 'mock',
          products: synced,
        }),
      );
    } catch {
      this.logger.warn(
        'Mock ERP inventory synchronization failed.',
      );
    } finally {
      this.running = false;
    }
  }
}
