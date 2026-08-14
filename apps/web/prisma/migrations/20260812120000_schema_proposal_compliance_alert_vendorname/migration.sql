-- AlterTable
ALTER TABLE "QuoteListItem" ADD COLUMN     "vendorName" TEXT;

-- CreateTable
CREATE TABLE "ComplianceLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "linkType" TEXT NOT NULL DEFAULT 'official',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rules" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAlertSetting" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "alertType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryAlertSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceLink_organizationId_idx" ON "ComplianceLink"("organizationId");

-- CreateIndex
CREATE INDEX "ComplianceLink_enabled_idx" ON "ComplianceLink"("enabled");

-- CreateIndex
CREATE INDEX "ComplianceLink_linkType_idx" ON "ComplianceLink"("linkType");

-- CreateIndex
CREATE INDEX "InventoryAlertSetting_organizationId_idx" ON "InventoryAlertSetting"("organizationId");

-- CreateIndex
CREATE INDEX "InventoryAlertSetting_enabled_idx" ON "InventoryAlertSetting"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAlertSetting_inventoryId_userId_alertType_key" ON "InventoryAlertSetting"("inventoryId", "userId", "alertType");

-- AddForeignKey
ALTER TABLE "ComplianceLink" ADD CONSTRAINT "ComplianceLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAlertSetting" ADD CONSTRAINT "InventoryAlertSetting_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "ProductInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAlertSetting" ADD CONSTRAINT "InventoryAlertSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAlertSetting" ADD CONSTRAINT "InventoryAlertSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

