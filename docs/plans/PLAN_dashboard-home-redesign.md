# Implementation Plan: 메인 대시보드 리디자인 (dashhome 시안 정합)

- **Status:** ⏳ Pending
- **Started:** 2026-06-24
- **Last Updated:** 2026-06-24
- **시안:** uploads/시안.html · dashhome-app.jsx · dashhome.css · README.md (호영님 2026-06-24)

**CRITICAL INSTRUCTIONS**: 각 phase 완료 후 1.✅체크 2.🧪operator vitest+`npm run build` 3.⚠️gate 4.📅날짜 5.📝Notes 6.➡️다음. ⛔ gate 실패·dead button/no-op/placeholder success·page-per-feature 금지. labaxis-ui-wizard 정합(same-canvas·stateful·action-wired).

---

## 0. Truth Reconciliation
**시안 핵심(README):** 발주(ENABLE_PURCHASING) off 정합 + 시각 위계·반응형·가독성 정제. 레포 page.tsx 구조 충실 따름(rebuild 아님).
**현 레포(`app/dashboard/page.tsx`):** StatLine(L724)·NextStepBanner(L734)·ActionInbox(L739)·Pipeline(L754, getFlag 3단계 분기 존재)·BudgetSpendCard(L770)·OperatorQuickActions(L779, §11.93/§11.377/§rightcol-rebalance)·RecentActivityCard(L790)·SpendTrendCard(L799).

**핵심 diff:** 구조 1건(빠른시작 제거 + 2-col 재구성 Budget↔Trend) + 시각 정합(헤더 정리·Pipeline 퍼널·StatLine 0건 톤·NextStep gradient·도넛 내부). 발주 off는 이미 getFlag 분기.
**Chosen:** 시안 = 호영님 확정안. QuickActions 제거 = §11.93/§11.377/§rightcol-rebalance 설계 역전(sentinel 진화).
**Prereq:** dashhome.css는 프로토타입(레포는 Tailwind) → 토큰만 참조.

## 1. Priority Fit
- [x] Post-release UX 리디자인(호영님 시안 시리즈 1번 — "메인대시보드부터"). blocker 아님.

## 2. Work Type
- [x] Web · [x] Design Consistency · [x] Workflow(동선 — 빠른시작→Pipeline 흡수)

## 3. Overview
**Feature:** 메인 대시보드를 dashhome 시안에 맞춰 정제 — 빠른시작 제거, 2-col 재구성(예산&지출↔지출트렌드), 헤더 정리, Pipeline 퍼널 시각, 0건 가독성. 발주 off 정합 유지.

**Success Criteria:**
- [ ] OperatorQuickActions(빠른시작) 제거 — 동선은 Pipeline 카드 클릭이 흡수(dead 동선 0)
- [ ] 2-col = 예산&지출(도넛 내부) ↔ 지출 트렌드(QuickActions 자리 대체)
- [ ] 헤더 인사·이모지·중복카운트 제거(카운트는 ActionInbox 소유)
- [ ] Pipeline 3단계 퍼널 시각(아이콘박스+큰숫자+진행바+화살표+0건흐림), 카드 클릭 진입 보존
- [ ] StatLine 2 KPI(발주 off)·0건 slate-500 가독성, NextStep gradient, ActionInbox 신호등, 최근활동 풀폭
- [ ] 반응형 ≤1080/600/380
- [ ] canonical 무변경(시각/배치만)·dead button/no-op 0·발주 on 복원 가능(getFlag)

**Out of Scope (⚠️):**
- [ ] ENABLE_PURCHASING on 분기 로직 변경(기존 getFlag 보존)
- [ ] 데이터 소스/쿼리 변경(시각·배치만)
- [ ] dashhome.css 클래스 그대로 복붙(Tailwind 재현)

## 4. Product Constraints
**Must Preserve:** [x] same-canvas · [x] canonical(stats forward) · [x] getFlag 발주 분기 · [x] Pipeline 카드 진입 동선
**Must Not Introduce:** [x] page-per-feature · [x] dead button/no-op(빠른시작 제거 후 동선 끊김 0) · [x] 가짜 데이터/0건 날조

## 5. Architecture
| Decision | Rationale | Trade-off |
| :--- | :--- | :--- |
| 빠른시작 제거 + 2-col Budget↔Trend | 시안 결정(동선 Pipeline 흡수) | §11.93/§11.377/§rightcol-rebalance sentinel 진화 |
| 기존 컴포넌트 시각 정제(rebuild 아님) | 시안이 repo 구조 충실 | per-component Tailwind 조정 |

