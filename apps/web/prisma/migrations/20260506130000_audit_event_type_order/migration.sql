-- #audit-event-type-order — AuditEventType enum 에 dedicated 3 value 추가.
--
-- #post-approval-purchase-order-flow cluster 의 audit cleanup. service /
-- 2 route 의 audit log 가 generic `SETTINGS_CHANGED` 재사용 → dedicated
-- enum 으로 의미 명확화 (audit UI filter / grep 정합).
--
-- IF NOT EXISTS = idempotent (PostgreSQL 9.6+). 직전
-- #approver-routing-event-type-enum-add 패턴 정합.

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ORDER_CREATED_FROM_POCANDIDATE';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PO_PDF_GENERATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'VENDOR_EMAIL_SENT';
