-- #approver-routing-per-user-limit-organization-member Phase 1 server —
-- OrganizationMember.approvalLimit 추가
--
-- 단일 건 결재 한도 (KRW). null = 무제한 (default). amount > approvalLimit
-- 시 selectApproverByAmount 가 다음 fallback (org_owner → org_admin →
-- workspace_admin chain).
--
-- 직전 WorkspaceMember.approvalLimit (Phase 1) 와 동일 패턴.
--
-- backward compat:
--   - 모든 기존 OrganizationMember 행은 default null (무제한)
--   - 직전 helper logic (org member 한도 검증 0) 영향 0 — 신규 OR clause
--     가 추가되지만 null candidate 도 통과
--
-- rollback path:
--   ALTER TABLE "OrganizationMember" DROP COLUMN "approvalLimit";

ALTER TABLE "OrganizationMember"
  ADD COLUMN "approvalLimit" INTEGER;
