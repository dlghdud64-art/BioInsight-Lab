# §11.302c Commit Message Draft (재고 KPI 컴팩트화 + 신호등 색상)

```
feat(inventory): §11.302c #inventory-kpi-traffic-light — KPI 3개 (재주문 필요/만료 임박/폐기 검토) + grid-cols-3 모바일 정합 + 신호등 색상 신규 (호영님 P0)

호영님 P0 (2026-05-25):
재고 KPI 가 모바일 (375px) 에서 가로 스크롤 발생 + amber/orange/brown
색상이 신호등 체계와 불일치. spec 원본 = purchase_inventory_mobile_
kpi_fix.md + 11280_inventory_color_kpi_hotfix.md.

호영님 의사결정 (3 가지):
- Q1 = A: KPI 3개 spec 정합 (전체 재고 제거, 부족/품절 → 재주문 필요
  라벨 변경, 폐기 검토 신규)
- Q2 = A: 폐기 검토 = 만료된 LOT 개수 (expiryDate < now). 만료 임박
  (1~30일) 과 구분 — "이미 만료, 폐기 판단 필요"
- Q3 = B: KPI 카드만 우선 (§11.302c 본체). Badge / 안내 박스 / LOT
  배지는 별도 batch (§11.302d) — scope 분리

Fix (1 file ~80 line + 1 NEW test):

- apps/web/src/app/dashboard/inventory/inventory-main.tsx:
  · useMemo 추가 (~15 line):
    - outOfStockCount = displayInventories.filter(currentQuantity===0)
      → 재주문 필요 KPI 의 위험 (red-600) vs 긴급 (red-100) 분기용
    - discardCount = displayInventories.filter(expiryDate < now)
      → 폐기 검토 KPI value (호영님 spec Q2=A 정합)
  · totalInventoryCount 제거 (orphan cleanup, Karpathy 원칙):
    - "전체 재고" KPI 카드 제거 후 다른 사용처 0 확인 후 declaration
      도 제거
  · KPI 3-card grid swap (line 1458-1497, ~40 line → ~65 line):
    - grid-cols-1 sm:grid-cols-3 → grid-cols-3 (모바일 정합, 375px
      잘림 0)
    - "전체 재고" 카드 (Package, blue, totalInventoryCount) 제거
    - "부족/품절" 카드 → "재주문 필요" 라벨 + 신호등 색상 분기
      (outOfStock > 0 → red-600 white / lowStock > 0 → red-100
      red-700 / 0 → gray-50 gray-400)
    - "만료 임박" 카드 → 신호등 색상 (> 0 → yellow-100 yellow-700 /
      0 → gray-50)
    - "폐기 검토" 신규 카드 (Trash2, discardCount, > 0 → red-600
      white / 0 → gray-50)

- apps/web/src/__tests__/regression/inventory-kpi-traffic-light-302c.test.ts
  (NEW, 13 it × 4 nested describe):
  · §11.302c trace
  · useMemo 신규 (outOfStockCount / discardCount) + 제거
    (totalInventoryCount) + 보존 (lowOrOutOfStockCount /
    expiringSoonCount)
  · grid-cols-3 모바일 정합 + 전체 재고 제거 + 재주문 필요 라벨 +
    폐기 검토 신규
  · 신호등 색상 분기 3 KPI literal + KPI block 안 amber/orange/brown 0

canonical truth 보존 (회귀 0):
- displayInventories source 변경 0 — useQuery / API contract 무관
- lowOrOutOfStockCount filter logic 보존 (isOut || isLow || byLeadTime)
- expiringSoonCount filter logic 보존 (1~30일)
- PriorityActionQueue + 조치 필요 항목 + 다른 surface 변경 0
- AlertTriangle / Calendar / Trash2 import 보존 (기존 사용처 정합)

호영님 production effect:
1. /dashboard/inventory overview 탭 진입 → KPI 3개 (재주문 필요 /
   만료 임박 / 폐기 검토) 한 줄 표시 (375px 가로 스크롤 0)
2. 색상 신호등 — 데이터 상태별 직관적 인지:
   - 모두 0건: 회색 (안정)
   - 재주문 필요 1건+: 빨간색 연한 (긴급)
   - 재고 0 (out-of-stock): 빨간색 진한 (위험, 즉시 결품)
   - 만료 임박 1건+: 노란색 (검토)
   - 폐기 검토 1건+: 빨간색 진한 (위험, 이미 만료)
3. amber/orange/brown KPI 카드 0 노출 (Badge / 안내 박스 등 다른
   surface 는 §11.302d 별도 batch)

§11.302c 후속 (§11.302d 별도 batch — 호영님 Q3=B 결정 정합):
- Badge amber → 신호등 swap:
  · inventory-main.tsx line 3059 (Badge dot="amber" bg-yellow-50)
  · line 3245 (Badge dot="amber" bg-yellow-50)
  · line 3687 (Badge dot="amber" bg-yellow-50)
  · line 3732 (Badge dot="amber" bg-yellow-50)
- "긴급 재발주 필요" 안내 박스 (위치 audit 필요)
- LOT 상세 "위험" 배지 (위치 audit 필요)
- inventory-content.tsx amber/orange/brown grep audit

Out of Scope (§11.302c 본 batch):
- 호영님 spec 폐기 검토 색상 미명시 — "이미 만료" 의미상 위험 (red-600)
  적용. 호영님 검수 후 조정 가능.
- inventory-summary-block.tsx (별도 widget, 4-card grid "전체 품목 /
  부족 위험 / 만료 임박 / 최근 변동") 는 spec 다른 surface — 별도
  batch 후보 (§11.302e?).

Rollback path: git revert <SHA>
- 1 file ~80 line 복원 + sentinel test 삭제
- KPI 4-card (전체 재고 + 부족/품절 + 만료 임박) 회귀

Lessons:
1. 모바일 정합 — grid-cols-1 sm:grid-cols-3 은 < sm (640px) 에서
   1-card 세로 stack. spec "375px 잘림 0" 정합하려면 grid-cols-3
   강제 (gap-3 + px-4 py-3 작아도 3-card 한 줄).
2. 신호등 색상 분기 — 단순 conditional className 으로 4-state
   (위험/긴급/검토/0건) 표현. tailwind variant 없이 expression
   기반 (호영님 환경 silent fail 위험 0).
3. 호영님 spec 폐기 검토 색상 미명시 → "이미 만료된 LOT" 의미상
   위험 (red-600) 으로 logical 추론. commit 에 명시 + 호영님 검수.
4. orphan cleanup (Karpathy 원칙) — 본인 변경으로 unused 가 된
   totalInventoryCount declaration 만 제거. 다른 dead code 손대지
   않음.
5. spec scope 분리 (호영님 Q3=B) — KPI 카드 우선 land, Badge / 안내
   박스 별도 batch. 한 PR 에 다 넣으면 review 부담 + 회귀 위험 ↑.
6. Karpathy minimum-diff — 1 file ~80 line + 1 NEW test (13 it).
```

