-- §scan-registration-category (호영님 2026-09-04) — Product 분류 출처 축 신설.
--
-- 왜: 신규 품목 스캔 입고의 분류가 fallback(REAGENT)으로 채워진다. 그게 사람이 고른
--   값인지 기본값이 그냥 통과한 것인지 구분되지 않으면, 오염이 보이지 않는 채로 쌓인다
--   (호영님 조건 2). 나중에 "fallback 이 얼마나 무비판적으로 통과되는가" 를 실측하려면
--   근거가 canonical 에 있어야 한다.
--
--   categorySource = "USER_SELECTED" | "FALLBACK" (값 검증은 API 층 — smart-receiving POST).
--   Postgres enum 을 쓰지 않는다 — 이번 장애의 원인이 정확히 enum 불일치였고
--   (`"OTHER" as ProductCategory`), lotSource 선례도 TEXT + API 검증이다.
--
-- additive only: ADD COLUMN(nullable) 1. 기존 컬럼·CHECK·인덱스·데이터 무접촉.
--   null = 구 데이터(출처 미기록) — backfill 하지 않는다(지어내지 않는다).
--   기존 314행은 전부 null 로 남으며, 이 값이 없다고 읽기 경로가 깨지지 않는다.

ALTER TABLE "Product" ADD COLUMN "categorySource" TEXT;
