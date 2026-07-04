-- §safety-modal-upgrade P4b (호영님 2026-07-04) — Inspection 물질 대표 점검 지원.
--   additive + nullable 완화(무손실). 기존 lot 점검 row 는 inventoryId 유지, 물질 점검은 productId 사용.
--
-- 비파괴 검토:
--   - inventoryId NOT NULL → NULL: 제약 완화(기존 값 보존, 데이터 손실 0)
--   - productId/severity/photoUrl/lastInspectedAt: nullable 신규 컬럼(additive)
--   - Inspection_productId FK + index: additive
--
-- 🛑 파괴적 명령 없음. 세션 pooler 5432 로 migrate deploy(dry-run→"진행" 후).

-- inventoryId 제약 완화(lot 점검 무영향)
ALTER TABLE "Inspection" ALTER COLUMN "inventoryId" DROP NOT NULL;

-- 물질 점검 신규 컬럼(nullable, additive)
ALTER TABLE "Inspection" ADD COLUMN "productId" TEXT;
ALTER TABLE "Inspection" ADD COLUMN "severity" TEXT;
ALTER TABLE "Inspection" ADD COLUMN "photoUrl" TEXT;

-- Product 최근 물질점검 시각(안전 어댑터 lastInspection 파생 소스)
ALTER TABLE "Product" ADD COLUMN "lastInspectedAt" TIMESTAMP(3);

-- 물질 점검 인덱스 + FK
CREATE INDEX "Inspection_productId_idx" ON "Inspection"("productId");
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
