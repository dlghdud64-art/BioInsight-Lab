# §11.298d Commit Message Draft

```
fix(ui): §11.298d #quotes-quote-panel-plain — quotes/page.tsx 2 + quote-panel 1 = 3 dropdown Radix → inline plain (호영님 application-wide 단순화 진행)

호영님 spec (2026-05-24):
단일 dropdown 11 file 진행 — quotes/page.tsx (2 dropdown: 모바일
더보기 + BOM upload split button) + quote-panel.tsx (1 dropdown:
CSV/링크 공유 export) swap. data-table.tsx (DropdownMenuCheckboxItem
특수 pattern) 만 §11.298e 마지막 batch.

Fix (2 file ~200 line swap + 1 NEW test):

- apps/web/src/app/dashboard/quotes/page.tsx:
  · isMobileMoreOpen + isBomDropdownOpen useState
  · 모바일 더보기 (MoreHorizontal trigger, md:hidden) — 2 menuItem
    (견적서 비교 / 견적 요청 초안 만들기)
  · BOM upload split button (ChevronDown trigger) — 1 menuItem
    (BOM 업로드)
  · Radix DropdownMenu* import 4종 제거
  · data-testid="quote-header-more-actions-mobile" 보존

- apps/web/src/app/_workbench/_components/quote-panel.tsx:
  · isExportMenuOpen useState + 내보내기 (MoreVertical labeled)
  · CSV 생성 complex inline logic 보존 (headers + rows.map +
    blob + link.download + revokeObjectURL + toast)
  · 링크 공유 (generateShareLink + try/catch toast) 보존
  · Radix DropdownMenu* import 5종 제거

- apps/web/src/__tests__/regression/quotes-quote-panel-plain-298d.test.ts
  (NEW, 6 it × 3 nested describe):
  · §11.298d trace (2 file)
  · Radix import/사용 부재 (2 file)
  · quotes: 2 useState + 모바일 더보기 testid + handler 보존
  · quote-panel: isExportMenuOpen + CSV blob + generateShareLink 보존

canonical truth 보존 (회귀 0):
- 모든 handler (runAiQuoteCompare / openQuoteDraftWorkbench /
  setIntakeDockSource / setIntakeDockOpen / generateShareLink /
  CSV blob 생성 logic) 변경 0
- disabled 분기 (aiCompareLoading / quotes.length < 2 / isLoading /
  quotes.length === 0) 보존
- data-testid="quote-header-more-actions-mobile" 보존
- BOM upload split button group rounded-l-none 스타일 보존
- §11.279d-2 quote table direct send CTA (§11.298d 영향 0)

호영님 production effect:
1. 견적 list 모바일 (md 미만) "⋮" click → 견적서 비교 / 초안 plain
2. "새 견적 요청" 옆 ChevronDown click → BOM 업로드 plain
3. 견적 detail panel 의 "내보내기" click → CSV 다운로드 / 링크 공유 plain
4. 외부 click → backdrop close

Out of Scope (§11.298e 마지막):
- components/ui/data-table.tsx (DropdownMenuCheckboxItem 특수
  pattern, column visibility toggle checkbox list)

Rollback path: git revert <SHA>
- 2 file ~200 line + import 복원

Lessons:
1. button group split (BOM upload) — rounded-l-none 보존하면서
   inline plain swap 가능
2. CSV 생성 inline complex logic — useState close timing 만 추가,
   logic 자체 변경 0
3. md:hidden 모바일 한정 dropdown — Radix wrapper 없이 div.md:hidden
   으로 동일 분기
4. Karpathy minimum-diff — 2 file ~200 line + 1 NEW test (6)
```

## Push

```bash
git add apps/web/src/app/dashboard/quotes/page.tsx \
        apps/web/src/app/_workbench/_components/quote-panel.tsx \
        apps/web/src/__tests__/regression/quotes-quote-panel-plain-298d.test.ts \
        docs/commit-drafts/COMMIT_11.298d-quotes-quote-panel-plain.md

git commit -F docs/commit-drafts/COMMIT_11.298d-quotes-quote-panel-plain.md
git push origin main
```

## 남은 1 file (§11.298e — application-wide 완전 종결)

| File | dropdown | 특수 |
|---|---|---|
| components/ui/data-table.tsx | 1 | DropdownMenuCheckboxItem (column visibility checkbox list) |
