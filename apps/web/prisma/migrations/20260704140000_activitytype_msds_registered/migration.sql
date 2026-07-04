-- §msds-audit-versioning AV-P1 (호영님 2026-07-04) — ActivityType.MSDS_REGISTERED 추가.
--   MSDS 문서 실 등록의 감사(누가·언제) 로그용.
--
-- PostgreSQL ALTER TYPE ADD VALUE 주의(선례 20260505200000 동일):
--   - PG 13+ transaction 밖 실행(IF NOT EXISTS 지원)
--   - rollback 0 (enum 값 삭제 불가) — backward compat 보장(기존 caller 영향 0, additive)
--
-- ⚠ 적용 순서: migrate deploy → prisma generate → build (코드가 ActivityType.MSDS_REGISTERED 참조).
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'MSDS_REGISTERED';
