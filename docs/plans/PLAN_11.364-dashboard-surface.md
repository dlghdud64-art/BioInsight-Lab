# Implementation Plan: §11.364 대시보드 + 재고 surface 정비

- **Status:** ⏳ Pending
- **Started:** 2026-06-04
- **Last Updated:** 2026-06-04
- **호영님 P1 (2026-06-04), 승인 완료 (Q1 병합 / Q2 가드레일 / Q3 생성)**

**CRITICAL INSTRUCTIONS** (phase 완료 시):
1. ✅ 체크박스 갱신  2. 🧪 quality gate 검증(Claude Code: tsc/lint/test)  3. ⚠️ 전 항목 통과 확인
4. 📅 Last Updated 갱신  5. 📝 Notes 기록  6. ➡️ 통과 후에만 다음 phase

⛔ quality gate 실패/소스충돌 미해소 상태로 진행 금지. dead button / no-op / placeholder success 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source:** 현 배포 `0f0345d1` (origin/main = Vercel production READY).

**Secondary References:** 호영님 D-1~D-6 지시문(2026-06-04) — **배포 반영 전 화면 기준**.

**Conflicts Found / 완료분 제외:**
- D-4 (재고 필터 빈상태) = §11.361-2 완료 (`inventory-main` L1498-1516 3분기, lot_issue 커버). **제외.**
- D-5 (로드 가짜 빈상태 flash) = §11.361-1c 완료 (`dashboard/page` L237 가드). **제외.**
- D-6a (운영 현황 "s" stray) = §11.358-1#4 완료 (suffix 0). **제외.**

**Chosen Source of Truth:** 코드(배포 `0f0345d1`)가 지시문 화면보다 우선. 잔여 = D-1, D-2, D-3, D-6b, D-6c.

**Environment Reality Check:**
- [x] repo/branch: main, 배포 동기화 확인
- [x] runnable: 코드 편집·sandbox grep 가능 / ⚠️ vitest·tsc·build = sandbox 불가(node_modules 소실) → Claude Code 전용
- [x] execution blockers: sandbox push 금지(통제구조), page.tsx bash mount 부분복사 → Read 툴 검증

## 1. Priority Fit
- [x] P1 immediate (호영님 P1). release-prep와 비충돌(UI 정비).
- 우선순위: **D-1+D-2(병합) > D-3 > D-6**. D-1 = 최고 레버리지·최고 리스크(canonical 역할 분리).

## 2. Work Type
- [x] Design Consistency  [x] Canonical(액션존↔네비존 역할 분리)  [x] Web
- same-canvas 유지, 신규 페이지 0, page-per-feature 회귀 0.

## 3. Overview

**Feature Description:** 대시보드 정보구조를 액션존(예외 전용 실행)↔네비존(순수 진입)으로 분리하고, 운영 바로가기 카드의 데코 컬러바를 신호등 dot으로 절제, 밀도(KPI/배너/빈차트/데스크탑 2-col) 정비. FAB 충돌·랜딩 리빌 폴리시.

**Success Criteria:**
- [ ] 같은 액션(입고/발송 등) 실행 CTA = 화면 1곳(상단 액션존)에만 존재.
- [ ] 운영 바로가기 = 클릭 라우팅 + 읽기 배지만, 자체 처리 동작 0.
- [ ] 카드 의미 없는 색상 면적 0 — 색은 §11.302 신호등 dot(상태값)에만.
- [ ] 데스크탑 첫 폭에 "지금 할 일"이 큰 KPI 카드보다 먼저 도달.
- [ ] 회귀 0 (sentinel readFileSync+regex 항목별).

**Out of Scope (⚠️ 구현 금지):**
- [ ] D-7 (지출 분석 IA 재배치 / 지출·예산 surface 중복 정리) — **별도 batch.**
- [ ] §0 AI 정책 톤다운 (✨ 스파클·AI 라벨 전역) — **별도 batch (전 surface 횡단).**
- [ ] ontology→chatbot 재해석, support hero hub 회귀, page-per-feature 분절.

**User-Facing Outcome:** 운영자가 "지금 할 일"을 상단에서 한 번에, 바로가기는 단순 진입으로 인지. 시각 노이즈 감소.

## 4. Product Constraints

**Must Preserve:** [x] workbench/queue/rail/dock  [x] same-canvas  [x] canonical truth(count display-only)  [x] invalidation

**Must Not Introduce:** [ ] page-per-feature  [ ] chatbot 재해석  [ ] dead button/no-op/placeholder success  [ ] preview가 truth 덮기

**Canonical Truth Boundary:**
- Source of Truth: stats API(재고/발주/견적/만료/SLA 집계), 발송 truth=견적 워크벤치.
- Derived Projection: 대시보드 KPI·priority·바로가기 배지(전부 display-only).
- Persistence Path: 변경 0 (UI 재배치/시각만).

