feat(workbench): §11.312-b #clear-all-confirm — "전체 해제" 별도 줄 → bar 본체 🗑 + AlertDialog 확인 다이얼로그 (호영님 P1, 2026-05-30)

호영님 P1 §11.312-b (구 spec §11.306 보강) — 데스크탑 sticky bar "전체 해제" 위치 정리.

배경 (Phase 0 Truth audit):
- §11.312 1차 작업 = sandbox 사실상 완료 (PLAN_11.312-sourcing-bar-ux.md stale, 실제 (1)~(6) 모두 wiring 완료)
- 호영님 spec 5번 = 데스크탑 "전체 해제 별도 줄" → bar 본체 🗑 통합 + 확인 다이얼로그
- 다른 spec 이슈 A (개별 삭제) / B (검토 dead button) / C (bar 정보 강화) = §11.312 1차 sandbox 완료
- §11.312-b 실제 잔여 = 데스크탑 보강 only

현재 sandbox 문제 (line 1565-1575):
- "전체 해제" 별도 줄(border-t white/15 + ghost button h-7 px-2 text-slate-500)
- bar 본체와 분리, 우측 끝 회색 텍스트 → primary CTA 옆 오탭 위험
- CLAUDE.md "파괴적 액션 = primary CTA 와 분리 + 확인 다이얼로그" 원칙 위반

Fix (Phase 2 — _workbench/search/page.tsx 단일 file 1 Edit):

- apps/web/src/app/_workbench/search/page.tsx:

  · 견적 bar 본체 ml-auto 영역 swap (line 1545-1575):
    · 옛: `<div className="ml-auto flex items-center gap-2 shrink-0">` + ₩{totalAmount} + primary CTA + 별도 줄 `<div border-t border-white/15>` 전체 해제 ghost button
    · 신: `<div className="ml-auto flex items-center gap-3 shrink-0">` + ₩{totalAmount} + AlertDialog wrap Trash2 button + primary CTA (별도 줄 제거)

  · 🗑 Trash2 button 신설 (totalAmount 뒤, primary CTA 앞 — 호영님 spec "견적 금액과 primary CTA 사이"):
    · `data-testid="sourcing-bar-clear-all-trigger"`
    · `aria-label="견적 후보 전체 해제"`
    · variant="outline" + `h-8 w-8 p-0` 정사각 + `border-slate-200/40 bg-slate-700/40 text-slate-300 hover:bg-slate-600/60 hover:text-slate-100`
    · 시각 대비: 🗑 dark outline vs primary CTA `bg-emerald-600` filled
    · `gap-3` (옛 gap-2) 으로 시각 분리 강화

  · AlertDialog 확인 다이얼로그:
    · 제목: "견적 후보를 모두 해제할까요?"
    · 설명: "견적 후보 {quoteItems.length}건{ + 비교 후보 {compareIds.length}건 if > 0 }이 모두 해제됩니다. 개별 항목 삭제는 '견적' 또는 '비교' 영역을 탭하여 시트에서 가능합니다."
    · 취소: AlertDialogCancel "취소"
    · 확인: AlertDialogAction `bg-red-600 hover:bg-red-700` "모두 해제" → clearCompare() + quoteItems.forEach(removeQuoteItem)

  · 별도 줄 제거 (line 1565-1575 div + Button 전체 삭제):
    · 옛 ghost variant "전체 해제" 사라짐
    · `border-t border-white/15` 패턴 제거
    · 주석 명시: "옛 '전체 해제 별도 줄' 제거. 견적 bar 본체 안 🗑 으로 통합."

  · `gap-2 → gap-3` 변경 (line 1545):
    · ₩totalAmount + 🗑 + primary CTA 3 elements 간 시각·물리적 분리 확보

canonical 보존 (회귀 0):
- SourcingCandidatesSheet wiring 보존 (§11.312 1차):
  · setCandidatesSheetMode("compare"/"quote"/"review") 3 button
  · onRemoveCompare / onRemoveQuoteItem / onClearCompare / onClearQuote / onClearReviewFlag
