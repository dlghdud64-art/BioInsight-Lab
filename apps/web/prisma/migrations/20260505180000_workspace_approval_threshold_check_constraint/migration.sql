-- #approver-routing-cross-field-validation-db-check-constraint
--
-- 4-layer defense in depth 의 마지막 DB level lock — PostgreSQL CHECK
-- constraint. application-layer validation (form / zod refine / runtime
-- cross-field) 외 직접 SQL 또는 Prisma raw update 우회 차단.
--
-- 매트릭스 정합 (#approver-routing-multi-tier-threshold):
--   - low (< approvalLowThresholdKrw) → workspace_admin
--   - mid (low <= amount < approvalThresholdKrw) → org_admin
--   - high (amount >= approvalThresholdKrw) → org_owner
-- 따라서 approvalLowThresholdKrw <= approvalThresholdKrw 강제.
--
-- backward compat:
--   - 기존 Workspace rows 모두 default (low=1M, high=10M) 정합
--   - migration 적용 시 violation 0 보장 (default 1M ≤ 10M)
--
-- rollback path:
--   ALTER TABLE "Workspace" DROP CONSTRAINT "workspace_approval_threshold_low_le_high";
--
-- Prisma schema syntax 0 — schema.prisma 변경 0 (reader 정합 위해 모델
-- 안에 CHECK 명시 코멘트만).

ALTER TABLE "Workspace"
  ADD CONSTRAINT "workspace_approval_threshold_low_le_high"
  CHECK ("approvalLowThresholdKrw" <= "approvalThresholdKrw");
