# COMMIT — §11.364 Phase 2 (D-3): 데스크탑 KPI 밀도 축소

```
refactor(dashboard) §11.364 D-3 #kpi-density — 데스크탑 ExecutiveSummary KpiCard 밀도 축소(패딩·여백·아이콘, 폰트 24-30 유지). 빈 차트 mockup은 §11.243b#4 P0 우선으로 유지(접기 철회)
```

## 무엇 (§11.364 D-3 — 호영님 P1, 2026-06-04)
- 데스크탑 KPI 카드가 와이드 폭에서 간격만 벌어짐(패딩 p-5 + 하단 데드스페이스 mt-5 + 큰 아이콘 w-12).
- 수용기준(할 일>KPI 순서)은 이미 충족(priority banner > ExecutiveSummary). D-3 (2)System Insight·(4)2-col도 이미 충족 → **(1) KPI 밀도만 실작업.**

## 호영님 결정 (기계 적용 금지)
- **(1) KPI 높이**: §11.311-1(text-xl 20px)은 모바일 renderKpiCard 전용 — 데스크탑 KpiCard에 끌어오면 category error. 데스크탑 자체 타깃 = **숫자 24-30px 유지**, 높이는 **패딩·여백**에서 축소.
- **(3) 빈 차트**: §11.243b#4(호영님 P0 mockup)와 D-3 "접기" 충돌 → **기존 P0 우선, 접기 철회.** mockup = 운영 전 onboarding affordance로 정당 → 무작업 유지(조건 2개만 sentinel 보호).

## Fix (`executive-summary-section.tsx` KpiCard)
- 패딩 `p-5` → `p-4`. 헤더 `mb-4` → `mb-3`. 아이콘 `w-12 h-12 rounded-2xl` → `w-10 h-10 rounded-xl`. hint `mt-2` → `mt-1.5`. 하단 progress bar `mt-5` → `mt-3`.
- value 폰트 `text-3xl md:text-[32px]`(30/32) → `text-2xl md:text-3xl`(24/30) — **24-30 유지**(과축소 아님).

## 무작업 (확인 완료)
- (2) System Insight: §11.243b#3 compact/dismiss 이미 적용.
- (3) 빈 차트 mockup: spend-trend-card `isEmpty ? mockup : 실차트` 배타 삼항(클린 스왑) + "예시 데이터" 캡션 = 호영님 조건 충족. 유지.
- (4) 데스크탑 2-col: priority banner 이미 `md:flex-row`.

## canonical truth
- 데이터/집계 변경 0. KpiCard 밀도(패딩·여백·아이콘·폰트 24-30)만. mockup 정책 보존.

## 검증
- sentinel `dashboard-kpi-density-364`: KpiCard 밀도값(p-4/text-2xl md:text-3xl/mb-3/w-10/mt-1.5/mt-3) + 과축소(text-xl) 금지 + mockup 조건①②. ⚠️ vitest = Claude Code.
- 기존 sentinel 충돌 0: `system-insight-compact-252d3`는 SystemInsightCard 대상(KpiCard 무관).
- 배포 후 Chrome(데스크탑): KPI 카드 높이 축소, 숫자 24-30 가독 유지.

## Out of Scope
- §11.364 D-6(FAB/랜딩) = 다음 phase. D-7(지출 IA)·§0(AI 정책)·D-8(품목 상세 인라인) = 별도 batch.

## Rollback
- KpiCard 밀도 클래스 6곳 revert + sentinel 삭제. 독립.
```
footer 없음
```
