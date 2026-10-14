import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { StripeService } from './stripe.service.js';

const MAX_TRANSACTION_ATTEMPTS = 3;

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService:
      StripeService,
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

    if (!paymentIntent.client_secret) {
      throw new ServiceUnavailableException(
        'Payment provider did not return a client secret.',
      );
    }

    if (
      !payment.providerPaymentIntentId
    ) {
      await this.prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          providerPaymentIntentId:
            paymentIntent.id,
          status:
            paymentIntent.status ===
            'processing'
              ? 'PROCESSING'
              : 'PENDING',
        },
      });
    }

    return {
      payment: {
        id: payment.id,
        provider: payment.provider,
        status:
          paymentIntent.status ===
          'processing'
            ? 'PROCESSING'
            : payment.status,
        amountInCents:
          payment.amountInCents,
        currency: payment.currency,
      },
      clientSecret:
        paymentIntent.client_secret,
    };
  }

  private async preparePaymentAttempt(
    userId: string,
    orderId: string,
  ) {
    for (
      let attempt = 1;
      attempt <= MAX_TRANSACTION_ATTEMPTS;
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
                  status: {
                    in: [
                      'PENDING',
                      'PROCESSING',
                    ],
                  },
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
