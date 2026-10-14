import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import type { AccountType } from '../generated/prisma/enums.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto.js';

const RESERVATION_DURATION_MINUTES = 30;
const MAX_TRANSACTION_ATTEMPTS = 3;

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(
    userId: string,
    dto: CreateOrderDto,
  ) {
    for (
      let attempt = 1;
      attempt <= MAX_TRANSACTION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await this.createOrderTransaction(
          userId,
          dto,
        );
      } catch (error) {
        if (
          this.isRetryableTransactionError(
            error,
          ) &&
          attempt < MAX_TRANSACTION_ATTEMPTS
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException(
      'Checkout could not be completed. Please try again.',
    );
  }

  async listOrders(
    userId: string,
    query: ListOrdersQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where = {
      userId,
      ...(query.status
        ? {
            status: query.status,
          }
        : {}),
    };

    const [orders, total] =
      await this.prisma.$transaction([
        this.prisma.order.findMany({
          where,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            currency: true,
            subtotalInCents: true,
            shippingInCents: true,
            totalInCents: true,
            reservationExpiresAt: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                items: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip: (page - 1) * limit,
          take: limit,
        }),

        this.prisma.order.count({
          where,
        }),
      ]);

    return {
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        currency: order.currency,
        subtotalInCents:
          order.subtotalInCents,
        shippingInCents:
          order.shippingInCents,
        totalInCents:
          order.totalInCents,
        itemCount: order._count.items,
        reservationExpiresAt:
          order.reservationExpiresAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages:
          total === 0
            ? 0
            : Math.ceil(total / limit),
      },
    };
  }

  async getOrder(
    userId: string,
    orderId: string,
  ) {
    const order =
      await this.prisma.order.findFirst({
        where: {
          id: orderId,
          userId,
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          currency: true,

          subtotalInCents: true,
          shippingInCents: true,
          totalInCents: true,

          customerAccountType: true,
          customerName: true,
          customerEmail: true,
          customerTaxId: true,
          customerPhone: true,

          shippingRecipientName: true,
          shippingStreet: true,
          shippingNumber: true,
          shippingComplement: true,
          shippingNeighborhood: true,
          shippingCity: true,
          shippingState: true,
          shippingPostalCode: true,
          shippingCountry: true,

          reservationExpiresAt: true,
          createdAt: true,
          updatedAt: true,

          items: {
            select: {
              id: true,
              productId: true,
              productName: true,
              productSlug: true,
              productSku: true,
              unitPriceInCents: true,
              quantity: true,
              lineTotalInCents: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

    if (!order) {
      throw new NotFoundException(
        'Order not found.',
      );
    }

    const {
      customerTaxId,
      ...safeOrder
    } = order;

    return {
      order: {
        ...safeOrder,
        customerTaxIdMasked:
          this.maskTaxId(
            customerTaxId,
          ),
      },
    };
  }

  private async createOrderTransaction(
    userId: string,
    dto: CreateOrderDto,
  ) {
    return this.prisma.$transaction(
      async (transaction) => {
        const user =
          await transaction.user.findUnique({
            where: {
              id: userId,
            },
            select: {
              id: true,
              email: true,
              customerProfile: {
                select: {
                  id: true,
                  accountType: true,
                  fullName: true,
                  legalName: true,
                  taxId: true,
                  phone: true,
                },
              },
            },
          });

        if (!user) {
          throw new NotFoundException(
            'User not found.',
          );
        }

        if (!user.customerProfile) {
          throw new BadRequestException(
            'Complete your customer profile before checkout.',
          );
        }

        const profile =
          user.customerProfile;

        const address =
          await transaction.address.findFirst({
            where: {
              id: dto.addressId,
              customerId: profile.id,
            },
            select: {
              recipientName: true,
              street: true,
              number: true,
              complement: true,
              neighborhood: true,
              city: true,
              state: true,
              postalCode: true,
              country: true,
            },
          });

        if (!address) {
          throw new NotFoundException(
            'Shipping address not found.',
          );
        }

        const cart =
          await transaction.cart.findUnique({
            where: {
              userId,
            },
            select: {
              id: true,
              items: {
                select: {
                  quantity: true,
                  product: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      sku: true,
                      priceInCents: true,
                      currency: true,
                      isActive: true,
                      category: {
                        select: {
                          isActive: true,
                        },
                      },
                      inventory: {
                        select: {
                          id: true,
                          quantity: true,
                          reservedQuantity: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          });

        if (
          !cart ||
          cart.items.length === 0
        ) {
          throw new BadRequestException(
            'Cart is empty.',
          );
        }

        const currencies = new Set(
          cart.items.map(
            (item) =>
              item.product.currency,
          ),
        );

        if (currencies.size !== 1) {
          throw new ConflictException(
            'Cart contains multiple currencies.',
          );
        }

        for (const item of cart.items) {
          if (
            !item.product.isActive ||
            !item.product.category.isActive
          ) {
            throw new ConflictException(
              'Cart contains unavailable products.',
            );
          }

          const inventory =
            item.product.inventory;

          const availableQuantity =
            Math.max(
              (inventory?.quantity ?? 0) -
                (inventory
                  ?.reservedQuantity ?? 0),
              0,
            );

          if (
            availableQuantity <
            item.quantity
          ) {
            throw new ConflictException(
              'Some products no longer have sufficient stock.',
            );
          }
        }

        const currency =
          cart.items[0].product.currency;

        const subtotalInCents =
          cart.items.reduce(
            (subtotal, item) =>
              subtotal +
              item.product.priceInCents *
                item.quantity,
            0,
          );

        const shippingInCents = 0;

        const totalInCents =
          subtotalInCents +
          shippingInCents;

        const reservationExpiresAt =
          new Date(
            Date.now() +
              RESERVATION_DURATION_MINUTES *
                60 *
                1000,
          );

        const order =
          await transaction.order.create({
            data: {
              orderNumber:
                this.generateOrderNumber(),

              userId,

              currency,

              subtotalInCents,
              shippingInCents,
              totalInCents,

              customerAccountType:
                profile.accountType,

              customerName:
                this.getCustomerName(
                  profile.accountType,
                  profile.fullName,
                  profile.legalName,
                ),

              customerEmail: user.email,
              customerTaxId:
                profile.taxId,
              customerPhone:
                profile.phone,

              shippingRecipientName:
                address.recipientName,
              shippingStreet:
                address.street,
              shippingNumber:
                address.number,
              shippingComplement:
                address.complement,
              shippingNeighborhood:
                address.neighborhood,
              shippingCity:
                address.city,
              shippingState:
                address.state,
              shippingPostalCode:
                address.postalCode,
              shippingCountry:
                address.country,

              reservationExpiresAt,

              items: {
                create: cart.items.map(
                  (item) => ({
                    productId:
                      item.product.id,
                    productName:
                      item.product.name,
                    productSlug:
                      item.product.slug,
                    productSku:
                      item.product.sku,
                    unitPriceInCents:
                      item.product
                        .priceInCents,
                    quantity:
                      item.quantity,
                    lineTotalInCents:
                      item.product
                        .priceInCents *
                      item.quantity,
                  }),
                ),
              },
            },

            select: {
              id: true,
              orderNumber: true,
              status: true,
              currency: true,

              subtotalInCents: true,
              shippingInCents: true,
              totalInCents: true,

              customerAccountType: true,
              customerName: true,
              customerEmail: true,
              customerTaxId: true,
              customerPhone: true,

              shippingRecipientName: true,
              shippingStreet: true,
              shippingNumber: true,
              shippingComplement: true,
              shippingNeighborhood: true,
              shippingCity: true,
              shippingState: true,
              shippingPostalCode: true,
              shippingCountry: true,

              reservationExpiresAt: true,
              createdAt: true,
              updatedAt: true,

              items: {
                select: {
                  id: true,
                  productId: true,
                  productName: true,
                  productSlug: true,
                  productSku: true,
                  unitPriceInCents: true,
                  quantity: true,
                  lineTotalInCents: true,
                },
              },
            },
          });

        for (const item of cart.items) {
          if (!item.product.inventory) {
            throw new ConflictException(
              'Some products no longer have sufficient stock.',
            );
          }

          await transaction.inventory.update({
            where: {
              id: item.product.inventory.id,
            },
            data: {
              reservedQuantity: {
                increment:
                  item.quantity,
              },
            },
          });
        }

        await transaction.cart.delete({
          where: {
            id: cart.id,
          },
        });

        const {
          customerTaxId,
          ...safeOrder
        } = order;

        return {
          order: {
            ...safeOrder,
            customerTaxIdMasked:
              this.maskTaxId(
                customerTaxId,
              ),
          },
        };
      },
      {
        isolationLevel: 'Serializable',
      },
    );
  }

  private getCustomerName(
    accountType: AccountType,
    fullName: string | null,
    legalName: string | null,
  ): string {
    if (
      accountType === 'INDIVIDUAL'
    ) {
      if (!fullName) {
        throw new BadRequestException(
          'Individual customer profile is incomplete.',
        );
      }

      return fullName;
    }

    if (!legalName) {
      throw new BadRequestException(
        'Business customer profile is incomplete.',
      );
    }

    return legalName;
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now();

    const randomPart = randomBytes(4)
      .toString('hex')
      .toUpperCase();

    return `BLX-${timestamp}-${randomPart}`;
  }

  private maskTaxId(
    taxId: string,
  ): string {
    if (taxId.length <= 4) {
      return taxId;
    }

    return `${'*'.repeat(
      taxId.length - 4,
    )}${taxId.slice(-4)}`;
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

    return (
      code === 'P2034' ||
      code === 'P2002'
    );
  }
}
