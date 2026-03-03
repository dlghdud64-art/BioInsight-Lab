import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  await prisma.$executeRawUnsafe(`
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
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "InventoryRestock_inventoryId_idx" ON "InventoryRestock"("inventoryId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "InventoryRestock_userId_idx" ON "InventoryRestock"("userId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "InventoryRestock_restockedAt_idx" ON "InventoryRestock"("restockedAt")
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'InventoryRestock_inventoryId_fkey'
      ) THEN
        ALTER TABLE "InventoryRestock"
          ADD CONSTRAINT "InventoryRestock_inventoryId_fkey"
          FOREIGN KEY ("inventoryId") REFERENCES "ProductInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'InventoryRestock_userId_fkey'
      ) THEN
        ALTER TABLE "InventoryRestock"
          ADD CONSTRAINT "InventoryRestock_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$
  `);
  console.log('✅ InventoryRestock table created successfully');
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await prisma.$disconnect();
}
