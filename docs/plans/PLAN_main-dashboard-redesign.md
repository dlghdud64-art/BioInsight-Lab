# Implementation Plan: 메인 대시보드 재구조화 (시안 구조 · A 점진)

- **Status:** ⏳ Pending
- **Started:** 2026-06-14
- **Last Updated:** 2026-06-15 (P1 완료)
- **출처:** 「LabAxis 대시보드 구현 지시문」(16p, 정본 프로토타입 LabAxis Dashboard.html) + 호영님 결정(A 점진 + 가드 3건)

**CRITICAL INSTRUCTIONS**: 각 phase 완료 후 — 체크박스 / quality gate / Last Updated / Notes / 다음 phase.
⛔ quality gate 실패·SoT 충돌·dead button/no-op·가짜 데이터 금지.
⛔ **픽셀 복제(B) 금지** — 시안은 구조·순서·계약 참조, 동작 wiring은 현행 보존(§16p: 구조=프로토타입, 동작=기존 보존).

---

## 0. Truth Reconciliation

**Latest Truth Source:** 대시보드 구현 지시문(8모듈 구조·단일 진실·상태 규율) + 호영님 결정.
**현행(dashboard/page.tsx):** `ExecutiveSummarySection`(KPI 판단카드+SYSTEM INSIGHT) · `SpendTrendCard`+`CategoryDistributionCard` · `OperatorQuickActions` · `SmartReceivingStatusCard` · `AIInsightDialog` · 최근 처리 이력 · `OperationalBriefFloatingEntry`. AppPageHeader(§11.374).
**Conflicts/결정:**
- 접근 = **A 점진 정렬**(현행 컴포넌트를 시안 순서·계약·토큰에 재배치, wiring 보존). 픽셀 복제 X.
- `GET /api/dashboard/summary` **부재**(현행 api/dashboard/{stats,layout}) → 단일 진실 API 신규(계약 보존 점진).
- 신규 = **Pipeline(견적→발주→입고→재고)** 만. 나머지는 재배치/계약 정렬.

**호영님 가드 3건 (필수):**
- **가드① empty-state 명시:** 시안은 채워진 목업(견적7/재고2/할일2)만 그림. **실제 첫 화면=빈 계정(0).** 각 모듈 empty 상태를 계획에 정의 — ActionInbox 0 / Pipeline 0·0·0·0 / BudgetSpend ₩0 / 카테고리 비중. **빈 데이터 차트 금지** → "데이터 쌓이면 표시" empty(§1-2⑤·§kpi-category-axis). "예시" 배지만으론 부족(실데이터 오해) — 차트 미렌더가 기본.
- **가드② 가짜 차트 모순 비반복:** 현행 "누적 지출 ₩0 KPI" vs "지출 트렌드 ₩71.6M 차트" = 가짜 차트(빈 계정인데 분포 그림) = §1-2⑤ 위반. 시안 ₩0이 정직 — **실데이터/0만**, 목업 분포 상속 금지.
- **가드③ Pipeline canonical 상속:** 4단계 전이를 로컬 재정의하면 O1 drift 재발. `state-machine.ts` 도메인 전이맵을 읽어 표시(직전 §dashboard·O1 가드 그대로).

**Environment:** sentinel readFileSync+regex(격리 node). 실 vitest·build·push = operator. prod write 0(UI/route). summary API 신규 = 읽기 endpoint.

## 1. Priority Fit
- [x] Post-release UX 재구조화 (호영님 지시). large scope.

## 2. Work Type
- [x] Feature(대시보드 재구성) · [x] Workflow/Ontology Wiring(Pipeline) · [x] Design Consistency · [x] 데이터 정직화(가짜 차트 제거)

