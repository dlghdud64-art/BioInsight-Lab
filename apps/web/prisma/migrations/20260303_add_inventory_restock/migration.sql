-- CreateTable: InventoryRestock (재고 입고 이력)
CREATE TABLE IF NOT EXISTS "InventoryRestock" (
    "id"          TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "quantity"    DOUBLE PRECISION NOT NULL,
    "unit"        TEXT,
    "lotNumber"   TEXT,
    "expiryDate"  TIMESTAMP(3),
    "notes"       TEXT,
    "restockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryRestock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryRestock_inventoryId_idx" ON "InventoryRestock"("inventoryId");
CREATE INDEX IF NOT EXISTS "InventoryRestock_userId_idx" ON "InventoryRestock"("userId");
CREATE INDEX IF NOT EXISTS "InventoryRestock_restockedAt_idx" ON "InventoryRestock"("restockedAt");

-- AddForeignKey
ALTER TABLE "InventoryRestock" ADD CONSTRAINT "InventoryRestock_inventoryId_fkey"
    FOREIGN KEY ("inventoryId") REFERENCES "ProductInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryRestock" ADD CONSTRAINT "InventoryRestock_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
