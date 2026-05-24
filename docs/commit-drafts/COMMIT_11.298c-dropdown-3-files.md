# §11.298c Commit Message Draft (단일 dropdown 11 file 진행 — 3 simple files)

```
fix(ui): §11.298c #dropdown-3-files-298c — safety-spend + organizations + bom 3 file Radix → plain (호영님 application-wide 단순화 진행)

호영님 spec (2026-05-24):
단일 dropdown 11 file 중 simple 3 file (safety-spend export +
organizations member row action + bom reagent row action) Radix →
plain. quotes/page.tsx + quote-panel + data-table 별도 batch
§11.298d/e (complex content, DropdownMenuCheckboxItem 특수 pattern).

Fix (3 file ~120 line swap + 1 NEW test):

- apps/web/src/app/dashboard/safety-spend/page.tsx:
  · isExportMenuOpen useState + inline plain dropdown
    (Download trigger + 3 export csv/xlsx/pdf + 안내 텍스트)
  · Radix DropdownMenu* import 5종 제거

- apps/web/src/app/dashboard/organizations/[id]/page.tsx:
  · openMemberActionId useState + ActionMenu shared
  · isPending 분기 (초대 재발송/취소 vs 멤버 제거) items 동적 build
  · resendInviteMutation / removeMemberMutation 보존
  · Radix DropdownMenu* import 5종 제거

- apps/web/src/app/protocol/bom/page.tsx:
  · openReagentMenuId useState + ActionMenu shared
  · 3 items (편집 / 검색 / 삭제 danger)
  · setEditingReagentId / handleDeleteReagent / router.push 보존
  · Radix DropdownMenu* import 4종 제거

- apps/web/src/__tests__/regression/dropdown-3-files-298c.test.ts
  (NEW, 6 it × 4 nested describe):
  · §11.298c trace (3 file)
  · Radix import/사용 부재 (3 file)
  · safety-spend: isExportMenuOpen + handleExport 3종 보존
  · organizations: openMemberActionId + isPending 분기 + mutation 보존
  · bom: openReagentMenuId + reagent handler 보존

canonical truth 보존 (회귀 0):
- 모든 handler / mutation (handleExport / resendInviteMutation /
  removeMemberMutation / setEditingReagentId / handleDeleteReagent /
  router.push) 변경 0
- isPending 분기 logic 보존
- confirm() dialog (초대 취소 / 멤버 제거) 보존
- §11.297 family ActionMenu shared 재사용

호영님 production effect:
1. safety-spend 화면 "리포트 내보내기" click → plain dropdown
   (CSV/XLSX/PDF + 안내 텍스트)
2. organizations member row "⋮" click → 초대 재발송/취소 (pending)
   또는 멤버 제거 (active)
3. bom reagent row "✏️" click → 편집/검색/삭제
4. 외부 click → backdrop close

Out of Scope (별도 batch §11.298d/e):
- quotes/page.tsx (2 dropdown — 모바일 더보기 + ChevronDown 분할)
- _workbench/_components/quote-panel.tsx (1 — CSV 생성 complex)
- components/ui/data-table.tsx (1 — DropdownMenuCheckboxItem 특수)

Rollback path: git revert <SHA>
- 3 file ~120 line + import 복원

Lessons:
1. ActionMenu shared 재사용 — 6 file (Header 외 + 재고 3 + settings 2
   + organizations + bom) plain pattern 확장
2. isPending 분기 items 동적 build (spread + ternary)
3. inline plain (safety-spend) vs ActionMenu (org/bom) — trigger
   다양성 대응
4. Karpathy minimum-diff — 3 file ~120 line + 1 NEW test (6)
```

## Push

```bash
git add apps/web/src/app/dashboard/safety-spend/page.tsx \
        apps/web/src/app/dashboard/organizations/\[id\]/page.tsx \
        apps/web/src/app/protocol/bom/page.tsx \
        apps/web/src/__tests__/regression/dropdown-3-files-298c.test.ts \
        docs/commit-drafts/COMMIT_11.298c-dropdown-3-files.md

git commit -F docs/commit-drafts/COMMIT_11.298c-dropdown-3-files.md
git push origin main
```

## 남은 batch (§11.298d/e)

| File | dropdown |
|---|---|
| quotes/page.tsx | 2 (모바일 더보기 + ChevronDown 분할) |
| _workbench/_components/quote-panel.tsx | 1 (CSV 생성 complex) |
| components/ui/data-table.tsx | 1 (DropdownMenuCheckboxItem 특수) |
