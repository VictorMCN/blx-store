import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  ProductQueryDto,
  type ProductSort,
} from './dto/product-query.dto.js';

const PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  description: true,
  priceInCents: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  images: {
    select: {
      id: true,
      url: true,
      altText: true,
      position: true,
    },
    orderBy: {
      position: 'asc',
    },
  },
  inventory: {
    select: {
      quantity: true,
      reservedQuantity: true,
    },
  },
} as const;

type CatalogProduct = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_SELECT;
}>;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories() {
    const categories =
      await this.prisma.category.findMany({
        where: {
          isActive: true,
          products: {
            some: {
              isActive: true,
            },
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          _count: {
            select: {
              products: {
                where: {
                  isActive: true,
                },
              },
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

    return {
      categories: categories.map(
        ({ _count, ...category }) => ({
          ...category,
          productCount: _count.products,
        }),
      ),
    };
  }

  async listProducts(query: ProductQueryDto) {
    if (
      query.minPriceInCents !== undefined &&
      query.maxPriceInCents !== undefined &&
      query.minPriceInCents >
        query.maxPriceInCents
    ) {
      throw new BadRequestException(
        'Minimum price cannot be greater than maximum price.',
      );
    }

    const where =
      this.buildProductWhere(query);

    const orderBy =
      this.buildProductOrderBy(query.sort);

    const skip =
      (query.page - 1) * query.limit;

    const [products, total] =
      await this.prisma.$transaction([
        this.prisma.product.findMany({
          where,
          select: PRODUCT_SELECT,
          orderBy,
          skip,
          take: query.limit,
        }),
        this.prisma.product.count({
          where,
        }),
      ]);

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(total / query.limit);

    return {
      products: products.map((product) =>
        this.toProductResponse(product),
      ),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNextPage:
          query.page < totalPages,
        hasPreviousPage:
          query.page > 1 && totalPages > 0,
      },
    };
  }

  async getProductBySlug(slug: string) {
    const normalizedSlug =
      slug.trim().toLowerCase();

    const product =
      await this.prisma.product.findFirst({
        where: {
          slug: normalizedSlug,
          isActive: true,
          category: {
            isActive: true,
          },
        },
        select: PRODUCT_SELECT,
      });

    if (!product) {
      throw new NotFoundException(
        'Product not found.',
      );
    }

    return {
      product:
        this.toProductResponse(product),
    };
  }

  private buildProductWhere(
    query: ProductQueryDto,
  ): Prisma.ProductWhereInput {
    const filters: Prisma.ProductWhereInput[] = [
      {
        isActive: true,
        category: {
          isActive: true,
        },
      },
    ];

    if (query.category) {
      filters.push({
        category: {
          isActive: true,
          slug: query.category.toLowerCase(),
        },
      });
    }

    if (query.search) {
      filters.push({
        OR: [
          {
            name: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
          {
            sku: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        ],
      });
    }

    if (
      query.minPriceInCents !== undefined ||
      query.maxPriceInCents !== undefined
    ) {
      filters.push({
        priceInCents: {
          ...(query.minPriceInCents !== undefined
            ? {
                gte: query.minPriceInCents,
              }
            : {}),
          ...(query.maxPriceInCents !== undefined
            ? {
                lte: query.maxPriceInCents,
              }
            : {}),
        },
      });
    }

    if (query.inStock === true) {
      filters.push({
        inventory: {
          is: {
            quantity: {
              gt: this.prisma.inventory.fields
                .reservedQuantity,
            },
          },
        },
      });
    }

    if (query.inStock === false) {
      filters.push({
        OR: [
          {
            inventory: {
              is: null,
            },
          },
          {
            inventory: {
              is: {
                quantity: {
                  lte: this.prisma.inventory.fields
                    .reservedQuantity,
                },
              },
            },
          },
        ],
      });
    }

    return {
      AND: filters,
    };
  }

  private buildProductOrderBy(
    sort: ProductSort,
  ): Prisma.ProductOrderByWithRelationInput {
    switch (sort) {
      case 'price_asc':
        return {
          priceInCents: 'asc',
        };

      case 'price_desc':
        return {
          priceInCents: 'desc',
        };

      case 'name_asc':
        return {
          name: 'asc',
        };

      case 'name_desc':
        return {
          name: 'desc',
        };

      case 'newest':
      default:
        return {
          createdAt: 'desc',
        };
    }
  }

  private toProductResponse(
    product: CatalogProduct,
  ) {
    const quantity =
      product.inventory?.quantity ?? 0;

    const reservedQuantity =
      product.inventory?.reservedQuantity ?? 0;

    const availableQuantity = Math.max(
      quantity - reservedQuantity,
      0,
    );

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      description: product.description,
      priceInCents: product.priceInCents,
      currency: product.currency,
      category: product.category,
      images: product.images,
      availability: {
        inStock: availableQuantity > 0,
      },
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
