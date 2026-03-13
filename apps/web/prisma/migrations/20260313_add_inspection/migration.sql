-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('PASS', 'CAUTION', 'FAIL');

-- AlterEnum: AuditEntityType에 INSPECTION 추가
ALTER TYPE "AuditEntityType" ADD VALUE 'INSPECTION';

-- AlterTable
ALTER TABLE "ProductInventory" ADD COLUMN "lastInspectedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "result" "InspectionResult" NOT NULL,
    "checklist" JSONB NOT NULL,
    "notes" TEXT,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Inspection_inventoryId_idx" ON "Inspection"("inventoryId");

-- CreateIndex
CREATE INDEX "Inspection_userId_idx" ON "Inspection"("userId");

-- CreateIndex
CREATE INDEX "Inspection_organizationId_idx" ON "Inspection"("organizationId");

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "ProductInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
