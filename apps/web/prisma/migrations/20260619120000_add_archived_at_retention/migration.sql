-- §pricing-refresh P3 — 데이터 보존 entitlement (soft 아카이브 컬럼)
-- Quote·Order·ProductInventory 에 archivedAt(nullable) 추가. null=활성/노출, 값=아카이브(숨김).
-- additive·비파괴: nullable + default 없음 → 기존 행 전부 NULL(활성 보존). 데이터 손실 0.
--
-- 적용 경위(2026-06-19): operator-shell 에서 raw ADD COLUMN IF NOT EXISTS 로 prod 선적용 후 본 파일 기록.
--   schema engine RPC 미가용 환경이라 prisma migrate deploy 대신 멱등 raw ALTER 사용(§9.9 shadow 미사용).
--   _prisma_migrations 는 미기록 — 다음 정상 prisma 환경 `migrate deploy` 가 IF NOT EXISTS 로 멱등 재적용(skip)
--   + 자동 기록. 그래서 IF NOT EXISTS 필수(재적용 안전).
ALTER TABLE "Quote"            ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Order"            ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "ProductInventory" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
