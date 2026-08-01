-- §receiving-inspection-decision (T2) — 입고 검수 판정 필드 추가.
--
-- 설계 근거:
--   · receivedQuantity(공급사 회신값)와 inspectedQuantity(검수 실측값)를 분리 보존한다.
--     덮어쓰면 "공급사가 몇 개 보냈다고 했는지"의 근거가 사라져 분쟁·GMP 추적이 불가능해진다.
--   · restockedAt = 라인 단위 재고 반영 가드. 기존 draft 단위 가드는 부분 입고 후
--     잔여분 재확정을 전면 차단하므로, 가드를 제거하지 않고 범위만 라인으로 축소한다.
--
-- 안전성: additive-only (nullable 컬럼 추가만). 기존 행 영향 0, 제약·인덱스 변경 0, data loss 0.
--   기존 행은 전부 NULL = 미판정 상태로 해석되며, 판정 없이는 재고 반영되지 않는다.

ALTER TABLE "ReceivingDraftItem" ADD COLUMN "inspectedQuantity" DOUBLE PRECISION;
ALTER TABLE "ReceivingDraftItem" ADD COLUMN "decision"          TEXT;
ALTER TABLE "ReceivingDraftItem" ADD COLUMN "decidedAt"         TIMESTAMP(3);
ALTER TABLE "ReceivingDraftItem" ADD COLUMN "decidedById"       TEXT;
ALTER TABLE "ReceivingDraftItem" ADD COLUMN "discrepancyAction" TEXT;
ALTER TABLE "ReceivingDraftItem" ADD COLUMN "discrepancyReason" TEXT;
ALTER TABLE "ReceivingDraftItem" ADD COLUMN "restockedAt"       TIMESTAMP(3);

-- Rollback (수동):
--   ALTER TABLE "ReceivingDraftItem"
--     DROP COLUMN IF EXISTS "inspectedQuantity",
--     DROP COLUMN IF EXISTS "decision",
--     DROP COLUMN IF EXISTS "decidedAt",
--     DROP COLUMN IF EXISTS "decidedById",
--     DROP COLUMN IF EXISTS "discrepancyAction",
--     DROP COLUMN IF EXISTS "discrepancyReason",
--     DROP COLUMN IF EXISTS "restockedAt";
--   ※ 기록된 판정은 유실되나, 재고 반영분(InventoryRestock)은 별 테이블이라 보존된다.