## 3. Overview
**Description:** 메인 대시보드를 지시문 8모듈 구조(GlobalEmpty→StatLine→SystemInsight→ActionInbox→Pipeline→BudgetSpend + QuickActions/RecentActivity)로 재배치. 단일 진실(/api/dashboard/summary) + capMs 상태머신 + 각 모듈 정직한 empty. 현행 검증 wiring 보존.
**Success Criteria:**
- [ ] 8모듈 시안 순서 배치(현행 컴포넌트 재사용 + Pipeline 신규)
- [ ] `/api/dashboard/summary` 단일 진실(MODULES{quote,po,receive,stock}) + BUDGET + 파생(ALL_EMPTY/budTone/won)
- [ ] capMs 2.6s 상태머신(loading/error/ready·데이터/ready·빈상태), 무한 스켈레톤 0
- [ ] **각 모듈 정직한 empty(가드①)** — 빈 데이터 차트 금지
- [ ] **가짜 차트 모순 제거(가드②)** — 실데이터/0만
- [ ] **Pipeline canonical state-machine 상속(가드③)**
- [ ] 현행 wiring(fetch/CTA/권한/overlay) 무회귀 + dead button/no-op 0
- [ ] 반응형 1180/760/680 + 접근성 + ⌘K/ScanHub/토스트 정합
**Out of Scope (⚠️):**
- [ ] 픽셀 단위 시안 복제(B)
- [ ] 현행 검증 wiring 재구축(보존)
- [ ] 안전/감사 등 타 surface
- [ ] 목업 분포/예시 차트 데이터

**User-Facing Outcome:** 빈 계정엔 정직한 빈 상태 + 시작 유도, 데이터 쌓이면 8모듈이 단일 진실로 채워짐. 가짜 숫자 0.

## 4. Product Constraints
**Must Preserve:** workbench/queue/rail/dock·same-canvas, 현행 fetch/CTA/권한 wiring, canonical truth(state-machine·summary), §11.374 AppPageHeader.
**Must Not Introduce:** 가짜 데이터/목업 분포, 빈 데이터 차트, dead button/no-op, Pipeline 로컬 전이 재정의, page-per-feature.
**Canonical Truth Boundary:**
- SoT: `/api/dashboard/summary`(MODULES) + `state-machine.ts`(전이) + BUDGET(실 예산/지출)
- Derived: ALL_EMPTY/budTone/won/insight 계산식(프로토타입 유지)
- Persistence: 읽기 surface(쓰기 없음). insight 닫기 = localStorage.

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-off |
| :-- | :-- | :-- |
| A 점진(재배치+계약) | 회귀 위험↓, 검증 wiring 보존, minimal-diff | 픽셀 100% 불일치(구조만) |
| /api/dashboard/summary 신규 | 단일 진실(분산 stats/layout 통합) | 기존 fetch 점진 이관 |
| Pipeline canonical 상속 | O1 drift 재발 차단 | 표시 전용(전이 검증은 state-machine) |
| 빈 데이터 차트 미렌더 | §1-2⑤ 정직성 | 시안(채워진 목업)과 빈 화면 다름 |

**Touched(예상):** `dashboard/page.tsx`, `components/dashboard/*`(executive-summary/spend-trend/category/operator-quick-actions/recent), 신규 Pipeline 컴포넌트, `api/dashboard/summary`(신규), capMs 공통 훅, sentinel.

## 6. Global Test Strategy
- 데이터 계약: summary API shape + 파생 계산 단위.
- 상태머신: 4상태 + capMs 전환 sentinel.
- empty: 각 모듈 0 상태 렌더(차트 미렌더·정직 문구) sentinel.
- Pipeline: state-machine 전이맵 참조(로컬 재정의 부재) sentinel.
- 라이브 smoke: 빈 계정 첫 화면(가짜 0) + (데이터 시) 채워짐.

## 7. Implementation Phases

