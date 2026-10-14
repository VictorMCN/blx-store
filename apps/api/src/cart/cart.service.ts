import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { AddCartItemDto } from './dto/add-cart-item.dto.js';
import { UpdateCartItemDto } from './dto/update-cart-item.dto.js';

const CART_SELECT = {
  id: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      quantity: true,
      createdAt: true,
      updatedAt: true,
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
          images: {
            select: {
              url: true,
              altText: true,
              position: true,
            },
            orderBy: {
              position: 'asc',
            },
            take: 1,
          },
          inventory: {
            select: {
              quantity: true,
              reservedQuantity: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
} as const;

type CartWithItems = Prisma.CartGetPayload<{
  select: typeof CART_SELECT;
}>;

type CartItemAvailabilityReason =
  | 'PRODUCT_UNAVAILABLE'
  | 'OUT_OF_STOCK'
  | 'INSUFFICIENT_STOCK'
  | null;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string) {
    const cart =
      await this.prisma.cart.findUnique({
        where: {
          userId,
        },
        select: CART_SELECT,
      });

    return this.toCartResponse(cart);
  }

  async addItem(
    userId: string,
    dto: AddCartItemDto,
  ) {
    await this.prisma.$transaction(
      async (transaction) => {
        const product =
          await transaction.product.findFirst({
            where: {
              id: dto.productId,
              isActive: true,
              category: {
                isActive: true,
              },
            },
            select: {
              id: true,
              currency: true,
              inventory: {
                select: {
                  quantity: true,
                  reservedQuantity: true,
                },
              },
            },
          });

        if (!product) {
          throw new NotFoundException(
            'Product not found.',
          );
        }

        const cart =
          await transaction.cart.upsert({
            where: {
              userId,
            },
            update: {},
            create: {
              userId,
            },
            select: {
              id: true,
            },
          });

        const existingItems =
          await transaction.cartItem.findMany({
            where: {
              cartId: cart.id,
            },
            select: {
              productId: true,
              quantity: true,
              product: {
                select: {
                  currency: true,
                },
              },
            },
          });

        const cartCurrency =
          existingItems[0]?.product.currency;

        if (
          cartCurrency &&
          cartCurrency !== product.currency
        ) {
          throw new BadRequestException(
            'Cart items must use the same currency.',
          );
        }

        const existingItem =
          existingItems.find(
            (item) =>
              item.productId === product.id,
          );

        const targetQuantity =
          (existingItem?.quantity ?? 0) +
          dto.quantity;

        if (targetQuantity > 99) {
          throw new BadRequestException(
            'Cart item quantity cannot exceed 99.',
          );
        }

        this.ensureStockAvailable(
          product.inventory,
          targetQuantity,
        );

        if (existingItem) {
          await transaction.cartItem.update({
            where: {
              cartId_productId: {
                cartId: cart.id,
                productId: product.id,
              },
            },
            data: {
              quantity: targetQuantity,
            },
          });

          return;
        }

        await transaction.cartItem.create({
          data: {
            cartId: cart.id,
            productId: product.id,
            quantity: dto.quantity,
          },
        });
      },
    );

    return this.getCart(userId);
  }

  async updateItem(
    userId: string,
    productId: string,
    dto: UpdateCartItemDto,
  ) {
    await this.prisma.$transaction(
      async (transaction) => {
        const cart =
          await transaction.cart.findUnique({
            where: {
              userId,
            },
            select: {
              id: true,
            },
          });

        if (!cart) {
          throw new NotFoundException(
            'Cart item not found.',
          );
        }

        const item =
          await transaction.cartItem.findUnique({
            where: {
              cartId_productId: {
                cartId: cart.id,
                productId,
              },
            },
            select: {
              product: {
                select: {
                  isActive: true,
                  category: {
                    select: {
                      isActive: true,
                    },
                  },
                  inventory: {
                    select: {
                      quantity: true,
                      reservedQuantity: true,
                    },
                  },
                },
              },
            },
          });

        if (!item) {
          throw new NotFoundException(
            'Cart item not found.',
          );
        }

        if (
          !item.product.isActive ||
          !item.product.category.isActive
        ) {
          throw new ConflictException(
            'Product is no longer available.',
          );
        }

        this.ensureStockAvailable(
          item.product.inventory,
          dto.quantity,
        );

        await transaction.cartItem.update({
          where: {
            cartId_productId: {
              cartId: cart.id,
              productId,
            },
          },
          data: {
            quantity: dto.quantity,
          },
        });
      },
    );

    return this.getCart(userId);
  }

  async removeItem(
    userId: string,
    productId: string,
  ) {
    const cart =
      await this.prisma.cart.findUnique({
        where: {
          userId,
        },
        select: {
          id: true,
        },
      });

    if (!cart) {
      throw new NotFoundException(
        'Cart item not found.',
      );
    }

    const result =
      await this.prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
          productId,
        },
      });

    if (result.count === 0) {
      throw new NotFoundException(
        'Cart item not found.',
      );
    }
  }

  async clearCart(userId: string) {
    await this.prisma.cart.deleteMany({
      where: {
        userId,
      },
    });
  }

  private ensureStockAvailable(
    inventory:
      | {
          quantity: number;
          reservedQuantity: number;
        }
      | null,
    requestedQuantity: number,
  ) {
    const availableQuantity = Math.max(
      (inventory?.quantity ?? 0) -
        (inventory?.reservedQuantity ?? 0),
      0,
    );

    if (availableQuantity === 0) {
      throw new ConflictException(
        'Product is out of stock.',
      );
    }

    if (
      requestedQuantity > availableQuantity
    ) {
      throw new ConflictException(
        'Requested quantity exceeds available stock.',
      );
    }
  }

  private toCartResponse(
    cart: CartWithItems | null,
  ) {
    if (!cart) {
      return {
        cart: {
          id: null,
          items: [],
          distinctItemCount: 0,
          totalItemCount: 0,
          subtotalInCents: 0,
          currency: null,
          canCheckout: false,
          createdAt: null,
          updatedAt: null,
        },
      };
    }

    const items = cart.items.map((item) => {
      const product = item.product;

      const availableQuantity = Math.max(
        (product.inventory?.quantity ?? 0) -
          (product.inventory
            ?.reservedQuantity ?? 0),
        0,
      );

      let reason: CartItemAvailabilityReason =
        null;

      if (
        !product.isActive ||
        !product.category.isActive
      ) {
        reason = 'PRODUCT_UNAVAILABLE';
      } else if (availableQuantity === 0) {
        reason = 'OUT_OF_STOCK';
      } else if (
        availableQuantity < item.quantity
      ) {
        reason = 'INSUFFICIENT_STOCK';
      }

      const primaryImage =
        product.images[0] ?? null;

      return {
        id: item.id,
        quantity: item.quantity,
        lineTotalInCents:
          product.priceInCents *
          item.quantity,
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          priceInCents:
            product.priceInCents,
          currency: product.currency,
          primaryImage,
        },
        availability: {
          isAvailable: reason === null,
          reason,
        },
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    const currencies = new Set(
      items.map(
        (item) => item.product.currency,
      ),
    );

    const subtotalInCents = items.reduce(
      (subtotal, item) =>
        subtotal + item.lineTotalInCents,
      0,
    );

    const totalItemCount = items.reduce(
      (total, item) =>
        total + item.quantity,
      0,
    );

    const canCheckout =
      items.length > 0 &&
      currencies.size === 1 &&
      items.every(
        (item) =>
          item.availability.isAvailable,
      );

    return {
      cart: {
        id: cart.id,
        items,
        distinctItemCount: items.length,
        totalItemCount,
        subtotalInCents,
        currency:
          currencies.size === 1
            ? items[0]?.product.currency ??
              null
            : null,
        canCheckout,
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt,
      },
    };
  }
}
