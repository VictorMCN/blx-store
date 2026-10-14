-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM (
    'PENDING_PAYMENT',
    'PAID',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELED',
    'EXPIRED'
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "orderNumber" VARCHAR(30) NOT NULL,
    "userId" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "currency" VARCHAR(3) NOT NULL,

    "subtotalInCents" INTEGER NOT NULL,
    "shippingInCents" INTEGER NOT NULL DEFAULT 0,
    "totalInCents" INTEGER NOT NULL,

    "customerAccountType" "AccountType" NOT NULL,
    "customerName" VARCHAR(200) NOT NULL,
    "customerEmail" VARCHAR(255) NOT NULL,
    "customerTaxId" VARCHAR(20) NOT NULL,
    "customerPhone" VARCHAR(30),

    "shippingRecipientName" VARCHAR(150) NOT NULL,
    "shippingStreet" VARCHAR(200) NOT NULL,
    "shippingNumber" VARCHAR(30) NOT NULL,
    "shippingComplement" VARCHAR(120),
    "shippingNeighborhood" VARCHAR(120),
    "shippingCity" VARCHAR(120) NOT NULL,
    "shippingState" VARCHAR(120) NOT NULL,
    "shippingPostalCode" VARCHAR(20) NOT NULL,
    "shippingCountry" VARCHAR(2) NOT NULL,

    "reservationExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID,

    "productName" VARCHAR(180) NOT NULL,
    "productSlug" VARCHAR(200) NOT NULL,
    "productSku" VARCHAR(80) NOT NULL,

    "unitPriceInCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotalInCents" INTEGER NOT NULL,

    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key"
ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx"
ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_idx"
ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_reservationExpiresAt_idx"
ON "Order"("reservationExpiresAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx"
ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx"
ON "OrderItem"("productId");

-- AddForeignKey
ALTER TABLE "Order"
ADD CONSTRAINT "Order_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_orderId_fkey"
FOREIGN KEY ("orderId")
REFERENCES "Order"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_productId_fkey"
FOREIGN KEY ("productId")
REFERENCES "Product"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Order financial integrity
ALTER TABLE "Order"
ADD CONSTRAINT "Order_subtotal_positive_check"
CHECK ("subtotalInCents" > 0);

ALTER TABLE "Order"
ADD CONSTRAINT "Order_shipping_nonnegative_check"
CHECK ("shippingInCents" >= 0);

ALTER TABLE "Order"
ADD CONSTRAINT "Order_total_consistency_check"
CHECK (
    "totalInCents" =
    "subtotalInCents" + "shippingInCents"
);

-- Order snapshot integrity
ALTER TABLE "Order"
ADD CONSTRAINT "Order_currency_check"
CHECK (
    char_length("currency") = 3
    AND "currency" = upper("currency")
);

ALTER TABLE "Order"
ADD CONSTRAINT "Order_shipping_country_check"
CHECK (
    char_length("shippingCountry") = 2
    AND "shippingCountry" = upper("shippingCountry")
);

ALTER TABLE "Order"
ADD CONSTRAINT "Order_customer_tax_id_check"
CHECK (
    (
        "customerAccountType" = 'INDIVIDUAL'
        AND "customerTaxId" ~ '^[0-9]{11}$'
    )
    OR
    (
        "customerAccountType" = 'BUSINESS'
        AND "customerTaxId" ~ '^[0-9]{14}$'
    )
);

ALTER TABLE "Order"
ADD CONSTRAINT "Order_reservation_expiry_check"
CHECK ("reservationExpiresAt" > "createdAt");

-- Order item financial integrity
ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_unit_price_positive_check"
CHECK ("unitPriceInCents" > 0);

ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_quantity_check"
CHECK ("quantity" >= 1 AND "quantity" <= 99);

ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_line_total_positive_check"
CHECK ("lineTotalInCents" > 0);

ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_line_total_consistency_check"
CHECK (
    "lineTotalInCents" =
    "unitPriceInCents" * "quantity"
);
