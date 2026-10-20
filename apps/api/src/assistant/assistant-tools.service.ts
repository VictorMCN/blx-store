import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
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

type SearchConcept = {
  label: string;
  categorySlug: string;
  aliases: readonly string[];
  productTerms?: readonly string[];
};

const SEARCH_CONCEPTS: readonly SearchConcept[] = [
  {
    label: 'laptops',
    categorySlug: 'laptops',
    aliases: [
      'laptop',
      'laptops',
      'notebook',
      'notebooks',
      'computador portatil',
      'computadores portateis',
    ],
  },
  {
    label: 'smartphones',
    categorySlug: 'smartphones',
    aliases: [
      'celular',
      'celulares',
      'smartphone',
      'smartphones',
      'telefone',
      'telefones',
      'phone',
      'phones',
      'mobile phone',
      'mobile phones',
      'movil',
      'moviles',
    ],
  },
  {
    label: 'headphones',
    categorySlug: 'audio',
    aliases: [
      'fone',
      'fones',
      'fone de ouvido',
      'fones de ouvido',
      'headphone',
      'headphones',
      'headset',
      'headsets',
      'earphone',
      'earphones',
      'earbud',
      'earbuds',
      'auricular',
      'auriculares',
    ],
    productTerms: [
      'headphone',
      'headset',
      'earphone',
      'earbud',
    ],
  },
  {
    label: 'speakers',
    categorySlug: 'audio',
    aliases: [
      'caixa de som',
      'caixas de som',
      'alto falante',
      'alto falantes',
      'speaker',
      'speakers',
      'parlante',
      'parlantes',
    ],
    productTerms: [
      'speaker',
      'soundbar',
      'alto-falante',
    ],
  },
  {
    label: 'monitors',
    categorySlug: 'monitors',
    aliases: [
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
  },
  {
    label: 'keyboards',
    categorySlug: 'accessories',
    aliases: [
      'teclado',
      'teclados',
      'keyboard',
      'keyboards',
    ],
    productTerms: [
      'keyboard',
      'teclado',
    ],
  },
  {
    label: 'mice',
    categorySlug: 'accessories',
    aliases: [
      'mouse',
      'mouses',
      'mice',
      'raton',
      'ratones',
    ],
    productTerms: ['mouse'],
  },
  {
    label: 'hubs',
    categorySlug: 'accessories',
    aliases: [
      'hub',
      'hubs',
      'adaptador',
      'adaptadores',
      'adapter',
      'adapters',
      'dock',
      'docking station',
    ],
    productTerms: [
      'hub',
      'adapter',
      'dock',
    ],
  },
];

@Injectable()
export class AssistantToolsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async searchProducts(query: string, maxResults: number) {
    const text = query.trim();
    const limit = Math.min(Math.max(maxResults, 1), 5);

    if (!text) {
      return {
        query: text,
        interpretedSearchTerms: [],
        count: 0,
        products: [],
      };
    }

    const concepts = this.matchConcepts(text);

    const filters = concepts.length
      ? concepts.map((concept) => this.conceptFilter(concept))
      : this.textFilters(text);

    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        category: { isActive: true },
        OR: filters,
      },
      select: PRODUCT_SELECT,
      orderBy: { name: 'asc' },
      take: limit,
    });

    return {
      query: text,
      interpretedSearchTerms: concepts.length
        ? concepts.map((concept) => concept.label)
        : [text],
      count: products.length,
      products: products.map((product) =>
        this.toProductResult(product),
      ),
    };
  }

  async getProductDetails(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        slug: slug.trim().toLowerCase(),
        isActive: true,
      },
      select: PRODUCT_SELECT,
    });

    if (!product) {
      return {
        found: false,
        message: 'Product not found.',
      };
    }

    return {
      found: true,
      product: this.toProductResult(product),
    };
  }

  async compareProducts(slugs: string[]) {
    const normalizedSlugs = [
      ...new Set(
        slugs
          .map((slug) => slug.trim().toLowerCase())
          .filter(Boolean),
      ),
    ].slice(0, 4);

    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        slug: { in: normalizedSlugs },
      },
      select: PRODUCT_SELECT,
    });

    const bySlug = new Map(
      products.map((product) => [
        product.slug,
        product,
      ]),
    );

    return {
      requested: normalizedSlugs,
      products: normalizedSlugs
        .map((slug) => bySlug.get(slug))
        .filter(
          (product): product is NonNullable<typeof product> =>
            product !== undefined,
        )
        .map((product) => this.toProductResult(product)),
      missing: normalizedSlugs.filter(
        (slug) => !bySlug.has(slug),
      ),
    };
  }

  async getMyOrders(userId: string, limit: number) {
    const safeLimit = Math.min(Math.max(limit, 1), 5);

    const orders = await this.prisma.order.findMany({
      where: { userId },
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
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });

    return {
      count: orders.length,
      orders: orders.map((order) => ({
        orderNumber: order.orderNumber,
        status: order.status,
        total: this.formatMoney(
          order.totalInCents,
          order.currency,
        ),
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: order.items,
      })),
    };
  }

  async getMyOrderStatus(
    userId: string,
    orderNumber: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        userId,
        orderNumber: orderNumber.trim().toUpperCase(),
      },
      select: {
        orderNumber: true,
        status: true,
        currency: true,
        subtotalInCents: true,
        shippingInCents: true,
        totalInCents: true,
        reservationExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            productName: true,
            quantity: true,
            unitPriceInCents: true,
            lineTotalInCents: true,
          },
          orderBy: { createdAt: 'asc' },
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
        orderNumber: order.orderNumber,
        status: order.status,
        subtotal: this.formatMoney(
          order.subtotalInCents,
          order.currency,
        ),
        shipping: this.formatMoney(
          order.shippingInCents,
          order.currency,
        ),
        total: this.formatMoney(
          order.totalInCents,
          order.currency,
        ),
        reservationExpiresAt: order.reservationExpiresAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: order.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: this.formatMoney(
            item.unitPriceInCents,
            order.currency,
          ),
          lineTotal: this.formatMoney(
            item.lineTotalInCents,
            order.currency,
          ),
        })),
      },
    };
  }

  private matchConcepts(query: string): SearchConcept[] {
    const normalized = ` ${this.normalizeSearchText(query)} `;

    return SEARCH_CONCEPTS.filter((concept) =>
      concept.aliases.some((alias) =>
        normalized.includes(
          ` ${this.normalizeSearchText(alias)} `,
        ),
      ),
    );
  }

  private conceptFilter(
    concept: SearchConcept,
  ): Prisma.ProductWhereInput {
    const category: Prisma.ProductWhereInput = {
      category: { slug: concept.categorySlug },
    };

    if (!concept.productTerms?.length) {
      return category;
    }

    return {
      AND: [
        category,
        {
          OR: this.productTextFilters(
            concept.productTerms,
          ),
        },
      ],
    };
  }

  private textFilters(
    query: string,
  ): Prisma.ProductWhereInput[] {
    return [
      ...this.productTextFilters([query]),
      {
        category: {
          name: {
            contains: query,
            mode: 'insensitive',
          },
        },
      },
      {
        category: {
          description: {
            contains: query,
            mode: 'insensitive',
          },
        },
      },
    ];
  }

  private productTextFilters(
    terms: readonly string[],
  ): Prisma.ProductWhereInput[] {
    return terms.flatMap((term) => [
      {
        name: {
          contains: term,
          mode: 'insensitive',
        },
      },
      {
        description: {
          contains: term,
          mode: 'insensitive',
        },
      },
      {
        sku: {
          contains: term,
          mode: 'insensitive',
        },
      },
    ]);
  }

  private normalizeSearchText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private toProductResult(product: {
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
  }) {
    const availableQuantity = Math.max(
      0,
      (product.inventory?.quantity ?? 0) -
        (product.inventory?.reservedQuantity ?? 0),
    );

    return {
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      description: product.description,
      price: this.formatMoney(
        product.priceInCents,
        product.currency,
      ),
      priceInCents: product.priceInCents,
      currency: product.currency,
      category: product.category.name,
      availableQuantity,
      inStock: availableQuantity > 0,
      imageUrl: product.images[0]?.url ?? null,
      productUrl: `/products/${product.slug}`,
    };
  }

  private formatMoney(
    amountInCents: number,
    currency: string,
  ): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amountInCents / 100);
  }
}
