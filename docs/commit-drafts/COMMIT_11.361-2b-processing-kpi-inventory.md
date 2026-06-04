# COMMIT — §11.361-2b: "처리 필요 항목" KPI 에 재고 부족 포함 (truth 정합)

```
fix(dashboard) §11.361-2b #processing-kpi-inventory — "처리 필요 항목" KPI가 발주/예산만 집계해 재고 부족을 누락하던 truth 불일치 정정 (reorderReviewCount 반영)
```

## 무엇 (Claude in Chrome 라이브 검증에서 발견)
- 운영 대시보드: "재고 부족 2건"인데 **"처리 필요 항목" KPI = 0건.**
- 코드 정독: `executive-summary-section.tsx` 의 "처리 필요 항목" KpiCard value = `pendingApprovalCount + anomalyCount` (deriveKpis(orders, budgets) — **재고 데이터 없음**). 반면 dashboard `processingRequiredCount`(page.tsx) = lowStockAlerts + expiring + undecided (**재고 포함**).
- → 같은 라벨 "처리 필요 항목"이 **두 정의**(발주/예산 vs 재고 포함) → KPI 가 재고 부족 2건 누락 = truth 불일치.

## Fix
- `executive-summary-section.tsx`: `reorderReviewCount?: number` prop 추가 → "처리 필요 항목" KPI value/hint/risk/tone 을 `pendingApprovalCount + anomalyCount + reorderReviewCount` 로, breakdown 에 "재고 부족" 행 추가.
- `dashboard/page.tsx`: `<ExecutiveSummarySection reorderReviewCount={stats.lowStockAlerts}>` 전달.
- 결과: 재고 부족 2건이 "처리 필요 항목 2건 + breakdown(승인0·이상0·재고2)"로 정직 표기 → dashboard 다른 표면과 truth 일치.

## canonical truth
- 대시보드 내 "처리 필요 항목" 정의 통일(재고 포함). KPI 가 운영 현실(재고 부족) 반영.

## 검증
- 런타임(Chrome): 재고 부족 2 / 처리 필요 0 불일치 확인 → fix.
- sentinel `dashboard-processing-kpi-inventory-361.test.ts` (prop·합산·breakdown·page 전달). ⚠️ sandbox node_modules 소실 → Claude Code `npm run test`.
- 배포 후 Chrome 재검증: "처리 필요 항목 2건" + breakdown 재고 부족 2.

## Out of Scope
- §11.362-3(System Insight 위치)·§11.362-1/2(우선처리 종합 산출, 도메인 룰).

## Rollback
- reorderReviewCount prop/전달 + KPI 합산 revert.
```
footer 없음
```
