-- #schema-drift-reconcile — db push 로만 prod 반영된 drift 를 migration 으로 baseline.
-- prod 엔 이미 존재(db push 2026-06-14 복구) → operator 는 resolve --applied 로 기록(무DDL).
-- fresh-DB(migrate reset)에서는 이 SQL 이 실제 실행되어 객체 생성.
-- ⚠️ 인덱스/제약 명칭 + Order/User 델타는 prod pg_dump 로 확정(Phase 1 검증). 초안 = Prisma 컨벤션 best-effort.

-- CreateEnum
CREATE TYPE "VendorPartnershipTier" AS ENUM ('DIRECT_PARTNER', 'VERIFIED', 'GENERAL', 'UNVERIFIED');

-- AlterTable — Vendor.partnershipTier (default GENERAL)
ALTER TABLE "Vendor" ADD COLUMN "partnershipTier" "VendorPartnershipTier" NOT NULL DEFAULT 'GENERAL';

-- AlterTable — OrganizationMember.workflowCapabilities (JSONB default '[]')
ALTER TABLE "OrganizationMember" ADD COLUMN "workflowCapabilities" JSONB NOT NULL DEFAULT '[]';

-- AlterTable — User.deletedAt 타입 정합 (⚠️ pg_dump 로 현 타입 확인)
ALTER TABLE "User" ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMP(3);

-- DropIndex — Order quoteId 단독 unique → 복합으로 전환 잔재 (⚠️ pg_dump 로 확인)
DROP INDEX IF EXISTS "Order_quoteId_key";

-- CreateTable — OrganizationVendor
CREATE TABLE "OrganizationVendor" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "vendorId" TEXT,
    "vendorName" TEXT NOT NULL,
    "vendorEmail" TEXT NOT NULL,
    "vendorPhone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "partnershipTier" "VendorPartnershipTier",
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationVendor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationVendor_organizationId_vendorEmail_key" ON "OrganizationVendor"("organizationId", "vendorEmail");
CREATE INDEX "OrganizationVendor_organizationId_idx" ON "OrganizationVendor"("organizationId");
CREATE INDEX "OrganizationVendor_vendorId_idx" ON "OrganizationVendor"("vendorId");
CREATE INDEX "OrganizationVendor_createdById_idx" ON "OrganizationVendor"("createdById");

-- CreateTable — OrganizationVendorProduct
CREATE TABLE "OrganizationVendorProduct" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationVendorProduct_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationVendorProduct_organizationId_vendorId_productId_key" ON "OrganizationVendorProduct"("organizationId", "vendorId", "productId");
CREATE INDEX "OrganizationVendorProduct_organizationId_idx" ON "OrganizationVendorProduct"("organizationId");
CREATE INDEX "OrganizationVendorProduct_vendorId_idx" ON "OrganizationVendorProduct"("vendorId");
CREATE INDEX "OrganizationVendorProduct_productId_idx" ON "OrganizationVendorProduct"("productId");
CREATE INDEX "OrganizationVendorProduct_createdById_idx" ON "OrganizationVendorProduct"("createdById");

-- AddForeignKey — OrganizationVendor
ALTER TABLE "OrganizationVendor" ADD CONSTRAINT "OrganizationVendor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationVendor" ADD CONSTRAINT "OrganizationVendor_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationVendor" ADD CONSTRAINT "OrganizationVendor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey — OrganizationVendorProduct
ALTER TABLE "OrganizationVendorProduct" ADD CONSTRAINT "OrganizationVendorProduct_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationVendorProduct" ADD CONSTRAINT "OrganizationVendorProduct_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationVendorProduct" ADD CONSTRAINT "OrganizationVendorProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationVendorProduct" ADD CONSTRAINT "OrganizationVendorProduct_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
