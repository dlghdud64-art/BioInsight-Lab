-- §11.209d-approver-routing — Workspace.approvalThresholdKrw 추가
--
-- 결재 임계치 (KRW). 이 금액 이상 결재 요청은 organization OWNER
-- escalation. default 10,000,000 (1,000만원). 직전
-- APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW 상수의 admin UI override.
--
-- backward compat:
--   - 모든 기존 Workspace 행은 default 10000000 자동 채움 (NOT NULL + DEFAULT)
--   - selectApproverByAmount 가 threshold 인자 미명시 시 helper 상수 fallback
--     (helper 자체 default 동일 = 10000000)

ALTER TABLE "Workspace"
  ADD COLUMN "approvalThresholdKrw" INTEGER NOT NULL DEFAULT 10000000;
