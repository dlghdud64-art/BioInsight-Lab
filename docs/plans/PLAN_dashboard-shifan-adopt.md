# Implementation Plan: 대시보드 시안 구조 전면 채택 (§dashboard-shifan-adopt)

- **Status:** 🔄 In Progress
- **Started:** 2026-06-15
- **Last Updated:** 2026-06-15

**CRITICAL INSTRUCTIONS** (phase 완료마다): 체크박스 갱신 → quality gate 전수 → Last Updated → Notes → 다음 phase.
⛔ quality gate 실패·SoT 충돌·dead button/no-op/가짜 데이터 시 중단. ⛔ §11.199b 로딩게이트 무수정 보존.

---

## 0. Truth Reconciliation

**Latest Truth Source:** 호영님 라이브 A/B 비교 후 **시안(B) 전면 채택 결정**(2026-06-15) + 시안 HTML 프로토타입(2 스크린샷).
**Secondary:** `PLAN_main-dashboard-redesign.md`(A 점진, 95% 완료), 기존 page.tsx, 빌드된 컴포넌트.
**Conflicts Found:** main-dashboard-redesign P0가 "A 점진(B 픽셀복제 X)" 채택 → 라이브 비교 후 호영님이 B(시안 구조) 재결정.
**Chosen Source of Truth:** 시안 구조 전면 채택(호영님 신규 결정이 직전 A-점진 P0 override). A-점진 산출(컴포넌트·summary·capMs·sentinel)은 **자산으로 재사용**, 레이아웃만 시안으로 재구성.
**Environment:** sandbox=코드+격리 검증. 실 vitest·build·push·smoke=operator/Claude-Chrome. baseline=88(신규 fail 0 게이트). §9.9 준수.

## 1. Priority Fit
- [x] Post-release UX 재구조화(호영님 직접 지시·우선). §policy-pages-refresh 병행 보류.

## 2. Work Type
- [x] Design Consistency · [x] Workflow/Ontology Wiring(ActionInbox) · [x] Feature(레이아웃 재구성)

## 3. Overview
**Description:** 대시보드를 시안 단일 세로 흐름으로 재구성 — StatLine → SystemInsight 다크배너("다음 단계 추천") → ActionInbox("오늘 처리해야 할 일") → Pipeline → (예산&지출 + 빠른작업) → 최근활동. 레거시(시작하기 3단계 hero·중복 "가장 먼저 처리" 배너·중복 운영 KPI 섹션) 제거. **신규 컴포넌트 ~0**(기존 자산 재배열 + ActionInbox 배선).
**Success Criteria:**
- [ ] 시안 순서 단일 흐름 배치
- [ ] ActionInbox 배선("오늘 처리해야 할 일") — dashboardPriorityActions 소스, count>0, 신호등, 행 CTA, dead button 0
- [ ] 레거시 제거(시작하기 hero·중복 배너·중복 KPI) + awareness 공백 0
- [ ] SystemInsight "다음 단계 추천" 다크 배너 재배치
- [ ] §11.199b 로딩게이트 무수정, 무한스켈레톤 0
- [ ] baseline 88 신규 fail 0 + 반응형 + 라이브 smoke
**Out of Scope(⚠️):** 신규 AI/chatbot UI, page-per-feature 분절, summary/capMs 계약 변경(재사용만), §policy 트랙.
**User-Facing Outcome:** 대시보드가 "지금 뭘 해야 하나"(ActionInbox) 중심의 깔끔한 단일 흐름. 잡多/중복 제거.

## 4. Product Constraints
**Must Preserve:** §11.199b 로딩게이트(isStillLoading/loadTimedOut), summary 단일 진실 훅, capMs 10s, canonical truth, AppPageHeader.
**Must Not Introduce:** 가짜 데이터/빈 차트, dead button/no-op, page-per-feature, ontology chatbot화.
**Canonical Truth Boundary:** SoT=/api/dashboard/{summary,stats} + dashboardPriorityActions(page derive). Derived=ActionInbox items/Pipeline counts/StatLine. Persistence=읽기(insight dismiss=sessionStorage).
**UI Surface:** [x] 기존 route 재배열(same-canvas, 신규 page 0)

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-off |
| :-- | :-- | :-- |
| 시안 채택, 컴포넌트 재사용 | 신규 코드↓, 검증 자산 활용 | 레이아웃 재배열·레거시 제거 회귀 위험 |
| ActionInbox = dashboardPriorityActions 소스 | awareness 동일 소스 보존(공백 0) | 가이드형 "다음 작업"과 별개(count형만) |
| 레거시 sentinel 진화 | 보호는 ActionInbox/Pipeline로 이전 증명 | 다수 sentinel 터치 |
**Touched(예상):** `app/dashboard/page.tsx`, `executive-summary-section.tsx`(운영KPI/SystemInsight 분해), action-inbox(배선), sentinel 다수 진화.

