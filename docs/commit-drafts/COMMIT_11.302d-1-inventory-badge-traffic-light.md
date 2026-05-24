# §11.302d-1 Commit Message Draft (inventory-main 4 Badge amber → 신호등)

```
fix(inventory): §11.302d-1 #inventory-badge-traffic-light — inventory-main 4 Badge (재고 부족 ×3 / 우선 사용 ×1) amber → 신호등 spec 색상 swap (호영님 권장대로)

호영님 Q3=B 결정 §11.302c 후속:
KPI 카드 (§11.302c) 완료. Badge / 안내 박스 별도 batch 분할.
§11.302d 도 sub-batch 분리 권장 (Karpathy minimum-diff):
  §11.302d-1 = inventory-main.tsx 4 Badge (본 batch)
  §11.302d-2 = inventory-main 그 외 yellow (line 1631/1672/1890)
  §11.302d-3 = inventory-content.tsx amber/yellow 20+ 곳
  §11.302d-4 = "긴급 재발주 필요" 안내 박스 (위치 확정 후)

5 Badge audit 결과 (호영님 Q2 라벨 매핑):
  line 1748 "우선 사용" (expiring)        → 검토 yellow-100
  line 3100 "재고 부족" (isLowStock)       → 긴급 red-100 + dot=red
  line 3286 "재고 부족" (!out !restock)    → 긴급 red-100 + dot=red
  line 3728 "부족"     (!out)             → 긴급 red-100 + dot=red
  line 3773 "설정 필요" (isLocationMissing) → 보존 (호영님 spec 외 utility)

Fix (1 file 4 Badge ~16 line swap + 1 NEW test):

- apps/web/src/app/dashboard/inventory/inventory-main.tsx:
  · line 1748 "우선 사용" Badge — 검토 색상 swap:
    bg-yellow-50 → bg-yellow-100
    border-yellow-700 → border-yellow-200
    (중복된 bg-yellow-50/text-yellow-700/border-yellow-700 trailing
     duplicate 제거 — orphan cleanup)
    dot prop 없음 보존 (Truck icon)
  · line 3100 "재고 부족" Badge — 긴급 색상 + dot=red swap:
    bg-yellow-50 → bg-red-100
    text-yellow-700 → text-red-700
    border-yellow-700 → border-red-200
    dot="amber" → dot="red"
  · line 3286 "재고 부족" Badge — 동일 swap (긴급)
  · line 3728 "부족" Badge — 동일 swap (긴급)
  · line 3773 "설정 필요" Badge — 보존 (호영님 spec 외 utility,
    canonical 일관성)

- apps/web/src/__tests__/regression/inventory-badge-traffic-light-302d1.test.ts
  (NEW, 9 it × 4 nested describe):
  · §11.302d-1 trace
  · 긴급 Badge 3 곳 (line 3100/3286/3728) — bg-red-100 + dot=red 검증
  · 검토 Badge 1 곳 (line 1748) — bg-yellow-100 + border-yellow-200
  · 설정 필요 Badge 보존 — yellow utility
  · 회귀 0: "재고 부족" / "부족" 라벨 Badge 에 dot="amber" 부재 +
    §11.302c KPI 보존 (grid-cols-3 + outOfStockCount + discardCount)

canonical truth 보존 (회귀 0):
- Badge component (apps/web/src/components/ui/badge.tsx) 변경 0
  → dotColorMap red/amber 그대로, dot=red 사용처만 확장
- Badge trigger condition (isLowStock / isOutOfStock / expiring /
  isLocationMissing) 변경 0
- 다른 surface (status mapping line 845-847 "임박" / "재주문 권장"
  이미 spec 정합) 변경 0
- KPI 3-card (§11.302c) 변경 0
- conditional className 안의 bg-yellow (line 1631/1672) 변경 0 —
  §11.302d-2 별도 batch

호영님 production effect:
1. 재고 작업 카드의 "재고 부족" Badge — 노란색에서 빨간색 (긴급)
   으로 변경. 사용자에게 더 강한 시각 시그널.
2. "부족" Badge (compact 표시) — 동일 빨간색
3. "우선 사용" Badge (유효기간 임박) — 노란색 그대로 (검토 색상,
   spec yellow-100 으로 미세 조정)
4. "설정 필요" Badge (위치 미지정) — 변경 0 (utility)

§11.302d 후속 (호영님 결정 대기):
- §11.302d-2 inventory-main 그 외 yellow conditional 정리
- §11.302d-3 inventory-content.tsx amber/yellow swap (~20 곳)
- §11.302d-4 "긴급 재발주 필요" 안내 박스 — inventory-content
  line 2036 (priorityExpiredLot/expiringSoon/lowOrOut conditional)
  권장 위치, 호영님 spec 정합 확정 후 진행

Out of Scope:
- Badge dot 옵션에 yellow 추가 (badge.tsx 변경) — scope 확대 회피.
  검토 Badge (line 1748 우선 사용) 는 dot 없이 색상만 swap.
- amber dot 완전 폐지 — line 3773 "설정 필요" 는 호영님 spec 외 +
  utility 라벨 (위치 미지정) 으로 유지. 호영님 명시적 결정 후 별도
  batch 에서 정리 가능.

Rollback path: git revert <SHA>
- 1 file 4 Badge ~16 line 복원 + sentinel test 삭제

Lessons:
1. Badge dot prop swap — dot="amber" → dot="red" 으로 시각 시그널
   강도 격상. amber dot 은 호영님 spec "amber 폐지" 정합.
2. yellow dot 부재 → Badge component 확장 회피. 검토 Badge 는
   className 색상만 swap (dot 없음).
3. 라벨 매핑 (Q2) — "재고 부족" / "부족" = 긴급 (재주문 필요 동의어),
   "우선 사용" = 검토 (유효기간 임박), "설정 필요" = utility (spec 외).
4. Karpathy surgical change — line 1748 의 trailing duplicate
   (bg-yellow-50 text-yellow-700 border-yellow-700 두 번 반복) 는
   본 swap 으로 자연스럽게 정리 (orphan cleanup).
5. spec scope 보존 — "설정 필요" 는 호영님 spec scope 외 utility
   이므로 보존. 일관성 vs 추가 변경 trade-off 에서 보존 권장.
6. Karpathy minimum-diff — 1 file 4 Badge ~16 line + 1 NEW test (9).
```

