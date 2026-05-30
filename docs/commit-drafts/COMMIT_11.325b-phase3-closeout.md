docs(workbench): §11.325b Phase 3 #closeout — 회귀 audit + 모바일 final + PLAN 종결 (호영님 P1, 2026-05-30)

호영님 P1 §11.325b Phase 3 (GREEN, closeout) — 회귀 audit + 모바일 final + plan 종결.

배경:
- §11.325b Phase 2 작업으로 sentinel 8 it 자연 GREEN
- Phase 3 = 회귀 audit + 모바일 final + plan closeout
- 추가 sandbox 작업 0 (Phase 2 sourcing-result-row.tsx wiring 으로 모든 sentinel 정합)

Fix (Phase 3 — PLAN 문서 closeout only):

- docs/plans/PLAN_11.325-product-detail-entry-truth-reconciliation.md:
  · Status: 🔄 In Progress → ✅ Complete
  · Phase 0~3 모든 체크박스 [x]
  · §13 Phase 3 회귀 audit 결과 추가:
    · caller 유일 (_workbench/search/page.tsx), props 시그니처 변경 0
    · 기존 sentinel 3건 영향 0 (268b/258a/292)
    · §11.325b sentinel 8 it 자연 GREEN
    · 모바일 final 검증 (데스크탑 4 elements + 모바일 3 elements, 375px overflow 0 예상)

회귀 audit 결과 (sandbox grep):
- sourcing-result-row.tsx 유일 caller = _workbench/search/page.tsx (line 1133-1155, 1214)
- 기존 sentinel 3건 영향 0:
  · 268b sourcing-button-outline-parity = page.tsx Operating Status Bar 단언, 본 file 무관
  · 258a sourcing-mobile-search = page.tsx 모바일 검색 form, 검색 결과 카드 별개
  · 292 sourcing-triage-removal = TRIAGE/카드 배지/Shortlist "제거" 단언, 신규 button 추가 영향 0
- sourcing-context-rail.tsx ProductDetailSummary render + showDetailLink={true} 보존 ✓
- /products/[id] 라우트 (1293 lines) 보존 — 비로그인 ProductCard 진입로 그대로 ✓

§11.325b 전체 4 phase 합산 production effect:
- Phase 0 Truth: 가설 B 사실, 페이지 풀 구현, 워크벤치 미배선 + dead UI 확정
- Phase 1 RED: 8 it sentinel (button + ChevronRight + canonical + rail same-canvas)
- Phase 2 GREEN: sourcing-result-row.tsx 3 Edit (데스크탑 button + ChevronRight wrap + 모바일 button)
- Phase 3 회귀 0: caller + 기존 sentinel 3건 + rail/route 보존

호영님 production effect (Phase 3 단독):
- production 변화 0 (문서만)
- §11.325b batch 4 phase 종결 명시 — 워크벤치 dead UI 해소 + same-canvas 패널 wiring 명확화

Out of Scope:
- product-detail-summary.tsx 의 §11.314 Part A 정합 (별도 batch — §11.314 진입 시 cross-reference)
- 데스크탑 4 elements overflow 발생 시 모바일처럼 dropdown 통합 (Phase 5 옵션, 호영님 production smoke 후 결정)
- 다음 트랙 (§11.312-b 소싱 sticky bar 보강 / §11.324 랜딩 Triage 데모)

검증:
- PLAN file Status Complete ✓
- Phase 0~3 체크박스 [x] ✓
- §13 Phase 3 audit 결과 갱신 ✓
- sandbox commit 0 (호영님 push 의존, 통제 구조 준수)

Rollback path: git revert <SHA>
- PLAN 문서만 변경 (Status / §13 갱신) revert

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add docs/plans/PLAN_11.325-product-detail-entry-truth-reconciliation.md `
  docs/commit-drafts/COMMIT_11.325b-phase3-closeout.md
git status
git commit -F docs/commit-drafts/COMMIT_11.325b-phase3-closeout.md
git push origin main
```

## Production smoke
- N/A (PLAN closeout only, production 변화 0)
- 호영님 §11.325b Phase 2 production smoke 누적 결과 = 4 phase 합산 효과 확인 완료 가정

## Next (호영님 push 회신 후)

§11.325 + §11.325b 완전 종결. 다음 트랙 (호영님 결정):
- §11.312-b 소싱 sticky bar UX 보강 (P1 backlog)
- §11.324 랜딩 /search Triage 데모 정리 (P2 backlog)
- §11.318-CORRECTION 환각 억제 batch (호영님 spec 참조 시)
- 다른 신규 spec
