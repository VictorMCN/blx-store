import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type Stripe from 'stripe';
import { PrismaService } from '../database/prisma.service.js';
import { StripeService } from './stripe.service.js';

const MAX_TRANSACTION_ATTEMPTS = 3;

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  async createPaymentIntent(
    userId: string,
    orderId: string,
  ) {
    const payment =
      await this.preparePaymentAttempt(
        userId,
        orderId,
      );

    const paymentIntent =
      payment.providerPaymentIntentId
        ? await this.stripeService.retrievePaymentIntent(
            payment.providerPaymentIntentId,
          )
        : await this.stripeService.createPaymentIntent(
            {
              paymentId: payment.id,
              orderId: payment.order.id,
              orderNumber:
                payment.order.orderNumber,
              amountInCents:
                payment.amountInCents,
              currency:
                payment.currency,
            },
          );

    this.assertPaymentIntentMatches(
      {
        id: payment.id,
        orderId: payment.order.id,
        amountInCents:
          payment.amountInCents,
        currency: payment.currency,
      },
      paymentIntent,
    );

    await this.linkProviderPaymentIntent(
      payment.id,
      paymentIntent.id,
    );

    const providerStatus =
      this.mapActiveProviderStatus(
        paymentIntent.status,
      );

    if (providerStatus) {
      await this.syncActiveProviderStatus(
        payment.id,
        providerStatus,
      );
    }

    if (
      paymentIntent.status === 'succeeded'
    ) {
      await this.reconcileSucceededPayment(
        paymentIntent,
      );

      return {
        payment: {
          id: payment.id,
          provider: payment.provider,
          status: 'SUCCEEDED' as const,
          amountInCents:
            payment.amountInCents,
          currency:
            payment.currency,
        },
        clientSecret:
          paymentIntent.client_secret,
      };
    }

    if (
      paymentIntent.status === 'canceled'
    ) {
      await this.handlePaymentCanceled(
        paymentIntent,
      );

      throw new ConflictException(
        'Payment attempt has been canceled.',
      );
    }

    await this.ensureOrderStillAcceptsPayment(
      payment.order.id,
      paymentIntent,
    );

    if (!paymentIntent.client_secret) {
      throw new ServiceUnavailableException(
        'Payment provider did not return a client secret.',
      );
    }

    return {
      payment: {
        id: payment.id,
        provider: payment.provider,
        status:
          providerStatus ??
          payment.status,
        amountInCents:
          payment.amountInCents,
        currency: payment.currency,
      },
      clientSecret:
        paymentIntent.client_secret,
    };
  }

  async reconcileSucceededPayment(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    if (
      paymentIntent.status !== 'succeeded'
    ) {
      throw new ConflictException(
        'Payment provider does not report a successful payment.',
      );
    }

    await this.handlePaymentSucceeded(
      paymentIntent,
      new Date(),
    );
  }

  async handleStripeWebhook(
    event: Stripe.Event,
  ): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSucceeded(
          event.data
            .object as Stripe.PaymentIntent,
          new Date(
            event.created * 1000,
          ),
        );
        return;

      case 'payment_intent.processing':
        await this.handlePaymentStatus(
          event.data
            .object as Stripe.PaymentIntent,
          'PROCESSING',
        );
        return;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(
          event.data
            .object as Stripe.PaymentIntent,
        );
        return;

      case 'payment_intent.canceled':
        await this.handlePaymentCanceled(
          event.data
            .object as Stripe.PaymentIntent,
        );
        return;

      default:
        return;
    }
  }

  private async preparePaymentAttempt(
    userId: string,
    orderId: string,
  ) {
    for (
      let attempt = 1;
      attempt <=
      MAX_TRANSACTION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const order =
              await transaction.order.findFirst({
                where: {
                  id: orderId,
                  userId,
                },
                select: {
                  id: true,
                  orderNumber: true,
                  status: true,
                  currency: true,
                  totalInCents: true,
                  reservationExpiresAt:
                    true,
                },
              });

            if (!order) {
              throw new NotFoundException(
                'Order not found.',
              );
            }

            if (
              order.status !==
              'PENDING_PAYMENT'
            ) {
              throw new ConflictException(
                'Order is not awaiting payment.',
              );
            }

            if (
              order.reservationExpiresAt <=
              new Date()
            ) {
              throw new ConflictException(
                'Order payment reservation has expired.',
              );
            }

            const existingPayment =
              await transaction.payment.findFirst({
                where: {
                  orderId: order.id,
                  OR: [
                    {
                      status: {
                        in: [
                          'PENDING',
                          'PROCESSING',
                        ],
                      },
                    },
                    {
                      status: 'FAILED',
                      providerPaymentIntentId:
                        {
                          not: null,
                        },
                    },
                  ],
                },
                select: {
                  id: true,
                  provider: true,
                  status: true,
                  amountInCents: true,
                  currency: true,
                  providerPaymentIntentId:
                    true,
                  order: {
                    select: {
                      id: true,
                      orderNumber: true,
                    },
                  },
                },
                orderBy: {
                  createdAt: 'desc',
                },
              });

            if (existingPayment) {
              if (
                existingPayment.amountInCents !==
                  order.totalInCents ||
                existingPayment.currency !==
                  order.currency
              ) {
                throw new ConflictException(
                  'Existing payment attempt does not match the order.',
                );
              }

              return existingPayment;
            }

            return transaction.payment.create({
              data: {
                orderId: order.id,
                amountInCents:
                  order.totalInCents,
                currency:
                  order.currency,
              },
              select: {
                id: true,
                provider: true,
                status: true,
                amountInCents: true,
                currency: true,
                providerPaymentIntentId:
                  true,
                order: {
                  select: {
                    id: true,
                    orderNumber: true,
                  },
                },
              },
            });
          },
          {
            isolationLevel:
              'Serializable',
          },
        );
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

    throw new ConflictException(
      'Payment could not be initialized. Please try again.',
    );
  }

  private async linkProviderPaymentIntent(
    paymentId: string,
    paymentIntentId: string,
  ): Promise<void> {
    const linkedPayment =
      await this.prisma.payment.updateMany({
        where: {
          id: paymentId,
          OR: [
            {
              providerPaymentIntentId:
                null,
            },
            {
              providerPaymentIntentId:
                paymentIntentId,
            },
          ],
        },
        data: {
          providerPaymentIntentId:
            paymentIntentId,
        },
      });

    if (linkedPayment.count !== 1) {
      throw new ConflictException(
        'Payment attempt is already linked to a different provider payment.',
      );
    }
  }

  private async syncActiveProviderStatus(
    paymentId: string,
    status: 'PENDING' | 'PROCESSING',
  ): Promise<void> {
    await this.prisma.payment.updateMany({
      where: {
        id: paymentId,
        status: {
          in: [
            'PENDING',
            'PROCESSING',
            'FAILED',
          ],
        },
      },
      data: {
        status,
        failureCode: null,
        failureMessage: null,
      },
    });
  }

  private async handlePaymentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
    succeededAt: Date,
  ) {
    for (
      let attempt = 1;
      attempt <=
      MAX_TRANSACTION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        await this.prisma.$transaction(
          async (transaction) => {
            const payment =
              await transaction.payment.findUnique({
                where: {
                  providerPaymentIntentId:
                    paymentIntent.id,
                },
                select: {
                  id: true,
                  orderId: true,
                  status: true,
                  amountInCents: true,
                  currency: true,
                  order: {
                    select: {
                      id: true,
                      status: true,
                      items: {
                        select: {
                          productId: true,
                          quantity: true,
                        },
                      },
                    },
                  },
                },
              });

            if (!payment) {
              return;
            }

            this.assertPaymentIntentMatches(
              payment,
              paymentIntent,
            );

            if (
              payment.status ===
              'SUCCEEDED'
            ) {
              return;
            }

            if (
              payment.order.status !==
              'PENDING_PAYMENT'
            ) {
              throw new ConflictException(
                'Order can no longer be completed by this payment.',
              );
            }

            for (
              const item of
                payment.order.items
            ) {
              if (!item.productId) {
                throw new ConflictException(
                  'Reserved product is no longer available.',
                );
              }

              const inventory =
                await transaction.inventory.findUnique({
                  where: {
                    productId:
                      item.productId,
                  },
                  select: {
                    id: true,
                    quantity: true,
                    reservedQuantity:
                      true,
                  },
                });

              if (
                !inventory ||
                inventory.quantity <
                  item.quantity ||
                inventory.reservedQuantity <
                  item.quantity
              ) {
                throw new ConflictException(
                  'Inventory reservation is inconsistent.',
                );
              }

              await transaction.inventory.update({
                where: {
                  id: inventory.id,
                },
                data: {
                  quantity: {
                    decrement:
                      item.quantity,
                  },
                  reservedQuantity: {
                    decrement:
                      item.quantity,
                  },
                },
              });
            }

            await transaction.payment.update({
              where: {
                id: payment.id,
              },
              data: {
                status: 'SUCCEEDED',
                succeededAt,
                failureCode: null,
                failureMessage: null,
              },
            });

            await transaction.order.update({
              where: {
                id: payment.order.id,
              },
              data: {
                status: 'PAID',
              },
            });
          },
          {
            isolationLevel:
              'Serializable',
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

  private async ensureOrderStillAcceptsPayment(
    orderId: string,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const order =
      await this.prisma.order.findUnique({
        where: {
          id: orderId,
        },
        select: {
          status: true,
          reservationExpiresAt: true,
        },
      });

    if (
      order &&
      order.status === 'PENDING_PAYMENT' &&
      order.reservationExpiresAt >
        new Date()
    ) {
      return;
    }

    if (
      paymentIntent.status !== 'succeeded' &&
      paymentIntent.status !== 'canceled'
    ) {
      try {
        await this.stripeService.cancelPaymentIntent(
          paymentIntent.id,
        );
      } catch {
        // The PaymentIntent is already persisted locally.
        // The scheduler can safely reconcile it later.
      }
    }

    if (
      order?.status === 'EXPIRED' ||
      (order &&
        order.reservationExpiresAt <=
          new Date())
    ) {
      throw new ConflictException(
        'Order payment reservation has expired.',
      );
    }

    throw new ConflictException(
      'Order is not awaiting payment.',
    );
  }

  private async handlePaymentStatus(
    paymentIntent: Stripe.PaymentIntent,
    status: 'PROCESSING',
  ) {
    const payment =
      await this.findPaymentForWebhook(
        paymentIntent,
      );

    if (!payment) {
      return;
    }

    if (
      payment.status === 'SUCCEEDED' ||
      payment.status === 'CANCELED'
    ) {
      return;
    }

    await this.prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: {
          in: [
            'PENDING',
            'PROCESSING',
            'FAILED',
          ],
        },
      },
      data: {
        status,
        failureCode: null,
        failureMessage: null,
      },
    });
  }

  private async handlePaymentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ) {
    const payment =
      await this.findPaymentForWebhook(
        paymentIntent,
      );

    if (!payment) {
      return;
    }

    if (
      payment.status === 'SUCCEEDED' ||
      payment.status === 'CANCELED'
    ) {
      return;
    }

    await this.prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: {
          in: [
            'PENDING',
            'PROCESSING',
            'FAILED',
          ],
        },
      },
      data: {
        status: 'FAILED',
        failureCode:
          paymentIntent
            .last_payment_error
            ?.code ?? null,
        failureMessage:
          paymentIntent
            .last_payment_error
            ?.message ?? null,
      },
    });
  }

  private async handlePaymentCanceled(
    paymentIntent: Stripe.PaymentIntent,
  ) {
    const payment =
      await this.findPaymentForWebhook(
        paymentIntent,
      );

    if (!payment) {
      return;
    }

    if (
      payment.status === 'SUCCEEDED'
    ) {
      return;
    }

    await this.prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: {
          in: [
            'PENDING',
            'PROCESSING',
            'FAILED',
            'CANCELED',
          ],
        },
      },
      data: {
        status: 'CANCELED',
        failureCode:
          paymentIntent
            .cancellation_reason ??
          'canceled',
        failureMessage:
          'Payment was canceled by the payment provider.',
      },
    });
  }

  private async findPaymentForWebhook(
    paymentIntent: Stripe.PaymentIntent,
  ) {
    const payment =
      await this.prisma.payment.findUnique({
        where: {
          providerPaymentIntentId:
            paymentIntent.id,
        },
        select: {
          id: true,
          orderId: true,
          status: true,
          amountInCents: true,
          currency: true,
        },
      });

    if (!payment) {
      return null;
    }

    this.assertPaymentIntentMatches(
      payment,
      paymentIntent,
    );

    return payment;
  }

  private assertPaymentIntentMatches(
    payment: {
      id: string;
      orderId: string;
      amountInCents: number;
      currency: string;
    },
    paymentIntent: Stripe.PaymentIntent,
  ) {
    const currency =
      paymentIntent.currency.toUpperCase();

    if (
      paymentIntent.amount !==
        payment.amountInCents ||
      currency !== payment.currency ||
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

  private mapActiveProviderStatus(
    status: Stripe.PaymentIntent.Status,
  ): 'PENDING' | 'PROCESSING' | null {
    switch (status) {
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return 'PENDING';

      case 'processing':
        return 'PROCESSING';

      default:
        return null;
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