- §11.312 1차 미리보기 truncate max-w-[140px] 보존
- §11.302 색상 정합 yellow-100 검토 배지 보존
- primary CTA (견적 요청서 만들기 / 견적 요청 조립) bg-emerald-600 보존
- handleProtectedAction wiring 보존 (setWorkWindowMode / setRequestWizardOpen)
- 비교 bar (compareIds > 0) 보존, 별도 🗑 추가 0 (호영님 spec 5번 견적 bar 만 명시)
- clearCompare + quoteItems forEach removeQuoteItem 양쪽 clear 동작 보존
- AlertDialog import (line 97-101) + Trash2 import (line 11) 기존 import 활용, 신규 import 0

Phase 1 sentinel GREEN 전환 (8 it):
- 별도 줄 div 잔존 0 (border-t border-white/15 + 전체 해제) ✓
- ghost variant + slate-500 hover:red-500 패턴 잔존 0 ✓
- sourcing-bar-clear-all-trigger testid ✓
- AlertDialog 안 "모두 해제" 문구 ✓
- clearCompare + quoteItems.forEach + removeQuoteItem ✓
- canonical: SourcingCandidatesSheet + 3 mode + truncate + yellow + emerald CTA 보존 ✓

호영님 production effect:
1. "전체 해제" 별도 줄 사라짐 — 모바일/데스크탑 모두 깔끔.
2. 🗑 Trash2 = 견적 bar 본체 안 견적 금액과 primary CTA 사이 명시.
3. 🗑 outline (dark slate) vs primary CTA filled (emerald) 시각 대비 — 오탭 위험 ↓.
4. 🗑 탭 → AlertDialog 확인 다이얼로그 — 파괴적 액션 보호.
5. 개별 항목 삭제 = 시트(§11.312 1차)로 안내, 양쪽 clear 동작 보존.
6. CLAUDE.md "파괴적 액션 = primary CTA 와 분리 + 확인" 원칙 정합.

Out of Scope (Phase 3):
- 회귀 audit + PLAN closeout (Phase 3)
- 비교 bar 별도 🗑 (호영님 spec 5번 견적 bar 만, scope 최소화)
- 모바일 sticky bar 별도 처리 (현재 view 자체가 비교/견적 bar 양쪽 모바일 정합)

검증 (sandbox 정적 grep):
- "전체 해제 별도 줄" 잔존 0
- sourcing-bar-clear-all-trigger 신규 testid ✓
- AlertDialog 안 "모두 해제할까요?" / "모두 해제" 문구 ✓
- gap-3 적용 + ml-auto 보존 ✓
- §11.312 1차 wiring 영향 0 ✓

Rollback path: git revert <SHA>
- 옛 ml-auto gap-2 + 별도 줄 ghost button 복원 (단일 file)
- sentinel 삭제

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/app/_workbench/search/page.tsx `
  apps/web/src/__tests__/regression/sourcing-bar-clear-all-confirm-312b.test.ts `
  docs/plans/PLAN_11.312-sourcing-bar-ux.md `
  docs/plans/PLAN_11.312-b-sourcing-bar-ux-refinement.md `
  docs/commit-drafts/COMMIT_11.312-b-clear-all-confirm.md
git status
git commit -F docs/commit-drafts/COMMIT_11.312-b-clear-all-confirm.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. /_workbench/search → 검색 → 카드 → "견적 담기" 클릭 (quoteItems > 0)
3. 데스크탑 sticky bar 견적 행 우측:
   · ₩{totalAmount} [🗑 Trash2 outline] [견적 요청서 만들기 emerald CTA]
   · 옛 "전체 해제 별도 줄" 사라짐
4. 🗑 click → AlertDialog open: "견적 후보를 모두 해제할까요?" + "견적 후보 N건 ..." + 취소 / 모두 해제(red)
5. 모두 해제 click → clearCompare + quoteItems clear → sticky bar 사라짐
6. 취소 click → 다이얼로그 닫힘, 변화 0
7. 비교 bar (compareIds > 0) 동작 회귀 0 (별도 🗑 추가 안 함)
8. SourcingCandidatesSheet (비교/견적/검토 sheet) 동작 회귀 0 (§11.312 1차 wiring 보존)
9. 모바일 375px sticky bar overflow 0 (🗑 + CTA gap-3)

## Next (호영님 push 회신 후)
- Phase 3: 회귀 + PLAN closeout (§11.312-b 종결)
