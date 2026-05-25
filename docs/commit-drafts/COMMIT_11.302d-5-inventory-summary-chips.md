# §11.302d-5 Commit Message Draft (요약 칩 색상 정합 + 전체 재고 제거)

```
fix(inventory): §11.302d-5 #inventory-summary-chips — 요약 칩 색상 의미 역전 정정 + "전체 재고" 칩 §11.302c 정합 제거 + totalInventoryCount orphan cleanup

§11.302c (KPI 카드) + §11.302d-4 (우선 처리 배너) 후속:
inventory-content.tsx line 2070-2094 요약 칩의 색상 의미 역전:
  "만료 임박" → text-red-600 bg-red-50 (잘못, 검토 yellow 가 맞음)
  "부족/품절" → text-yellow-600 bg-yellow-50 (잘못, 긴급 red 가 맞음)
+ "전체 재고" 칩 — §11.302c KPI "전체 재고" 제거 정합 결락 (orphan)

Fix (1 file 1 array + 1 useMemo 제거 + 1 NEW test):

- apps/web/src/app/dashboard/inventory/inventory-content.tsx
  (line 2068-2090):
  · 요약 칩 array 3 → 2 (전체 재고 제거):
    "만료 임박": text-yellow-700 + bg-yellow-100 + border-yellow-200
      (검토, 이전 text-red-600 bg-red-50 정정)
    "재주문 필요" (이전 "부족/품절"): text-red-700 + bg-red-100 +
      border-red-200 (긴급, 이전 text-yellow-600 bg-yellow-50 정정)
      라벨도 §11.302c KPI "재주문 필요" 정합 swap
    "전체 재고" 제거 (§11.302c KPI 정합)
  · §11.302d-5 trace comment 추가
  (line 918-919):
  · totalInventoryCount useMemo 제거 (orphan cleanup, Karpathy 원칙)
    - 요약 칩 "전체 재고" 제거 후 다른 사용처 0 확인 후 declaration 도 제거

- apps/web/src/__tests__/regression/inventory-summary-chips-302d5.test.ts
  (NEW, 9 it × 3 nested describe):
  · §11.302d-5 trace
  · 색상 역전 정정 — "만료 임박" 검토 / "재주문 필요" 긴급 / "부족/품절" 라벨 부재
  · "전체 재고" 칩 + totalInventoryCount 제거 검증
  · 회귀 0: §11.302d-4 우선 처리 배너 색상 + lowOrOutOfStockCount /
    expiringSoonCount useMemo + 요약 칩 map 구조 보존

canonical truth 보존 (회귀 0):
- displayInventories source 변경 0
- lowOrOutOfStockCount + expiringSoonCount filter logic 변경 0
- 요약 칩 inline-flex + chip.bg + chip.color + chip.value 구조 보존
- 우선 처리 배너 (§11.302d-4) 변경 0
- PriorityActionQueue / handlePriorityQueueAction 변경 0
- inventory-content.tsx 의 다른 amber/yellow 사용처 (line 1092/1097/
  1560/1579/2164/2194/2198/2201/2212/2241/2429/2430) — §11.302d-3
  별도 batch (분할 권장)

호영님 production effect:
1. 점검 사항 탭 요약 칩 영역:
   - "만료 임박" 칩 → 노란색 (검토, 이전 빨강 정정)
   - "재주문 필요" 칩 → 빨간색 (긴급, 이전 "부족/품절" 노랑 정정)
   - "전체 재고" 칩 제거 (§11.302c KPI 정합)
2. 우선 처리 배너 (§11.302d-4) 와 요약 칩 색상 의미 일치 — 만료 임박
   = yellow, 재주문 필요 = red 통일
3. 시각 정보량 축소 — 칩 3 → 2 (focus 강화)

§11.302d 시리즈 종결 후보 (호영님 결정):
- §11.302d-3: inventory-content.tsx 그 외 amber/yellow ~17 곳 분할
  (d-3a status mapping line 1092-1097, d-3b approval-waiting line
  1560/1579, d-3c card BG line 2164 + lot detail line 2194-2241,
  d-3d KPI valueClass line 2429-2430)
- §11.302e: inventory-summary-block + Lot 추적 widget (line 1885-1898)

Out of Scope:
- inventory-content.tsx 다른 amber/yellow 사용처 (§11.302d-3 분할)
- inventory-summary-block.tsx 별도 widget (§11.302e)
- §11.290 Phase 4c-3 AI 스캔 PO 매칭 (호영님 planner OK 후)

Rollback path: git revert <SHA>
- 1 file 1 array 복원 + totalInventoryCount useMemo 복원 + sentinel
  test 삭제
- 색상 역전 회귀 + "전체 재고" 칩 회귀

Lessons:
1. 색상 역전 = §11.302d-4 우선 처리 배너 와 동일 패턴 — 같은 file
   안 두 surface 가 동시에 색상 역전 보유. audit 시 같은 file 의
   여러 surface 한 번에 검토 필요.
2. label cascade — KPI 라벨 변경 (§11.302c "부족/품절" → "재주문 필요")
   은 요약 칩 라벨 까지 cascade 정합 필요. 한 라벨 변경이 다른 surface
   에 영향.
3. orphan cleanup cascade — totalInventoryCount 가 inventory-main.tsx
   (§11.302c) + inventory-content.tsx (§11.302d-5) 양쪽 모두 제거
   대상. 동일 변수가 여러 file 에 있을 때 모두 cleanup.
4. Karpathy minimum-diff — 1 file 1 array + 1 useMemo 제거 + 1 NEW
   test (9 it).
```