## Push

```bash
git add apps/web/src/app/dashboard/inventory/inventory-main.tsx \
        apps/web/src/__tests__/regression/inventory-kpi-traffic-light-302c.test.ts \
        docs/commit-drafts/COMMIT_11.302c-inventory-kpi-traffic-light.md

git commit -F docs/commit-drafts/COMMIT_11.302c-inventory-kpi-traffic-light.md
git push origin main
```

## Production smoke

1. labaxis.co.kr/dashboard/inventory overview 탭 Cmd+Shift+R
2. 375px 모바일 viewport (Chrome DevTools) — KPI 3개 한 줄 표시
   (가로 스크롤 0)
3. KPI 카드 색상 검증:
   - 모든 KPI 0 → gray-50 (회색, 안정)
   - 재주문 필요 1건+ (out 0) → red-100 (긴급, 연한 빨강)
   - 재고 0 (out > 0) → red-600 white (위험, 진한 빨강 + 흰 글자)
   - 만료 임박 1건+ → yellow-100 (검토, 노랑)
   - 폐기 검토 1건+ → red-600 white (위험, 진한 빨강)
4. "전체 재고" 카드 0 (4-card 회귀 0)
5. "부족/품절" 라벨 0, "재주문 필요" 라벨 100%
6. Badge amber 잔존 확인 (§11.302d 후속 audit) — 변경 0

## 후속 batch 후보 (호영님 push 응답 후 결정)

| § | scope | 호영님 결정 필요 |
|---|---|---|
| §11.302d | Badge amber → 신호등 swap (4 line) + 안내 박스 + LOT 배지 | 호영님 OK 즉시 |
| §11.302e | inventory-summary-block.tsx (별도 widget) audit + swap 여부 | 호영님 결정 (다른 surface) |
| §11.290 Phase 4c-3 | AI 스캔 PO 매칭 풀스펙 | planner 진입 OK |
