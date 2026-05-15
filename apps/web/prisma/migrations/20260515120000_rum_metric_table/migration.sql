-- §11.246d-4-cont #rum-metric-db-persistence — Core Web Vitals 4 metric 영속화.
--
-- §11.246d-3 observeLCP + §11.246d-5 observeCLS/FID/INP client RUM 측정 →
-- §11.246d-4 server POST endpoint (zod validation + structured log) →
-- 본 table 으로 raw row 영속화. p75 aggregate view 는 별도 백로그.
--
-- 4 metric DOUBLE PRECISION nullable — client beacon 도 모두 optional
-- (browser 미지원 graceful fallback). FK 강제 0 — anonymous RUM 강제.
-- IF NOT EXISTS 패턴 (idempotent, 직전 cluster 정합).

CREATE TABLE IF NOT EXISTS "RumMetric" (
  "id"        TEXT NOT NULL,
  "lcp"       DOUBLE PRECISION,
  "cls"       DOUBLE PRECISION,
  "fid"       DOUBLE PRECISION,
  "inp"       DOUBLE PRECISION,
  "pathname"  TEXT,
  "userAgent" TEXT,
  "sessionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RumMetric_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RumMetric_createdAt_idx" ON "RumMetric"("createdAt");
CREATE INDEX IF NOT EXISTS "RumMetric_pathname_idx"  ON "RumMetric"("pathname");
CREATE INDEX IF NOT EXISTS "RumMetric_lcp_idx"       ON "RumMetric"("lcp");
CREATE INDEX IF NOT EXISTS "RumMetric_cls_idx"       ON "RumMetric"("cls");
CREATE INDEX IF NOT EXISTS "RumMetric_inp_idx"       ON "RumMetric"("inp");
