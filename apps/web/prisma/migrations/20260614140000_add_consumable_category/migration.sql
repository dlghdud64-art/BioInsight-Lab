-- §11.374 #master-catalog-import — ProductCategory 에 CONSUMABLE 추가 (소모품 55건 적재).
-- ⚠️ ALTER TYPE ... ADD VALUE 는 PG 에서 트랜잭션 밖 실행 필요. Prisma migrate 가
--    NonTransactional 로 처리(IF NOT EXISTS 로 멱등 — 재실행 안전).
-- A-track(DEV_RUNBOOK §9.5/9.7): shadow DB pgvector 이슈로 수동 폴더 + diff 사후 검증.

ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'CONSUMABLE';
