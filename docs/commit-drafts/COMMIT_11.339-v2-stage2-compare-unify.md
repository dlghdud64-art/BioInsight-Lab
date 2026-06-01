feat(sourcing): §11.339 v2 2단계 #compare-unify — 비교 일원화(탭위 strip 제거) + 비교함 품명 버그 (호영님 P1, 2026-06-01)

호영님 P1 §11.339 v2 2단계(GREEN) — 1단계(탭 카트) 위에 비교 액션 일원화 + 비교함
품명 placeholder 버그 수정.

배경 / 현상 (스크린샷 1780312007694):
- 탭 위 빨간 "비교 검토 활성/혼합 카테고리" 박스 + 비교함 탭 + 하단 바 "비교" = 비교 액션 3군데 경합.
- 비교함 탭 항목 대부분 "제품" placeholder(품명 미표시), 맨 아래 1개만 정상.

호영님 최종 결정 (2-3):
- 하단 바 "비교" 버튼 유지(견적과 짝, 익숙). 탭 위 박스 제거. 비교 = 비교함 탭 + 하단 바 일원화.

Fix (file 별):

- src/app/_workbench/search/page.tsx:
  · 2-3: 탭 위 "AI 비교 판단 상태 strip"(aiCompareReadiness 박스 + 비교 검토 CTA) 제거.
  · QuoteCartPanel 에 compareReadiness={aiCompareReadiness} + onCompareReview 전달
    → 비교 검토 상태/CTA 가 비교함 탭 상단으로 이동(일원화).
  · 2-4: compareItems 매핑에 getStoredName(compareStore) fallback.
    name: p?.name || storedName || "제품" — 현재 검색결과에 없는 비교 항목도 저장명 표시
    (이전: products lookup 실패 시 무조건 "제품" placeholder).

- src/app/_workbench/_components/quote-cart-panel.tsx (1단계 land + 2단계 prop):
  · 비교함 탭 상단 compareReadiness 카드(혼합 카테고리 §11.302 보더만) + "비교 검토" CTA.
  · cart-compare-readiness / cart-compare-review testid.

canonical truth / 제약:
- 비교 상태 = aiCompareReadiness(파생) 단일 소스. 비교함 탭 + 하단 바 진입(탭 위 중복 제거).
- 비교 항목 품명 = products(현재 검색) 우선, 없으면 compareStore 저장명(§11.339 v2 2-4).
- §11.302 색상(혼합경고 보더만, 전체 노랑 X). dead button 0.

production effect:
- 탭 위 빨간 비교 박스 사라짐 → 비교 검토는 비교함 탭 상단 + 하단 바.
- 비교함 탭이 실제 품명 표시("제품" placeholder 해소).

검증 (sandbox):
- sentinel quote-cart-v2-stage2-339v2.test.ts: strip 제거 + compareReadiness/onCompareReview 전달 +
  비교함 readiness/CTA + getStoredName fallback + 1단계 탭 보존. 전체 PASS.
- 2파일 brace/paren/eof 무결. ⚠️ search/page truncation 발견 → HEAD 복원 후 Python 원자치환 재적용
  (HEAD 3141 → 3118, strip 제거 순감 정상).
- 빌드 = 호영님 env.

Out of Scope (§11.339 v2 잔여 — 별도 batch):
- 4 검토필요 레이어 패턴 통일(중앙 모달 or 인라인) + 하단 노란 시트 제거 — Opus 4.8.
- 4-3 견적 요청 조립 "Cat. N/A" 버그(조립 모달 catalogNumber 전달) — 별도.
- 2-2 하단 드로어(SourcingCandidatesSheet) 완전 제거 — 병존 유지(같은 quoteItems 소스).

Rollback path: git revert <SHA>
- strip 복원, compareReadiness/getStoredName 제거.

## Push
```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
cd apps\web; npx next build
cd ..\..
git add apps/web/src/app/_workbench/search/page.tsx `
  apps/web/src/app/_workbench/_components/quote-cart-panel.tsx `
  apps/web/src/__tests__/regression/quote-cart-v2-stage2-339v2.test.ts `
  docs/commit-drafts/COMMIT_11.339-v2-stage2-compare-unify.md
git commit -F docs/commit-drafts/COMMIT_11.339-v2-stage2-compare-unify.md
git push origin main
```

## Production smoke (호영님 env — 배포 후)
1. 비교 2+ 담기 → 탭 위 빨간 박스 없음. 비교함 탭 상단에 "비교 검토 활성" + CTA.
2. 비교함 탭 항목 = 실제 품명(다른 검색에서 담은 것도 "제품" 아님).
3. 하단 바 "비교 N" 버튼 유지.
4. 혼합 카테고리 → 비교함 탭 상단 노란 보더(전체 배경 X).

## Next
- §11.339 v2 잔여(4 검토필요 레이어 / 4-3 Cat.N/A) = 별도 Opus 4.8.
- §11.342 소싱 라벨스캔→검색 = 별도 P1.
