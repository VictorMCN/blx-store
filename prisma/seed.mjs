import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is required to seed the database.',
  );
}

const pool = new Pool({
  connectionString,
});

const categories = [
  {
    name: 'Laptops',
    slug: 'laptops',
    description:
      'Portable computers designed for productivity, study, and professional workloads.',
  },
  {
    name: 'Smartphones',
    slug: 'smartphones',
    description:
      'Modern smartphones focused on performance, connectivity, and everyday use.',
  },
  {
    name: 'Audio',
    slug: 'audio',
    description:
      'Headphones and speakers for entertainment, work, and communication.',
  },
  {
    name: 'Monitors',
    slug: 'monitors',
    description:
      'Displays designed for productivity, gaming, and professional workspaces.',
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    description:
      'Peripherals and accessories for computers, mobile devices, and workspaces.',
  },
];

const products = [
  {
    categorySlug: 'laptops',
    name: 'BLX NovaBook 14',
    slug: 'blx-novabook-14',
    sku: 'BLX-NB14-001',
    description:
      'A lightweight 14-inch laptop built for everyday productivity, study, and hybrid work.',
    priceInCents: 599900,
    currency: 'BRL',
    quantity: 18,
    reservedQuantity: 2,
    reorderPoint: 5,
  },
  {
    categorySlug: 'laptops',
    name: 'BLX ForgeBook 16',
    slug: 'blx-forgebook-16',
    sku: 'BLX-FB16-001',
    description:
      'A high-performance 16-inch laptop designed for demanding development and creative workloads.',
    priceInCents: 849900,
    currency: 'BRL',
    quantity: 9,
    reservedQuantity: 1,
    reorderPoint: 3,
  },
  {
    categorySlug: 'smartphones',
    name: 'BLX Vector X',
    slug: 'blx-vector-x',
    sku: 'BLX-VX-001',
    description:
      'A premium smartphone with a high-refresh display, advanced cameras, and all-day battery life.',
    priceInCents: 429900,
    currency: 'BRL',
    quantity: 24,
    reservedQuantity: 4,
    reorderPoint: 6,
  },
  {
    categorySlug: 'smartphones',
    name: 'BLX Vector Lite',
    slug: 'blx-vector-lite',
    sku: 'BLX-VL-001',
    description:
      'An accessible smartphone focused on reliable performance, battery life, and essential features.',
    priceInCents: 249900,
    currency: 'BRL',
    quantity: 8,
    reservedQuantity: 8,
    reorderPoint: 4,
  },
  {
    categorySlug: 'audio',
    name: 'BLX Pulse ANC',
    slug: 'blx-pulse-anc',
    sku: 'BLX-PA-001',
    description:
      'Wireless over-ear headphones with active noise cancellation and a comfortable long-session fit.',
    priceInCents: 89900,
    currency: 'BRL',
    quantity: 35,
    reservedQuantity: 5,
    reorderPoint: 8,
  },
  {
    categorySlug: 'audio',
    name: 'BLX Echo Mini',
    slug: 'blx-echo-mini',
    sku: 'BLX-EM-001',
    description:
      'A compact wireless speaker designed for portable listening with clear and balanced sound.',
    priceInCents: 39900,
    currency: 'BRL',
    quantity: 42,
    reservedQuantity: 3,
    reorderPoint: 10,
  },
  {
    categorySlug: 'monitors',
    name: 'BLX Horizon 27 QHD',
    slug: 'blx-horizon-27-qhd',
    sku: 'BLX-H27-001',
    description:
      'A 27-inch QHD monitor with a sharp display and versatile connectivity for modern workspaces.',
    priceInCents: 179900,
    currency: 'BRL',
    quantity: 16,
    reservedQuantity: 2,
    reorderPoint: 4,
  },
  {
    categorySlug: 'monitors',
    name: 'BLX Horizon 32 UltraWide',
    slug: 'blx-horizon-32-ultrawide',
    sku: 'BLX-H32-001',
    description:
      'An immersive ultrawide monitor designed for multitasking, development, and creative workflows.',
    priceInCents: 289900,
    currency: 'BRL',
    quantity: 7,
    reservedQuantity: 1,
    reorderPoint: 3,
  },
  {
    categorySlug: 'accessories',
    name: 'BLX Core Mouse',
    slug: 'blx-core-mouse',
    sku: 'BLX-CM-001',
    description:
      'An ergonomic wireless mouse with precise tracking and a clean minimalist design.',
    priceInCents: 24900,
    currency: 'BRL',
    quantity: 60,
    reservedQuantity: 6,
    reorderPoint: 15,
  },
  {
    categorySlug: 'accessories',
    name: 'BLX Arc Mechanical Keyboard',
    slug: 'blx-arc-mechanical-keyboard',
    sku: 'BLX-AMK-001',
    description:
      'A compact mechanical keyboard with tactile switches and a durable aluminum-style frame.',
    priceInCents: 49900,
    currency: 'BRL',
    quantity: 28,
    reservedQuantity: 4,
    reorderPoint: 7,
  },
  {
    categorySlug: 'accessories',
    name: 'BLX Flux USB-C Hub',
    slug: 'blx-flux-usb-c-hub',
    sku: 'BLX-FH-001',
    description:
      'A versatile USB-C hub with additional connectivity for laptops, tablets, and modern workstations.',
    priceInCents: 34900,
    currency: 'BRL',
    quantity: 32,
    reservedQuantity: 2,
    reorderPoint: 8,
  },
];

