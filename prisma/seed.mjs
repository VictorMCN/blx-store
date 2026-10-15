import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL;

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
    description: `14-inch 1920×1200 IPS • BLX N7-680 8-core processor • 16 GB LPDDR5X • 512 GB NVMe SSD

The BLX NovaBook 14 is a lightweight productivity laptop designed for university work, software development, office applications and hybrid work. Its compact aluminum-style chassis combines portability with enough performance for demanding everyday multitasking.

Key specifications:
• Processor: BLX N7-680, 8 cores / 16 threads, up to 4.6 GHz
• Graphics: integrated BLX Iris G7 graphics
• Memory: 16 GB LPDDR5X
• Storage: 512 GB PCIe 4.0 NVMe SSD
• Display: 14-inch IPS, 1920 × 1200, 16:10
• Brightness: 400 nits
• Battery: 63 Wh, up to 11 hours typical use
• Wireless: Wi-Fi 6E and Bluetooth 5.3
• Ports: 2 × USB-C, 2 × USB-A, HDMI and 3.5 mm audio
• Webcam: Full HD with privacy shutter
• Keyboard: backlit
• Weight: approximately 1.35 kg

What's included:
• BLX NovaBook 14
• 65 W USB-C power adapter
• USB-C charging cable
• Quick start guide`,
    priceInCents: 599900,
    currency: 'BRL',
    quantity: 18,
    reservedQuantity: 2,
    reorderPoint: 5,
    images: [
      {
        url: '/products/blx-novabook-14-01.png',
        altText:
          'BLX NovaBook 14 front view',
        position: 0,
      },
      {
        url: '/products/blx-novabook-14-02.png',
        altText:
          'BLX NovaBook 14 detail view',
        position: 1,
      },
    ],
  },
  {
    categorySlug: 'laptops',
    name: 'BLX ForgeBook 16',
    slug: 'blx-forgebook-16',
    sku: 'BLX-FB16-001',
    description: `16-inch 2560×1600 165 Hz • BLX X9-890H • 32 GB DDR5 • 1 TB NVMe SSD • BLX Forge G8 8 GB

The BLX ForgeBook 16 is a high-performance laptop engineered for software development, virtual machines, 3D workloads, video editing and demanding creative applications. Its larger high-refresh display and dedicated graphics provide workstation-class capability in a portable format.

Key specifications:
• Processor: BLX X9-890H, 12 cores / 20 threads, up to 5.2 GHz
• Graphics: BLX Forge G8 dedicated GPU with 8 GB GDDR6
• Memory: 32 GB DDR5 5600 MHz
• Storage: 1 TB PCIe 4.0 NVMe SSD
• Display: 16-inch IPS, 2560 × 1600, 165 Hz, 16:10
• Color coverage: 100% sRGB
• Battery: 80 Wh
• Cooling: dual-fan high-performance thermal system
• Wireless: Wi-Fi 6E and Bluetooth 5.3
• Ports: USB-C, USB4, USB-A, HDMI, Ethernet and audio
• Keyboard: full-size backlit keyboard
• Weight: approximately 2.15 kg

What's included:
• BLX ForgeBook 16
• 180 W power adapter
• Power cable
• Quick start guide`,
    priceInCents: 849900,
    currency: 'BRL',
    quantity: 9,
    reservedQuantity: 1,
    reorderPoint: 3,
    images: [
      {
        url: '/products/blx-forgebook-16-01.png',
        altText:
          'BLX ForgeBook 16 front view',
        position: 0,
      },
      {
        url: '/products/blx-forgebook-16-02.png',
        altText:
          'BLX ForgeBook 16 detail view',
        position: 1,
      },
    ],
  },
  {
    categorySlug: 'smartphones',
    name: 'BLX Vector X',
    slug: 'blx-vector-x',
    sku: 'BLX-VX-001',
    description: `6.7-inch OLED 144 Hz • BLX V9 Pro • 12 GB RAM • 512 GB storage • 5,200 mAh battery • 5G

The BLX Vector X is the flagship smartphone of the BLX lineup, combining a high-refresh OLED display, advanced cameras, premium connectivity and performance designed for demanding mobile workloads.

Key specifications:
• Processor: BLX V9 Pro octa-core platform
• Memory: 12 GB LPDDR5X
• Storage: 512 GB
• Display: 6.7-inch OLED, 144 Hz, HDR
• Main camera: 50 MP optical-stabilized sensor
• Ultra-wide camera: 12 MP
• Telephoto camera: 10 MP, 3× optical zoom
• Front camera: 32 MP
• Battery: 5,200 mAh
• Wired charging: up to 80 W
• Wireless charging: up to 30 W
• Connectivity: 5G, Wi-Fi 7, Bluetooth 5.4 and NFC
• Security: under-display fingerprint reader
• Protection: IP68

What's included:
• BLX Vector X
• USB-C cable
• Protective case
• SIM tool
• Quick start guide`,
    priceInCents: 429900,
    currency: 'BRL',
    quantity: 24,
    reservedQuantity: 4,
    reorderPoint: 6,
    images: [
      {
        url: '/products/blx-vector-x-01.png',
        altText:
          'BLX Vector X front view',
        position: 0,
      },
      {
        url: '/products/blx-vector-x-02.png',
        altText:
          'BLX Vector X detail view',
        position: 1,
      },
    ],
  },
  {
    categorySlug: 'smartphones',
    name: 'BLX Vector Lite',
    slug: 'blx-vector-lite',
    sku: 'BLX-VL-001',
    description: `6.5-inch FHD+ 120 Hz • BLX V6 processor • 8 GB RAM • 256 GB storage • 5,000 mAh battery • 5G

The BLX Vector Lite delivers the essential smartphone experience with a smooth high-refresh display, reliable everyday performance and long battery life at a more accessible price point.

Key specifications:
• Processor: BLX V6 octa-core platform
• Memory: 8 GB RAM
• Storage: 256 GB
• Display: 6.5-inch FHD+ LCD, 120 Hz
• Main camera: 50 MP
• Secondary camera: 8 MP ultra-wide
• Front camera: 16 MP
• Battery: 5,000 mAh
• Charging: up to 33 W USB-C
• Connectivity: 5G, Wi-Fi 6, Bluetooth 5.3 and NFC
• Security: side-mounted fingerprint reader
• Audio: stereo speakers

What's included:
• BLX Vector Lite
• USB-C cable
• Protective case
• SIM tool
• Quick start guide`,
    priceInCents: 249900,
    currency: 'BRL',
    quantity: 8,
    reservedQuantity: 8,
    reorderPoint: 4,
    images: [
      {
        url: '/products/blx-vector-lite-01.png',
        altText:
          'BLX Vector Lite front view',
        position: 0,
      },
      {
        url: '/products/blx-vector-lite-02.png',
        altText:
          'BLX Vector Lite detail view',
        position: 1,
      },
    ],
  },
  {
    categorySlug: 'audio',
    name: 'BLX Pulse ANC',
    slug: 'blx-pulse-anc',
    sku: 'BLX-PA-001',
    description: `40 mm drivers • Hybrid active noise cancellation • Bluetooth 5.3 • Up to 45 hours battery • USB-C

The BLX Pulse ANC is an over-ear wireless headset designed for focused work, travel and long listening sessions. Hybrid active noise cancellation reduces constant background noise while soft memory-foam cushions provide a comfortable seal.

Key specifications:
• Drivers: 40 mm dynamic drivers
• Noise cancellation: hybrid ANC
• Transparency mode: supported
• Connectivity: Bluetooth 5.3
• Multipoint connection: up to 2 devices
• Battery life: up to 45 hours without ANC
• Battery life with ANC: up to 32 hours
• Charging: USB-C
• Wired audio: 3.5 mm input
• Microphones: integrated beamforming microphones for calls
• Ear cushions: memory foam with soft synthetic leather

What's included:
• BLX Pulse ANC headphones
• Protective carrying case
• USB-C charging cable
• 3.5 mm audio cable
• Quick start guide`,
    priceInCents: 89900,
    currency: 'BRL',
    quantity: 35,
    reservedQuantity: 5,
    reorderPoint: 8,
    images: [
      {
        url: '/products/blx-pulse-anc-01.png',
        altText:
          'BLX Pulse ANC front view',
        position: 0,
      },
      {
        url: '/products/blx-pulse-anc-02.png',
        altText:
          'BLX Pulse ANC detail view',
        position: 1,
      },
    ],
  },
  {
    categorySlug: 'audio',
    name: 'BLX Echo Mini',
    slug: 'blx-echo-mini',
    sku: 'BLX-EM-001',
    description: `20 W wireless speaker • Bluetooth 5.3 • IP67 protection • Up to 12 hours battery • USB-C

The BLX Echo Mini delivers portable stereo sound in a compact body built for desks, bedrooms, trips and outdoor use. Its balanced acoustic profile emphasizes clear vocals while retaining enough low-frequency response for music and entertainment.

Key specifications:
• Output power: 20 W
• Connectivity: Bluetooth 5.3
• Wireless range: up to 10 m in open environments
• Battery life: up to 12 hours
• Charging: USB-C
• Protection rating: IP67 dust and water resistance
• Audio: dual-driver design with passive bass radiator
• Controls: playback, volume and Bluetooth controls
• Built-in microphone: hands-free calling support
• Weight: approximately 520 g

What's included:
• BLX Echo Mini
• USB-C charging cable
• Quick start guide`,
    priceInCents: 39900,
    currency: 'BRL',
    quantity: 42,
    reservedQuantity: 3,
    reorderPoint: 10,
    images: [
      {
        url: '/products/blx-echo-mini-01.png',
        altText:
          'BLX Echo Mini front view',
        position: 0,
      },
      {
        url: '/products/blx-echo-mini-02.png',
        altText:
          'BLX Echo Mini detail view',
        position: 1,
      },
    ],
  },
  {
    categorySlug: 'monitors',
    name: 'BLX Horizon 27 QHD',
    slug: 'blx-horizon-27-qhd',
    sku: 'BLX-H27-001',
    description: `27-inch QHD IPS • 2560×1440 • 165 Hz • 1 ms response • HDR • USB-C connectivity

The BLX Horizon 27 QHD combines a sharp 27-inch panel with high-refresh performance for productivity, development, content creation and gaming. Its adjustable stand and broad connectivity make it suitable for modern desktop setups.

Key specifications:
• Panel: 27-inch IPS
• Resolution: 2560 × 1440 QHD
• Refresh rate: up to 165 Hz
• Response time: 1 ms MPRT
• Color coverage: 99% sRGB
• HDR: supported
• Adaptive refresh: supported
• Brightness: 350 nits
• Connections: DisplayPort, HDMI, USB-C and USB hub
• USB-C Power Delivery: up to 65 W
• Stand: height, tilt and swivel adjustment
• VESA mounting: 100 × 100 mm

What's included:
• BLX Horizon 27 QHD
• DisplayPort cable
• USB-C cable
• Power adapter
• Quick start guide`,
    priceInCents: 179900,
    currency: 'BRL',
    quantity: 16,
    reservedQuantity: 2,
    reorderPoint: 4,
    images: [
      {
        url: '/products/blx-horizon-27-qhd-01.png',
        altText:
          'BLX Horizon 27 QHD front view',
        position: 0,
      },
      {
        url: '/products/blx-horizon-27-qhd-02.png',
        altText:
          'BLX Horizon 27 QHD detail view',
        position: 1,
      },
    ],
  },
  {
    categorySlug: 'monitors',
    name: 'BLX Horizon 32 UltraWide',
    slug: 'blx-horizon-32-ultrawide',
    sku: 'BLX-H32-001',
    description: `32-inch UltraWide • 3440×1440 • 144 Hz • USB-C 90 W • Built-in KVM • HDR

The BLX Horizon 32 UltraWide is designed for multitasking, development, editing and immersive entertainment. Its expansive curved workspace allows multiple applications to remain visible without requiring a dual-monitor setup.

Key specifications:
• Panel: 32-inch curved UltraWide
• Resolution: 3440 × 1440
• Aspect ratio: 21:9
• Refresh rate: up to 144 Hz
• Response time: 1 ms MPRT
• Color coverage: 98% DCI-P3
• HDR: supported
• USB-C Power Delivery: up to 90 W
• KVM switch: integrated
• Connections: DisplayPort, 2 × HDMI, USB-C and USB hub
• Stand: height and tilt adjustment
• VESA mounting: 100 × 100 mm

What's included:
• BLX Horizon 32 UltraWide
• DisplayPort cable
• HDMI cable
• USB-C cable
• Power cable
• Quick start guide`,
    priceInCents: 289900,
    currency: 'BRL',
    quantity: 7,
    reservedQuantity: 1,
    reorderPoint: 3,
    images: [
      {
        url: '/products/blx-horizon-32-ultrawide-01.png',
        altText:
          'BLX Horizon 32 UltraWide front view',
        position: 0,
      },
      {
        url: '/products/blx-horizon-32-ultrawide-02.png',
        altText:
          'BLX Horizon 32 UltraWide detail view',
        position: 1,
      },
    ],
  },
  {
    categorySlug: 'accessories',
    name: 'BLX Core Mouse',
    slug: 'blx-core-mouse',
    sku: 'BLX-CM-001',
    description: `4,000 DPI optical sensor • Bluetooth 5.2 + 2.4 GHz • 6 buttons • USB-C rechargeable

The BLX Core Mouse is a versatile wireless mouse designed for productivity, study and everyday use. Its ergonomic right-handed shape combines precise tracking with quiet controls and flexible wireless connectivity.

Key specifications:
• Sensor: adjustable optical sensor, 800 / 1,600 / 2,400 / 4,000 DPI
• Connectivity: Bluetooth 5.2 and 2.4 GHz wireless
• Buttons: 6 controls
• Battery: rechargeable 650 mAh battery
• Charging: USB-C
• Polling rate: up to 1,000 Hz in 2.4 GHz mode
• Compatibility: Windows, macOS and Linux
• Finish: matte graphite with textured side grip
• Weight: approximately 92 g

What's included:
• BLX Core Mouse
• 2.4 GHz USB receiver
• USB-C charging cable
• Quick start guide`,
    priceInCents: 24900,
    currency: 'BRL',
    quantity: 60,
    reservedQuantity: 6,
    reorderPoint: 15,
    images: [
      {
        url: '/products/blx-core-mouse-01.png',
        altText:
          'BLX Core Mouse front view',
        position: 0,
      },
      {
        url: '/products/blx-core-mouse-02.png',
        altText:
          'BLX Core Mouse detail view',
        position: 1,
      },
    ],
  },
  {
    categorySlug: 'accessories',
    name: 'BLX Arc Mechanical Keyboard',
    slug: 'blx-arc-mechanical-keyboard',
    sku: 'BLX-AMK-001',
    description: `75% mechanical layout • Hot-swappable tactile switches • Bluetooth + 2.4 GHz + USB-C • 4,000 mAh battery

The BLX Arc Mechanical Keyboard combines a compact 75% layout with mechanical tactile feedback and flexible wired or wireless operation. It is designed for programming, writing, productivity and gaming without occupying unnecessary desk space.

Key specifications:
• Layout: compact 75%
• Switches: BLX tactile mechanical switches
• Switch sockets: hot-swappable
• Connectivity: Bluetooth 5.2, 2.4 GHz wireless and USB-C wired
• Battery: 4,000 mAh rechargeable battery
• Backlighting: adjustable blue LED illumination
• Keycaps: durable double-shot style keycaps
• Frame: aluminum-style top plate
• Anti-ghosting: full-key rollover in wired mode
• Compatibility: Windows, macOS and Linux

What's included:
• BLX Arc Mechanical Keyboard
• USB-C cable
• 2.4 GHz USB receiver
• Keycap and switch puller
• Quick start guide`,
    priceInCents: 49900,
    currency: 'BRL',
    quantity: 28,
    reservedQuantity: 4,
    reorderPoint: 7,
    images: [
      {
        url: '/products/blx-arc-mechanical-keyboard-01.png',
        altText:
          'BLX Arc Mechanical Keyboard front view',
        position: 0,
      },
      {
        url: '/products/blx-arc-mechanical-keyboard-02.png',
        altText:
          'BLX Arc Mechanical Keyboard detail view',
        position: 1,
      },
    ],
  },
  {
    categorySlug: 'accessories',
    name: 'BLX Flux USB-C Hub',
    slug: 'blx-flux-usb-c-hub',
    sku: 'BLX-FH-001',
    description: `7-in-1 USB-C hub • HDMI 4K 60 Hz • 100 W Power Delivery • Gigabit Ethernet • SD and microSD

The BLX Flux USB-C Hub expands a single USB-C port into a complete workstation connection point for laptops, tablets and compatible smartphones. Its aluminum enclosure is designed for desks, travel and hybrid work.

Key specifications:
• Host connection: USB-C
• HDMI: up to 4K at 60 Hz
• USB-A: 2 × USB 3.2 Gen 1 ports
• USB-C Power Delivery: up to 100 W pass-through
• Networking: Gigabit Ethernet
• Card reader: SD and microSD
• Data transfer: up to 5 Gbps on supported USB ports
• Chassis: compact aluminum construction
• Compatibility: USB-C devices supporting DisplayPort Alt Mode where required

What's included:
• BLX Flux USB-C Hub
• Integrated USB-C host cable
• Quick start guide`,
    priceInCents: 34900,
    currency: 'BRL',
    quantity: 32,
    reservedQuantity: 2,
    reorderPoint: 8,
    images: [
      {
        url: '/products/blx-flux-usb-c-hub-01.png',
        altText:
          'BLX Flux USB-C Hub front view',
        position: 0,
      },
      {
        url: '/products/blx-flux-usb-c-hub-02.png',
        altText:
          'BLX Flux USB-C Hub detail view',
        position: 1,
      },
    ],
  },
];

async function upsertCategory(
  client,
  category,
) {
  const result =
    await client.query(
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
  const result =
    await client.query(
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

  for (const image of product.images) {
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
  const client =
    await pool.connect();

  try {
    await client.query('BEGIN');

    const categoryIds =
      new Map();

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
          `Category not found for product ${product.name}.`,
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
