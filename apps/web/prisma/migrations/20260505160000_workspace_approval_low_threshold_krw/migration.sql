-- #approver-routing-multi-tier-threshold — Workspace.approvalLowThresholdKrw 추가
--
-- 3 tier 매트릭스의 중액/저액 구분 임계치 (KRW). default 1,000,000 (100만원).
-- 직전 #approver-routing-threshold-admin-ui 의 approvalThresholdKrw (default
-- 10M) 와 함께 정합:
--   - amount < approvalLowThresholdKrw → workspace_admin (low tier)
--   - low <= amount < approvalThresholdKrw → org_admin (mid tier)
--   - amount >= approvalThresholdKrw → org_owner (high tier)
--
-- backward compat:
--   - 모든 기존 Workspace 행은 default 1000000 자동 채움 (NOT NULL + DEFAULT)
--   - 직전 batch caller (single threshold) 호환 — helper 의 threshold alias 가
--     highThreshold 로 매핑

ALTER TABLE "Workspace"
  ADD COLUMN "approvalLowThresholdKrw" INTEGER NOT NULL DEFAULT 1000000;