function imageUrl(product, view) {
  const text = encodeURIComponent(
    `${product.name} ${view}`,
  );

  return `https://placehold.co/1200x1200/png?text=${text}`;
}

async function upsertCategory(client, category) {
  const result = await client.query(
    `
      INSERT INTO "Category" (
        "id",
        "name",
        "slug",
        "description",
        "isActive",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        TRUE,
        NOW(),
        NOW()
      )
      ON CONFLICT ("slug")
      DO UPDATE SET
        "name" = EXCLUDED."name",
        "description" = EXCLUDED."description",
        "isActive" = TRUE,
        "updatedAt" = NOW()
      RETURNING "id";
    `,
    [
      randomUUID(),
      category.name,
      category.slug,
      category.description,
    ],
  );

  return result.rows[0].id;
}

async function upsertProduct(
  client,
  product,
  categoryId,
) {
  const result = await client.query(
    `
      INSERT INTO "Product" (
        "id",
        "categoryId",
        "name",
        "slug",
        "sku",
        "description",
        "priceInCents",
        "currency",
        "isActive",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        TRUE,
        NOW(),
        NOW()
      )
      ON CONFLICT ("slug")
      DO UPDATE SET
        "categoryId" = EXCLUDED."categoryId",
        "name" = EXCLUDED."name",
        "sku" = EXCLUDED."sku",
        "description" = EXCLUDED."description",
        "priceInCents" = EXCLUDED."priceInCents",
        "currency" = EXCLUDED."currency",
        "isActive" = TRUE,
        "updatedAt" = NOW()
      RETURNING "id";
    `,
    [
      randomUUID(),
      categoryId,
      product.name,
      product.slug,
      product.sku,
      product.description,
      product.priceInCents,
      product.currency,
    ],
  );

  return result.rows[0].id;
}

async function replaceProductImages(
  client,
  product,
  productId,
) {
  await client.query(
    `
      DELETE FROM "ProductImage"
      WHERE "productId" = $1;
    `,
    [productId],
  );

  const images = [
    {
      url: imageUrl(product, 'Front'),
      altText: `${product.name} front view`,
      position: 0,
    },
    {
      url: imageUrl(product, 'Detail'),
      altText: `${product.name} detail view`,
      position: 1,
    },
  ];

  for (const image of images) {
    await client.query(
      `
        INSERT INTO "ProductImage" (
          "id",
          "productId",
          "url",
          "altText",
          "position",
          "createdAt"
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          NOW()
        );
      `,
      [
        randomUUID(),
        productId,
        image.url,
        image.altText,
        image.position,
      ],
    );
  }
}

async function upsertInventory(
  client,
  product,
  productId,
) {
  await client.query(
    `
      INSERT INTO "Inventory" (
        "id",
        "productId",
        "quantity",
        "reservedQuantity",
        "reorderPoint",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        NOW(),
        NOW()
      )
      ON CONFLICT ("productId")
      DO UPDATE SET
        "quantity" = EXCLUDED."quantity",
        "reservedQuantity" = EXCLUDED."reservedQuantity",
        "reorderPoint" = EXCLUDED."reorderPoint",
        "updatedAt" = NOW();
    `,
    [
      randomUUID(),
      productId,
      product.quantity,
      product.reservedQuantity,
      product.reorderPoint,
    ],
  );
}

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const categoryIds = new Map();

    for (const category of categories) {
      const categoryId =
        await upsertCategory(
          client,
          category,
        );

      categoryIds.set(
        category.slug,
        categoryId,
      );
    }

    for (const product of products) {
      const categoryId =
        categoryIds.get(
          product.categorySlug,
        );

      if (!categoryId) {
        throw new Error(
          `Category "${product.categorySlug}" was not seeded.`,
        );
      }

      const productId =
        await upsertProduct(
          client,
          product,
          categoryId,
        );

      await replaceProductImages(
        client,
        product,
        productId,
      );

      await upsertInventory(
        client,
        product,
        productId,
      );
    }

    await client.query('COMMIT');

    console.log(
      `Seed completed: ${categories.length} categories and ${products.length} products.`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

try {
  await seed();
} finally {
  await pool.end();
}
