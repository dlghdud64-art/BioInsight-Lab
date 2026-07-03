-- §cas-hazard-classification P1 (호영님 2026-07-04) — Product.casNo (CAS 등록번호) 추가.
--   OCR(claude-structurer·gemini-parser)이 추출하던 casNumber를 저장할 canonical 필드.
--   nullable — 기존 행 무영향. rollback: DROP COLUMN "casNo".
ALTER TABLE "Product" ADD COLUMN "casNo" TEXT;
