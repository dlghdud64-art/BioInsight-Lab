-- CreateEnum
CREATE TYPE "PurchaseSource" AS ENUM ('IMPORT', 'QUOTE');

-- Add new QuoteStatus value
ALTER TYPE "QuoteStatus" ADD VALUE 'PURCHASED';

-- AlterTable: Update PurchaseRecord to new schema
ALTER TABLE "PurchaseRecord" DROP COLUMN IF EXISTS "projectName";
ALTER TABLE "PurchaseRecord" DROP COLUMN IF EXISTS "externalDocId";
ALTER TABLE "PurchaseRecord" DROP COLUMN IF EXISTS "importedAt";

ALTER TABLE "PurchaseRecord" RENAME COLUMN "purchaseDate" TO "purchasedAt";

ALTER TABLE "PurchaseRecord" ADD COLUMN IF NOT EXISTS "vendorName" TEXT NOT NULL DEFAULT 'Unknown Vendor';
ALTER TABLE "PurchaseRecord" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "PurchaseRecord" ADD COLUMN IF NOT EXISTS "itemName" TEXT NOT NULL DEFAULT 'Unknown Item';
ALTER TABLE "PurchaseRecord" ADD COLUMN IF NOT EXISTS "catalogNumber" TEXT;
ALTER TABLE "PurchaseRecord" ADD COLUMN IF NOT EXISTS "unit" TEXT;
ALTER TABLE "PurchaseRecord" ADD COLUMN IF NOT EXISTS "source" "PurchaseSource" NOT NULL DEFAULT 'IMPORT';
ALTER TABLE "PurchaseRecord" ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE "PurchaseRecord" RENAME COLUMN "totalAmount" TO "amount";
ALTER TABLE "PurchaseRecord" ALTER COLUMN "quantity" TYPE INTEGER;

-- Make organizationId required
ALTER TABLE "PurchaseRecord" ALTER COLUMN "organizationId" SET NOT NULL;

-- Update indexes
DROP INDEX IF EXISTS "PurchaseRecord_purchaseDate_idx";
CREATE INDEX IF NOT EXISTS "PurchaseRecord_purchasedAt_idx" ON "PurchaseRecord"("purchasedAt");
CREATE INDEX IF NOT EXISTS "PurchaseRecord_vendorName_idx" ON "PurchaseRecord"("vendorName");
DROP INDEX IF EXISTS "PurchaseRecord_category_idx";
CREATE INDEX IF NOT EXISTS "PurchaseRecord_category_idx" ON "PurchaseRecord"("category");

-- AlterTable: Update Budget to new schema
ALTER TABLE "Budget" DROP COLUMN IF EXISTS "projectName";
ALTER TABLE "Budget" DROP COLUMN IF EXISTS "name";
ALTER TABLE "Budget" DROP COLUMN IF EXISTS "periodStart";
ALTER TABLE "Budget" DROP COLUMN IF EXISTS "periodEnd";

ALTER TABLE "Budget" ADD COLUMN IF NOT EXISTS "yearMonth" TEXT NOT NULL DEFAULT '2025-01';
ALTER TABLE "Budget" ALTER COLUMN "organizationId" SET NOT NULL;

-- Create unique index on Budget
DROP INDEX IF EXISTS "Budget_organizationId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "Budget_organizationId_yearMonth_key" ON "Budget"("organizationId", "yearMonth");
CREATE INDEX IF NOT EXISTS "Budget_organizationId_idx" ON "Budget"("organizationId");
CREATE INDEX IF NOT EXISTS "Budget_yearMonth_idx" ON "Budget"("yearMonth");
