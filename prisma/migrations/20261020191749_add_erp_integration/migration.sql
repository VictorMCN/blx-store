-- CreateEnum
CREATE TYPE "ErpSyncStatus" AS ENUM ('PENDING', 'PROCESSING', 'RETRY', 'SYNCED', 'FAILED');

-- CreateTable
CREATE TABLE "ErpSyncJob" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "status" "ErpSyncStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMPTZ(3),
    "externalReference" VARCHAR(80),
    "lastErrorCode" VARCHAR(60),
    "syncedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ErpSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpMockOrder" (
    "id" UUID NOT NULL,
    "sourceOrderId" UUID NOT NULL,
    "reference" VARCHAR(80) NOT NULL,
    "orderNumber" VARCHAR(30) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "totalInCents" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErpMockOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErpSyncJob_orderId_key" ON "ErpSyncJob"("orderId");

-- CreateIndex
CREATE INDEX "ErpSyncJob_status_nextAttemptAt_idx" ON "ErpSyncJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "ErpSyncJob_status_lockedUntil_idx" ON "ErpSyncJob"("status", "lockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ErpMockOrder_sourceOrderId_key" ON "ErpMockOrder"("sourceOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ErpMockOrder_reference_key" ON "ErpMockOrder"("reference");

-- AddForeignKey
ALTER TABLE "ErpSyncJob" ADD CONSTRAINT "ErpSyncJob_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
