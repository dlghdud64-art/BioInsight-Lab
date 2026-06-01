fix(sourcing): §11.339 v2 4 #review-inline-unify — 검토필요 하단 노란시트 진입 제거 → 견적함 인라인 일원화 (호영님 P1, 2026-06-01)

호영님 P1 §11.339 v2 4 (GREEN) — 검토 필요가 하단 노란 시트(SourcingCandidatesSheet review
mode)로 뜨던 패턴 제거. 견적함 탭 인라인(cart-review-inline)으로 일원화.

배경 / 현상 (스크린샷 1780312044679):
- 검토 필요 = 하단 전체 노란 시트(슬라이드업), 견적 요청 조립(중앙 모달)과 패턴 불일치 + §11.302 위반.
- §11.339 v2 1·2단계에서 검토 인라인(QuoteCartPanel)은 구현했으나 하단 시트 진입(하단 바 검토 버튼)을
  제거 안 함("병존") → 노란 시트가 그대로 노출. = 실제 미구현분(솔직 보고).

호영님 결정: 옵션 B (견적함 인라인 = 별도 레이어 제거).

Fix (search/page.tsx + quote-cart-panel.tsx):
- 하단 바 "검토 N" 버튼: onClick setCandidatesSheetMode("review")(노란 시트) 제거.
- 대신 배지 클릭 → setReviewFocusKey(k+1) → QuoteCartPanel forceQuoteKey → 견적함 탭 전환.
  (호영님 "검토 진입 안 됨" 피드백 반영: 비클릭 배지는 dead-feel → 견적함 탭으로 라우팅.)
- QuoteCartPanel: forceQuoteKey prop + useEffect(forceQuoteKey → setTab("quote")) 추가.
- setCandidatesSheetMode("review") 트리거 0 (compare/quote 모드 Sheet 는 보존 — review 진입만 차단).
- 검토 실동작 = 견적함 탭 인라인(cart-review-inline + resolve/keep). 배지 = 탭 진입 + 건수.

canonical truth / 제약:
- 검토 필요 단일 경로 = 견적함 탭 인라인(cart-review-inline + resolve/keep 액션). §11.339 v2 1단계 구현분.
- §11.302: 하단 전체 노란 시트 제거. 인라인은 좌측 보더 + ⚠ 배지만.
- dead button 0(배지는 건수 표시, 액션은 인라인). SourcingCandidatesSheet compare/quote 모드 보존.

production effect:
- 검토 필요 클릭 시 하단 노란 시트 안 뜸. 견적함 탭 해당 항목 아래 인라인 경고 + [재고확인][유지].
- 하단 바 "검토 N" 배지는 건수만 표시(견적함 탭에서 처리 안내 title).

검증 (sandbox):
- sentinel review-inline-unify-339v2-4.test.ts: review 트리거 0 + 건수 배지(비클릭) + 인라인/액션 보존 +
  reviewFlags/onResolveReview 연결. 전체 PASS.
- search/page brace/paren/eof 무결. ⚠️ Edit 툴 truncation 재발 → HEAD 복원 후 Python 원자치환
  (3119→3118, review 버튼 교체 순감 정상).
- 빌드 = 호영님 env.

Out of Scope (§11.339 v2 잔여):
- 4-3 견적 요청 조립 "Cat. N/A" 버그(조립 모달 catalogNumber 전달) — 별도.
- §11.343 견적함 패널 디자인 고도화(위계/progressive disclosure/토큰) — Opus 4.8 별도.
- SourcingCandidatesSheet review mode 코드 자체 삭제(진입 0이라 dead path, 정리는 별도).

Rollback path: git revert <SHA>
- 하단 바 검토 버튼 onClick + review mode 트리거 복원.

## Push
```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
cd apps\web; npx next build
cd ..\..
git add apps/web/src/app/_workbench/search/page.tsx `
  apps/web/src/__tests__/regression/review-inline-unify-339v2-4.test.ts `
  docs/commit-drafts/COMMIT_11.339-v2-4-review-inline.md
git commit -F docs/commit-drafts/COMMIT_11.339-v2-4-review-inline.md
git push origin main
```

## Production smoke (호영님 env — 배포 후)
1. 검토 필요 있는 견적 후보 → 하단 노란 시트 안 뜸.
2. 견적함 탭 해당 항목 아래 인라인 경고(좌측 보더+⚠) + [재고확인][유지].
3. 하단 바 "검토 N" 배지 = 건수만(클릭해도 시트 안 뜸).

## Next
- §11.343 디자인 고도화(위계/접힘/토큰) — 구조 안정 후 Opus 4.8.
- 4-3 Cat.N/A — 별도.
