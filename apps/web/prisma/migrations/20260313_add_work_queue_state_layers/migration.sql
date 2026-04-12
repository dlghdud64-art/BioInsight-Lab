-- Work Queue 3-Layer State Decoupling
-- TaskStatus (글로벌 작업 상태), ApprovalStatus (결재 상태), substatus (도메인 세부)

-- 1. Enum 생성
DO $$ BEGIN
  CREATE TYPE "TaskStatus" AS ENUM (
    'READY',
    'REVIEW_NEEDED',
    'IN_PROGRESS',
    'WAITING_RESPONSE',
    'ACTION_NEEDED',
    'COMPLETED',
    'FAILED',
    'BLOCKED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ApprovalStatus" AS ENUM (
    'NOT_REQUIRED',
    'PENDING',
    'APPROVED',
    'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. AiActionItem 테이블에 새 컬럼 추가
ALTER TABLE "AiActionItem" ADD COLUMN IF NOT EXISTS "taskStatus" "TaskStatus" NOT NULL DEFAULT 'READY';
ALTER TABLE "AiActionItem" ADD COLUMN IF NOT EXISTS "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "AiActionItem" ADD COLUMN IF NOT EXISTS "substatus" TEXT;
ALTER TABLE "AiActionItem" ADD COLUMN IF NOT EXISTS "assigneeId" TEXT;
ALTER TABLE "AiActionItem" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "AiActionItem" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AiActionItem" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "AiActionItem" ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);

-- 3. 기존 데이터 마이그레이션: Legacy status → 3-Layer
UPDATE "AiActionItem" SET
  "taskStatus" = CASE "status"
    WHEN 'PENDING'   THEN 'REVIEW_NEEDED'::"TaskStatus"
    WHEN 'APPROVED'  THEN 'COMPLETED'::"TaskStatus"
    WHEN 'DISMISSED' THEN 'COMPLETED'::"TaskStatus"
    WHEN 'EXPIRED'   THEN 'COMPLETED'::"TaskStatus"
    WHEN 'EXECUTING' THEN 'IN_PROGRESS'::"TaskStatus"
    WHEN 'FAILED'    THEN 'FAILED'::"TaskStatus"
    ELSE 'READY'::"TaskStatus"
  END,
  "approvalStatus" = CASE "status"
    WHEN 'PENDING'   THEN 'PENDING'::"ApprovalStatus"
    WHEN 'APPROVED'  THEN 'APPROVED'::"ApprovalStatus"
    WHEN 'DISMISSED' THEN 'REJECTED'::"ApprovalStatus"
    WHEN 'EXPIRED'   THEN 'NOT_REQUIRED'::"ApprovalStatus"
    WHEN 'EXECUTING' THEN 'APPROVED'::"ApprovalStatus"
    WHEN 'FAILED'    THEN 'NOT_REQUIRED'::"ApprovalStatus"
    ELSE 'NOT_REQUIRED'::"ApprovalStatus"
  END,
  "substatus" = CASE "type"
    WHEN 'QUOTE_DRAFT'            THEN 'quote_draft_generated'
    WHEN 'VENDOR_EMAIL_DRAFT'     THEN 'vendor_email_generated'
    WHEN 'REORDER_SUGGESTION'     THEN 'restock_suggested'
    WHEN 'EXPIRY_ALERT'           THEN 'expiry_alert_created'
    WHEN 'FOLLOWUP_DRAFT'         THEN 'followup_draft_generated'
    WHEN 'VENDOR_RESPONSE_PARSED' THEN 'vendor_response_parsed'
    WHEN 'STATUS_CHANGE_SUGGEST'  THEN 'status_change_proposed'
    ELSE NULL
  END,
  "completedAt" = CASE
    WHEN "status" IN ('APPROVED', 'DISMISSED', 'EXPIRED') THEN "resolvedAt"
    ELSE NULL
  END,
  "failedAt" = CASE
    WHEN "status" = 'FAILED' THEN "resolvedAt"
    ELSE NULL
  END
WHERE "taskStatus" = 'READY' AND "status" != 'PENDING';

-- 4. 인덱스 생성
CREATE INDEX IF NOT EXISTS "AiActionItem_organizationId_taskStatus_idx" ON "AiActionItem"("organizationId", "taskStatus");
CREATE INDEX IF NOT EXISTS "AiActionItem_taskStatus_priority_idx" ON "AiActionItem"("taskStatus", "priority");
CREATE INDEX IF NOT EXISTS "AiActionItem_updatedAt_idx" ON "AiActionItem"("updatedAt");
