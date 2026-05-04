-- §11.99b — POCandidate.approvalStatus String → POCandidateApprovalStatus enum
--
-- 옵션 A 정합: AiActionItem.approvalStatus 의 ApprovalStatus enum (4 값
-- UPPER_CASE) 과 별개 enum 으로 분리 (별도 이름 — POCandidateApprovalStatus,
-- 8 값 snake_case). procurement-stage.ts 의 ApprovalStatus type alias 어휘
-- 와 동일.
--
-- canonical truth:
--   - schema 의 enum POCandidateApprovalStatus single source
--   - application code 의 string literal ("not_required" 등) 그대로 호환
--     (Prisma 가 enum value 와 string 자동 매핑)

-- 1) Create enum type (8 values, snake_case)
CREATE TYPE "POCandidateApprovalStatus" AS ENUM (
  'not_required',
  'external_approval_required',
  'external_approval_pending',
  'externally_approved',
  'externally_rejected',
  'in_app_approval_pending',
  'in_app_approved',
  'in_app_rejected'
);

-- 2) Safety: invalid values → 'not_required' (방어 — seed 는 유효한 값만
--    사용하지만 history 데이터 보호)
UPDATE "POCandidate"
  SET "approvalStatus" = 'not_required'
  WHERE "approvalStatus" NOT IN (
    'not_required',
    'external_approval_required',
    'external_approval_pending',
    'externally_approved',
    'externally_rejected',
    'in_app_approval_pending',
    'in_app_approved',
    'in_app_rejected'
  );

-- 3) Convert column type with USING cast (default 임시 제거 → 변환 → 재설정)
ALTER TABLE "POCandidate"
  ALTER COLUMN "approvalStatus" DROP DEFAULT;

ALTER TABLE "POCandidate"
  ALTER COLUMN "approvalStatus" TYPE "POCandidateApprovalStatus"
  USING "approvalStatus"::"POCandidateApprovalStatus";

ALTER TABLE "POCandidate"
  ALTER COLUMN "approvalStatus" SET DEFAULT 'not_required'::"POCandidateApprovalStatus";
