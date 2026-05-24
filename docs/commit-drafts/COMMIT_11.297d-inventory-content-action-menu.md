# §11.297d Commit Message Draft (재고 3/3 partial — inventory-content D1+D2+D5)

```
fix(inventory): §11.297d #inventory-content-action-menu — inventory-content.tsx D1+D2+D5 (utility 2 + card 1) Radix → ActionMenu plain button (호영님 재고 3/3 partial, D3 filter + D4 issue alert 별도 §11.297e)

호영님 spec (2026-05-24):
재고 batch 3/3 — inventory-content.tsx (4586 line) 의 5 dropdown
중 3개 (utility 2 + card actions 1) 우선 swap. D3 (line 1714
filter, Select form 포함) + D4 (line 2262 issue alert, issueType
4-way 분기) 은 별도 batch §11.297e (inventory-main D3 complex 와
함께) + Radix import 제거 (D4 변환 후).

Fix (1 file ~100 line swap + 1 NEW test):

- apps/web/src/app/dashboard/inventory/inventory-content.tsx:
  · ActionMenu shared import 추가 (line 24 옆)
  · InventoryPageContent useState 추가:
    openInvContentMenuId (utility 2 dropdown 공유)
  · InventoryCard useState 추가:
    openContentCardMenuId (card actions 1 dropdown)
  · 3 DropdownMenu swap:
    - D1 (line 1339) → inv-content-utility-mobile (4 items: 재고 파일
      가져오기/QR 스캔/라벨 인쇄/스마트 입고 separator)
    - D2 (line 1516) → inv-content-utility-desktop (4 items: 구매 반영/
      재고 파일 가져오기/QR 스캔/라벨 데이터 내보내기 (엑셀) separator)
    - D5 (line 4313 InventoryCard) → inv-content-card-actions
      (2 items: 정보 수정/상세 보기)
  · D3 (line 1714 filter, Select form) + D4 (line 2262 issue alert,
    issueType expiring/expired/out_of_stock|low_stock 분기) Radix
    그대로 + Radix import 그대로 (별도 batch §11.297e)

- apps/web/src/__tests__/regression/inventory-content-action-menu-297d.test.ts
  (NEW, 5 it):
  · §11.297d trace + ActionMenu shared import
  · 2 useState (openInvContentMenuId / openContentCardMenuId)
  · 3 ActionMenu instance (utility-mobile/desktop/card-actions)
  · handler 5종 보존 (setIsImportStagingOpen/handleBulkLabelPrint/
    setIsSmartReceiveOpen/export-labels API/setShowUsageDialog)
  · D3 + D4 Radix 잔존 (count=2) + §11.297e 분리 trace

canonical truth 보존 (회귀 0):
- 모든 onClick handler 변경 0
- D3 filter (Select form + activeFilterCount badge) 영향 0
- D4 issue alert (issueType 분기 + aiPanel.preparePanel +
  dismissedAlertIds) 영향 0
- §11.297/§11.297b/§11.297c 보존 (InventoryTable + ActionMenu
  shared + inventory-main utility/card)
- InventoryPageContent + InventoryCard component boundary 보존

호영님 production effect (Vercel READY 후):
1. 재고 화면 상단 utility "⋮" click → plain dropdown (모바일/
   데스크탑 분기 그대로)
2. InventoryCard "⋮" click → plain dropdown (정보 수정/상세 보기)
3. D3 filter (Select form 포함) 기존 Radix 그대로
4. D4 issue alert (issueType 분기) 기존 Radix 그대로
5. 외부 click → backdrop close

Out of Scope (별도 batch §11.297e):
- inventory-content.tsx D3 (filter, Select form) → 별도 처리
  (ActionMenu 부적합, custom plain dropdown 또는 Select 만 유지)
- inventory-content.tsx D4 (issue alert, issueType 분기)
- inventory-main.tsx D3 (line 1782 issue alert, issueType 분기 — 동일)
- Radix DropdownMenu* import 제거 (양쪽 file, D3+D4 swap 후)

Rollback path: git revert <SHA>
- 1 file ~100 line + state + import 복원 → 3 dropdown Radix 회귀

Lessons:
1. complex dropdown (filter Select form / issueType 분기) 별도 batch
2. ActionMenu shared 재사용 — 4 file (Header 외 InventoryTable +
   inventory-main + inventory-content) plain pattern 확장
3. component boundary 별 별도 state (openInvContentMenuId vs
   openContentCardMenuId) 가 scope 명확
4. utility 통합 — md:hidden 중복 제거
5. Karpathy minimum-diff — 1 file ~100 line + state 2 + import + 1 NEW test (5)
```

## Push

```bash
git add apps/web/src/app/dashboard/inventory/inventory-content.tsx \
        apps/web/src/__tests__/regression/inventory-content-action-menu-297d.test.ts \
        docs/commit-drafts/COMMIT_11.297d-inventory-content-action-menu.md

git commit -F docs/commit-drafts/COMMIT_11.297d-inventory-content-action-menu.md
git push origin main
```

## 재고 batch 진행 현황

| File | dropdown | 상태 |
|---|---|---|
| InventoryTable.tsx | 3 | ✅ §11.297 |
| action-menu.tsx (shared) | — | ✅ §11.297b |
| inventory-main utility+card | 3/4 | ✅ §11.297c |
| **inventory-content utility+card** | 3/5 | ✅ **§11.297d (이번)** |
| inventory-main D3 (issue alert complex) | 1/4 | ⏸️ §11.297e |
| inventory-content D3 (filter Select) + D4 (issue alert) | 2/5 | ⏸️ §11.297e |
| Radix import 제거 (양쪽 file) | — | ⏸️ §11.297e |