### Phase 0: Truth & 범위 + 모듈 매핑 + empty 설계 — ✅ Complete (2026-06-14)
- Status: [x] Complete
- **현행 렌더 순서:** AIInsightDialog(헤더) → "가장 먼저 처리"(p730) → ExecutiveSummary(KPI+운영인사이트, p883) → SpendTrend+Category(p946) → OperatorQuickActions(p971) → SmartReceivingStatusCard(p984) → 최근 알림(p1583) → 최근 처리 이력(p1608).
- **8모듈 매핑 확정:**

  | 시안 모듈 | 현행 | 조치 |
  | :-- | :-- | :-- |
  | GlobalEmpty | 라이브 "오늘 처리 이슈 없음" 유사 | ALL_EMPTY 통합 정렬(P3) |
  | StatLine KPI3 | ExecutiveSummary KPI카드 | 재배치+계약(이번달 지출·잔여 예산·확정 발주액) |
  | SystemInsight | 운영 인사이트(ExecutiveSummary 내) | 재배치(우선순위 도출) |
  | ActionInbox | "가장 먼저 처리"+"다음 작업" | 통합(max-h 412) |
  | Pipeline | **없음** | **신규**(canonical state-machine 상속, 가드③) |
  | BudgetSpend | SpendTrend+Category | 재배치 + **MOCKUP 제거(가드②)** |
  | QuickActions | OperatorQuickActions | 재배치(2×2) |
  | RecentActivity | 최근 처리 이력 | 재배치 |
  | ~~SmartReceivingStatusCard~~ | p984 | **Pipeline 입고 단계로 흡수**(호영님 결정) |
  | ~~최근 알림~~ | p1583 | **제거**(상단바 NotificationCenter 충분, 호영님 결정) |

- **가짜 차트 출처(가드②) 확정:** `spend-trend-card.tsx:44-47` `MOCKUP_SPEND_DATA`(§11.243b "회색 톤 6개월 sample") → 빈 계정에 mockup 차트+overlay 렌더(라이브 ₩71.6M). **제거 → "데이터 쌓이면 표시" empty.**
- **각 모듈 empty 명세(가드①):** StatLine 0건 회색(§11.311) / SystemInsight "처리할 운영 신호 없음"(CTA 0) / ActionInbox 체크+"처리할 항목 없음" / Pipeline 0·0·0·0 회색(.is-empty) / **BudgetSpend ₩0 + 차트 미렌더 "데이터 쌓이면 표시"** / RecentActivity "첫 견적·예산부터" / GlobalEmpty(ALL_EMPTY=true)만 종합 빈.
- **summary API:** `/api/dashboard/stats`(실 Prisma derive: monthlySpendingChart/categorySpending/카운트류) 존재 → `/api/dashboard/summary`(MODULES{quote,po,receive,stock}+BUDGET)는 stats 확장/추출로 점진(계약 보존). P1에서 stats 필드 정밀 → MODULES 매핑.
- **Pipeline canonical(가드③):** `lib/operations/state-machine.ts` 도메인 전이맵 참조(표시 전용, 로컬 전이 재정의 금지).
- **✋ Gate:** 매핑 완전 ✅, empty 명세 확정 ✅, 가드 3건 반영 ✅, 신규=Pipeline+summary+capMs ✅. Rollback: planning-only.

