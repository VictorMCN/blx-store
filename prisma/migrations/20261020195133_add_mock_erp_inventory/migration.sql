-- CreateTable
CREATE TABLE "ErpMockInventory" (
    "id" UUID NOT NULL,
    "sku" VARCHAR(80) NOT NULL,
    "onHandQuantity" INTEGER NOT NULL,
    "reservedQuantity" INTEGER NOT NULL,
    "availableQuantity" INTEGER NOT NULL,
    "syncedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ErpMockInventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErpMockInventory_sku_key" ON "ErpMockInventory"("sku");
