-- Organization ↔ Workspace 1:1 bootstrap (옵션 B - Phase 2)
-- 설계 근거: docs/architecture/organization-workspace-bootstrap.md
--
-- Phase 1 에서 이미 UNIQUE INDEX 를 걸었으므로, 이 마이그레이션은 NOT NULL 로만 승격한다.
--
-- ⚠️ 실행 전 필수 조건:
--   1) Phase 1 마이그레이션 적용 완료 (20260417120000_add_workspace_organization_id_nullable)
--   2) Backfill 스크립트 실행 완료 (scripts/backfill-organization-workspace.ts)
--      → Workspace.organizationId NULL 인 레코드가 0 건인 상태여야 한다.
--
-- Pre-flight check 쿼리 (Backfill 완료 검증용):
--   SELECT COUNT(*) FROM "Workspace" WHERE "organizationId" IS NULL;
--   → 0 건이 나와야 한다.

-- NULL 레코드가 남아 있으면 마이그레이션 실패시키기 (안전장치)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Workspace" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'Workspace.organizationId 에 NULL 이 남아 있습니다. backfill 을 먼저 완료하세요.';
  END IF;
END $$;

-- NOT NULL 승격 (UNIQUE 는 Phase 1 에서 이미 걸려 있음)
ALTER TABLE "Workspace" ALTER COLUMN "organizationId" SET NOT NULL;