## 6. Test Strategy
- sentinel: 구조(빠른시작 부재·2-col 구성)·헤더 정리·각 컴포넌트 시각 핀. 각 phase GREEN 동반(delta-0). QuickActions 관련 sentinel 진화(보호의도=동선 보존을 Pipeline로 이전).

## 7. Phases

#### Phase 0: Truth Lock ✅ COMPLETE (2026-06-24)
- Status: [x] Complete

**현 순서(page.tsx):** Header → StatLine → NextStep → ActionInbox → GlobalEmpty → Pipeline(getFlag 3단계) → 2-col[BudgetSpendCard(L770, categorySpending prop) | **OperatorQuickActions**(L779)] → RecentActivity(L790 풀폭) → **SpendTrendCard**(L799 맨아래).
**시안 순서:** … Pipeline → 2-col[BudgetSpend(도넛내부) | **SpendTrend**] → RecentActivity(풀폭). 빠른시작 없음.
**구조 diff(P1):** OperatorQuickActions 제거 + SpendTrendCard를 맨아래→2-col 우측으로 이동. RecentActivity 풀폭(2-col 뒤) 유지.

**진화 대상 sentinel (P1):**
- `dashboard-budget-spend-shifan-p3b.test.ts` L32(2-col=Budget+QuickActions)·L33(QuickActions→RecentActivity 순서)·L39(QuickActions<SpendTrend 순서) → **전부 진화**(2-col=Budget+SpendTrend, QuickActions 제거).
- `dashboard-bottom-modules-p5.test.ts` L45-46 + (C)(OperatorQuickActions 보존) → **진화**(page에서 제거, 컴포넌트 파일 dormant 보존).
**무손(컴포넌트 파일/import 보존 시 GREEN):** `operator-quick-actions-responsive`·`dashboard-quote-dispatch-card-evidence`(둘 다 operator-quick-actions.tsx 파일 read — 파일 삭제 안 함)·`charts-tab-252b`(SpendTrendCard dynamic import 보존).

**시각 항목(P3 확인):** BudgetSpendCard 도넛 내부 렌더 유무(categorySpending prop 존재 → 이미 일부 정합 가능, P3 정독)·StatLine 발주 off 2 KPI·Pipeline 퍼널 시각.

**✋ Gate:** ✅ 구조 diff 확정·진화 2 sentinel 식별·무손 3 분리. **Rollback:** planning-only.

#### Phase 1: 구조 — 빠른시작 제거 + 2-col 재구성 ✅ COMPLETE (2026-06-24)
- Status: [x] Complete

**Land:** `page.tsx` — 2-col 우측 `<OperatorQuickActions>` → `<SpendTrendCard>`(예산&지출 ↔ 트렌드), 하단 풀폭 SpendTrend 제거(2-col로 이동), RecentActivity 풀폭(2-col 뒤) 유지. OperatorQuickActions import 제거(unused). 컴포넌트 파일 dormant 보존(rollback). BudgetSpendCard 도넛 내부는 이미 통합(categorySpending).
**sentinel 진화 2:** `dashboard-budget-spend-shifan-p3b`(2-col=Budget+SpendTrend, QuickActions 제거, 순서 Budget→Trend→RecentActivity)·`dashboard-bottom-modules-p5`(OperatorQuickActions page 제거). 무손: operator-quick-actions-responsive·quote-dispatch-card-evidence(파일 read)·charts-tab-252b(SpendTrend import 보존).
**✋ Gate:** dead 동선 0(Pipeline 카드 클릭 진입 흡수), unused import 0, build EXIT 0, baseline-delta 0. **Rollback:** page.tsx 배치+import+sentinel revert.

**★ missed-sweep 봉합(baseline-delta 2차 안전망):** 1차 진화 2개(budget-spend-p3b·bottom-modules-p5) 외 **같은 레이아웃을 핀하는 shifan sentinel 2개 누락** → baseline-delta가 포착:
- `dashboard-reorder-shifan-p3a`(iQuick 순서)·`dashboard-shifan-final-p4`(Pipeline<Budget<Quick<Trend + 2-col grid) → 새 레이아웃(빠른작업 제거, 2-col=Budget+Trend, 순서 Budget→Trend→RecentActivity)으로 진화.
- 근원: page.tsx **주석의 PascalCase "OperatorQuickActions" 리터럴**이 `not.toMatch(/OperatorQuickActions/)`를 false-trip → 주석에서 제거(robust). 모든 순서 단언은 `<OperatorQuickActions`(JSX) / `indexOf("<…")` 사용해 주석 무영향.
- 교훈: 레이아웃 변경 시 **순서/배치를 핀하는 sentinel은 기능명 grep만으론 부족 — indexOf/grid 단언까지 전수**. 진화 sentinel은 §dashboard-home-redesign 4개(budget-spend-p3b·bottom-modules-p5·reorder-shifan-p3a·shifan-final-p4).