### Phase 1: 데이터 계약 — /api/dashboard/summary + 파생 — ✅ Complete (2026-06-15)
- Status: [x] Complete
- 🔴 RED: summary 응답 shape(MODULES/BUDGET) + 파생(ALL_EMPTY/budTone/won) 계약 sentinel. **가짜 차트 데이터 제거(실데이터/0, 가드②)**.
- 🟢 GREEN: summary route(읽기) + 파생 helper. 현행 분산 fetch → 단일 진실 점진 이관(wiring 보존).
- **산출(파일):**
  - `lib/dashboard/summary-derive.ts`(신규) — 순수 파생: `deriveDashboardSummary(input)` + `budTone()` + `won()`. MODULES{quote,po,receive,stock} + BUDGET + 파생(allEmpty/budTone/usageRate). DB 접근 0(전이 정의 0=가드③).
  - `app/api/dashboard/summary/route.ts`(신규) — 읽기 endpoint. stats 와 동일 scope(orgIds/workspaceIds/guestKey)로 카운트 derive → helper 위임. force-dynamic, mutation 0. 신규 파일=현행 stats 무회귀(page 미이관, P3~5).
  - `components/dashboard/spend-trend-card.tsx` — `MOCKUP_SPEND_DATA` + grayscale mockup 차트 + "예시 데이터" overlay 제거 → 차트 미렌더 + "데이터 쌓이면 표시" dashed empty(가드①②). isEmpty 배타 삼항·props 계약 보존(page wiring 무회귀).
  - `__tests__/dashboard/summary-contract-p1.test.ts`(신규) — 파생 로직 단위(allEmpty/budTone 임계/won/usageRate) + route shape/읽기전용 + 가드②(분포 mock 0) + 가드③(ALLOWED_*_TRANSITIONS 부재) + 회귀(계약 키 보존).
  - `__tests__/regression/dashboard-kpi-density-364.test.ts` — block(3) §11.243b#4 mockup-유지 lock → 가드② mockup 제거/정직 empty 가드로 진화(stale 정정). block(1) KPI 밀도 무변.
- **격리 node 검증(sandbox):** sentinel regex 18/18 PASS + helper 로직(type-strip 직접 eval) 18/18 PASS(budTone 80/100 임계·won 포맷·allEmpty·usageRate). budTone 임계 §11.302: <80 ok / 80–<100 warn / ≥100 danger / 미설정 none(신규 파생 기본값, P3 StatLine에서 톤 소비).
- ✋ Gate: 계약 sentinel GREEN(격리 PASS, **operator 실 vitest+build 대기**), 가짜 분포 0 ✅, Pipeline 전이 로컬 재정의 0 ✅. Rollback: API/helper+테스트 revert(현행 stats fetch 유지), spend-trend mockup 제거는 독립 revert.

### Phase 2: capMs 상태머신 + empty 4상태
- Status: [ ] In Progress (2026-06-15)
- 🟢 섹션별 독립 로드 훅(loading/error/ready·데이터/ready·빈상태) + capMs **10s** 오류 전환(무한 스켈레톤 금지) + 카드별 재시도. **빈 데이터 차트 미렌더 정책(가드①)**.
- **⚠️ Truth reconciliation (2026-06-15, 호영님 결정):** PLAN 초안 `capMs 2.6s`(프로토타입 시안값) 는 라이브 §11.375 P1 픽스와 충돌 — `dashboard/page.tsx:212-222` 스켈레톤 상한을 6→**10초**로 올린 이유가 "콜드스타트 serverless 5~6s(느린 성공)가 짧은 상한에 걸려 거짓 '지연' 에러카드 깜빡임"(2026 실인시던트). 2.6s hard-error = 인시던트 재발. **결정: 2.6s 폐기 → hard-error 임계 10s 채택**(라이브 정합). 4상태는 유지(error 는 10s+retry 소진 시).
- **산출(파일):**
  - `lib/dashboard/section-state.ts`(신규, 순수) — `deriveSectionState()` 4상태(loading/error/empty/ready) + `CAPMS_DEFAULT=10000`(§11.375 정합). React 의존 0 → 격리 단위 검증 가능.
  - `hooks/use-dashboard-section.ts`(신규, client) — react-query useQuery 래핑(retry 2·backoff canonical 보존) + capMs 10s hard-cap 타이머(§11.366/§11.375 패턴 재사용, 신규 경쟁 primitive 0) + `deriveSectionState` 합성. `{state,data,error,retry,timedOut}` 노출(카드별 재시도). **page 미교체(P3~5에서 모듈별 채택)** → 훅 revert=페이지 무영향.
  - `__tests__/dashboard/dashboard-section-capms-p2.test.ts`(신규) — 순수 4상태 도출 단위 + capMs 10s(2.6s 부재) + retry/refetch 노출 + 무한 스켈레톤 금지(timedOut&&!data→error) 가드.
