fix(sourcing): §11.339 v2 5 #drawer-removed — 하단 드로어 완전 제거 → 우측 탭 카트 일원화 (호영님 P1, 2026-06-01)

호영님 P1 §11.339 v2 5 — 하단 SourcingCandidatesSheet(견적/비교/검토 드로어) 완전 제거.
우측 견적함/비교함 탭(QuoteCartPanel)이 같은 내용 상시 표시 → 드로어 중복.

배경 / 현상 (호영님 스크린샷 2026-06-01):
- 우측 QuoteCartPanel(견적함 탭+수량+인라인경고)은 배포·표시됨(§11.339 v2 1·2·4 READY 확인).
- 그러나 하단 바 "견적 N"/"비교 N" 클릭 시 옛 하단 드로어가 그대로 뜸(삭제돼야 할 중복) → 호영님 "하단 클릭 동일" 지적.
- §11.339 v2 4 는 review mode 진입만 제거, compare/quote mode 드로어는 "병존"으로 남겼던 미완분.

호영님 결정: 하단 드로어 완전 제거.

Fix (file 별):

- src/app/_workbench/_components/quote-cart-panel.tsx:
  · forceCompareKey prop + useEffect(forceCompareKey → setTab("compare")) 추가
    (forceQuoteKey 와 대칭 — 하단 바 "비교 N" → 비교함 탭).

- src/app/_workbench/search/page.tsx:
  · 하단 바 "비교 N" onClick: setCandidatesSheetMode("compare") → setCompareFocusKey(k+1)(비교함 탭 전환).
  · 하단 바 "견적 N" onClick: setCandidatesSheetMode("quote") → setQuoteFocusKey(k+1)(견적함 탭 전환).
  · quoteFocusKey/compareFocusKey state 추가. forceQuoteKey=(reviewFocusKey+quoteFocusKey),
    forceCompareKey=compareFocusKey 로 QuoteCartPanel 연결.
  · <SourcingCandidatesSheet ... /> 렌더 제거(2438자). setCandidatesSheetMode 트리거 0.

canonical truth / 제약:
- 견적/비교/검토 단일 경로 = 우측 QuoteCartPanel 탭(상시). 하단 바 = 건수 표시 + 탭 진입 트리거.
- same-canvas(우측 패널). 하단 드로어 레이어 제거 → 난립 0.
- dead button 0(하단 바 클릭 → 우측 탭 전환 real). §11.302/§11.338 보존.

production effect:
- 하단 "견적 N" 클릭 → 우측 견적함 탭. "비교 N" → 비교함 탭. "검토 N" → 견적함 탭(인라인 경고).
- 하단 드로어 안 뜸(중복 해소). 모든 카트 동작이 우측 패널 한 곳에서.

검증 (sandbox):
- sentinel drawer-removed-339v2-5.test.ts: Sheet 렌더/트리거 제거 + 하단 바 탭 전환 wiring +
  패널 forceCompareKey + 우측 탭 보존. 전체 PASS.
- 2파일 brace/paren/eof 무결. truncation 0(search -47 = Sheet 블록 제거).
- 빌드 = 호영님 env.

Out of Scope:
- candidatesSheetMode state + SourcingCandidatesSheet import 잔존(미사용 — lint 경고만, 빌드 통과).
  완전 제거는 별도 cleanup(다른 참조 안전 확인 후).
- §11.343 디자인 고도화(위계/접힘/토큰) — 별도 Opus 4.8.

Rollback path: git revert <SHA>
- 하단 바 onClick setCandidatesSheetMode 복원 + Sheet 렌더 복원.

## Push
```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
cd apps\web; npx next build
cd ..\..
git add apps/web/src/app/_workbench/search/page.tsx `
  apps/web/src/app/_workbench/_components/quote-cart-panel.tsx `
  apps/web/src/__tests__/regression/drawer-removed-339v2-5.test.ts `
  docs/commit-drafts/COMMIT_11.339-v2-5-drawer-removed.md
git commit -F docs/commit-drafts/COMMIT_11.339-v2-5-drawer-removed.md
git push origin main
```

## Production smoke (호영님 env — 배포 후)
1. 견적 담기 → 하단 "견적 N" 클릭 → 하단 드로어 안 뜸, 우측 견적함 탭 활성.
2. 비교 담기 → 하단 "비교 N" 클릭 → 우측 비교함 탭 활성.
3. "검토 N" 클릭 → 우측 견적함 탭(인라인 경고).
4. 하단 노란 시트/드로어 완전히 안 뜸.

## Next
- §11.343 디자인 고도화(위계/progressive disclosure/토큰) — Opus 4.8.
- candidatesSheetMode/import 미사용 cleanup — 별도.
