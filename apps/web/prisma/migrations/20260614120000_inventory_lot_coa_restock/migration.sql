-- #inventory-lot-entity P3 — COA(lot-scoped) 를 ProductInventory(제품당 1행) 에서
-- 실 입고 lot(InventoryRestock) 으로 재바인딩. "COA 폭발" 근본 원인 해결:
-- 기존엔 모든 lot 의 COA 가 ProductInventory.id(제품/org 당 1개) 1개 섹션에 쌓임.
--
-- 호영님 통제 구조 (dry-run → 보고 → "진행" 승인 2026-06-14):
--   실측: docType='coa' 1행(TEST_COA_smoke.pdf, 매핑 가능 실 lot 0) + docType='sds' 0행.
--   실 production COA 0건 → 위험 최소. 테스트 row 1건만 정리.
--
-- ⚠️ SDSDocument_coa_lot_check CHECK 는 Prisma 미관리(수동 보강). 향후 migrate diff
--   가 DROP 을 제안해도 보존. 자세한 부채 기록은 DEV_RUNBOOK §9 참조.

-- 1) 테스트 COA row 정리 (restock 후보 0 = 매핑 불가, 스모크 아티팩트)
DELETE FROM "SDSDocument"
  WHERE id = 'cmqcanhd40001nqwz2z8foz60' AND "docType" = 'coa';

-- 2) restockId 컬럼 + 인덱스 + FK (Prisma-managed)
ALTER TABLE "SDSDocument" ADD COLUMN "restockId" TEXT;

CREATE INDEX "SDSDocument_restockId_idx" ON "SDSDocument"("restockId");

ALTER TABLE "SDSDocument" ADD CONSTRAINT "SDSDocument_restockId_fkey"
  FOREIGN KEY ("restockId") REFERENCES "InventoryRestock"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3) CHECK 재정의 (unmanaged): coa→inventoryId 에서 coa→restockId 로 전환
ALTER TABLE "SDSDocument" DROP CONSTRAINT IF EXISTS "SDSDocument_coa_lot_check";

ALTER TABLE "SDSDocument" ADD CONSTRAINT "SDSDocument_coa_lot_check"
  CHECK (
    ("docType" = 'coa' AND "restockId" IS NOT NULL)
    OR ("docType" = 'sds' AND "restockId" IS NULL)
  );

-- Rollback (수동):
--   ALTER TABLE "SDSDocument" DROP CONSTRAINT IF EXISTS "SDSDocument_coa_lot_check";
--   ALTER TABLE "SDSDocument" ADD CONSTRAINT "SDSDocument_coa_lot_check"
--     CHECK (("docType"='coa' AND "inventoryId" IS NOT NULL) OR ("docType"='sds' AND "inventoryId" IS NULL));
--   ALTER TABLE "SDSDocument" DROP CONSTRAINT IF EXISTS "SDSDocument_restockId_fkey";
--   DROP INDEX IF EXISTS "SDSDocument_restockId_idx";
--   ALTER TABLE "SDSDocument" DROP COLUMN IF EXISTS "restockId";