## 6. Global Test Strategy
- ActionInbox 배선: priority→items 매핑 단위 + dead button 0 sentinel.
- 레거시 제거: 제거 + awareness 보존(priority count 잔존) sentinel, baseline-delta=0.
- 라이브 smoke: 시안 흐름·무한스켈레톤 0·CTA 동작.

## 7. Implementation Phases

### Phase 0: Truth & 시안 매핑 lock — ✅ Complete (2026-06-15)
- Status: [x] Complete
- **시안 8영역 ↔ 자산 매핑:**

  | 시안 영역 | 자산 | 조치 |
  | :-- | :-- | :-- |
  | 헤더(스캔/운영리포트) | AppPageHeader | 유지 |
  | StatLine(이번달지출/잔여예산/확정발주액) | `stat-line.tsx`(P3-B2 배선됨) | 유지 |
  | SystemInsight 다크 "다음 단계 추천" | `executive-summary-section`의 SystemInsightCard | **분해·재배치**(독립 배너) |
  | ActionInbox "오늘 처리해야 할 일" | `action-inbox.tsx`(P4-A 빌드·미배선) | **배선**(P1) |
  | Pipeline "구매 파이프라인" | `pipeline.tsx`(P4-B1 배선됨) | 유지 + 상태라벨 보강 |
  | 예산&지출 | SpendTrend+Category(BudgetSpend) | 재배치 |
  | 빠른 작업(2×2) | OperatorQuickActions | 재배치 |
  | 최근 활동 | RecentActivity | 재배치 |
  | GlobalEmpty(ALL_EMPTY) | `global-empty.tsx`(배선됨) | 유지 |
- **레거시 제거 목록:** ① "시작하기 3단계" OnboardingHero(→ GlobalEmpty/SystemInsight 흡수) ② 중복 "가장 먼저 처리" 우선순위 배너(→ ActionInbox 대체) ③ ExecutiveSummary 운영 KPI 3(처리필요/진행발주/이상징후 — ActionInbox/Pipeline/StatLine와 중복 → 흡수/제거).
- **ActionInbox 데이터 소스 확정:** `dashboardPriorityActions`(page.tsx ~423-469: {id,label,count,severityRank,helper,href,icon}) → ActionInboxItem{id,label,count,href,tone,detail}. tone = severityRank 1만료/2SLA→danger, 3재고/4입고→warn, 5승인→info. count>0 filter(dead button 0). **"가장 먼저 처리" 배너와 동일 소스 = awareness 공백 0.**
- **가드:** §11.199b 로딩게이트 무수정. 레거시 제거가 깨뜨릴 sentinel(308e priority-banner / density-364 / system-insight-order-362 / processing-kpi-361 등) = phase별 진화 + baseline-delta=0.
- ✋ Gate: 매핑 완전 ✅, 레거시 목록 확정 ✅, ActionInbox 소스 확정 ✅. Rollback: planning-only.

### Phase 1: ActionInbox 배선 + "가장 먼저 처리" 배너 대체 — ✅ Complete (2026-06-15)
- Status: [x] Complete
- **산출:**
  - `app/dashboard/page.tsx` — `actionInboxItems: ActionInboxItem[] = dashboardPriorityActions.map(...)` (tone=severityRank 1만료/2SLA→danger·3재고/4입고→warn·5승인→info) + 레거시 우선순위 배너 섹션 제거 → `<ActionInbox items={actionInboxItems}/>`. 배너 전용 cluster(primaryPriorityAction/secondary/nextPriority/inactiveReason/priorityStageBadges) 제거. dashboardPriorityActions·approvalPendingCount·ArrowRight 보존(타 섹션 사용).
  - `components/dashboard/action-inbox.tsx` — 헤더 "처리 인박스"→"오늘 처리해야 할 일"(시안 정합). count>0 필터·empty·신호등 보존.
  - sentinel: `dashboard-actioninbox-wire-shifan-p1.test.ts`(신규) + **진화 4건** — 308e block2(배너 testid→ActionInbox 대체·awareness 보존), severity-rank-362 it3+회귀(배너 primary 선정→ActionInbox surface, 배열 severity 순 보존), mid-modules-p4(D)/pipeline-wire(D)(ActionInbox 배선됨).
