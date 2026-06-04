# COMMIT — §11.362-3: System Insight(종합 판단)를 KPI(개별 액션) 위로

```
refactor(dashboard) §11.362-3 #system-insight-order — System Insight 배너를 KPI 그리드 위로 이동 (종합 판단 → 개별 액션 순)
```

## 무엇 (§11.362 #3 — 호영님)
- 기존: ExecutiveSummarySection 이 `KPI 그리드 → SystemInsightCard` 순서 → 개별 KPI 가 먼저, 종합 운영 시그니처(System Insight)가 아래.
- 호영님 지시: "Insight 배너를 위로 (종합 판단 → 개별 액션 순)."

## Fix (단순 reorder, 외부 영향 0)
- `executive-summary-section.tsx`: `<SystemInsightCard>` 렌더 블록을 KPI Row 그리드 **위로** 이동.
- 위치 의존성 0 확인: SystemInsightCard 는 `{!onboardingMode && ...}`, 온보딩 KPI guide banner 는 `{onboardingMode && ...}` → **상호배타**, 순서 바뀌어도 동시 노출/충돌 없음.
- kpis/ordersCount prop·dismiss·sessionStorage·derive 로직 변경 0 (visibility/순서만).

## canonical truth
- 데이터/집계 변경 0. 렌더 순서만 조정 — 종합 판단을 먼저 보여 운영자 시선 흐름 정합.

## 검증
- sentinel `dashboard-system-insight-order-362.test.ts`: insight 인덱스 < KPI Row 인덱스, §11.362-3 마커, 가드/단일 렌더/prop 보존. ⚠️ sandbox node_modules 소실 → Claude Code `npm run test`.
- 배포 후 Chrome 재검증: 대시보드에서 System Insight 배너가 4 KPI 카드 위에 노출.

## Out of Scope
- §11.362-1/2(우선처리 종합 산출 — full-stage severity 룰, 도메인 결정 대기).

## Rollback
- SystemInsightCard 블록을 그리드 아래로 원복. 독립.
```
footer 없음
```
