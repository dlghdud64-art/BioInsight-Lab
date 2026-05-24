# §11.297e Commit Message Draft

```
fix(inventory): §11.297e #inventory-issue-alert-action-menu — issue alert 2 dropdown (issueType 4-way 분기) swap + inventory-main Radix import 제거 (inventory-content D3 filter 별도 §11.297f)

호영님 spec (2026-05-24):
재고 batch — inventory-main D3 (issue alert, line 1782) +
inventory-content D4 (issue alert, line 2262) 동시 swap. 두 dropdown
동일 구조 (issueType expiring/expired/out_of_stock|low_stock 4-way
분기). ActionMenu items array 동적 build (spread + ternary).

inventory-main: 4/4 dropdown 완료 → Radix DropdownMenu* import 제거.
inventory-content: D4 swap → 4/5 dropdown 완료. D3 (filter, Select
form 포함) 잔존 — §11.297f 별도 batch (filter 는 ActionMenu 부적합,
custom plain dropdown 필요).

Fix (2 file ~280 line swap + 1 NEW test):

- apps/web/src/app/dashboard/inventory/inventory-main.tsx:
  · D3 (line 1782 issue alert) → ActionMenu inv-issue-${inv.id}
    - 2 base items (상세 보기 + 정보 수정)
    - issueType expiring: 폐기 검토 (danger) + 재발주 검토
    - issueType expired: 대체품 재발주 검토
    - issueType out_of_stock|low_stock: 입고 등록
    - 목록에서 제외 (마지막 separator)
  · Radix DropdownMenu* import 5종 제거
  · §11.297e trace marker swap

- apps/web/src/app/dashboard/inventory/inventory-content.tsx:
  · D4 (line 2262 issue alert) → ActionMenu inv-content-issue-${inv.id}
    - 동일 구조 (inventory-main D3 와)
  · D3 (line 1714 filter, Select form 포함) 그대로 + Radix import 그대로
    (§11.297f 별도)
  · §11.297e trace marker swap

- apps/web/src/__tests__/regression/inventory-issue-alert-action-menu-297e.test.ts
  (NEW, 10 it × 3 nested describe):
  · §11.297e trace (양쪽 file)
  · inventory-main 4/4 완료 — ActionMenu instance + issueType 4-way
    분기 + aiPanel.preparePanel 보존 + Radix import/사용 부재
  · inventory-content D4 swap + D3 filter Radix 잔존 + Radix import
    그대로 (§11.297f 분리)

canonical truth 보존 (회귀 0):
- 모든 onClick handler 변경 0 (setSelectedItem/setEditingInventory/
  setIsSheetOpen/setIsDialogOpen/setSheetSafetyStock/setRestockItem/
  setRestockForm/setDismissedAlertIds/aiPanel.preparePanel/toast)
- issueType 4-way 분기 로직 보존 (expiring/expired/out_of_stock|low_stock)
- §11.297/§11.297b/§11.297c/§11.297d 보존
- inventory-content D3 filter (Select + activeFilterCount badge) 영향 0

호영님 production effect (Vercel READY 후):
1. 재고 issue list (만료 임박/만료/재고 부족) "⋮" click → plain
   dropdown 즉시 열림
2. issueType 별 분기 menuItem 정상 표시 (폐기 검토 / 재발주 검토 /
   대체품 재발주 / 입고 등록)
3. 목록에서 제외 click → setDismissedAlertIds + toast
4. inventory-main 의 모든 dropdown plain (Radix 의존성 0)
5. inventory-content D3 filter 기존 Radix 그대로 (§11.297f)
6. 호영님 환경 Radix silent fail 차단 확장

Out of Scope (§11.297f 별도 batch):
- inventory-content D3 (line 1714 filter, Select form) custom plain
  dropdown 으로 변환 + Radix import 제거
- ActionMenu Esc/Arrow keys/focus trap a11y 강화

Rollback path: git revert <SHA>
- 2 file ~280 line + import 복원 → 2 dropdown Radix 회귀

Lessons:
1. issueType 4-way 분기 items array 동적 build — spread + ternary
   로 conditional items 정합
2. 동일 패턴 2 dropdown 동시 swap — DRY 정합 (같은 ActionMenu items
   구조 양쪽 file)
3. inventory-main 완전 종료 — Radix import 제거 (inventory-content
   는 D3 filter 때문에 import 유지)
4. complex dropdown 분리 — filter (Select form) 는 ActionMenu 부적합
   → 별도 patten (custom plain) 필요
5. Karpathy minimum-diff — 2 file ~280 line + 1 NEW test (10).
   handler 변경 0
```

## Push

```bash
git add apps/web/src/app/dashboard/inventory/inventory-main.tsx \
        apps/web/src/app/dashboard/inventory/inventory-content.tsx \
        apps/web/src/__tests__/regression/inventory-issue-alert-action-menu-297e.test.ts \
        docs/commit-drafts/COMMIT_11.297e-inventory-issue-alert.md

git commit -F docs/commit-drafts/COMMIT_11.297e-inventory-issue-alert.md
git push origin main
```

## 재고 batch 진행 현황

| File | dropdown | 상태 |
|---|---|---|
| InventoryTable.tsx | 3 | ✅ §11.297 |
| action-menu.tsx (shared) | — | ✅ §11.297b |
| inventory-main utility+card | 3/4 | ✅ §11.297c |
| inventory-content utility+card | 3/5 | ✅ §11.297d |
| **inventory-main issue alert + Radix 제거** | 1/4 | ✅ **§11.297e (이번)** |
| **inventory-content issue alert** | 1/5 | ✅ **§11.297e (이번)** |
| inventory-content D3 (filter) + Radix import 제거 | 1/5 | ⏸️ §11.297f |
