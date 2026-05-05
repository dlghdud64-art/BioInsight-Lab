-- #approver-routing-multi-owner-roundrobin — lastApprovalAssignedAt 추가
--
-- WorkspaceMember + OrganizationMember 양쪽에 마지막 결재 할당 timestamp
-- 추가. helper 가 orderBy lastApprovalAssignedAt asc (nulls first) +
-- createdAt asc tie-breaker — round-robin 분산 lock.
--
-- backward compat:
--   - 모든 기존 행은 default null (한 번도 안 받음 → 우선 매핑)
--   - request-approval route 가 PR INSERT 후 candidate 의 본 field update

ALTER TABLE "WorkspaceMember"
  ADD COLUMN "lastApprovalAssignedAt" TIMESTAMP(3);

ALTER TABLE "OrganizationMember"
  ADD COLUMN "lastApprovalAssignedAt" TIMESTAMP(3);
