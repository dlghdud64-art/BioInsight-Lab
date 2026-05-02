-- §11.193d Phase 2 #organization-member-workflow-capabilities
-- OrganizationMember 모델에 workflow capabilities 추가:
--   workflowCapabilities (Json) — 운영 tag (LAB_MANAGER / APPROVER / REQUESTER)
--
-- 호영님 prototype 시안: "1인 동시 Lab Manager + Approver + Requester 보유".
-- RBAC role 과 별도 layer — permission-checker 변경 0.
--
-- 값 whitelist + parser: lib/permissions/workflow-capabilities.ts
--   - WORKFLOW_CAPABILITIES const (3종)
--   - getWorkflowCapabilities() defensive parse
--
-- backfill 은 §11.193d Phase 2.2 별도 script (scripts/backfill-workflow-capabilities.ts).
-- 본 migration 은 column 추가만 — 모든 기존 row 는 default `[]` (resolver fallback 사용).

ALTER TABLE "OrganizationMember"
  ADD COLUMN "workflowCapabilities" JSONB NOT NULL DEFAULT '[]'::jsonb;