**별도 commit 분리(스코프 정리):** 호영님 "회색 글자 대비 개선"(quotes 테이블 RFQ/견적대기/공급사미정/우선순위 dot + supplier-avatars + quotes-rail-A sentinel 색 비의존 진화)은 **P1 대시보드와 별개 변경** → operator가 2 commit으로 분리:
  1. `fix(quotes) — 테이블 회색 대비 개선 + quotes-rail-A 색 비의존 진화`
  2. `feat(dashboard) §dashboard-home-redesign P1 — 빠른작업 제거+2-col 재구성 + sentinel 4 진화`

#### Phase 2: 헤더 정리 ✅ COMPLETE (2026-06-24)
- Status: [x] Complete

**Land:** `page.tsx` AppPageHeader description = `${name}님, {상태 카운트}` → `todayLabel`(날짜, SSR-safe useState ""+mount). 장식성 인사 + 중복 카운트("확인이 필요한 항목 N건", ActionInbox 소유) 제거. title "대시보드" + AI 리포트 actions 보존. `session` 미사용 → `const { status } = useSession()`(unused 0). 카운트 소스 변수(processingRequiredCount 등)는 ActionInbox/isBlocked/mobile용 보존(orphan 0). **워크스페이스명**은 canonical org 소스 부재 → 보류(날조 금지, 날짜만 노출). sentinel: `dashboard-home-redesign-header-p2.test.ts`.
**✋ Gate:** 카운트 중복 0, hydration mismatch 0(SSR-safe), unused 0. **Rollback:** description + todayLabel + useSession destructure revert.

**★ missed-sweep 봉합(baseline-delta):** P2가 헤더 description의 `dashboardState === "zero"`/`"blocked"` 리터럴 소비 제거 → `quick-start-duplicate-252d2`(§11.252d-2) L44(`=== "zero"` 핀) RED. state machine 정의(union `"blocked"|"zero"|"active"` + `isZero ? "zero" : "active"` ternary)는 **보존** → 핀을 **소비 리터럴 → state machine 정의** 기준으로 진화(invariant[3상태 분기 존재] 불변·강화, `=== "active"` mobile 소비는 잔존 유지). 교훈: 헤더 카피 변경도 상태 리터럴을 핀하는 sentinel을 깰 수 있음 — 소비 리터럴 변경 시 grep 선식별.

#### Phase 3: 컴포넌트 시각 정합
- Status: [ ] Pending
**🟢:** Pipeline 퍼널 시각·StatLine 0건 slate-500·NextStep gradient·BudgetSpend 도넛 내부·ActionInbox 신호등·최근활동 풀폭. per-component Tailwind. **✋ Gate:** 시각만(canonical 0), build EXIT 0. **Rollback:** per-component revert.

#### Phase 4: 반응형 + smoke
- Status: [ ] Pending
**🟢:** ≤1080(사이드바 숨김·KPI 1열·파이프 2×2·2-col 1열)·≤600·≤380. read-only + 호영님 라이브 확인. **✋ Gate:** 375px 잘림 0, baseline-delta 0. **Rollback:** 반응형 클래스 revert.

## 8. Risk
| Risk | P | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| QuickActions 제거 sentinel 다수 진화 | High | Med | 보호의도(동선) Pipeline 흡수로 이전·grep 전수 선식별 |
| 빠른시작 제거 후 동선 끊김(dead) | Low | High | Pipeline 카드 클릭 진입 보존 확인 |
| 발주 on 복원 회귀 | Low | Med | getFlag 분기 불변 |

## 9. Rollback
- P1: page.tsx 배치+sentinel revert. P2~3: per-component revert. P4: 반응형 revert. env/flag 없음 — git revert.

## 10. Progress
- Overall: 60%(P0·P1·P2 완료) · Current: P3(컴포넌트 시각 정합) · Blocker: 없음 · Next: Pipeline 퍼널·StatLine 0건 톤·NextStep gradient·도넛 내부 정독
**Checklist:** [x] P0 [x] P1 [x] P2 [ ] P3 [ ] P4

## 11. Notes
**Decisions (2026-06-24, 호영님):** dashhome 시안 정합, "메인대시보드부터". 빠른시작 제거·2-col 재구성·발주 off 유지.
