-- §SM-S1 P1 (호영님 2026-07-05) — Organization.safetyCategories(안전 MSDS 관리 대상 카테고리).
--   additive·무회귀: 기존 org 전부 기본값 ["REAGENT"] 자동 부여(화학물질 확정). 데이터 손실 0.
--
-- 🛑 파괴적 명령 없음. 세션 pooler 5432 로 migrate deploy(dry-run→"진행" 후).
ALTER TABLE "Organization" ADD COLUMN "safetyCategories" TEXT[] NOT NULL DEFAULT ARRAY['REAGENT']::TEXT[];
