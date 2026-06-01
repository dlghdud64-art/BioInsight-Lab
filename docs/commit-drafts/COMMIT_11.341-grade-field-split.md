feat(schema): §11.341 1단계 #grade-field-split — 자사 internalGrade vs 제조사 공인 grade 분리 (호영님 P2, 2026-06-01)

호영님 P2 §11.341 1단계 — 제품 등급 필드 충돌(자사 A~E가 공인등급 grade 점유) 해소.
크롤링 본체(공인등급 외부수집)는 정책 미정 → 별도. 본 커밋은 필드 분리 + import 정합만.

배경 / 진단:
- §11.337 Part D: 자사 Grade(A~E, 시약관리대장 회사 내부기준) UI 제거 결정 — 제품 본연 속성 아님.
- §11.341: 제조사 공인 등급(ACS/HPLC/분자생물학급 등)은 가치 있음 → 크롤링 대상.
- 충돌 발견: Product.grade 필드 주석 = 공인등급용("HPLC grade/GMP/EP·USP")인데
  §11.336-data import 가 여기 자사 A~E(A6/B23/C12/D30/E13) 투입 → 같은 필드 오용.
- 호영님 결정: 별도 필드 분리(grade=공인등급 환원, 자사 A~E=internalGrade 신규).

Fix (file 별):

- prisma/schema.prisma (Product):
  · grade 주석 환원 → "제조사 공인 등급(HPLC/GMP/EP·USP/cell culture, §11.341 크롤링 대상)".
  · internalGrade String? 신규 — 자사 내부 등급(A~E, 시약관리대장).
  · gradeSource String? 신규 — 공인등급 출처(제조사 카탈로그 URL/명, §11.335 출처 명시 정책).
  · 모두 nullable, additive — 기존 데이터 영향 0.

- prisma/migrations/20260601120000_add_product_internal_grade_source/migration.sql (신규):
  · ALTER TABLE Product ADD COLUMN IF NOT EXISTS internalGrade/gradeSource TEXT.
  · operator-shell 수동 적용(Vercel prebuild NO-OP, §11.326 packsize 패턴).

- scripts/import-catno-master.ts:
  · 신규 Product 생성 시 grade: p.grade → internalGrade: p.grade (A~E 는 자사등급).
  · prepared.json 은 그대로(p.grade 에 A~E) — import 매핑만 internalGrade 로 전환.

canonical truth / 제약:
- grade = 제조사 공인 등급(외부 검증값, §11.341 크롤링 시 gradeSource 기록).
- internalGrade = 자사 A~E(§11.337 Part D 정책상 UI 비노출 대상 — UI 변경은 별도).
- §11.335 출처 명시: 크롤링 공인등급은 gradeSource 필수(추정 금지).

production effect:
- 스키마 2필드 추가(데이터 영향 0). import 재실행 시 A~E 가 internalGrade 로 정확히 들어감.
- grade 필드가 공인등급 전용으로 비워져 §11.341 크롤링 본체 준비 완료.

검증 (sandbox):
- 스키마 internalGrade/gradeSource 추가 + grade 주석 환원 확인.
- import 스크립트 internalGrade: p.grade 매핑 확인(grade 오용 제거).
- migration SQL additive(IF NOT EXISTS) — 기존 데이터 무손실.
- 빌드/migration = 호영님 env(operator-shell prisma migrate deploy).

Out of Scope (§11.341 본체 = 별도, 정책 미정):
- 크롤링 파이프라인(어떤 공인등급/출처 우선순위/robots.txt·ToS) — 호영님 결정 1·2·3 대기.
- §11.337 Part D UI 제거(자사 grade 노출 제거) — 별도 UI 작업.
- 이미 import 된 prod 데이터의 grade→internalGrade 이전(재import 또는 UPDATE 스크립트 — apply 시점 판단).

⚠️ 순서 주의:
- 본 migration(필드 추가)을 호영님 env 에 먼저 적용해야 import 스크립트의 internalGrade 가 동작.
- §11.336-data import 를 아직 --apply 안 했으면: migration → import(internalGrade 정합) 순.
- 이미 --apply 했으면: migration 후 기존 A~E grade 를 internalGrade 로 옮기는 UPDATE 별도 필요(아래).

## 실행 (호영님 env, operator-shell)
```powershell
cd C:\Users\young\ai-biocompare\apps\web
# 1) migration 적용 (필드 추가)
npx prisma migrate deploy
npx prisma generate
# 2) (아직 import 안 한 경우) import = internalGrade 자동 정합
npx tsx scripts/import-catno-master.ts          # dry-run
npx tsx scripts/import-catno-master.ts --apply
# 2') (이미 import 해서 grade 에 A~E 들어간 경우) 이전 UPDATE:
#   UPDATE "Product" SET "internalGrade" = "grade", "grade" = NULL
#   WHERE "grade" IN ('A','B','C','D','E');
```

## Push
```powershell
cd C:\Users\young\ai-biocompare
git add apps/web/prisma/schema.prisma `
  apps/web/prisma/migrations/20260601120000_add_product_internal_grade_source/migration.sql `
  apps/web/scripts/import-catno-master.ts `
  docs/commit-drafts/COMMIT_11.341-grade-field-split.md
git commit -F docs/commit-drafts/COMMIT_11.341-grade-field-split.md
git push origin main
```

## Next (§11.341 본체 — 호영님 정책 결정 후)
1. 어떤 공인등급(순도 ACS/HPLC / 용도 분자생물학급·세포배양급)?
2. 출처 우선순위(제조사 공식만 vs 유통사도)?
3. robots.txt/ToS + 제조사 API 우선 → Cat.No 기반 크롤링 PoC.
- §11.337 Part D UI: 자사 grade 노출 제거(internalGrade 는 admin/감사용만).
