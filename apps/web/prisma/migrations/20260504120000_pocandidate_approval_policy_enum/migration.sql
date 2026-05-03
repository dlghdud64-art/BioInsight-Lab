-- §11.209b-pre — POCandidate.approvalPolicy String → ApprovalPolicy enum
--
-- 옵션 B 정합: schema 만 통일, application code 의 string literal 그대로
-- 호환 (Prisma 가 enum value 와 string literal 자동 매핑).
--
-- 다른 enum drift (POCandidate.approvalStatus String / guardrail.ts 의
-- "in_app_light" / quote-case-contract 의 "external_manual") 정합은 별도
-- cluster (§11.99 dead-capability-cleanup 후보) 분리.

-- 1) Create enum type
CREATE TYPE "ApprovalPolicy" AS ENUM ('none', 'in_app_approval', 'external_approval');

-- 2) Safety: invalid values → 'none' fallback (방어 — seed 는 'none' /
--    'in_app_approval' 만 사용하지만 history 데이터 보호)
UPDATE "POCandidate"
  SET "approvalPolicy" = 'none'
  WHERE "approvalPolicy" NOT IN ('none', 'in_app_approval', 'external_approval');

-- 3) Convert column type with USING cast (default 임시 제거 → 변환 → 재설정)
ALTER TABLE "POCandidate"
  ALTER COLUMN "approvalPolicy" DROP DEFAULT;

ALTER TABLE "POCandidate"
  ALTER COLUMN "approvalPolicy" TYPE "ApprovalPolicy"
  USING "approvalPolicy"::"ApprovalPolicy";

ALTER TABLE "POCandidate"
  ALTER COLUMN "approvalPolicy" SET DEFAULT 'none'::"ApprovalPolicy";
