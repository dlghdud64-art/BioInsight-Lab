-- #approver-routing-per-user-limit Phase 1 — WorkspaceMember.approvalLimit 추가
--
-- 단일 건 결재 한도 (KRW). null = 무제한 (default). amount > approvalLimit
-- 시 selectApproverByAmount 가 다음 tier fallback (low → mid → high
-- escalation).
--
-- backward compat:
--   - 모든 기존 WorkspaceMember 행은 default null (무제한) — 영향 0
--   - 직전 매트릭스 (low/mid/high) 보존
--
-- rollback path:
--   ALTER TABLE "WorkspaceMember" DROP COLUMN "approvalLimit";

ALTER TABLE "WorkspaceMember"
  ADD COLUMN "approvalLimit" INTEGER;