**UI Surface Plan:** [x] Existing route section (dashboard/page + operator-quick-actions, same-canvas). 신규 페이지 0.

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| D-1+D-2 병합(1 phase) | 동일 컴포넌트(operator-quick-actions §11.93) 단일 터치 → 회귀 표면·리뷰 비용 절반 | phase가 약간 커짐(구조+시각 동시) |
| 바로가기 = 순수 네비 | 액션 중복 제거, 실행은 상단 단일화 | 발송 진입 동선 보존 필요(가드레일) |
| 컬러바→신호등 dot | §11.302 정합, 데코 색 제거 | 기존 tone accent sentinel 갱신 필요 |

**Touched:** `components/dashboard/operator-quick-actions.tsx`, `app/dashboard/page.tsx`, `components/operational-brief/floating-entry.tsx`, 랜딩 섹션 컴포넌트(`app/_components/*`).

## 6. Global Test Strategy
- Design/구조 변경 → sentinel(readFileSync+regex) 항목별 회귀 보호 필수.
- 사용자 동선(발송 진입) → Chrome smoke(라우팅 dead-end 0).
- ⚠️ 테스트 실행 = Claude Code(`npm run test`). sandbox = grep 정합 사전검증만.

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
- Status: [ ] Pending
- 🔴 완료분(D-4/5/6a) 제외 확정(위). **Q2 가드레일 선결**: 상단 액션존(priority banner)이 "견적 발송 대기"를 커버하는지 코드 확인.
- 🟢 priority 후보(현재 만료/SLA/재고/입고/승인 — §11.362-1/2)에 견적 발송 대기 포함 여부 판정.
- 🔵 범위 동결.
- ✋ Gate: 충돌 0, 가드레일 결론 도출. **Rollback:** planning-only.

### Phase 1: D-1 + D-2 — 액션존↔네비존 분리 + 컬러바→신호등 dot (최우선)
- Status: [ ] Pending
- 🔴 sentinel 작성(실패 확인): 바로가기 발송 CTA 부재 / 카드 `border-l-2` 컬러바 부재 / 신호등 dot 존재 / 카드 클릭 라우팅 보존.
- 🟢 operator-quick-actions:
  - 발송 관련 Link/Button(L220·230 등) 제거 → 카드 클릭=워크벤치 라우팅만(순수 네비), count 배지 읽기전용 유지.
  - 좌측 `border-l-2 ${tone.accent}` 제거 → §11.302 신호등 dot 1개(빨강 결품/노랑 검토/정상 무표기·회색). 본문 무채색.
- 🔵 tone accent map 정리, 중복 제거.
- ✋ Gate: **발송 진입 동선 보존(상단 액션존이 발송 대기 커버 확인됐을 때만 CTA 제거; 미커버면 상단에 먼저 추가 후 제거)** / dead-end 0 / no-op 0 / 색은 상태값에만 / 기존 §11.93·§11.243 sentinel 정합.
- **Rollback:** operator-quick-actions 단일 파일 revert.

### Phase 2: D-3 — 밀도 정비
- Status: [ ] Pending
- 🔴 sentinel: KPI 카드 컴팩트 클래스 / 인사이트 배너 1줄 muted / 빈 차트 접기 / 데스크탑 2-col 분기.
- 🟢 KPI 높이 축소(§11.311-1: p-3 md:p-4, text-lg md:text-xl), 인사이트 배너 → KPI 행 흡수 또는 1줄 muted(§11.311-3), 빈 차트 0건 시 접기/컴팩트 라인, 데스크탑(lg+) 상단 액션존 좌(디테일)·우(액션) 2-컬럼.
- 🔵 데드스페이스 제거.
- ✋ Gate: 모바일 §11.311 회귀 0(375px) / 데스크탑 첫 폭에 "할 일" 우선 도달 / 큰 빈 박스 0.
- **Rollback:** dashboard/page 레이아웃 블록 revert.

### Phase 3: D-6b + D-6c — 폴리시 (FAB / 랜딩 리빌)
- Status: [ ] Pending
- 🔴 sentinel: FAB 위치/라벨(챗봇 미인상) / 랜딩 2번째 섹션 리빌 트리거.
- 🟢 FAB(floating-entry): 모바일 하단 탭바 코너 충돌 재진단(§11.252c 기존 72px 위), 위치 조정 또는 라벨/아이콘 점검(AI 어시스턴트처럼 안 읽히게). 랜딩 2번째(재고 목업) 리빌 뷰포트 진입 보장 또는 리빌 제거.
- 🔵 정리.
- ✋ Gate: FAB↔탭바 충돌 0 / 챗봇 재해석 0 / 랜딩 흐릿 멈춤 0.
- **Rollback:** floating-entry / 랜딩 섹션 개별 revert.

