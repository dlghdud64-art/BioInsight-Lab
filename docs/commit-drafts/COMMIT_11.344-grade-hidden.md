fix(sourcing): §11.344 #grade-hidden — 자사 Grade(A~E) 소싱 UI 표시 제거 (호영님 P1, 2026-06-01)

호영님 P1 §11.344 — 검색 카드/우측 패널의 자사 Grade(A~E) 노출 제거. 데이터 보존.

배경 / 현상 (스크린샷 1780319430049):
- 검색 카드에 "Capricorn · Cat. PBS-1A · 시약 · E" 처럼 자사 Grade(A~E) 노출.
- Grade A~E = 호영님 회사 시약관리 자사 기준 — 제품 본연 속성 아님. 타 사용자엔 무의미 + 오해 소지.
- §11.337 Part D 로 묶였으나 미적용 → 단순 표시 제거라 분리 발행.

Fix (file 별):

- src/app/_workbench/_components/sourcing-result-row.tsx (buildStaticMeta):
  · `else if (product.grade) parts.push(product.grade)` 제거. specification 만 보조 메타로.
  · 분류(PRODUCT_CATEGORIES[product.category]) push 는 보존.

- src/app/_workbench/_components/product-detail-summary.tsx:
  · 우측 패널 "Grade" 렌더 블록(data.grade && ...) 제거.
  · empty 조건에서 grade 항목 제거(분류 유지). data.grade 매핑(48)은 보존(렌더만 제거).

canonical truth / 제약:
- 데이터 보존: product.grade(DB/seed)는 삭제 0 — 내부 참조용. UI 노출만 제거.
- 분류(시약/기구/소모품) 표시 유지. §11.302 무관(텍스트 제거).
- §11.341 내부등급 분리(internalGrade)는 migration 선행 보류 중 — 본 건은 현 grade 필드 UI 비노출만.

production effect:
- 검색 카드: "Capricorn · Cat. PBS-1A · 시약 · E" → "Capricorn · Cat. PBS-1A · 시약".
- 우측 패널: Grade 항목 사라짐. 분류/스펙은 유지.

검증 (sandbox):
- sentinel grade-hidden-344.test.ts: 카드/패널 grade 렌더 제거 + 분류 보존. 전체 PASS.
- 2파일 brace/paren 무결. truncation 0(row 동일, panel -7 = Grade 블록 제거).
- 빌드 = 호영님 env.

Out of Scope:
- DB/seed grade 데이터 삭제(보존). §11.341 internalGrade 분리(별도, migration 선행).
- 다른 화면(재고/비교 테이블)의 grade — 소싱 검색 범위만.

Rollback path: git revert <SHA>
- buildStaticMeta grade push + 패널 Grade 블록 복원.

## Push
```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
cd apps\web; npx next build
cd ..\..
git add apps/web/src/app/_workbench/_components/sourcing-result-row.tsx `
  apps/web/src/app/_workbench/_components/product-detail-summary.tsx `
  apps/web/src/__tests__/regression/grade-hidden-344.test.ts `
  docs/commit-drafts/COMMIT_11.344-grade-hidden.md
git commit -F docs/commit-drafts/COMMIT_11.344-grade-hidden.md
git push origin main
```

## Production smoke (호영님 env — 배포 후)
1. 검색 → 카드에 "시약 · E" 같은 Grade 사라짐. "시약"만.
2. 상세 패널에 Grade 항목 없음. 분류/스펙은 유지.
