-- #post-approval-purchase-order-flow Phase 2.3 step 1 — Order PDF 영속화 field.
--
-- step 2 (storage upload) 별도 mini-batch — host config (S3/Cloudinary
-- /Supabase) 후 generate-pdf route 가 upload 결과 URL 저장.
--
-- 본 step 은 schema field 만 — backward compat (NULL = 미생성). 기존
-- Order row 영향 0.

-- IF NOT EXISTS 패턴 (idempotent, 직전 cluster 정합).
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "poDocumentUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "poDocumentGeneratedAt" TIMESTAMP(3);
