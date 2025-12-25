-- CreateEnum
CREATE TYPE "PurchaseMatchType" AS ENUM ('QUOTE', 'CATALOG', 'FUZZY', 'MANUAL');

-- AlterTable
ALTER TABLE "PurchaseRecord" ADD COLUMN "matchType" "PurchaseMatchType";
ALTER TABLE "PurchaseRecord" ADD COLUMN "hazardSnapshot" JSONB;

-- CreateIndex
CREATE INDEX "PurchaseRecord_organizationId_purchaseDate_idx" ON "PurchaseRecord"("organizationId", "purchaseDate");
CREATE INDEX "PurchaseRecord_organizationId_productId_idx" ON "PurchaseRecord"("organizationId", "productId");
CREATE INDEX "PurchaseRecord_organizationId_vendorId_idx" ON "PurchaseRecord"("organizationId", "vendorId");



