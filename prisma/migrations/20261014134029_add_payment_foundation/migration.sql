-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM (
    'STRIPE'
);

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'SUCCEEDED',
    'FAILED',
    'CANCELED'
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',

    "amountInCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,

    "providerPaymentIntentId" VARCHAR(255),

    "failureCode" VARCHAR(120),
    "failureMessage" VARCHAR(500),

    "succeededAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerPaymentIntentId_key"
ON "Payment"("providerPaymentIntentId");

-- CreateIndex
CREATE INDEX "Payment_orderId_createdAt_idx"
ON "Payment"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_idx"
ON "Payment"("status");

-- AddForeignKey
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_orderId_fkey"
FOREIGN KEY ("orderId")
REFERENCES "Order"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Financial integrity
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_amount_positive_check"
CHECK ("amountInCents" > 0);

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_currency_check"
CHECK (
    char_length("currency") = 3
    AND "currency" = upper("currency")
);

-- Success timestamp integrity
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_succeeded_at_check"
CHECK (
    (
        "status" = 'SUCCEEDED'
        AND "succeededAt" IS NOT NULL
    )
    OR
    (
        "status" <> 'SUCCEEDED'
        AND "succeededAt" IS NULL
    )
);