- ✋ Gate: 4상태 sentinel, capMs 전환(10s), empty 정직, 무한 스켈레톤 0. Rollback: 훅+순수모듈 revert(page 무변경이라 무영향).

### Phase 3: 상단 모듈 — GlobalEmpty / StatLine / SystemInsight
- Status: [ ] In Progress (2026-06-15) — P3-A 고립 빌드 완료, 탑재(P3-B) 대기
- 🟢 현행 ExecutiveSummary를 시안 StatLine(KPI3: 이번달 지출·잔여 예산·확정 발주액) + SystemInsight(1줄 도출 우선순위) + GlobalEmpty(ALL_EMPTY)로 정렬. KPI 칩/CTA wiring 보존.
- **접근(호영님 2026-06-15 결정):** 고립 빌드 → 별도 탑재. 현행 ExecutiveSummary(zustand store derive)를 in-place 교체하지 않고, summary 소스 신규 모듈을 먼저 작성·검증(page 미배선) → 별도 커밋에서 store→summary swap 배선(§11.199b/§11.196b stuck 위험 격리, wiring 단독 rollback).
- **P3-A 산출(고립 빌드):**
  - `lib/dashboard/summary-derive.ts` + `api/dashboard/summary/route.ts` — **계약 확장**: `spend.thisMonth`(이번달 실구매 합, 예산 무관) 추가. StatLine "이번달 지출" 소스(P0 "stats 확장" 정합, 실데이터/0). P1 sentinel(E) 계약 키 `+spend` 갱신.
  - `components/dashboard/stat-line.tsx`(신규) — KPI3(이번달 지출=spend.thisMonth·잔여 예산=budget.remaining·확정 발주액=po.confirmedAmount) summary 단일 진실. 4상태(loading 스켈레톤/error 재시도/값 표시), §11.311 컴팩트(grid-cols-3·p-3 md:p-4·text-lg md:text-xl), 0건 회색(bg-gray-50/text-gray-400), won() 포맷, 터치≥44px. presentational(fetch=P2 훅 주입, 탑재 시).
  - `components/dashboard/global-empty.tsx`(신규) — allEmpty 종합 빈 첫 화면. 정직 문구 + 견적/예산 CTA. 차트/목업/예시 0(가드①②), 컴팩트.
  - `__tests__/dashboard/dashboard-top-modules-p3.test.ts`(신규) — StatLine KPI3·4상태·§11.311·0회색·summary소스 / GlobalEmpty CTA·정직 / 가드② mock 0 / **page 미배선(격리)** 가드.
- **격리 node 검증:** regex 전부 PASS(route spend·stat 10/10·empty mock 0·page 미배선). summary spend 로직은 `?? 0` passthrough(P1 로직 불변). ⚠️ bash mount staleness로 strip-eval 1회 막힘(파일툴 디스크는 정합) — operator 실 vitest가 로직 권위.
- ✋ Gate(P3-A): 모듈 sentinel GREEN, 가짜 분포 0, page 미배선. **operator 실 vitest+build 대기.** Rollback: 모듈+계약 revert(page 무변경=무영향).
- **다음 P3-B(별도):** page.tsx 에서 useDashboardSection(summary) → state 분기: allEmpty→GlobalEmpty / else→StatLine + SystemInsight 재소스. 현행 ExecutiveSummary KPI/CTA wiring 보존 정렬. (store→summary swap = 회귀 위험, 단독 커밋·smoke.)

