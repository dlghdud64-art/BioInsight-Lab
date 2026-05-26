-- §11.309a #inventory-restock-ocr-link — InventoryRestock 확장 + OcrJob FK
-- 호영님 P0 (2026-05-26) — 스마트 입고 AI 스캔 backend MVP, Phase A.
-- Q23 = A 옵션 (InventoryRestock 확장, 새 model 0건).
--
-- 변경 범위:
--   1. InventoryRestock 에 ocrJobId (TEXT, nullable) 컬럼 추가
--   2. InventoryRestock 에 extractedData (JSONB, nullable) 컬럼 추가
--   3. FK 제약: ocrJobId → OcrJob(id), ON DELETE SET NULL
--   4. Index: InventoryRestock(ocrJobId)
--
-- 회귀 0:
--   - 기존 InventoryRestock row 영향 0 (두 컬럼 모두 NULL 허용)
--   - 기존 caller (createOrUpdateMutation 등) 변경 0 (필드 미지정 시 NULL)
--   - OcrJob 삭제 시 InventoryRestock 보존 (SET NULL, 입고 이력 무결성 보호)
--
-- Rollback:
--   ALTER TABLE "InventoryRestock" DROP CONSTRAINT "InventoryRestock_ocrJobId_fkey";
--   DROP INDEX "InventoryRestock_ocrJobId_idx";
--   ALTER TABLE "InventoryRestock" DROP COLUMN "ocrJobId";
--   ALTER TABLE "InventoryRestock" DROP COLUMN "extractedData";

ALTER TABLE "InventoryRestock"
  ADD COLUMN "ocrJobId" TEXT,
  ADD COLUMN "extractedData" JSONB;

ALTER TABLE "InventoryRestock"
  ADD CONSTRAINT "InventoryRestock_ocrJobId_fkey"
  FOREIGN KEY ("ocrJobId") REFERENCES "OcrJob"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "InventoryRestock_ocrJobId_idx" ON "InventoryRestock"("ocrJobId");
