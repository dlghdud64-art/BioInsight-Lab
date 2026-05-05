-- #approver-routing-event-type-enum-add
--
-- AuditEventType enum 에 결재 라우팅 dedicated values 추가:
--   - WORKSPACE_THRESHOLD_CHANGED — workspace 결재 임계치 변경 (low/high)
--   - PURCHASE_REQUEST_CREATED — PR INSERT + 결재 매핑 (source/appliedThresholds)
--
-- 직전 #approver-routing-audit-log 의 generic enum 재사용 (SETTINGS_CHANGED
-- / WORK_QUEUE_TASK_GENERATED) → dedicated enum 으로 swap. audit 의미 정합.
--
-- PostgreSQL ALTER TYPE ADD VALUE 주의:
--   - 13+ 부터 transaction 안 가능 (IF NOT EXISTS 지원)
--   - rollback 0 (DROP VALUE 미지원) — backward compat 보장 필요
--
-- backward compat:
--   - 직전 batch 의 SETTINGS_CHANGED + WORK_QUEUE_TASK_GENERATED 사용 caller
--     는 본 batch 에서 swap (workspace PATCH + request-approval). 다른 도메인
--     (USER / ORGANIZATION 등) caller 영향 0.

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'WORKSPACE_THRESHOLD_CHANGED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PURCHASE_REQUEST_CREATED';