- **awareness 공백 0:** ActionInbox = 레거시 배너와 **동일 소스(dashboardPriorityActions 5 action: 만료/SLA/재고/입고/승인)**. severity 순서 = 배열 .map 순 보존.
- 격리 검증: 배선 14/14 + sentinel 정합 9/9 PASS. dead import/cluster 잔존 0. §11.199b 로딩게이트 무수정.
- ✋ Gate: dead button 0 ✅, awareness 보존 ✅, **operator 실 vitest+build+baseline 88 신규 0+라이브 smoke 대기**. Rollback: page+sentinel revert(배너 복원).

### Phase 2: SystemInsight "다음 단계 추천" 다크 배너 + OnboardingHero 흡수
- Status: [ ] Pending
- 🟢 SystemInsightCard를 ExecutiveSummary에서 분해→독립 다크 배너("다음 단계 추천", dismiss 보존). "시작하기 3단계" hero → GlobalEmpty(빈 계정)/Insight(시작 유도)로 흡수, 레거시 hero 제거.
- ✋ Gate: insight 재소스 정합, hero 제거 후 시작 유도 보존, dismiss 동작. Rollback: hero/insight 복원.

### Phase 3: 시안 순서 재배열 + 중복 KPI 정리 + Pipeline 라벨 보강
- Status: [ ] Pending
- 🟢 page 단일 흐름 재배열(StatLine→Insight→ActionInbox→Pipeline→예산&지출+빠른작업→최근활동). ExecutiveSummary 운영 KPI 3 제거/흡수(ActionInbox·Pipeline·StatLine 중복). Pipeline 상태 라벨 보강(발송대기/안전재고미달). density-364·system-insight-order·processing-kpi sentinel 진화.
- ✋ Gate: 중복 0, 순서 정합, sentinel 진화 GREEN, baseline 88. Rollback: 모듈 순서 revert.

### Phase 4: 반응형 + 종합 smoke + rollback
- Status: [ ] Pending
- 🟢 1180/760/375 반응형 + 접근성 + 종합 라이브 smoke(시안 흐름·무한스켈레톤 0·ActionInbox/Pipeline CTA 동작·빈계정 GlobalEmpty). capstone sentinel 갱신.
- ✋ Gate: 반응형·smoke PASS, baseline 88. Rollback: 스타일 revert.

## 8. Addendum A (Workflow/Ontology — ActionInbox)
- ActionInbox = dashboardPriorityActions(만료/SLA/재고/입고/승인) resolver 출력의 same-canvas surface(행 CTA→해당 route). dashboard ontology 강노출 회피(우선처리 인박스 형태). chatbot/terminal 금지.

## 9. Risk
| Risk | P | I | Mitigation |
| :-- | :-- | :-- | :-- |
| §11.199b 무한스켈레톤 재발 | Med | High | 로딩게이트 무수정 보존 |
| 레거시 제거가 다수 sentinel 깸 | High | Med | phase별 진화 + baseline-delta=0 게이트 |
| ActionInbox awareness 공백 | Med | High | dashboardPriorityActions 동일 소스 |
| "미배선" 가드 충돌(반복 패턴) | Med | Low | 배선 전 전체 sentinel "미배선" 가드 sweep |

## 10. Rollback
- 모듈별 독립 커밋 → phase별 revert. 레거시 제거는 복원 가능(컴포넌트 보존). 데이터 비파괴(읽기). 최악 시 page.tsx 직전 commit revert.

## 11. Progress
- Overall: 35% (P0 매핑 + P1 ActionInbox 배선·배너 대체) · Current: P1 operator 검증(smoke) 대기 → P2(SystemInsight 다크배너 + hero 흡수)
- Checklist: [x]P0 [x]P1 [ ]P2 [ ]P3 [ ]P4

## 12. Notes
- [2026-06-15] 호영님 라이브 A/B 비교 후 시안(B) 채택 결정. A-점진 산출 전부 자산 재사용(신규 코드 ~0). ActionInbox(P4-A 빌드)가 시안 "오늘 처리해야 할 일"에 정합 — P4-B2 보류했던 모델 불일치는 "다음 작업(가이드형)" 한정이었고, 우선처리(count형)엔 적합.
- §policy-pages-refresh: ⓑ(P1 UX+P2) 먼저, ⟦국외이전⟧(Vercel iad1/OAuth US) ⓐ 회신 시 우선 확인 — 호영님 지시.
