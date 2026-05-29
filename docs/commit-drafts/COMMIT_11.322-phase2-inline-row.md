refactor(inventory): §11.322 Phase 2 #inline-row — 재고 현황 인라인 라벨-값 row 4 + 위험 텍스트 색상 (호영님 P1, 2026-05-30)

호영님 P1 §11.322 Phase 2 (GREEN) — A. 잘림 해결 + B. 카드 테두리 강조 제거.

배경:
- §11.320 production smoke 결과 호영님 잔여 문제 A/B:
  · A. 재고 현황 3 카드(grid-cols-3) 가로 폭 좁아 "0 bottle"이 "0 bot..."로 잘림
  · B. 위험 카드만 빨간 테두리(qtyTone="danger"), 옆 카드 무테두리 = 시각 불균형
- 호영님 spec 3/4 정합: 인라인 라벨-값 row 전환 + 카드 테두리 강조 제거, 텍스트 색상으로만 위험 표현
- §11.320 결정 번복: "최단 LOT 제거" → 인라인 row 4 (현재/안전재고/만료 임박/최단 LOT) 재도입 (LOT 섹션 접힘 시작이라 above the fold 부담 적음)

Fix (Phase 2 — inventory-context-panel.tsx 단일 + sentinel 1 갱신):

- apps/web/src/components/inventory/inventory-context-panel.tsx:
  · KPI 컨테이너 swap (line 685-701):
    · 옛: `<div className="grid grid-cols-3 gap-3 mt-3">` + MetricCell × 3 (현재/안전재고/만료 임박)
    · 신: `<div className="mt-3 space-y-1.5">` + 인라인 row 4 (`flex justify-between items-center text-xs`)
  · MetricCell 본 패널에서 미사용 전환 (외부 14 file 사용처 영향 0 — operational-brief/metric-cell.tsx 자체 보존)
  · 인라인 row 4 (각 라벨 좌 / 값 우 정렬, 단위 풀표기 "bottle" 잘림 0):
    · `inventory-context-kpi-current` (testid 보존) — 위험 값 분기:
      · qtyTone === "danger" → `text-red-600` (카드 테두리 0)
      · qtyTone === "warn" → `text-yellow-700`
      · ok → `text-slate-900`
    · `inventory-context-kpi-safety-stock` (testid 보존) — `text-slate-700` neutral
    · `inventory-context-kpi-expiring-soon` (testid 보존) — 위험 값 분기 (expiryTone)
    · `inventory-context-kpi-shortest-lot` (신규 testid) — `font-mono text-slate-700`, lots[].expiryDate 가장 가까운 lotNumber
  · 최단 LOT 계산 IIFE (shortestLotLabel):
    · `lots.filter(l => l.expiryDate).sort(by expiryDate asc)[0]?.lotNumber ?? "-"`
    · expiry 없는 lot만 있으면 `lots[0]?.lotNumber ?? "-"` fallback

- apps/web/src/__tests__/regression/
  inventory-context-panel-restructure-320.test.ts (§11.320 sentinel 갱신):
  · "KPI 3 — 최단 LOT 제거" 단언 → "KPI 핵심 3 testid 보존 — §11.322 Phase 2 에서 최단 LOT row 재도입(인라인)" 으로 의도 갱신 (testid 3개 보존만 단언)
  · "KPI grid grid-cols-3" 단언 → "KPI 인라인 라벨-값 row — 모바일 폭 안정" 으로 swap (flex justify-between + grid-cols-3 + MetricCell 패턴 0 단언)

canonical 보존 (회귀 0):
- KPI 핵심 3 testid (current/safety-stock/expiring-soon) 보존 ✓
- qtyTone / expiryTone logic 보존 (위험/주의/정상 분기 동일, 색상 매핑만 변경)
- safetyValue / expiryValue 계산 로직 보존
- lots 변수 (line 409) 그대로 활용, 새 변수 0
- MetricCell 컴포넌트 자체 보존 (외부 14 file 사용처 영향 0)
- InventoryContextPanel props 시그니처 변경 0 — caller 2곳(inventory-content:2725 / inventory-main:1958) 영향 0
- §11.320 결정 보존 (탭 0 / 상태 배너 / 액션 상단 / 접기 3섹션)

§11.322 Phase 1 sentinel GREEN 전환 (A + B):
- 인라인 row 4 testid (current/safety-stock/expiring-soon/shortest-lot) ✓
- grid grid-cols-3 + MetricCell 패턴 잔존 0 ✓
- flex justify-between 패턴 4 row ✓ (testid 직후 80 chars 내 매칭)
- qtyTone 보존 ✓
- qtyTone === "danger" → text-red-600 분기 ✓

여전히 RED (Phase 3~4 GREEN target):
- C: 상태 배너 toneSub 결론 문구 swap (Phase 3)
- D: risks 필터링 (Phase 3)
- E: 권장 액션 useState 접기 (Phase 4)

호영님 production effect:
1. 재고 현황 카드 → 인라인 row 4 — "0 bottle" 잘림 사라짐, 단위 풀표기.
2. 위험 카드 빨간 테두리 사라짐 — 옆 카드와 시각 균형 회복.
3. 위험 표시 → 값 텍스트 `text-red-600 font-semibold` 만 (§11.302 정합).
4. 최단 LOT 재도입 — LOT 섹션 접힘 상태에서도 가장 임박한 lotNumber 즉시 인지.
5. 데스크탑/모바일 폭 360px/400px 모두 잘림 0.

Out of Scope (Phase 3~5):
- 상태 배너 정량 숫자 제거 (Phase 3)
- 리스크 필터링 — 안전재고 미달/재고 소진 흡수 (Phase 3)
- 권장 액션 접힘 (Phase 4)
- 모바일 final + 회귀 (Phase 5)

검증 (sandbox 정적 grep):
- inline row 4 testid 매칭 ✓
- grid grid-cols-3 + MetricCell 패턴 잔존 0 ✓
- text-red-600 분기 (qtyTone/expiryTone) ✓
- shortestLotLabel IIFE 1건 ✓
- MetricCell 본 패널 사용 횟수 0 (외부 14 file 보존)

Rollback path: git revert <SHA>
- 옛 grid-cols-3 + MetricCell × 3 KPI 패턴 복원 (단일 file) + sentinel 의도 swap revert

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/components/inventory/inventory-context-panel.tsx `
  apps/web/src/__tests__/regression/inventory-context-panel-restructure-320.test.ts `
  docs/commit-drafts/COMMIT_11.322-phase2-inline-row.md
git status
git commit -F docs/commit-drafts/COMMIT_11.322-phase2-inline-row.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. /dashboard/inventory → 품목 click → 우측 패널 open (데스크탑 + 모바일 375px)
3. 재고 현황 섹션 인라인 row 4 노출:
   · 현재 수량 / 안전재고 / 만료 임박 / 최단 LOT 각각 한 줄, 라벨 좌 / 값 우
   · "0 bottle" 단위 풀표기 (잘림 0)
4. 위험 케이스(currentQuantity=0): "현재 수량" 값 `text-red-600 font-semibold` 표시, 카드 테두리 0
5. 정상 케이스: "현재 수량" 값 `text-slate-900` 일반 표시
6. 최단 LOT row — expiry 가장 가까운 lotNumber 표시 (font-mono)
7. 데스크탑 폭 400px / 모바일 폭 360px 모두 잘림 0

## Next (호영님 push 회신 후)
- Phase 3: C (상태 배너 toneSub 결론 swap) + D (risks 필터링)
