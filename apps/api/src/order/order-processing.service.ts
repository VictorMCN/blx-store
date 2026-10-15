import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { OrderStatus } from '../generated/prisma/enums.js';
import { EmailService } from '../notification/email.service.js';

const PREVIOUS_STATUS_BY_TARGET: Partial<
  Record<OrderStatus, OrderStatus>
> = {
  PROCESSING: 'PAID',
  SHIPPED: 'PROCESSING',
  DELIVERED: 'SHIPPED',
};

const FULFILLMENT_STATUSES: OrderStatus[] = [
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
];

@Injectable()
export class OrderProcessingService {
  constructor(
    private readonly prisma:
      PrismaService,
    private readonly emailService:
      EmailService,
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
      await this.findOrder(
        orderId,
      );

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
        order:
          currentOrder,
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
          status:
            targetStatus,
        },
      });

    if (
      result.count === 0
    ) {
      const latestOrder =
        await this.findOrder(
          orderId,
        );

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
          order:
            latestOrder,
        };
      }

      throw new ConflictException(
        `Order cannot transition from ${latestOrder.status} to ${targetStatus}.`,
      );
    }

    const updatedOrder =
      await this.findOrder(
        orderId,
      );

    if (!updatedOrder) {
      throw new NotFoundException(
        'Order not found.',
      );
    }

    await this.sendStatusEmail(
      orderId,
      targetStatus,
    );

    return {
      order:
        updatedOrder,
    };
  }

  async setFulfillmentStatus(
    orderId: string,
    targetStatus: OrderStatus,
  ) {
    if (
      !FULFILLMENT_STATUSES.includes(
        targetStatus,
      )
    ) {
      throw new BadRequestException(
        'Only fulfillment statuses can be changed manually.',
      );
    }

    const currentOrder =
      await this.findOrder(
        orderId,
      );

    if (!currentOrder) {
      throw new NotFoundException(
        'Order not found.',
      );
    }

    if (
      !FULFILLMENT_STATUSES.includes(
        currentOrder.status,
      )
    ) {
      throw new ConflictException(
        `Order status ${currentOrder.status} cannot be manually changed as fulfillment status.`,
      );
    }

    if (
      currentOrder.status ===
      targetStatus
    ) {
      return {
        order:
          currentOrder,
      };
    }

    await this.prisma.order.update({
      where: {
        id:
          orderId,
      },
      data: {
        status:
          targetStatus,
      },
    });

    const updatedOrder =
      await this.findOrder(
        orderId,
      );

    if (!updatedOrder) {
      throw new NotFoundException(
        'Order not found.',
      );
    }

    const isNormalForwardTransition =
      PREVIOUS_STATUS_BY_TARGET[
        targetStatus
      ] ===
      currentOrder.status;

    if (
      isNormalForwardTransition
    ) {
      await this.sendStatusEmail(
        orderId,
        targetStatus,
      );
    }

    return {
      order:
        updatedOrder,
    };
  }

  private async sendStatusEmail(
    orderId: string,
    status: OrderStatus,
  ): Promise<void> {
    switch (status) {
      case 'PROCESSING':
      case 'SHIPPED':
      case 'DELIVERED':
        await this.emailService.sendFulfillmentUpdate(
          orderId,
          status,
        );
        return;

      default:
        return;
    }
  }

  private findOrder(
    orderId: string,
  ) {
    return this.prisma.order.findUnique({
      where: {
        id:
          orderId,
      },
      select: {
        id: true,
        orderNumber:
          true,
        status:
          true,
        customerName:
          true,
        customerEmail:
          true,
        currency:
          true,
        totalInCents:
          true,
        createdAt:
          true,
        updatedAt:
          true,
      },
    });
  }
}
