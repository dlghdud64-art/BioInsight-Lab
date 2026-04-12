-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "InspectionResult" AS ENUM ('PASS', 'CAUTION', 'FAIL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum: AuditEntityType에 INSPECTION 추가
DO $$ BEGIN
  ALTER TYPE "AuditEntityType" ADD VALUE 'INSPECTION';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "ProductInventory" ADD COLUMN IF NOT EXISTS "lastInspectedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Inspection" (
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
CREATE INDEX IF NOT EXISTS "Inspection_inventoryId_idx" ON "Inspection"("inventoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Inspection_userId_idx" ON "Inspection"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Inspection_organizationId_idx" ON "Inspection"("organizationId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "ProductInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
