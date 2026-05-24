# §11.297b Commit Message Draft (재고 batch — ActionMenu shared 추출)

```
refactor(inventory): §11.297b #action-menu-shared-extract — ActionMenu helper component 별도 file 추출 + InventoryTable refactor (재고 3 file plain button 단순화 기반)

호영님 spec (2026-05-24):
재고 3 file (InventoryTable + inventory-main + inventory-content)
의 12 dropdown plain button 단순화 기반 작업. §11.297 의 inline
ActionMenu (InventoryTable.tsx 안) 를 shared component 로 추출
→ inventory-main (4) + inventory-content (5) 도 동일 helper 사용.

이 batch (§11.297b):
- ActionMenu shared component 추출
- InventoryTable.tsx refactor (inline → import)

별도 batch:
- §11.297c: inventory-main.tsx 4 dropdown
- §11.297d: inventory-content.tsx 5 dropdown

Fix:

- apps/web/src/components/inventory/action-menu.tsx (NEW, ~90 line):
  · "use client" + ReactNode + MoreVertical import
  · ActionMenuItem interface (label/icon/onClick/danger?/separator?)
  · ActionMenu function (menuId/currentOpenId/onOpenChange/items/width)
  · plain <button aria-label="작업 메뉴" aria-expanded aria-haspopup>
    + MoreVertical pointer-events-none
  · 조건부 backdrop (fixed inset-0 외부 click close) + <div role="menu">
  · items.map plain <button role="menuitem"> + e.stopPropagation
  · separator + danger style 분기
  · Usage JSDoc 예시

- apps/web/src/components/inventory/InventoryTable.tsx:
  · inline ActionMenu 정의 (~75 line) 제거
  · ActionMenuItem interface 정의 제거
  · import { ActionMenu } from "@/components/inventory/action-menu"
  · ReactNode type import 제거 (no longer needed)
  · 3 ActionMenu instance + openActionMenuId state 그대로

- apps/web/src/__tests__/regression/action-menu-shared-extract-297b.test.ts
  (NEW, 11 it × 2 nested describe):
  · shared component: §11.297b trace + ActionMenuItem field +
    aria 4종 + MoreVertical + backdrop + e.stopPropagation +
    danger/separator 분기
  · InventoryTable refactor: inline 제거 + shared import +
    3 ActionMenu instance + Radix 사용/import 부재 +
    openActionMenuId state + handler 5종 보존

canonical truth 보존 (회귀 0):
- §11.297 InventoryTable 의 3 ActionMenu instance + handler 5종
  (onDetailClick/onEdit/onMoveLocation/onDelete/onPrintLabel) 보존
- openActionMenuId single state mutually exclusive 보존
- visible UI 변화 0 (component 위치만 이동)

호영님 production effect:
- 변화 0 (shared 추출 + import 변경 만)
- InventoryTable 의 3 dropdown 그대로 plain button 작동

Out of Scope (별도 batch):
- §11.297c: inventory-main.tsx 4 dropdown (line 984/1130/1782/3475)
- §11.297d: inventory-content.tsx 5 dropdown (line 1339/1516/1738/2286/4313)
- ActionMenu Esc/Arrow keys/focus trap a11y 강화

Rollback path: git revert <SHA>
- action-menu.tsx 삭제 + InventoryTable inline 복원 → §11.297 회귀

Lessons:
1. shared component 추출 — 12 dropdown × 75 line = 900 line 회피
2. DRY 정합 + 단일 source of truth
3. helper pattern 으로 호영님 환경 silent fail 차단 확장
4. visible UI 변화 0 = 안전한 refactor
5. Karpathy minimum-diff — 1 NEW file + 1 file 75 line 제거 + import
```

## Push

```bash
git add apps/web/src/components/inventory/action-menu.tsx \
        apps/web/src/components/inventory/InventoryTable.tsx \
        apps/web/src/__tests__/regression/action-menu-shared-extract-297b.test.ts \
        docs/commit-drafts/COMMIT_11.297b-action-menu-shared-extract.md

git commit -F docs/commit-drafts/COMMIT_11.297b-action-menu-shared-extract.md
git push origin main
```

## 재고 batch 진행

| File | dropdown | 상태 |
|---|---|---|
| InventoryTable.tsx | 3 | ✅ §11.297 (push 완료) |
| **action-menu.tsx (shared)** | — | ✅ **§11.297b (이번)** |
| inventory-main.tsx | 4 | ⏸️ §11.297c |
| inventory-content.tsx | 5 | ⏸️ §11.297d |