### Phase 4: 중단 모듈 — ActionInbox + Pipeline(신규)
- Status: [ ] Pending
- 🟢 ActionInbox: 현행 "가장 먼저 처리"/"다음 작업" 통합(max-h 412 내부 스크롤, 행 클릭 라우팅, empty 0건 정직). **Pipeline 신규**: 견적→발주→입고→재고 4단계, 각 단계 자기 집계 + 클릭 라우팅, **canonical state-machine 상속(가드③)**, empty(0·0·0·0) 회색.
- ✋ Gate: Pipeline 로컬 전이 재정의 0, dead button 0, empty 정직. Rollback: 모듈 revert.

### Phase 5: 하단 모듈 — BudgetSpend / QuickActions / RecentActivity
- Status: [ ] Pending
- 🟢 BudgetSpend: 현행 Spend+Category 정렬, **가짜 차트 제거(가드②), 빈 데이터 차트 미렌더 → "데이터 쌓이면 표시" empty(가드①)**. QuickActions(2×2, OperatorQuickActions 재사용). RecentActivity(최근 이력 재사용, empty 정직).
- ✋ Gate: 가짜 분포 0, 빈 차트 0, wiring 보존. Rollback: 모듈 revert.

### Phase 6: 반응형 + 접근성 + smoke
- Status: [ ] Pending
- 🟢 1180/760/680 브레이크포인트 + 접근성(dialog/menu/aria) + ⌘K/ScanHub/토스트 정합. 라이브 375/데스크탑 smoke(빈 계정 정직 0 + 데이터 시 채워짐).
- ✋ Gate: 반응형 정합, 빈 계정 가짜 0 라이브 확인. Rollback: 스타일 revert.

## 8. Addendum A (Workflow/Ontology)
- Pipeline = workflow 집계 표시(전이는 state-machine SoT 참조, 클릭=해당 모듈 라우팅). dashboard ontology 강노출 금지(quick action/entry 우선).

## 9. Risk
| Risk | P | I | Mitigation |
| :-- | :-- | :-- | :-- |
| 빈 계정 가짜 분포/빈 차트 재발 | Med | **High(정직성)** | 가드①② empty 명세 + sentinel 빈 차트 미렌더 |
| Pipeline 로컬 전이 drift(O1 재발) | Med | High | 가드③ state-machine 상속 sentinel |
| 현행 wiring 재구축 중 회귀(dead button) | Med | High | A 점진(보존) + 모듈별 독립 커밋 |
| summary 단일 진실 이관 중 데이터 불일치 | Med | Med | 계약 sentinel + 점진 이관 |

## 10. Rollback
- 모듈별 독립 커밋 → phase별 revert. summary API no-op 시 현행 분산 fetch 복귀. 데이터 비파괴(읽기).

## 11. Progress
- Overall: 45% (P0·P1 완료 + P2 capMs 머신 push + P3-A 상단모듈 고립 빌드) · Current: P3-A operator 검증 대기 → P3-B 탑재
- Checklist: [x]P0 [x]P1 [x]P2 [~]P3(A 빌드/B 탑재 대기) [ ]P4 [ ]P5 [ ]P6
- [2026-06-15] P1 push READY(94a4da1e). P2 capMs 10s(2.6s 폐기, §11.375 충돌 해소) push. P3-A 고립 빌드(StatLine·GlobalEmpty·summary spend 확장).
- ⚠️ 별 트랙 §suite-red: 전체 dashboard+regression suite 286 fail(91 file) 발견. P2/대시보드 무관(고립 검증). ENOENT-14 가설 철회(전부 통과 가드). 실 vitest 실패목록 → baseline allowlist 후 P3-B 게이트 "신규 fail 0".
- P4 Pipeline 입고 단계에 SmartReceiving 흡수 / P5 최근 알림 제거 — P0 결정 반영.

## 12. Notes
- [2026-06-14] 호영님 결정: 시안(2) 구조 채택, **A 점진**(픽셀 복제 X). 가드 3건(empty 명세·가짜 차트 비반복·Pipeline canonical 상속) 필수. §16p "구조=프로토타입, 동작=기존 보존".