## Push

```bash
git add apps/web/src/app/dashboard/inventory/inventory-main.tsx \
        apps/web/src/__tests__/regression/inventory-badge-traffic-light-302d1.test.ts \
        docs/commit-drafts/COMMIT_11.302d-1-inventory-badge-traffic-light.md

git commit -F docs/commit-drafts/COMMIT_11.302d-1-inventory-badge-traffic-light.md
git push origin main
```

## Production smoke

1. labaxis.co.kr/dashboard/inventory Cmd+Shift+R
2. 재고 카드의 "재고 부족" Badge — 빨간색 (red-100 + red-700 + red dot)
3. 재고 카드의 "부족" Badge (compact) — 빨간색 (동일)
4. 유효기간 임박 Lot 의 "우선 사용" Badge — 노란색 (yellow-100 +
   yellow-700 + Truck icon)
5. 위치 미지정 Lot 의 "설정 필요" Badge — 노란색 (amber dot 보존,
   utility)
6. KPI 3-card (§11.302c) — 변경 0 확인

## 후속 batch (호영님 push 응답 후 결정)

| § | scope | 우선도 |
|---|---|---|
| §11.302d-2 | inventory-main conditional yellow (line 1631/1672/1890) | 중 |
| §11.302d-3 | inventory-content.tsx amber/yellow ~20 곳 | 중-Large |
| §11.302d-4 | "긴급 재발주 필요" 안내 박스 (inventory-content line 2036) | 호영님 확정 후 |
| §11.302e | inventory-summary-block.tsx 별도 widget audit | 호영님 결정 |
| §11.290 Phase 4c-3 | AI 스캔 PO 매칭 풀스펙 | planner 진입 OK |
