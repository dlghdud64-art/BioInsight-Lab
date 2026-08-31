-- §scan-recognition-upgrade P1 (2026-08-31) — ReceivingDraftItem lot 출처 축 신설.
--
-- 왜: "COA 인식" 배지의 truth 를 canonical 에 둔다. UI state 로 배지를 들면
--   인식 직후 자동 렌더(자동 확정 위장)를 구조적으로 막을 수 없다(호영님 검토 코멘트).
--   lotSource = "vendor_reply" | "coa_ocr" | "manual" (값 검증은 API 층 — inspect PATCH).
--   coaOcrJobId = 확정에 쓴 OcrJob 역추적(lineage) — lotSource=coa_ocr 이면 API 가 필수 강제.
--
-- additive only: ADD COLUMN(nullable) 2 + CREATE INDEX 1. 기존 컬럼·CHECK·데이터 무접촉.
--   null = 구 데이터(출처 미기록) — backfill 하지 않는다(지어내지 않는다).

ALTER TABLE "ReceivingDraftItem" ADD COLUMN "lotSource" TEXT;

ALTER TABLE "ReceivingDraftItem" ADD COLUMN "coaOcrJobId" TEXT;

CREATE INDEX "ReceivingDraftItem_coaOcrJobId_idx" ON "ReceivingDraftItem"("coaOcrJobId");
