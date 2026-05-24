# §11.297f Commit Message Draft (재고 batch 최종 종결)

```
fix(inventory): §11.297f #inventory-content-filter-plain — D3 filter (Select form) custom plain dropdown + inventory-content Radix import 제거 (재고 batch 최종 종결, 3 file 13 dropdown plain)

호영님 spec (2026-05-24):
재고 batch 마지막 — inventory-content.tsx D3 (line 1714 filter,
Select form 포함) Radix DropdownMenu → custom plain dropdown
(useState + plain button + 조건부 backdrop + Select 2개 그대로
유지). ActionMenu 부적합 (form elements).

재고 3 file (InventoryTable + inventory-main + inventory-content)
의 12 dropdown + 1 filter 모두 plain pattern 으로 swap 완료. 재고
surface Radix DropdownMenu wiring 0.

Fix (1 file ~70 line swap + 1 NEW test):

- apps/web/src/app/dashboard/inventory/inventory-content.tsx:
  · isFilterDropdownOpen useState 추가
  · D3 (line 1714) filter Radix DropdownMenu → custom plain dropdown:
    - plain <button aria-label="필터" aria-expanded aria-haspopup>
      + Filter icon (pointer-events-none) + activeFilterCount badge
    - 조건부 backdrop (fixed inset-0 z-40 외부 click close)
    - <div role="menu" aria-label="필터 메뉴">
    - 위치 Select (locationFilter / uniqueLocations) 보존
    - 상태 Select (statusFilter / 7 option) 보존
    - 초기화 button (locationFilter/statusFilter/categoryFilter
      reset) 보존
  · Radix DropdownMenu* import 5종 제거

- apps/web/src/__tests__/regression/inventory-content-filter-plain-297f.test.ts
  (NEW, 8 it):
  · §11.297f trace
  · isFilterDropdownOpen state
  · plain button + aria + Filter icon
  · activeFilterCount badge 보존
  · 조건부 backdrop + role="menu" + Select 2개 + 초기화
  · Radix import 완전 제거
  · Radix DropdownMenu 사용 완전 부재
  · 기존 ActionMenu 4 instance (§11.297d/e) 보존

canonical truth 보존 (회귀 0):
- locationFilter / statusFilter / categoryFilter state setter 변경 0
- uniqueLocations 사용 보존
- activeFilterCount badge 위치/색상 보존
- Select / SelectTrigger / SelectValue / SelectContent / SelectItem
  Radix component 그대로 (DropdownMenu 만 swap)
- §11.297d ActionMenu 4 instance (utility/card/issue alert) 보존
- §11.297/§11.297b/§11.297c/§11.297e 전 family 보존

호영님 production effect (Vercel READY 후):
1. 재고 화면 filter (⏷) button click → plain dropdown 즉시 열림
2. 위치 / 상태 Select 정상 작동
3. 초기화 button → 3 filter reset
4. 외부 click → backdrop close
5. activeFilterCount badge 정상 표시
6. 재고 surface 모든 dropdown plain — Radix DropdownMenu 0

재고 batch 최종 종결 (§11.297 family v6):
| File | dropdown | § |
| InventoryTable | 3 | §11.297 |
| action-menu shared | — | §11.297b |
| inventory-main utility+card | 3 | §11.297c |
| inventory-content utility+card | 3 | §11.297d |
| inventory-main + inventory-content issue alert | 2 | §11.297e |
| inventory-content D3 filter | 1 | §11.297f (이번) |

= 12 dropdown + 1 filter = 13 swap 완료. 재고 surface Radix
DropdownMenu wiring 0.

Out of Scope (별도 batch):
- 단일 dropdown 11 file (settings/auth/etc) plain button 단순화
- ActionMenu Esc/Arrow keys/focus trap a11y 강화
- §11.279d-2 패턴 다른 surface 회귀 audit

Rollback path: git revert <SHA>
- 1 file ~70 line + state + import 복원 → D3 filter Radix 회귀

Lessons:
1. form elements (Select) 포함 dropdown → ActionMenu 부적합 →
   custom plain pattern (조건부 div + form 그대로)
2. Radix Select 와 Radix DropdownMenu 는 별개 component — Select
   는 그대로 유지하면서 DropdownMenu 만 swap 가능
3. 재고 surface (3 file 13 dropdown) plain 단순화 완료 — 호영님
   환경 Radix silent fail 차단 완전 (재고 + Header)
4. activeFilterCount badge pointer-events-none — button hit-test
   trap 회피 (§11.280-2 정신)
5. Karpathy minimum-diff — 1 file ~70 line + state + import + 1 NEW test (8).
   Select form / state setter 변경 0
```

## Push

```bash
git add apps/web/src/app/dashboard/inventory/inventory-content.tsx \
        apps/web/src/__tests__/regression/inventory-content-filter-plain-297f.test.ts \
        docs/commit-drafts/COMMIT_11.297f-inventory-content-filter-plain.md

git commit -F docs/commit-drafts/COMMIT_11.297f-inventory-content-filter-plain.md
git push origin main
```

## §11.297 family 종결

| File | dropdown | 상태 |
|---|---|---|
| InventoryTable.tsx | 3 | ✅ §11.297 |
| action-menu.tsx (shared) | — | ✅ §11.297b |
| inventory-main utility+card | 3 | ✅ §11.297c |
| inventory-content utility+card | 3 | ✅ §11.297d |
| inventory-main + inventory-content issue alert | 2 | ✅ §11.297e |
| **inventory-content D3 filter + Radix 제거** | 1 | ✅ **§11.297f (이번)** |

**재고 surface Radix DropdownMenu wiring 0 — 호영님 환경 silent fail 차단 완전.**

## 다음 batch 후보

| 후보 | 작업 |
|---|---|
| 단일 dropdown 11 file (settings/auth/etc) | 11 file × 1 dropdown 일괄 단순화 |
| §11.279d-2 패턴 다른 surface 회귀 audit | preemptive |
| ActionMenu a11y (Esc/Arrow keys/focus trap) | 추후 |
| 호영님 추가 P0/P1 지시 대기 | — |
