# §11.298 Commit Message Draft

```
fix(ui): §11.298 #single-dropdown-4-files-plain — 단일 dropdown 4 file (InventoryQRCode + export-button + compliance-links + workspace) Radix → plain (ActionMenu shared 또는 inline plain)

호영님 A안 (2026-05-24):
application-wide Radix wiring 완전 종결 1/3 batch. 단일 dropdown 11
file 중 simple row action 4 file 우선 swap. user-menu (큰 swap) +
나머지 6 file = 별도 batch.

Fix (4 file ~120 line swap + 1 NEW test):

- apps/web/src/components/inventory/InventoryQRCode.tsx:
  · isMoreMenuOpen useState + plain button (MoreHorizontal) +
    조건부 backdrop + 2 menuItem (PNG 저장 / QR 값 복사)
  · Radix DropdownMenu* import 4종 제거

- apps/web/src/components/quote-list/export-button.tsx:
  · isExportMenuOpen useState + Button (구매팀 제출용 내보내기) +
    조건부 backdrop + 3 menuItem (TSV / CSV / ZIP)
  · Radix DropdownMenu* import 4종 제거

- apps/web/src/app/settings/compliance-links/page.tsx:
  · ActionMenu shared import + openLinkMenuId useState
  · menuId="compliance-link-${link.id}" — 수정 + 삭제 (danger)
  · Radix DropdownMenu* import 4종 제거

- apps/web/src/app/settings/workspace/page.tsx:
  · ActionMenu shared import + openMemberMenuId useState
  · menuId="member-${member.id}" — 멤버 제거 (danger)
  · Radix DropdownMenu* import 4종 제거

- apps/web/src/__tests__/regression/single-dropdown-4-files-plain-298.test.ts
  (NEW, 8 it × 4 nested describe):
  · §11.298 trace (4 file)
  · Radix import/사용 부재 (4 file)
  · 각 file 별 state + handler 보존

canonical truth 보존 (회귀 0):
- 모든 handler (handleDownload/handleExport/handleEdit/handleDelete/
  handleDeleteMember/navigator.clipboard) 변경 0
- 각 file 의 다른 component / Dialog / form / state 영향 0
- §11.297 family ActionMenu shared 재사용 (compliance-links / workspace)
- InventoryQRCode + export-button 은 inline plain (ActionMenu trigger
  와 다른 button — MoreHorizontal / Download 라벨)

호영님 production effect (Vercel READY 후):
1. 재고 QR 카드 "⋮" click → plain dropdown (PNG 저장 / QR 값 복사)
2. 견적 list "구매팀 제출용 내보내기" click → plain dropdown
   (TSV / CSV / ZIP)
3. compliance link row "⋮" click → 수정 / 삭제 (danger)
4. workspace member row "⋮" click → 멤버 제거 (danger)
5. 외부 click → backdrop close
6. application-wide Radix wiring 완전 종결 진행 1/3

Out of Scope (별도 batch §11.298b/c):
- user-menu.tsx (큰 swap, profile dropdown 10+ menuItem)
- quotes/page.tsx (2 dropdown)
- safety-spend / organizations / protocol/bom / quote-panel /
  data-table

Rollback path: git revert <SHA>
- 4 file ~120 line + import 복원 → 4 dropdown Radix 회귀

Lessons:
1. ActionMenu shared 재사용 + inline plain 혼합 — trigger button
   다양성 대응 (MoreHorizontal vs MoreVertical vs labeled button)
2. preemptive Radix silent fail 확장 — 4 file 추가 cover
3. settings surface (compliance-links / workspace) row action 정합
4. file-local useState (각 file 의 dropdown 별도) — scope 명확
5. Karpathy minimum-diff — 4 file ~120 line + 1 NEW test (8)
```

## Push

```bash
git add apps/web/src/components/inventory/InventoryQRCode.tsx \
        apps/web/src/components/quote-list/export-button.tsx \
        apps/web/src/app/settings/compliance-links/page.tsx \
        apps/web/src/app/settings/workspace/page.tsx \
        apps/web/src/__tests__/regression/single-dropdown-4-files-plain-298.test.ts \
        docs/commit-drafts/COMMIT_11.298-single-dropdown-4-files.md

git commit -F docs/commit-drafts/COMMIT_11.298-single-dropdown-4-files.md
git push origin main
```

## 다음 batch (별도 §11.298b/c)

| File | dropdown | 작업 |
|---|---|---|
| user-menu.tsx | 1 (큰 swap, 10+ menuItem) | §11.298b |
| quotes/page.tsx | 2 | §11.298c |
| safety-spend/page.tsx | 1 | §11.298c |
| organizations/[id]/page.tsx | 1 | §11.298c |
| protocol/bom/page.tsx | 1 | §11.298c |
| _workbench/_components/quote-panel.tsx | 1 | §11.298c |
| components/ui/data-table.tsx | 1 | §11.298c |
