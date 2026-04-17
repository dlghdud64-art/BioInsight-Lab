-- Organization ↔ Workspace 1:1 bootstrap (옵션 B - Phase 2)
-- 설계 근거: docs/architecture/organization-workspace-bootstrap.md
--
-- ⚠️ 실행 전 필수 조건:
--   1) Phase 1 마이그레이션 적용 완료 (20260417120000_add_workspace_organization_id_nullable)
--   2) Backfill 스크립트 실행 완료 (scripts/backfill-organization-workspace.ts)
--      → Workspace.organizationId NULL 인 레코드가 0 건인 상태여야 한다.
--
-- Pre-flight check 쿼리 (Backfill 완료 검증용):
--   SELECT COUNT(*) FROM "Workspace" WHERE "organizationId" IS NULL;
--   SELECT "organizationId", COUNT(*)
--   FROM "Workspace"
--   WHERE "organizationId" IS NOT NULL
--   GROUP BY "organizationId"
--   HAVING COUNT(*) > 1;
--   (두 쿼리 모두 0 건이 나와야 이 마이그레이션을 실행할 수 있다)

-- 1) NULL 레코드가 남아 있으면 마이그레이션 실패시키기 (안전장치)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Workspace" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'Workspace.organizationId 에 NULL 이 남아 있습니다. backfill 을 먼저 완료하세요.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Workspace"
    WHERE "organizationId" IS NOT NULL
    GROUP BY "organizationId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION '같은 organizationId 를 갖는 Workspace 가 여러 개입니다. 1:1 제약을 만들 수 없습니다.';
  END IF;
END $$;

-- 2) NOT NULL 승격
ALTER TABLE "Workspace" ALTER COLUMN "organizationId" SET NOT NULL;

-- 3) 기존 비-유니크 인덱스 제거 후 @unique 로 교체
DROP INDEX IF EXISTS "Workspace_organizationId_idx";
CREATE UNIQUE INDEX "Workspace_organizationId_key" ON "Workspace"("organizationId");
