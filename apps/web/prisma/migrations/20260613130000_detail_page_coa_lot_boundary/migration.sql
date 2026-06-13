-- §detail-page P2 — COA/SDS 경계 강제 (lot-scoped COA vs product-scoped SDS).
-- Source: prisma migrate diff --from-url <prod> --to-schema-datamodel <new schema> --script
--   + 수동 보강: SDSDocument_coa_lot_check CHECK constraint.
-- 호영님 통제 구조: schema.prisma 의 inventoryId/relation 만 자동 생성. CHECK 는
-- Prisma 미관리(향후 migrate diff 가 DROP 을 제안해도 보존). 자세한 부채 기록은
-- DEV_RUNBOOK §9 / 인프라 트랙 노트 참조.

-- AlterTable
ALTER TABLE "SDSDocument" ADD COLUMN     "inventoryId" TEXT;

-- CreateIndex
CREATE INDEX "SDSDocument_inventoryId_idx" ON "SDSDocument"("inventoryId");

-- AddForeignKey
-- ON DELETE RESTRICT: GMP/QC 기록 보존 — lot 에 COA 가 붙어있으면 lot 삭제 차단.
ALTER TABLE "SDSDocument" ADD CONSTRAINT "SDSDocument_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "ProductInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraint — docType ∈ {'sds','coa'} 강제 + COA/SDS 경계.
--   coa => inventoryId NOT NULL (lot-scoped)
--   sds => inventoryId NULL (product-scoped)
-- ⚠️ docType 값 추가(예: msds/spec) 시 본 CHECK 동반 갱신 필수.
--    미갱신 시 신규 docType INSERT 전면 차단.
-- ⚠️ Prisma 비관리: schema.prisma 가 CHECK 를 표현 못 함. 향후 migrate diff 가
--    이 CHECK 의 DROP 을 제안해도 보존(무시). 구조적 방어 값어치 > Prisma drift 부채.
ALTER TABLE "SDSDocument"
  ADD CONSTRAINT "SDSDocument_coa_lot_check"
  CHECK (
    ("docType" = 'coa' AND "inventoryId" IS NOT NULL)
    OR ("docType" = 'sds' AND "inventoryId" IS NULL)
  );
