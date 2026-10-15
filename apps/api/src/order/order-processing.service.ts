import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { OrderStatus } from '../generated/prisma/enums.js';

const PREVIOUS_STATUS_BY_TARGET: Partial<
  Record<OrderStatus, OrderStatus>
> = {
  PROCESSING: 'PAID',
  SHIPPED: 'PROCESSING',
  DELIVERED: 'SHIPPED',
};

@Injectable()
export class OrderProcessingService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async updateStatus(
    orderId: string,
    targetStatus: OrderStatus,
  ) {
    const expectedCurrentStatus =
      PREVIOUS_STATUS_BY_TARGET[
        targetStatus
      ];

    if (!expectedCurrentStatus) {
      throw new BadRequestException(
        'Unsupported order status transition.',
      );
    }

    const currentOrder =
      await this.findOrder(orderId);

    if (!currentOrder) {
      throw new NotFoundException(
        'Order not found.',
      );
    }

    if (
      currentOrder.status ===
      targetStatus
    ) {
      return {
        order: currentOrder,
      };
    }

    if (
      currentOrder.status !==
      expectedCurrentStatus
    ) {
      throw new ConflictException(
        `Order cannot transition from ${currentOrder.status} to ${targetStatus}.`,
      );
    }

    const result =
      await this.prisma.order.updateMany({
        where: {
          id: orderId,
          status:
            expectedCurrentStatus,
        },
        data: {
          status: targetStatus,
        },
      });

    if (result.count === 0) {
      const latestOrder =
        await this.findOrder(orderId);

      if (!latestOrder) {
        throw new NotFoundException(
          'Order not found.',
        );
      }

      if (
        latestOrder.status ===
        targetStatus
      ) {
        return {
          order: latestOrder,
        };
      }

      throw new ConflictException(
        `Order cannot transition from ${latestOrder.status} to ${targetStatus}.`,
      );
    }

    const updatedOrder =
      await this.findOrder(orderId);

    if (!updatedOrder) {
      throw new NotFoundException(
        'Order not found.',
      );
    }

    return {
      order: updatedOrder,
    };
  }

  private findOrder(
    orderId: string,
  ) {
    return this.prisma.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        customerName: true,
        customerEmail: true,
        currency: true,
        totalInCents: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
