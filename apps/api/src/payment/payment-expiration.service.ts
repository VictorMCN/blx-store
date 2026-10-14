import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  Cron,
  CronExpression,
} from '@nestjs/schedule';
import type Stripe from 'stripe';
import { PrismaService } from '../database/prisma.service.js';
import { StripeService } from './stripe.service.js';

const EXPIRATION_BATCH_SIZE = 25;
const MAX_TRANSACTION_ATTEMPTS = 3;

@Injectable()
export class PaymentExpirationService {
  private readonly logger = new Logger(
    PaymentExpirationService.name,
  );

  private expirationRunInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'expire-payment-reservations',
    disabled:
      process.env.NODE_ENV === 'test',
  })
  async expirePendingOrders(): Promise<void> {
    if (this.expirationRunInProgress) {
      return;
    }

    this.expirationRunInProgress = true;

    try {
      const orders =
        await this.findExpiredPendingOrders();

      for (const order of orders) {
        try {
          await this.expireOrder(order.id);
        } catch (error) {
          this.logger.warn(
            `Could not expire order ${order.orderNumber}: ${this.getErrorMessage(error)}`,
          );
        }
      }
    } finally {
      this.expirationRunInProgress = false;
    }
  }

  async findExpiredPendingOrders() {
    return this.prisma.order.findMany({
      where: {
        status: 'PENDING_PAYMENT',
        reservationExpiresAt: {
          lte: new Date(),
        },
      },
      select: {
        id: true,
        orderNumber: true,
        reservationExpiresAt: true,
      },
      orderBy: {
        reservationExpiresAt: 'asc',
      },
      take: EXPIRATION_BATCH_SIZE,
    });
  }

  private async expireOrder(
    orderId: string,
  ): Promise<void> {
    const providerPaymentsAreSafe =
      await this.ensureProviderPaymentsCannotSucceed(
        orderId,
      );

    if (!providerPaymentsAreSafe) {
      return;
    }

    await this.finalizeExpiration(orderId);
  }

  private async ensureProviderPaymentsCannotSucceed(
    orderId: string,
  ): Promise<boolean> {
    const payments =
      await this.prisma.payment.findMany({
        where: {
          orderId,
        },
        select: {
          id: true,
          status: true,
          providerPaymentIntentId: true,
        },
      });

    for (const payment of payments) {
      if (payment.status === 'SUCCEEDED') {
        return false;
      }

      if (
        payment.status === 'CANCELED' ||
        !payment.providerPaymentIntentId
      ) {
        continue;
      }

      const paymentIntent =
        await this.stripeService.retrievePaymentIntent(
          payment.providerPaymentIntentId,
        );

      if (
        paymentIntent.metadata.paymentId !==
          payment.id ||
        paymentIntent.metadata.orderId !==
          orderId
      ) {
        throw new ConflictException(
          'Stripe payment metadata does not match the stored payment.',
        );
      }

      if (
        paymentIntent.status === 'succeeded'
      ) {
        return false;
      }

      if (
        paymentIntent.status === 'canceled'
      ) {
        continue;
      }

      if (
        !this.isCancelablePaymentIntent(
          paymentIntent.status,
        )
      ) {
        return false;
      }

      const canceledPaymentIntent =
        await this.stripeService.cancelPaymentIntent(
          paymentIntent.id,
        );

      if (
        canceledPaymentIntent.status !==
        'canceled'
      ) {
        return false;
      }
    }

    return true;
  }

  private async finalizeExpiration(
    orderId: string,
  ): Promise<void> {
    for (
      let attempt = 1;
      attempt <= MAX_TRANSACTION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        await this.prisma.$transaction(
          async (transaction) => {
            const now = new Date();

            const order =
              await transaction.order.findUnique({
                where: {
                  id: orderId,
                },
                select: {
                  id: true,
                  status: true,
                  reservationExpiresAt: true,
                  items: {
                    select: {
                      productId: true,
                      quantity: true,
                    },
                  },
                },
              });

            if (
              !order ||
              order.status !==
                'PENDING_PAYMENT' ||
              order.reservationExpiresAt >
                now
            ) {
              return;
            }

            const claimedOrder =
              await transaction.order.updateMany({
                where: {
                  id: order.id,
                  status: 'PENDING_PAYMENT',
                  reservationExpiresAt: {
                    lte: now,
                  },
                },
                data: {
                  status: 'EXPIRED',
                },
              });

            if (claimedOrder.count !== 1) {
              return;
            }

            for (const item of order.items) {
              if (!item.productId) {
                throw new ConflictException(
                  'Reserved product is no longer available.',
                );
              }

              const releasedInventory =
                await transaction.inventory.updateMany({
                  where: {
                    productId: item.productId,
                    reservedQuantity: {
                      gte: item.quantity,
                    },
                  },
                  data: {
                    reservedQuantity: {
                      decrement: item.quantity,
                    },
                  },
                });

              if (
                releasedInventory.count !== 1
              ) {
                throw new ConflictException(
                  'Inventory reservation is inconsistent.',
                );
              }
            }

            await transaction.payment.updateMany({
              where: {
                orderId: order.id,
                status: {
                  in: [
                    'PENDING',
                    'PROCESSING',
                    'FAILED',
                  ],
                },
              },
              data: {
                status: 'CANCELED',
                failureCode:
                  'reservation_expired',
                failureMessage:
                  'Payment reservation expired before payment was completed.',
              },
            });
          },
          {
            isolationLevel: 'Serializable',
          },
        );

        return;
      } catch (error) {
        if (
          this.isRetryableTransactionError(
            error,
          ) &&
          attempt <
            MAX_TRANSACTION_ATTEMPTS
        ) {
          continue;
        }

        throw error;
      }
    }
  }

  private isCancelablePaymentIntent(
    status: Stripe.PaymentIntent.Status,
  ): boolean {
    switch (status) {
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
      case 'requires_capture':
      case 'processing':
        return true;

      default:
        return false;
    }
  }

  private isRetryableTransactionError(
    error: unknown,
  ): boolean {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error)
    ) {
      return false;
    }

    const code = (
      error as {
        code?: unknown;
      }
    ).code;

    return code === 'P2034';
  }

  private getErrorMessage(
    error: unknown,
  ): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown expiration error.';
  }
}