### Phase 4: Smoke / Rollback / Rollout
- Status: [ ] Pending
- 🔴 smoke path 정의: 발송 진입 / 바로가기 라우팅 / 모바일·데스크탑 첫 폭.
- 🟢 Claude Code tsc/lint/test/build → 푸시 → 배포 → Chrome 재검증(375px + 데스크탑).
- 🔵 임시 계측 제거, Notes 정리.
- ✋ Gate: 회귀 0, rollback 문서, 잔여 blocker 격리.
- **Rollback:** 항목 단위 revert(각 phase 독립).

## 9. Risk Assessment

| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 발송 CTA 제거 → 발송 진입 고아화 | Med | High | Phase 0 가드레일: 상단 커버 확인 후 제거(미커버 시 상단 추가 선행) |
| D-3 데스크탑 2-col → 모바일 §11.311 회귀 | Med | Med | 반응형 분기(lg+ 한정) + 375px sentinel |
| 컬러바 제거 시 기존 tone sentinel 충돌 | Low | Low | sentinel 갱신(데코 색 부재 가드) |
| 동일 파일 다회 터치 | Low | Med | D-1+D-2 병합으로 단일 터치 |

## 10. Rollback Strategy
- Phase 1 실패: operator-quick-actions revert. Phase 2: page 레이아웃 revert. Phase 3: floating-entry/랜딩 revert. 각 독립.

## 11. Progress Tracking
- Overall: 95% · Current phase: Phase 3 완료 (D-6) · Blocker: 없음 · Next: Phase 4 (smoke/Chrome 재검증 — 배포 후)

**Phase Checklist:** [x] P0  [x] P1  [x] P2  [x] P3  [ ] P4

**Phase 3 완료 (D-6) — 재진단 우선·gold-plating 금지:**
- D-6b FAB: **무작업 종결**. bottom-[72px](§11.252c)+scroll-lock hidden(§11.272d) 이미 충돌 해결. Sparkles 아이콘=§0 batch.
- D-6c 랜딩 리빌: 실작업. final-cta Reveal `margin:"-60px"`(트리거 지연→흐릿 멈춤) → `amount:0.15`. sentinel `landing-reveal-trigger-364`.
- Phase 4(smoke)는 배포 후 Chrome 재검증 단계 — 코드 작업 완료.

**Phase 2 완료 (D-3) — 호영님 결정(기계 적용 금지):**
- (1) KPI 밀도: KpiCard p-5→p-4, mb-4→mb-3, 아이콘 w-12→w-10, hint mt-2→mt-1.5, bar mt-5→mt-3. value 폰트 text-3xl/[32px]→text-2xl md:text-3xl(24-30 유지, 과축소 금지).
- (3) 빈 차트: §11.243b#4 P0 우선 → mockup 유지(접기 철회). 조건①클린스왑(isEmpty 배타삼항)·②예시 캡션 sentinel 보호.
- (2)(4) 무작업(이미 충족). sentinel `dashboard-kpi-density-364`. 충돌 0(252d3=SystemInsightCard 대상).

**Phase 0 가드레일 결론 (2026-06-04):**
- 상단 priority 후보(§11.362-1/2 = 만료/SLA/재고/입고/응답도착)에 "견적 발송 대기" **미커버** 확정 (respondedQuotes=응답 도착 ≠ 발송 대기).
- 호영님 **방법 A 승인**: quotes 카드를 제거가 아닌 **균질 네비 카드로 강등**(워크벤치 href 보존) → 발송 진입 동선 보존 + 상단 추가 불필요. 발송 대기는 "네비 큐"로 분류(예외 액션 아님).

**Phase 1 완료 (D-1+D-2):**
- operator-quick-actions 재작성: quotes 특수 분기(expand/summary/CTA) 제거 → 4 카드 균질 Link. ACTIONS[0]="견적 발송"+워크벤치 href(발송 동선 보존). useState/button/TONE_MAP 제거.
- D-2: 좌측 border-l 컬러바 제거, 아이콘 무채색(slate), 건수 배지 §11.302 노랑.
- sentinel: 신규 `dashboard-quick-actions-nav-364`, 갱신 `operator-quick-actions-responsive`·`dashboard-quote-dispatch-card-evidence`·`operator-quick-actions-amber-removed-308d`·`operator-quick-actions-252a`(강등 supersede).
- 정합: 보존 패턴 전부 매칭, 부재 단언 전부 0, page.tsx counts 4키 forward 정합. ⚠️ vitest = Claude Code.

## 12. Notes & Learnings
- [2026-06-04] D-4/5/6a 코드 대조로 완료 확인 → 범위 제외. 추측 없이 코드 우선.
- [2026-06-04] Q1 D-1+D-2 병합(동일 컴포넌트), Q2 발송 동선 가드레일, Q3 생성 승인.
- D-7(지출 IA)·§0(AI 정책) = §11.364 범위 밖, 별도 batch 예약.
