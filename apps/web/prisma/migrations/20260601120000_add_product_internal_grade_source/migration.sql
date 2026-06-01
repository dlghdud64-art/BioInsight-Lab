-- §11.341 — 제품 등급 필드 분리 (자사 internalGrade vs 제조사 공인 grade)
--   grade: 제조사 공인 등급(HPLC/GMP/EP·USP/cell culture, §11.341 크롤링 대상) — 기존 필드 유지.
--   internalGrade: 자사 내부 등급(시약관리대장 A~E). 제품 본연 속성 아님(§11.337 Part D).
--   gradeSource: 공인등급 출처(제조사 카탈로그 URL/명, §11.335 출처 명시 정책).
-- 모두 nullable — 기존 데이터 영향 0. additive only.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "internalGrade" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "gradeSource" TEXT;
