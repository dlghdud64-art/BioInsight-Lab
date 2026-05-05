-- #post-approval-purchase-order-flow Phase 1.2 — Vendor PO grouping (option A).
--
-- 변경:
--   1. `Order.quoteId @unique` 단독 제약 제거 → composite `(quoteId, vendorId)`
--   2. `Order.vendorId TEXT NULL` (Vendor FK, SetNull on delete)
--   3. `Order.poCandidateId TEXT NULL` (POCandidate FK, SetNull on delete)
--   4. CREATE INDEX vendorId / poCandidateId
--
-- legacy data backward compat:
--   - 기존 Order row 의 vendorId / poCandidateId = NULL (UI 가 "지정 없음" 표기)
--   - composite unique 가 (quoteId, NULL) 도 1개만 허용 (legacy 1 quote 1 NULL Order 보장)
--
-- rollback (down.sql 미생성 — 호영님 host 측 수동 rollback):
--   ALTER TABLE "Order" DROP CONSTRAINT "Order_quoteId_vendorId_key";
--   ALTER TABLE "Order" DROP CONSTRAINT "Order_vendorId_fkey";
--   ALTER TABLE "Order" DROP CONSTRAINT "Order_poCandidateId_fkey";
--   ALTER TABLE "Order" DROP COLUMN "vendorId";
--   ALTER TABLE "Order" DROP COLUMN "poCandidateId";
--   ALTER TABLE "Order" ADD CONSTRAINT "Order_quoteId_key" UNIQUE ("quoteId");
--   DROP INDEX "Order_vendorId_idx";
--   DROP INDEX "Order_poCandidateId_idx";

-- 1. 단독 unique 제거 (composite 로 swap) — IF EXISTS: DB에 없을 수 있음
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_quoteId_key";

-- 2. vendorId / poCandidateId column 추가 (NULL allowed for backward compat)
ALTER TABLE "Order" ADD COLUMN "vendorId" TEXT;
ALTER TABLE "Order" ADD COLUMN "poCandidateId" TEXT;

-- 3. composite unique — vendor 별 1개 Order (legacy NULL row 도 1개 보장)
ALTER TABLE "Order" ADD CONSTRAINT "Order_quoteId_vendorId_key" UNIQUE ("quoteId", "vendorId");

-- 4. FK constraint — SetNull on delete (Order 보존)
ALTER TABLE "Order" ADD CONSTRAINT "Order_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_poCandidateId_fkey"
  FOREIGN KEY ("poCandidateId") REFERENCES "POCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. index for FK lookup performance
CREATE INDEX "Order_vendorId_idx" ON "Order"("vendorId");
CREATE INDEX "Order_poCandidateId_idx" ON "Order"("poCandidateId");
