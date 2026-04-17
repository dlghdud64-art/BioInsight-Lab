-- Organization ↔ Workspace 1:1 bootstrap (옵션 B - Phase 1)
-- 설계 근거: docs/architecture/organization-workspace-bootstrap.md
--
-- 이 마이그레이션은 **nullable** 컬럼만 추가한다.
-- backfill 스크립트 (scripts/backfill-organization-workspace.ts) 실행 완료 후,
-- Phase 2 마이그레이션에서 NOT NULL + @unique 로 승격한다.

-- AlterTable: nullable organizationId 추가
ALTER TABLE "Workspace" ADD COLUMN "organizationId" TEXT;

-- CreateIndex (조회 성능; Phase 2 에서 @unique 로 대체됨)
CREATE INDEX "Workspace_organizationId_idx" ON "Workspace"("organizationId");

-- AddForeignKey: Organization 삭제 시 Workspace 도 함께 삭제 (Cascade)
ALTER TABLE "Workspace"
  ADD CONSTRAINT "Workspace_organizationId_fkey"
  FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
