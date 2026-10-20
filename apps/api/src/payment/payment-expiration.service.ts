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
import { recordPaymentMetric } from '../observability/payment-metrics.service.js';
import { PaymentService } from './payment.service.js';
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
    private readonly paymentService: PaymentService,
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
        } catch {
          recordPaymentMetric('reservationExpirationFailed');
          this.logger.warn('Payment reservation expiration failed.');
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
          orderId: true,
          status: true,
          amountInCents: true,
          currency: true,
          providerPaymentIntentId: true,
          order: {
            select: {
              orderNumber: true,
            },
          },
        },
      });

    for (const payment of payments) {
      if (payment.status === 'SUCCEEDED') {
        return false;
      }

      if (payment.status === 'CANCELED') {
        continue;
      }

      const paymentIntent =
        payment.providerPaymentIntentId
          ? await this.stripeService.retrievePaymentIntent(
              payment.providerPaymentIntentId,
            )
          : await this.recoverUnlinkedPaymentIntent(
              payment,
            );

      this.assertPaymentIntentMatches(
        payment,
        paymentIntent,
      );

      if (
        paymentIntent.status === 'succeeded'
      ) {
        await this.paymentService.reconcileSucceededPayment(
          paymentIntent,
        );

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

      this.assertPaymentIntentMatches(
        payment,
        canceledPaymentIntent,
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

  private async recoverUnlinkedPaymentIntent(
    payment: {
      id: string;
      orderId: string;
      amountInCents: number;
      currency: string;
      order: {
        orderNumber: string;
      };
    },
  ): Promise<Stripe.PaymentIntent> {
    const paymentIntent =
      await this.stripeService.createPaymentIntent({
        paymentId: payment.id,
        orderId: payment.orderId,
        orderNumber:
          payment.order.orderNumber,
        amountInCents:
          payment.amountInCents,
        currency:
          payment.currency,
      });

    const linkedPayment =
      await this.prisma.payment.updateMany({
        where: {
          id: payment.id,
          OR: [
            {
              providerPaymentIntentId:
                null,
            },
            {
              providerPaymentIntentId:
                paymentIntent.id,
            },
          ],
        },
        data: {
          providerPaymentIntentId:
            paymentIntent.id,
        },
      });

    if (linkedPayment.count !== 1) {
      throw new ConflictException(
        'Payment attempt is already linked to a different provider payment.',
      );
    }

    return paymentIntent;
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
        const didExpire = await this.prisma.$transaction(
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
              return false;
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
              return false;
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
                    productId:
                      item.productId,
                    reservedQuantity: {
                      gte: item.quantity,
                    },
                  },
                  data: {
                    reservedQuantity: {
                      decrement:
                        item.quantity,
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

            return true;
          },
          {
            isolationLevel: 'Serializable',
          },
        );

        if (didExpire) {
          recordPaymentMetric('reservationExpired');
        }

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

  private assertPaymentIntentMatches(
    payment: {
      id: string;
      orderId: string;
      amountInCents: number;
      currency: string;
    },
    paymentIntent: Stripe.PaymentIntent,
  ): void {
    if (
      paymentIntent.amount !==
        payment.amountInCents ||
      paymentIntent.currency.toUpperCase() !==
        payment.currency ||
      paymentIntent.metadata.paymentId !==
        payment.id ||
      paymentIntent.metadata.orderId !==
        payment.orderId
    ) {
      throw new ConflictException(
        'Stripe payment data does not match the stored payment.',
      );
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

}
