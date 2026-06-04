# COMMIT — §11.362-1/2: "가장 먼저 처리" 위험-우선 severity rank

```
fix(dashboard) §11.362-1/2 #priority-severity-rank — "가장 먼저 처리"를 고정 배열순→위험-우선 severity rank로 정정, 위험 신호(만료·SLA) 후보 편입
```

## 무엇 (§11.362 #1/2 — 호영님 도메인 결정)
- (구) `primaryPriorityAction = dashboardPriorityActions.find(count>0)` = **고정 배열순**(입고 > 재고 > 승인). severity 무관 → 만료 lot 폐기(위험)가 있어도 입고 1건이 먼저 뜸.
- 후보 배열에 **위험 신호 누락**: `riskOrBlockerCount`(SLA breach)·`stats.expiringCount`(만료 임박) = 후보에 부재 → 가장 위험한 항목이 primary 후보에 못 올랐음.
- 호영님 결정: **위험-우선 severity rank** — count>0 후보 중 severity 최상위를 primary.

## Fix (`dashboard/page.tsx`)
- 후보 5종에 `severityRank` 부여 + 만료·SLA 편입:
  - 만료 폐기(1) > SLA 지연(2) > 재고 부족(3) > 입고 처리(4) > 승인 대기(5).
- `primaryPriorityAction` = `filter(count>0).sort(severityRank)[0]` (구 find 단독 제거).
- `secondaryPriorityActions` = severity 정렬 후 slice(0,2) — 보조도 위험순.
- href 는 **검증된 기존 라우트 재사용**(만료/입고→inventoryIssueHref, SLA/승인→quotes RESPONDED) → 신규 dead route 0.
- nextPriorityAction / inactiveReason / priorityStageBadges / CTA 렌더 변경 0.

## canonical truth
- 우선순위 = 운영 위험도 반영(만료·SLA 최상위). 단순 배열 우연 순서가 truth 를 가리던 것 해소.

## 검증
- sentinel `dashboard-priority-severity-rank-362.test.ts`: severityRank 5종, 만료/SLA 편입, filter+sort 전환, rank 선언 순서, 회귀(secondary 정렬·next·inactiveReason·CTA). ⚠️ sandbox node_modules 소실 → Claude Code `npm run test`.
- 배포 후 Chrome 재검증: 만료/SLA 보유 계정에서 해당 항목이 "가장 먼저 처리"로 노출되는지.

## Out of Scope
- 비교 미결(undecidedCompareCount)은 후보 미편입(호영님 5종 rank 외) — processingRequiredCount 집계엔 유지. 추가 필요 시 별도 지시.
- 만료/SLA 전용 정밀 필터 라우트(현재 진입 힌트 수준) 는 별도.

## Rollback
- 후보 배열 3종 복귀 + find(count>0) 원복 + sentinel revert. 독립.
```
footer 없음
```
