import {
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

const PRODUCT_SELECT = {
  name: true,
  slug: true,
  sku: true,
  description: true,
  priceInCents: true,
  currency: true,

  category: {
    select: {
      name: true,
      slug: true,
    },
  },

  inventory: {
    select: {
      quantity: true,
      reservedQuantity: true,
    },
  },

  images: {
    select: {
      url: true,
      altText: true,
    },
    orderBy: {
      position: 'asc' as const,
    },
    take: 1,
  },
} as const;

const SEARCH_CONCEPTS = [
  {
    triggers: [
      'laptop',
      'laptops',
      'notebook',
      'notebooks',
      'computador portátil',
      'computador portatil',
      'computadores portáteis',
      'computadores portateis',
      'portátil',
      'portatil',
      'portátiles',
      'portatiles',
    ],
    terms: [
      'laptop',
      'laptops',
      'notebook',
      'portable',
    ],
  },

  {
    triggers: [
      'fone',
      'fones',
      'fone de ouvido',
      'fones de ouvido',
      'headphone',
      'headphones',
      'headset',
      'headsets',
      'auricular',
      'auriculares',
      'earphone',
      'earphones',
    ],
    terms: [
      'headphone',
      'headphones',
      'headset',
      'audio',
      'anc',
    ],
  },

  {
    triggers: [
      'celular',
      'celulares',
      'smartphone',
      'smartphones',
      'telefone',
      'telefones',
      'phone',
      'phones',
      'móvil',
      'movil',
      'móviles',
      'moviles',
    ],
    terms: [
      'smartphone',
      'smartphones',
      'phone',
      'mobile',
    ],
  },

  {
    triggers: [
      'monitor',
      'monitores',
      'monitors',
      'tela',
      'telas',
      'screen',
      'screens',
      'display',
      'displays',
    ],
    terms: [
      'monitor',
      'monitors',
      'display',
      'screen',
    ],
  },

  {
    triggers: [
      'teclado',
      'teclados',
      'keyboard',
      'keyboards',
    ],
    terms: [
      'keyboard',
      'keyboards',
      'mechanical',
    ],
  },

  {
    triggers: [
      'mouse',
      'mouses',
      'mice',
    ],
    terms: [
      'mouse',
      'mice',
    ],
  },

  {
    triggers: [
      'hub',
      'hubs',
      'adaptador',
      'adaptadores',
      'adapter',
      'adapters',
      'dock',
      'docking station',
    ],
    terms: [
      'hub',
      'usb-c',
      'adapter',
      'dock',
    ],
  },

  {
    triggers: [
      'caixa de som',
      'caixas de som',
      'alto falante',
      'alto-falante',
      'speaker',
      'speakers',
      'parlante',
      'parlantes',
    ],
    terms: [
      'speaker',
      'speakers',
      'audio',
    ],
  },
] as const;

@Injectable()
export class AssistantToolsService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async searchProducts(
    query: string,
    maxResults: number,
  ) {
    const normalizedQuery =
      query.trim();

    const limit = Math.min(
      Math.max(
        maxResults,
        1,
      ),
      5,
    );

    const searchTerms =
      this.expandSearchTerms(
        normalizedQuery,
      );

    const products =
      await this.prisma.product.findMany({
        where: {
          isActive: true,

          OR:
            searchTerms.flatMap(
              (term) => [
                {
                  name: {
                    contains:
                      term,
                    mode:
                      'insensitive' as const,
                  },
                },
                {
                  description: {
                    contains:
                      term,
                    mode:
                      'insensitive' as const,
                  },
                },
                {
                  sku: {
                    contains:
                      term,
                    mode:
                      'insensitive' as const,
                  },
                },
                {
                  category: {
                    name: {
                      contains:
                        term,
                      mode:
                        'insensitive' as const,
                    },
                  },
                },
                {
                  category: {
                    description: {
                      contains:
                        term,
                      mode:
                        'insensitive' as const,
                    },
                  },
                },
              ],
            ),
        },

        select:
          PRODUCT_SELECT,

        orderBy: {
          name: 'asc',
        },

        take: limit,
      });

    return {
      query:
        normalizedQuery,

      interpretedSearchTerms:
        searchTerms,

      count:
        products.length,

      products:
        products.map(
          (product) =>
            this.toProductResult(
              product,
            ),
        ),
    };
  }

  async getProductDetails(
    slug: string,
  ) {
    const product =
      await this.prisma.product.findFirst({
        where: {
          slug:
            slug
              .trim()
              .toLowerCase(),
          isActive: true,
        },

        select:
          PRODUCT_SELECT,
      });

    if (!product) {
      return {
        found: false,
        message:
          'Product not found.',
      };
    }

    return {
      found: true,
      product:
        this.toProductResult(
          product,
        ),
    };
  }

  async compareProducts(
    slugs: string[],
  ) {
    const normalizedSlugs =
      [
        ...new Set(
          slugs
            .map((slug) =>
              slug
                .trim()
                .toLowerCase(),
            )
            .filter(Boolean),
        ),
      ].slice(
        0,
        4,
      );

    const products =
      await this.prisma.product.findMany({
        where: {
          isActive: true,
          slug: {
            in:
              normalizedSlugs,
          },
        },

        select:
          PRODUCT_SELECT,
      });

    const productBySlug =
      new Map(
        products.map(
          (product) => [
            product.slug,
            product,
          ],
        ),
      );

    return {
      requested:
        normalizedSlugs,

      products:
        normalizedSlugs
          .map((slug) =>
            productBySlug.get(
              slug,
            ),
          )
          .filter(
            (
              product,
            ): product is NonNullable<
              typeof product
            > =>
              product !==
              undefined,
          )
          .map((product) =>
            this.toProductResult(
              product,
            ),
          ),

      missing:
        normalizedSlugs.filter(
          (slug) =>
            !productBySlug.has(
              slug,
            ),
        ),
    };
  }

  async getMyOrders(
    userId: string,
    limit: number,
  ) {
    const safeLimit =
      Math.min(
        Math.max(
          limit,
          1,
        ),
        5,
      );

    const orders =
      await this.prisma.order.findMany({
        where: {
          userId,
        },

        select: {
          orderNumber: true,
          status: true,
          currency: true,
          totalInCents: true,
          createdAt: true,
          updatedAt: true,

          items: {
            select: {
              productName: true,
              quantity: true,
            },
            orderBy: {
              createdAt:
                'asc',
            },
          },
        },

        orderBy: {
          createdAt: 'desc',
        },

        take:
          safeLimit,
      });

    return {
      count:
        orders.length,

      orders:
        orders.map(
          (order) => ({
            orderNumber:
              order.orderNumber,
            status:
              order.status,
            total:
              this.formatMoney(
                order.totalInCents,
                order.currency,
              ),
            createdAt:
              order.createdAt,
            updatedAt:
              order.updatedAt,
            items:
              order.items,
          }),
        ),
    };
  }

  async getMyOrderStatus(
    userId: string,
    orderNumber: string,
  ) {
    const normalizedOrderNumber =
      orderNumber
        .trim()
        .toUpperCase();

    const order =
      await this.prisma.order.findFirst({
        where: {
          userId,
          orderNumber:
            normalizedOrderNumber,
        },

        select: {
          orderNumber: true,
          status: true,
          currency: true,
          subtotalInCents: true,
          shippingInCents: true,
          totalInCents: true,
          reservationExpiresAt:
            true,
          createdAt: true,
          updatedAt: true,

          items: {
            select: {
              productName: true,
              quantity: true,
              unitPriceInCents:
                true,
              lineTotalInCents:
                true,
            },
            orderBy: {
              createdAt:
                'asc',
            },
          },
        },
      });

    if (!order) {
      return {
        found: false,
        message:
          'Order not found for the authenticated customer.',
      };
    }

    return {
      found: true,

      order: {
        orderNumber:
          order.orderNumber,
        status:
          order.status,

        subtotal:
          this.formatMoney(
            order.subtotalInCents,
            order.currency,
          ),

        shipping:
          this.formatMoney(
            order.shippingInCents,
            order.currency,
          ),

        total:
          this.formatMoney(
            order.totalInCents,
            order.currency,
          ),

        reservationExpiresAt:
          order.reservationExpiresAt,
        createdAt:
          order.createdAt,
        updatedAt:
          order.updatedAt,

        items:
          order.items.map(
            (item) => ({
              productName:
                item.productName,
              quantity:
                item.quantity,

              unitPrice:
                this.formatMoney(
                  item.unitPriceInCents,
                  order.currency,
                ),

              lineTotal:
                this.formatMoney(
                  item.lineTotalInCents,
                  order.currency,
                ),
            }),
          ),
      },
    };
  }

  private expandSearchTerms(
    query: string,
  ): string[] {
    const normalized =
      this.normalizeSearchText(
        query,
      );

    const terms =
      new Set<string>();

    if (query.trim()) {
      terms.add(
        query.trim(),
      );
    }

    for (
      const concept
      of SEARCH_CONCEPTS
    ) {
      const matches =
        concept.triggers.some(
          (trigger) =>
            normalized.includes(
              this.normalizeSearchText(
                trigger,
              ),
            ),
        );

      if (!matches) {
        continue;
      }

      for (
        const term
        of concept.terms
      ) {
        terms.add(term);
      }
    }

    return [
      ...terms,
    ];
  }

  private normalizeSearchText(
    value: string,
  ): string {
    return value
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        '',
      )
      .toLowerCase()
      .trim();
  }

  private toProductResult(
    product: {
      name: string;
      slug: string;
      sku: string;
      description: string;
      priceInCents: number;
      currency: string;

      category: {
        name: string;
        slug: string;
      };

      inventory: {
        quantity: number;
        reservedQuantity: number;
      } | null;

      images: {
        url: string;
        altText: string | null;
      }[];
    },
  ) {
    const availableQuantity =
      Math.max(
        0,
        (product.inventory
          ?.quantity ??
          0) -
          (product.inventory
            ?.reservedQuantity ??
            0),
      );

    return {
      name:
        product.name,
      slug:
        product.slug,
      sku:
        product.sku,
      description:
        product.description,

      price:
        this.formatMoney(
          product.priceInCents,
          product.currency,
        ),

      priceInCents:
        product.priceInCents,
      currency:
        product.currency,

      category:
        product.category.name,

      availableQuantity,
      inStock:
        availableQuantity >
        0,

      imageUrl:
        product.images[0]
          ?.url ??
        null,

      productUrl:
        `/products/${product.slug}`,
    };
  }

  private formatMoney(
    amountInCents: number,
    currency: string,
  ): string {
    return new Intl.NumberFormat(
      'en-US',
      {
        style:
          'currency',
        currency,
      },
    ).format(
      amountInCents /
        100,
    );
  }
}
