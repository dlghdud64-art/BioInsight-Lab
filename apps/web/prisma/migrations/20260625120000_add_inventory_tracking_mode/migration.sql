-- §inventory-phaseB P2 — trackingMode GMP 차감 게이팅 (additive only, 무손실)
-- 검증: operator-shell read-only `migrate diff --from-url`(prod) 결과와 일치. 데이터 삭제·변경 0.

-- CreateEnum
CREATE TYPE "TrackingMode" AS ENUM ('QUANTITY', 'LOT', 'GMP_STRICT');

-- AlterTable
ALTER TABLE "ProductInventory" ADD COLUMN     "trackingMode" "TrackingMode" NOT NULL DEFAULT 'QUANTITY';
