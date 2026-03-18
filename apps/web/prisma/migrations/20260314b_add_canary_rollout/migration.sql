-- Canary Rollout: processingPath + canaryStage 컬럼 추가

-- 1. ProcessingPath Enum
DO $$ BEGIN
  CREATE TYPE "ProcessingPath" AS ENUM (
    'rules',
    'ai_shadow',
    'ai_active_canary',
    'ai_active_full',
    'ai_fallback'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. CanaryStage Enum
DO $$ BEGIN
  CREATE TYPE "CanaryStage" AS ENUM (
    'OFF',
    'SHADOW_ONLY',
    'ACTIVE_5',
    'ACTIVE_25',
    'ACTIVE_50',
    'ACTIVE_100'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. ShadowComparisonLog에 processingPath 컬럼 추가
ALTER TABLE "ShadowComparisonLog"
  ADD COLUMN IF NOT EXISTS "processingPath" "ProcessingPath" NOT NULL DEFAULT 'rules';

-- 4. ShadowComparisonLog에 canaryStage 컬럼 추가
ALTER TABLE "ShadowComparisonLog"
  ADD COLUMN IF NOT EXISTS "canaryStage" "CanaryStage";

-- 5. CanaryHaltLog 테이블 — 서킷 브레이커 발동 기록
CREATE TABLE IF NOT EXISTS "CanaryHaltLog" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "previousStage" "CanaryStage" NOT NULL,
    "haltedToStage" "CanaryStage" NOT NULL,
    "reason" TEXT NOT NULL,
    "triggerCategory" "ShadowMismatchCategory",
    "triggerRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanaryHaltLog_pkey" PRIMARY KEY ("id")
);

-- 6. 인덱스
CREATE INDEX IF NOT EXISTS "ShadowComparisonLog_processingPath_idx"
  ON "ShadowComparisonLog"("processingPath");
CREATE INDEX IF NOT EXISTS "ShadowComparisonLog_canaryStage_idx"
  ON "ShadowComparisonLog"("canaryStage");
CREATE INDEX IF NOT EXISTS "CanaryHaltLog_documentType_idx"
  ON "CanaryHaltLog"("documentType");
CREATE INDEX IF NOT EXISTS "CanaryHaltLog_createdAt_idx"
  ON "CanaryHaltLog"("createdAt");
