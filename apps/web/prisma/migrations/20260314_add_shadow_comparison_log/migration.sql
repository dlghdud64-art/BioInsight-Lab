-- Shadow Comparison Log: AI Shadow 모드 비교 결과 저장
-- Zero-impact: 실제 Write Path에 영향 없음, 분석 전용 테이블

-- 1. Mismatch Category Enum
DO $$ BEGIN
  CREATE TYPE "ShadowMismatchCategory" AS ENUM (
    'NO_DIFF',
    'DOC_TYPE_DIFF',
    'VERIFICATION_DIFF',
    'AUTO_VERIFY_RISK',
    'TASK_MAPPING_DIFF',
    'EXTRACTION_DIFF',
    'LOW_CONFIDENCE_FALLBACK',
    'SCHEMA_INVALID_FALLBACK',
    'PROVIDER_ERROR_FALLBACK',
    'TIMEOUT_FALLBACK',
    'UNKNOWN_CLASSIFICATION',
    'ORG_SCOPE_BLOCKED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Review Candidate Tag Enum
DO $$ BEGIN
  CREATE TYPE "ShadowReviewTag" AS ENUM (
    'AI_AUTO_VERIFY_VS_RULES_MANUAL',
    'DOC_TYPE_CONFLICT',
    'VENDOR_AMOUNT_MISMATCH',
    'HIGH_CONFIDENCE_RULES_CONFLICT',
    'REPEATED_VENDOR_MISMATCH'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. ShadowComparisonLog 테이블
CREATE TABLE IF NOT EXISTS "ShadowComparisonLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "documentId" TEXT,

    -- Rules Path 결과
    "documentTypeByRules" TEXT,
    "verificationByRules" TEXT,
    "taskMappingByRules" TEXT,
    "dedupOutcomeByRules" TEXT,

    -- AI Path 결과
    "documentTypeByAi" TEXT,
    "verificationByAi" TEXT,
    "taskMappingByAi" TEXT,
    "dedupOutcomeByAiIfApplied" TEXT,

    -- 분석 메타
    "mismatchCategory" "ShadowMismatchCategory" NOT NULL DEFAULT 'NO_DIFF',
    "confidence" DOUBLE PRECISION,
    "schemaValid" BOOLEAN NOT NULL DEFAULT true,
    "fallbackReason" TEXT,

    -- AI 성능 메트릭
    "aiLatencyMs" INTEGER,
    "tokenUsage" INTEGER,
    "provider" TEXT,
    "model" TEXT,

    -- Review 태그
    "reviewTags" "ShadowReviewTag"[],
    "isReviewCandidate" BOOLEAN NOT NULL DEFAULT false,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShadowComparisonLog_pkey" PRIMARY KEY ("id")
);

-- 4. 인덱스
CREATE INDEX IF NOT EXISTS "ShadowComparisonLog_orgId_createdAt_idx"
  ON "ShadowComparisonLog"("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "ShadowComparisonLog_mismatchCategory_idx"
  ON "ShadowComparisonLog"("mismatchCategory");
CREATE INDEX IF NOT EXISTS "ShadowComparisonLog_isReviewCandidate_idx"
  ON "ShadowComparisonLog"("isReviewCandidate") WHERE "isReviewCandidate" = true;
CREATE INDEX IF NOT EXISTS "ShadowComparisonLog_requestId_idx"
  ON "ShadowComparisonLog"("requestId");
CREATE INDEX IF NOT EXISTS "ShadowComparisonLog_documentTypeByRules_idx"
  ON "ShadowComparisonLog"("documentTypeByRules");
CREATE INDEX IF NOT EXISTS "ShadowComparisonLog_createdAt_idx"
  ON "ShadowComparisonLog"("createdAt");

-- 5. Foreign Key (orgId → Organization)
DO $$ BEGIN
  ALTER TABLE "ShadowComparisonLog" ADD CONSTRAINT "ShadowComparisonLog_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
