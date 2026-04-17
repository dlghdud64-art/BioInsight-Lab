-- Organization ↔ Workspace 1:1 bootstrap (옵션 B - Phase 1)
-- 설계 근거: docs/architecture/organization-workspace-bootstrap.md
--
-- 이 마이그레이션은 **nullable + UNIQUE** 컬럼을 추가한다.
-- PostgreSQL UNIQUE 제약은 NULL 값끼리 중복으로 간주하지 않으므로,
-- backfill 완료 전에도 기존 Workspace(모두 NULL) 상태에서 안전하게 적용된다.
-- backfill 스크립트 (scripts/backfill-organization-workspace.ts) 실행 완료 후,
-- Phase 2 마이그레이션에서 NOT NULL 로 승격한다.

-- AlterTable: nullable organizationId 추가
ALTER TABLE "Workspace" ADD COLUMN "organizationId" TEXT;

-- CreateUniqueIndex: 1:1 관계 enforcement (NULL 다중 허용)
CREATE UNIQUE INDEX "Workspace_organizationId_key" ON "Workspace"("organizationId");

-- AddForeignKey: Organization 삭제 시 Workspace 도 함께 삭제 (Cascade)
ALTER TABLE "Workspace"
  ADD CONSTRAINT "Workspace_organizationId_fkey"
  FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
