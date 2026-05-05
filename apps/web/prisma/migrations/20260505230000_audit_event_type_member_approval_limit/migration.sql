-- #approver-routing-per-user-limit-audit-log
--
-- AuditEventType enum 에 dedicated value 추가:
--   - MEMBER_APPROVAL_LIMIT_CHANGED — workspace member 결재 한도 변경
--
-- 직전 #approver-routing-event-type-enum-add 의 패턴 정합:
--   - WORKSPACE_THRESHOLD_CHANGED (workspace 임계치)
--   - PURCHASE_REQUEST_CREATED (결재 매핑)
--
-- backward compat:
--   - 기존 caller 영향 0 (새 value 추가만)
--   - rollback 0 (PostgreSQL DROP VALUE 미지원)

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'MEMBER_APPROVAL_LIMIT_CHANGED';
