# Implementation Plan: 메인 대시보드 모바일 개선 (1a 기본 + 2a 고도화)

- **Status:** ⏳ Pending
- **Started:** 2026-07-20
- **Last Updated:** 2026-07-20 (Phase 3 완료 — 3/4)
- **Estimated Completion:** TBD

**CRITICAL INSTRUCTIONS**: 각 phase 완료 후:
1. ✅ 완료 체크박스 갱신
2. 🧪 quality gate 검증 명령 실행
3. ⚠️ gate 전 항목 통과 확인
4. 📅 "Last Updated" 갱신
5. 📝 Notes 에 learnings 기록
6. ➡️ 그 다음에만 다음 phase 진행

⛔ quality gate skip 금지
⛔ 미해소 source-of-truth 충돌 상태로 진행 금지
⛔ dead button / no-op / placeholder success 도입 금지

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- repo 현재 코드 (`apps/web/src`) + shipped sentinel 테스트
- `CLAUDE.md` — Mobile Patterns §11.311, 신호등 §11.302, amber 금지

**Secondary References:**
- 업로드 지시문 `모바일 대시보드 핸드오프.md` (호영님 2026-07-20)
- 프로토타입 `모바일 대시보드 지시문.html` (512KB, 부분 파싱)
- `docs/handoff/HANDOFF_2026-07-19-quotes-landing.md` §0 — 후보 ② `mobile-density` 재개
- `docs/plans/PLAN_quotes-mobile-density.md` (In Progress, 워킹트리 untracked — **임의 커밋/삭제 금지**)

**대상 Surface (실측):**

| 파일 | 성격 | 영향 범위 |
| :--- | :--- | :--- |
| `components/dashboard/mobile-dashboard-view.tsx` | 모바일 전용 (부모 `md:hidden`) | 모바일만 ✅ |
| `components/dashboard/next-step-banner.tsx` | **공유** | 모바일+데스크탑+견적 토큰 정합 |
| `components/dashboard/action-inbox.tsx` | **공유** | 모바일+데스크탑 |
| `components/operational-brief/floating-entry.tsx` | FAB | 다중 surface |
| `components/layout/bottom-nav.tsx` | 하단 내비 | 전역 모바일 |

**Conflicts Found:**

1. **배너 2줄화 ↔ `§nextstep-banner-density`** — 호영님 2026-06-27 "메인대시보드랑 견적관리 우선추천 크기가 다르다" → `truncate` 1행(~52px) thin화 확정. `nextstep-banner-density-consistency.test.ts` 가 `truncate` 를 명시 강제.
2. **앰버 칩 ↔ §11.302 amber 금지** — `components-amber-removed-302d6d2.test.ts` 가 `src/components/` 를 `walkTsx()` 로 **디렉터리 전체 순회**, `app-wide-amber-removed-302d6d3` 이 앱 전역 강제. 단일 파일 예외 불가.
3. **재고 카드 배경 제거 ↔ 신호등 강도** — 현재 `rose-50/rose-200`. `inventory-kpi-traffic-light-283a` / `302c` 등 신호등 계약 존재.
4. **FAB 스크롤 축소 ↔ 기존 FAB 계약 4종** — `fab-cta-overlap-272e` · `dashboard-fab-collision-fix-271` · `operational-brief-fab-bottom-273e` · `mobile/fab-sweep-252c`.
5. **배너 `✕` 단건 dismiss ↔ 현행 영구 dismiss** — `lab_insight_dismissed="1"` localStorage 영구.
6. **"오늘 할 일 = 실행 큐" 신규 아님** — `ActionInbox` 에 행별 CTA·tone 칩·건수 이미 구현. 실제 delta = `전체 보기 ›` 헤더 + 체크오프.
7. **예산 힌트 카드 삭제** — `summary.budget.isSet` canonical 정직 표기 경로. 통합 시 CTA 보존 필수.

**Chosen Source of Truth:**
- **repo 코드 + shipped sentinel 이 지시문보다 우선.** 지시문은 프로토타입 기반 의도이며, 확정된 제품 규율(§11.302 신호등, amber 금지)과 충돌 시 규율이 이긴다.
- 예외: 호영님이 명시 override 한 항목만 지시문 채택.

**호영님 결정 (2026-07-20):**
- ✅ 계획서 생성 승인
- ✅ 충돌 #1 → **모바일(<768px)만 2줄, `sm↑` thin 유지** (견적 정합 보존)
- ✅ 충돌 #2 → **C 확정: yellow 계열 근사.** 근거(호영님):
  1. 지시문의 amber 헥스(`#fffbeb/#d97706`)는 **디자인 의도 표기이지 토큰 지정이 아님.** 의도 = "주의 = 따뜻한 경고색" → `bg-yellow-50/text-yellow-700`(≈`#fefce8/#a16207`)로 충분히 재현.
  2. 16 amber-removed sentinel + `CLAUDE.md` §9 명문 규율을 색상 1건 때문에 해제하는 것(B)은 비용-편익 역전. 신호등 체계 반전 재검토는 이번 배치 범위 밖.
  3. A와 C의 실질 차이가 없으면 **C = A 로 수렴 허용.** 핵심은 **토큰은 yellow 체계 유지**, 시안과의 시각 차는 **허용 오차**로 간주.

**📐 색상 표기 규약 (호영님 확정, 이후 전 핸드오프에 적용):**
> LabAxis 핸드오프 문서의 **앰버/오렌지 계열 표기는 "warm warning (yellow 토큰)"으로 읽는다.**
> 즉 지시문에 amber 헥스가 나와도 구현 토큰은 `yellow-*`. 필요 시 지시문 색상 표를 yellow 토큰 기준으로 개정.

**Environment Reality Check:**
- [x] repo / branch context 확인 (`ai-biocompare`, origin/main 격차 0)
- [x] runnable 명령 확인 — 아래 F6 참조
- [x] 실행 blocker 식별: sandbox 공유 `node_modules` 설치 금지, prod DB 무접촉

---

## 0-b. Phase 0 실측 결과 (2026-07-20)

**F1 — amber 게이트 해소 ✅**
`components-amber-removed-302d6d2` 실측: `src/components/` recursive walk + regex `(bg|text|border|border-l|from|to|ring)-(amber|orange)-[0-9]`. 현재 offender **0건**. C 결정 시 sentinel 무손 유지 확정 → **Phase 3 게이트 해제.**

**F2 — mobile-density PLAN 정리 ✅**
`PLAN_quotes-mobile-density.md` 3 phase **전부 ✅ Complete**, 본문에 "✅ 트랙 완료 — 목표 위계 달성" 명시. 헤더의 `🔄 In Progress`는 **stale**(operator 게이트 대기 상태일 뿐). 대상 surface 가 **견적(quotes)** 이라 본 트랙(**대시보드**)과 **파일 중복 0** → 흡수 불필요, **정합 관계만 존재**. 워킹트리 untracked 유지(임의 커밋·삭제 금지 규칙 그대로).

**F3 — 신호등 적용범위(#3) 확정 ✅**
`inventory-kpi-traffic-light-302c` 범위 = `app/dashboard/inventory/inventory-main.tsx` **단일 파일**. `mobile-dashboard-view.tsx` 를 참조하는 sentinel **0건**(전 `__tests__` grep 무매치) → 재고 카드 배경 제거는 **신호등 계약 무저촉, 자유**.
⚠️ 단 해당 파일이 **무보호 상태**이므로 Phase 1 에서 신규 sentinel 추가 필수.

**F4 — rose/red 편차 발견 (규율 정합 개선 기회)**
`mobile-dashboard-view.tsx` 실측: `rose-*` **8회**, `red-*` **0회**. `CLAUDE.md` §9 위험 토큰은 `red-*` → 기존 편차. 지시문의 `#b91c1c`/`#fef2f2` = `red-700`/`red-50` 이므로 **Phase 2 가 톤다운과 동시에 규율 정합을 개선**한다.
⚠️ 범위 한정: **재고 경고 카드의 rose 만** red 로 정렬. 전월 대비 증가 표시(`text-rose-600`)는 의미가 다르므로(지출 증가 ≠ 재고 위험) **범위 밖 — 미변경**.

**F5 — ⚠️ 신규 충돌: 모바일 배너 밀도 parity**
mobile-density **P3 가 견적 우선추천을 모바일에서 1행 truncate(~48px)로 thin화 완료**. 본 트랙 Phase 2 는 대시보드 배너를 **모바일 2줄**로 확대 → **모바일에서 두 배너 밀도가 재불일치**한다.
호영님 2026-06-27 지시("메인대시보드랑 견적관리 우선추천 크기가 다르다" → 일치)가 **모바일 한정으로 다시 역전**되는 구조. 데스크탑 parity 는 보존됨.
→ **판정 필요 (Phase 2 착수 전):**
  - (i) **수용** — 역할이 다르다(대시보드=단일 배너/전체 맥락, 견적=리스트 위 배너/리스트 즉시 노출이 목표). 모바일 밀도 차 정당화. **← 권장**
  - (ii) 견적 우선추천도 모바일 2줄로 확대 → parity 복원, 단 quotes surface 로 범위 확대 + `quotes-mobile-density-p3` 갱신
  - (iii) 대시보드 2줄 철회 → 지시문 1a 미이행

  ✅ **호영님 판정(2026-07-20): (i) 수용.** 데스크탑 parity 는 `sm:truncate` 로 계속 잠그고, 모바일 밀도 차는 역할 차이로 정당화. `nextstep-banner-density-consistency` 헤더에 판정 근거 기록 완료.

**F9 — 🔴 검증 방법론 결함 및 교체 (2026-07-20 operator 실측에서 적발)**

operator full `vitest` 실측: `134 file fail / 295 test fail` — baseline(`3741b8a3` 133/294) 대비 **신규 실패 1건**.
- 실패: `dashboard-mobile-refine-p2.test.ts` "canonical 재사용 3종 보존" → `<ActionInbox items={actionInboxItems} />`(self-closing) 를 pin 했는데 Phase 3(2a-1)에서 sandbox 자신이 `viewAllHref` 를 주입 → **자기 변경과 자기 sentinel 충돌.**
- **근본 원인:** sandbox 의 node 검증 하네스가 sentinel 의 정규식을 **다시 타이핑(전사)** 했다. Phase 3 검증 때 `/<ActionInbox/`(느슨)로 옮겨 적어, 실제 파일의 엄격한 pin 을 검사하지 못함 → 거짓 "13/13 GREEN".
- **교체:** 하네스를 **테스트 파일에서 정규식을 추출해 실행**하는 방식으로 전환(`/tmp/sv/run.js`). 문자열 상수·`read()` 바인딩을 해석해 `expect(x).toMatch(/re/)` / `.not.toMatch` 를 원문 그대로 평가하고, 해석 불가한 복합 표현식은 **SKIP 으로 명시 카운트**해 은폐하지 않는다.
- **재검증 결과(4개 파일 원문 실행): PASS 123 · FAIL 0 · SKIP 2.** SKIP 2건(substring 추출형)은 수동 확인 PASS.
- **규칙화:** 이후 sandbox 는 "assertion 을 옮겨 적어" 검증했다고 보고하지 않는다. 원문 실행 결과 + 미해석 건수를 함께 보고한다. **operator full `vitest` 는 여전히 최종 판정.**

**F6 — 실행 환경 확정**
- `apps/web` scripts: `build`(next build) · `lint`(eslint) · `test`(vitest run)
- ❌ **vitest sandbox 실행 불가** — `rollup` native 바이너리가 Windows 전용(`MODULE_NOT_FOUND`), 재설치는 CLAUDE.md 금지 규칙 위반.
- ✅ **대안 확보:** sentinel 은 `readFileSync + regex` 구조라 **plain node 로 동형 재현 가능**(설치 0). Phase gate 검증은 이 방식으로 실증하고, `vitest` / `build` / `lint` 최종 확인은 **클로드코드 operator-shell 또는 호영님 환경**에 위임 — 결과 미확인 시 "실행 불가" 명시, 추정 통과 처리 금지.

---

## 1. Priority Fit

- [ ] P1 immediate
- [ ] Release blocker
- [x] Post-release (상위)
- [ ] P2 / Deferred

**Why:** 핸드오프 §0 후보 ② `mobile-density`(In Progress)와 **동일 영역**. 충돌이 아니라 흡수 대상. 배포 완료된 두 트랙 이후의 자연스러운 후속이며 release blocker 는 아니다. 규제·GMP 미결(DMSO H227·SM-P4d·안전 e2e)보다는 후순위이나, 사용자 대면 밀도 개선이라 backlog 보다는 상위.

---

## 2. Work Type

- [ ] Feature
- [ ] Bugfix
- [ ] API Slimming
- [ ] Workflow / Ontology Wiring
- [ ] Migration / Rollout
- [ ] Billing / Entitlement
- [x] Mobile
- [x] Web
- [x] Design Consistency

---

## 3. Overview

**Feature Description:**
메인 대시보드 모바일 웹(`/dashboard`, <768px)의 시각 밀도와 실행 동선 개선. 재고 경고 카드 톤다운 + 다음 단계 추천 배너 2줄 확대(1a), 실행 큐·지출/예산 통합·역할 분리·온보딩 스텝·FAB·내비 뱃지(2a 6종).

**Success Criteria:**
- [ ] 재고 경고 카드가 흰 카드 + 레드 포인트 톤 (배경 채색 0)
- [ ] 추천 배너가 모바일에서 말줄임 없이 2줄 전문 노출, `sm↑` 는 thin 1행 유지
- [ ] `ActionInbox` 헤더에 `전체 보기 ›`, 행별 CTA 실동작
- [ ] 예산 힌트 카드가 지출 카드에 통합, 스파크라인은 `monthlySpending` canonical 파생
- [ ] 배너에 1/3 진행 점 + 단계 텍스트
- [ ] FAB 이 재고 경고 `처리 ›` 등 터치 타겟을 어떤 상태에서도 가리지 않음
- [ ] 재고 탭 뱃지 = canonical 경고 건수
- [ ] 터치 타겟 ≥ 44px
- [ ] shipped sentinel 회귀 0 (density / FAB 4종 / amber-removed / traffic-light)

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] 데스크탑(`md:block`) 레이아웃 변경
- [ ] 견적 `PriorityRecommendationCard` 변경
- [ ] 신규 페이지 생성 (page-per-feature 회귀)
- [ ] AI / chatbot UI 신규
- [ ] `PLAN_quotes-mobile-density.md` 임의 커밋·삭제
- [ ] 가짜 스파크라인 데이터 (canonical 없으면 미노출)

**User-Facing Outcome:**
모바일 대시보드 첫 화면에서 추천 문구가 잘리지 않고, 재고 경고가 시야를 덜 잡아먹으며, 오늘 할 일에서 바로 행동으로 진입한다.

---

## 4. Product Constraints

**Must Preserve:**
- [ ] workbench / queue / rail / dock
- [ ] same-canvas
- [ ] canonical truth (`summary.budget`, `modules.stock`, `monthlySpending`)
- [ ] invalidation discipline

**Must Not Introduce:**
- [ ] page-per-feature
- [ ] ontology 의 chatbot/assistant 재해석
- [ ] dead button / no-op / placeholder success
- [ ] preview 가 actual truth 를 덮는 구조

**Canonical Truth Boundary:**
- **Source of Truth:** `DashboardSummary` (`summary.budget`, `summary.modules.stock`, `summary.modules.quote`), `monthlySpending`
- **Derived Projection:** `deriveInsight()` 결과, `actionInboxItems`, KPI 카운트, 스파크라인 포인트
- **Snapshot / Preview:** 없음 (도입 금지)
- **Persistence Path:** `localStorage lab_insight_dismissed` (UI state 한정 — truth 아님)

**UI Surface Plan:**
- [x] Existing route section (`/dashboard` 모바일 뷰)
- [x] Inline expand (지출 분석 아코디언 유지)
- [ ] New page — ⚠️ 사용 안 함

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 배너 2줄은 뷰포트 분기(`sm:` prefix)로 격리 | 견적 정합(호영님 2026-06-27)을 데스크탑에서 보존하면서 모바일 가독성 확보 | 배너 JSX 복잡도 증가, density 테스트 갱신 필요 |
| `ActionInbox` 는 신규 작성 대신 최소 diff | 행별 CTA·tone·건수 이미 구현 — 재작성은 회귀 위험만 추가 | 시안과 100% 일치하지 않을 수 있음 |
| 스파크라인은 `monthlySpending` 재사용, 신규 fetch 0 | 가짜 데이터 금지 + overfetch 방지 | 데이터 부족 시 스파크라인 미노출 분기 필요 |
| FAB 변경은 마지막 phase 로 분리 | 4개 shipped 계약 동시 파괴 위험 — 실패 시 이 항목만 defer 가능해야 함 | 전체 완료 시점 지연 |

**Dependencies:**
- Required Before Starting: 충돌 #2(amber) 결정, `PLAN_quotes-mobile-density` 진행상황 재확인
- External Packages: **없음** (sandbox 설치 금지 규칙 준수)
- Touched: `mobile-dashboard-view.tsx` / `next-step-banner.tsx` / `action-inbox.tsx` / `floating-entry.tsx` / `bottom-nav.tsx`

**Integration Points:**
- `summary-derive.ts` (canonical 파생)
- `/dashboard/inventory?filter=low` · `/dashboard/quotes` · `/dashboard/budget` 딥링크
- `section-state` 로딩/에러 계약

---

## 6. Global Test Strategy

Red-Green-Refactor 엄수.

- Design consistency 변경 → **sentinel 테스트**(readFileSync + regex) 필수
- 회귀 보호 → 각 sentinel 에 "회귀 0" describe 블록 필수 (CLAUDE.md 패턴)
- 기존 계약 재검증 대상: `nextstep-banner-density-consistency` · `fab-cta-overlap-272e` · `dashboard-fab-collision-fix-271` · `operational-brief-fab-bottom-273e` · `mobile/fab-sweep-252c` · `components-amber-removed-302d6d2` · `app-wide-amber-removed-302d6d3` · `inventory-kpi-traffic-light-283a`
- baseline-delta 0 원칙 유지

**Execution Notes:**
- 테스트 러너 실행 불가 시 "실행 불가" 명시. 추정으로 통과 처리 금지.

---

## 7. Implementation Phases

### Phase 0: Truth Lock & 충돌 재정 — ✅ Complete (2026-07-20)
**Goal:** 7개 충돌 확정 판정, amber 게이트 해소, mobile-density PLAN 정리.
- Status: [x] Complete

**🔴 RED:** 충돌 #2 미해소 상태로는 Phase 3 불가 — 게이트 명시 ✅
**🟢 GREEN:** amber → **C 확정**(F1) · `PLAN_quotes-mobile-density` **3 phase 전부 Complete 확인, 파일 중복 0 → 흡수 불필요**(F2) · 신호등 적용범위 **무저촉 확정**(F3) ✅
**🔵 REFACTOR:** 지시문 8항목 → **실제 delta 6항목**으로 축소(아래 표) ✅

**✋ Quality Gate:**
- [x] 미해소 충돌 0 — 단 **F5(모바일 parity) 신규 발견 → Phase 2 착수 전 판정 필요**
- [x] 잘못된 가정 0 (전 항목 repo 실측 근거)
- [x] priority fit 문서화
- [x] 코드 변경 0
**Rollback:** 계획 전용 — 코드 변경 없음

**실제 Delta 확정 (지시문 8 → 6항목):**

| 지시문 | 판정 | Phase |
| :--- | :--- | :--- |
| 1a 재고 카드 톤다운 | ✅ 변경 필요 (+ rose→red 정합) | 2 |
| 1a 배너 2줄 | ✅ 변경 필요 (모바일 한정) | 2 |
| 2a-1 실행 큐 | ⚠️ **대부분 기 구현** — delta = `전체 보기 ›` 헤더뿐 | 3 |
| 2a-2 지출+예산 통합 | ✅ 변경 필요 (스파크라인 + 힌트 카드 제거) | 3 |
| 2a-3 역할 분리 | ✅ 변경 필요 (`처리 ›` 딥링크 통일) | 3 |
| 2a-4 온보딩 스텝 | ✅ 변경 필요 (dismiss 계약 변경 수반) | 4 |
| 2a-5 FAB | ✅ 변경 필요 (계약 4종 재검증) | 4 |
| 2a-6 내비 뱃지 | ✅ 변경 필요 | 3 |

### Phase 1: Contract & Failing Tests — ✅ Complete (2026-07-20)
**Goal:** 의도된 동작을 실패 테스트로 먼저 고정.
- Status: [x] Complete

> 📌 **계획 조정 (2026-07-20):** 원안은 Phase 2~4 sentinel 을 Phase 1 에서 일괄 작성이었으나,
> 그 경우 Phase 3·4 미구현분이 장기 red 로 남아 **Phase 2 단독 push 가 pre-push hook 에서 차단**된다.
> → sentinel 작성을 **각 phase 착수 시점으로 분산**하고, Phase 1 은 **Phase 2 계약 확정**으로 한정.
> 보호 강도 동일, 증분 배포 가능. (Phase 3·4 sentinel 은 해당 phase RED 단계에서 작성)

**산출물:**
- 🆕 `src/__tests__/dashboard/dashboard-mobile-refine-p2.test.ts` — 신규 계약 12 + 회귀 0 블록 12
- 🔄 `src/__tests__/dashboard/nextstep-banner-density-consistency.test.ts` — **진화(보호의도 불변)**:
  단독 `truncate` 단정 → `sm:truncate`(데스크탑 정합 유지) + `line-clamp-2`/`sm:line-clamp-none`(모바일 2줄) 조합.
  분기 없는 단독 truncate 회귀 금지 어서션 신규 추가. navy·deriveInsight·dismiss·44px 핀 전부 보존.

**RED 실증 (node 동형 실행, F6 방식):**
- 신규 계약 **12/12 실패** ✅ (진짜 RED — 구현 전 정상)
- 회귀 0 블록 **12/12 통과** ✅ (기존 계약 무손)
- density 진화본: 신규 4 어서션 실패(예상) / 기존 positive 12·negative 5 **전부 통과** ✅
- `components/` amber·orange walk offender **0** ✅ (C 결정 유지)

**🔴 RED:** 신규 sentinel 작성 — 배너 모바일 2줄 분기 / 재고 카드 톤 / `전체 보기 ›` 헤더 / 내비 뱃지 / FAB 상태. 전부 실패 확인
**🟢 GREEN:** 최소 스캐폴딩
**🔵 REFACTOR:** 네이밍·범위 정리

⚠️ **F3 후속 필수:** `mobile-dashboard-view.tsx` 는 현재 **sentinel 0건(무보호)**. 본 phase 에서 해당 파일 전용 sentinel 신규 작성 — 톤/딥링크/canonical 파생/터치 타겟 + "회귀 0" describe 블록(CLAUDE.md 패턴) 포함.

**✋ Quality Gate:**
- [x] 실패가 진짜 실패인지 확인 — node 동형 실행 12/12 RED 실증
- [x] 기존 sentinel 무손 — 회귀 0 블록 12/12 + density 기존 어서션 17/17 통과
- [x] 제품 제약 무저촉 — amber walk offender 0, canonical 3종·딥링크·예산 정직표기 어서션으로 고정
- [x] 프로덕션 코드 변경 0 (테스트 레이어 한정)
- [ ] `vitest` / `build` / `lint` — **sandbox 실행 불가(F6)** → operator-shell 위임, 결과 미기록 상태. **추정 통과 처리 안 함**

**Rollback:** 신규 테스트 파일 삭제 + density sentinel 헤더/어서션 원복 (2 파일, 프로덕션 무영향)

### Phase 2: 1a 기본 2종 — ✅ Complete (2026-07-20)
**Goal:** 재고 경고 카드 톤다운 + 배너 모바일 2줄 분기.
- Status: [x] Complete

**🔴 RED:** Phase 1 sentinel 13/13 실패 확인 ✅
**🟢 GREEN:**
- `mobile-dashboard-view.tsx` 재고 카드 → 흰 카드 + `border-slate-200`(형제 카드와 동일), 아이콘 칩 `h-[22px] w-[22px] rounded-[7px]` + `bg-red-50/text-red-700`, 라벨·숫자 `text-red-700`, 서브텍스트 `text-slate-400` 고정. 0건은 칩까지 회색 비활성(§11.311 #4)
- `next-step-banner.tsx` → 본문 `line-clamp-2 sm:line-clamp-none sm:truncate [text-wrap:pretty]`
**🔵 REFACTOR:** rose→red 정합(F4)을 톤다운과 동시 달성, 배경 분기 삼항 제거로 클래스 단순화

**✋ Quality Gate:**
- [x] 신규 계약 **13/13 GREEN** (node 동형 실행)
- [x] 회귀 0 **16/16 통과** — navy·boxShadow·thin 컨테이너·인라인 아이콘·deriveInsight·CTA·44px·dismiss·canonical 3종·딥링크·예산 정직표기·MoM rose·아코디언·48px
- [x] 데스크탑 무접촉 — `sm:truncate` 로 thin 1행 유지, 견적 정합 보존
- [x] traffic-light sentinel 무손 (302c 범위 = `inventory-main.tsx`, 무저촉)
- [x] amber/orange walk offender **0**
- [x] `next-step-banner` 참조 타 sentinel 2종(`dashboard-nextstep-wire-shifan-p2`) 어서션 무저촉 — `truncate` 계열 단정 없음
- [x] dead button / no-op 0 — 딥링크·아코디언 실동작 보존
- [ ] `vitest` / `build` / `lint` — sandbox 실행 불가(F6) → operator-shell 위임

**Rollback:** 두 파일 각각 독립 revert (프로덕션 diff 2파일 한정)

### Phase 3: 2a 저위험 **3종** — ✅ Complete (2026-07-20) · 뱃지 1종은 F8 로 분리
**Goal:** 실행 큐 헤더 · 역할 분리 · 지출+예산 통합. (내비 뱃지 → **F8, 판정 대기**)
- Status: [x] Complete (3/4 — 2a-6 제외)
- ✅ **게이트 해제** — 충돌 #2 C 확정. amber/orange Tailwind class 도입 0 유지.

**🔴 RED:** 신규 sentinel `dashboard-mobile-refine-p3.test.ts` 작성 후 실패 확인 ✅
**🟢 GREEN:**
- `action-inbox.tsx` — **옵셔널 `viewAllHref` prop** 추가. 주입 시에만 `전체 보기 ›` 렌더(미주입 = 미렌더 → dead button 0). 모바일 뷰만 `/dashboard/inbox`(실재 라우트) 주입 → **데스크탑 `page.tsx` 무접촉**
- `mobile-dashboard-view.tsx` 재고 카드 → 순수 카운트 + `처리 ›` 어포던스. 사유 서브텍스트 제거(실행 큐 helper 와 중복). 목적지는 `page.tsx` `dashboardPriorityActions[id=inventory].href` 와 **동일**(`?filter=low`) — 실측 확인, 신규 라우트 0
- 지출 카드 → **inline SVG 미니 스파크라인**(`monthlySpending` 파생, `useMemo`, 신규 fetch·패키지 0, 표본 <2 이면 `return null` 로 미노출) + 하단 **예산 인라인 바**. 별도 예산 힌트 카드(③) **폐지**, `budget.isSet` 정직 표기와 `/dashboard/budget` CTA 는 통합 위치에 보존
**🔵 REFACTOR:** 카드 1개 제거로 first fold 확보(§11.311 #3), 미사용 `Calendar` import 정리, 예산 바 rose→red 정합

**✋ Quality Gate:**
- [x] 신규 계약 **13/13 GREEN** (node 동형 실행)
- [x] 회귀 0 **10/10 통과** — P2 재고 톤·ActionInbox 기존 계약(count>0 필터·empty 정직·신호등·헤더)·canonical 3종·MoM rose·아코디언·배너 분기·견적 카드 무접촉
- [x] dead button / no-op 0 — `viewAllHref` 미주입 시 미렌더, 전 CTA 실재 라우트
- [x] 예산 미설정 정직 표기 보존 (가짜 집행률 0)
- [x] 스파크라인 가짜 데이터 0 — 표본 2점 미만 미노출
- [x] amber/orange walk offender **0**
- [x] JSX brace/paren 균형 확인 (§11.311 #10 Vercel build 회귀 방지)
- [x] **operator full `vitest` 실측 완료** (2026-07-20) — Phase 3 대상 `dashboard-mobile-refine-p3` **40/40 GREEN**
- [x] **P2 sentinel 자기충돌 1건 적발·수정** — F9 참조. 수정 후 원문 실행 재검증 PASS 123 · FAIL 0 · SKIP 2(수동 PASS)
- [ ] 수정분 반영한 **operator full `vitest` 재실행** — baseline(133/294) 대비 신규 실패 0 확인 필요

**Rollback:** 항목별 독립 revert. `action-inbox.tsx` 는 prop 추가뿐이라 단독 revert 시 모바일 헤더만 사라지고 나머지 무영향.

> ⛔ **F8 — 2a-6 내비 뱃지 판정 필요 (2026-07-20 발견, Phase 3 에서 분리):**
> `bottom-nav.tsx` 는 **완전 presentational** 이며 canonical summary 접근 경로가 없다.
> `dashboard-shell.tsx` L26 주석이 `OpsStoreProvider` 를 "sidebar/bottom-nav badge 카운트 전용"으로
> 지목하지만, 실측 결과 **`OpsStoreProvider` 는 `lib/ops-console/seed-data.ts` 의 고정 seed
> (`ALL_STOCK_POSITIONS = [STOCK_POSITION_001, STOCK_POSITION_002]`)로 초기화**된다.
> → 이 경로로 뱃지를 달면 **실제 재고 경고 건수가 아닌 고정값이 노출**된다.
> **canonical truth 를 UI store 가 대신 드는 구조 + placeholder 표시** = CLAUDE.md 절대 원칙 위반.
> 추가 제약: `BottomNav` 는 `lg:hidden`(<1024) 인데 모바일 대시보드는 `md:hidden`(<768) →
> **768~1024 구간에서는 데스크탑 대시보드와 함께 뱃지가 뜬다**(브레이크포인트 불일치).
>
> **선택지:**
> - (a) **2a-6 defer** — 별도 배치로 분리. 이번 트랙은 3종으로 종결 ← **권장**
> - (b) shell 레벨 canonical provider 신설(summary 훅 승격) — 정공법이나 **구조 변경**, Phase 3 "저위험" 범위 밖. 별도 계획 필요
> - (c) `BottomNav` 내부 신규 fetch — 전 dashboard 라우트에서 실행되는 **overfetch**. 비권장
> - (d) ops-store seed 경로 사용 — ❌ **가짜 카운트. 금지**

### Phase 4: 2a 고위험 2종 + 롤아웃
**Goal:** FAB pill/축소 + 온보딩 1/3 로테이션, 스모크·롤백 확정.
- Status: [ ] Pending

> ⛔ **F7 — 착수 전 판정 필수 (2026-07-20 Phase 2 중 발견):**
> 지시문 **2a-4 온보딩 스텝**(배너 `· 1/3` + 진행 점 + `예산 등록 → 견적 첫 발송 → 재고 등록`)은
> **§dashboard-shifan-adopt P2 (C) 에서 의도적으로 폐지한 "시작하기 3단계 hero" 의 재도입**이다.
> `dashboard-nextstep-wire-shifan-p2.test.ts` L63–70 이 `onboardingSteps` / `dismissOnboarding` /
> `3단계로 운영 흐름을 시작하세요` 를 **명시 금지**한다.
> ⚠️ 해당 sentinel 은 `page.tsx` 만 검사하므로 **배너에 구현하면 기술적으로는 통과** — 그러나 이는
> **sentinel 우회이지 의도 준수가 아니다.** 폐지 결정을 뒤집는 것이므로 임의 진행 금지.
> **판정 필요:** (a) 폐지 유지 → 2a-4 미이행 / (b) 배너 한정 부활(폐지 근거 재검토 + sentinel 범위 갱신) /
> (c) 진행 점 없이 dismiss 단건화만 채택(절충).
>
> **📊 F7 데이터 소스 조사 (operator 요청, 2026-07-20):**
> 3단계는 **전부 canonical 파생 가능 — 하드코딩 아님.** `summary-derive.ts` 실측:
> 예산 등록 → `budget.isSet`(`budget !== null && budget.limit > 0`) / 견적 첫 발송 → `modules.quote.total` /
> 재고 등록 → `modules.stock.total`. (`allEmpty` 가 이미 `quote.total === 0 && … && stock.total === 0` 사용)
> → **dead button / placeholder 위험 낮음.** 즉 F7 은 데이터 무결성이 아니라 **제품 방향 결정**이다.
>
> **제품 쟁점:** `deriveInsight` 는 "가장 시급한 신호 **하나만**" 반환하는 룰베이스이고, 그 우선순위
> (예산 미설정 → 재고 → 견적)가 이미 온보딩 순서를 **암묵적으로** 수행한다. 여기에 `1/3` 진행 점을 얹으면
> 폐지된 hero 의 병렬 서사가 배너 안에서 부활해 "신호 하나" 원칙과 경쟁한다.
>
> **sandbox 권고: (c) 절충** — 진행 점·단계 텍스트는 넣지 않고 **`✕` dismiss 단건화만** 채택.
> 현행 `lab_insight_dismissed="1"` 은 **영구 dismiss** 라 한 번의 ✕ 로 이후 모든 운영 신호가 가려진다.
> 이는 온보딩과 무관하게 고쳐야 할 결함이고, 단건화는 폐지 결정과 충돌하지 않는다.

**🔴 RED:** FAB 4개 계약 + dismiss 계약 변경의 실패 모드 식별, 스모크 경로 정의
**🟢 GREEN:**
- `floating-entry.tsx` → 기본 pill(라벨), 스크롤 다운 시 46px 원형 축소, 최상단 복원. 콘텐츠 하단 ≈88px 여백 확보
- 배너 온보딩 `· 1/3` + 진행 점 + 단계 텍스트, `✕` = 현재 추천만 dismiss(3단계 완료 시 숨김)
**🔵 REFACTOR:** 임시 계측 제거, notes 확정

**✋ Quality Gate:** FAB 4개 sentinel 전부 통과, 터치 타겟 가림 0, dismiss 계약 변경이 canonical 침범 0, 롤백 문서화
**Rollback:** FAB / 온보딩 각각 독립 revert. 실패 시 이 phase 만 defer 하고 Phase 0–3 성과는 유지

---

## 8. Optional Addenda

### D. Mobile Addendum (적용)
**Must Include:** 375px 기준 잘림 0 / 터치 타겟 ≥44px / safe area / 딥링크 정확 목적지 / `md:hidden` 경계 무손

**Validation:**
- [ ] 375px 에서 overflow 0
- [ ] FAB 이 어떤 스크롤 상태에서도 CTA 를 가리지 않음
- [ ] 모든 CTA 딥링크가 실제 목적지 도달 (dead link 0)
- [ ] first fold 내 활동 리스트 1건 이상 노출 (§11.311-3)

---

## 9. Risk Assessment

| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| ~~배너 2줄이 견적과 크기 재불일치~~ → **F5 로 구체화: 모바일 한정 parity 붕괴** | High | Med | 데스크탑 parity 는 뷰포트 분기로 보존됨. 모바일은 (i)수용 권장 — Phase 2 착수 전 판정 |
| ~~amber 도입이 walk sentinel 파괴~~ — **해소됨(C 확정)** | — | — | ✅ yellow 토큰 사용, offender 0 유지 확인 |
| `mobile-dashboard-view.tsx` 무보호 상태에서 변경 | Med | Med | Phase 1 에서 전용 sentinel 신규 작성 |
| sandbox 에서 vitest/build 검증 불가 → 미검증 통과 위험 | High | High | node 동형 실행으로 sentinel 실증 + 최종 검증 operator-shell 위임, 미확인 시 "실행 불가" 명시 |
| FAB 4개 shipped 계약 동시 파괴 | Med | High | Phase 4 로 분리, 단독 defer 가능하게 설계 |
| 재고 배경 제거가 신호등 약화로 해석 | Med | Med | Phase 0 에서 적용 범위 확정 후 진행 |
| 스파크라인이 가짜 데이터/번들 증가 유발 | Low | Med | canonical 파생만, 신규 패키지 0 |
| `PLAN_quotes-mobile-density` 워킹트리 혼입 | Med | Med | add-list 밖 유지, 임의 커밋·삭제 금지 |

---

## 10. Rollback Strategy

- Phase 1 실패 → 테스트 스캐폴딩 revert
- Phase 2 실패 → `mobile-dashboard-view.tsx` / `next-step-banner.tsx` 개별 revert
- Phase 3 실패 → 4개 항목 개별 revert (헤더/역할분리/지출통합/뱃지)
- Phase 4 실패 → FAB·온보딩 개별 revert, Phase 0–3 성과 유지

**Special Cases:** DB migration 없음 · billing 무접촉 · 전부 UI 레이어 revert 로 복구 가능

---

## 11. Progress Tracking

- Overall completion: 75% (Phase 0–3/5, Phase 3 은 3/4 항목)
- Current phase: **Phase 3 ✅ 완료(3종) → Phase 4 는 판정 2건 대기**
- Current blocker: **F7**(온보딩 3단계 — 제품 결정) · **F8**(내비 뱃지 canonical 부재 — operator 도 (a) defer 동의, 호영님 확정 대기)
- Next validation step: P2 sentinel 수정분 반영 후 **operator full `vitest` 재실행**(신규 실패 0 확인) → 커밋 → F7·F8 판정

**Phase Checklist:**
- [x] Phase 0 complete
- [x] Phase 1 complete
- [x] Phase 2 complete
- [x] Phase 3 complete (3/4 — 2a-6 은 F8 로 분리)
- [ ] Phase 4 complete

---

## 12. Notes & Learnings

**Blockers Encountered:**
- [2026-07-20] 지시문 앰버 칩이 `components-amber-removed-302d6d2` 의 디렉터리 walk 검사에 걸림 → 단일 파일 예외 불가 확인. **→ 해소: 호영님 C 확정(yellow 근사), 색상 표기 규약 신설.**
- [2026-07-20] 지시문 "배너 말줄임 제거"가 호영님 본인의 2026-06-27 지시(견적 정합 thin화)와 정면 충돌 → **해소: 뷰포트 분기 승인.** 단 F5(모바일 parity)로 잔여 판정 1건 발생.
- [2026-07-20] sandbox vitest 실행 불가(`rollup` Windows 네이티브, 재설치 금지) → **해소: sentinel 은 node 동형 실행으로 실증, 최종 검증 operator-shell 위임.**
- [2026-07-20 · Phase 3 중] **F8 발견** — `OpsStoreProvider`(shell 주석상 "bottom-nav badge 카운트 전용")가 `seed-data.ts` 고정 seed 로 초기화됨을 실측. 이 경로로 뱃지를 달면 **가짜 카운트** → 2a-6 을 Phase 3 에서 분리, 판정 대기. 브레이크포인트 불일치(`lg:hidden` vs `md:hidden`)도 함께 기록.
- [2026-07-20 · Phase 2 중] **F7 발견** — 지시문 2a-4 온보딩 3단계가 §dashboard-shifan-adopt P2 (C) 의 "시작하기 hero 폐지" 결정과 충돌. sentinel 이 `page.tsx` 만 검사해 **배너 구현 시 우회 통과** 가능 → 임의 진행 금지, Phase 4 게이트로 승격. **판정 대기.**

**Implementation Notes:**
- 지시문 2a-1 "오늘 할 일 = 실행 큐"는 `ActionInbox` 에 이미 대부분 구현되어 있어 실제 delta 는 헤더 링크뿐. **재작성 금지.**
- 배너 dismiss 계약(영구 → 단건) 변경은 Phase 4 로 분리 — 기존 사용자의 `lab_insight_dismissed="1"` 상태 처리 방침 필요.
- **색상 표기 규약(호영님 2026-07-20):** 이후 LabAxis 핸드오프의 앰버/오렌지 표기 = "warm warning(yellow 토큰)". 지시문 색상 표 개정은 호영님 요청 시 수행.
- `mobile-dashboard-view.tsx` 의 `text-rose-600`(전월 대비 증가)은 재고 위험과 의미가 달라 **범위 밖 미변경** — 후속 배치에서 별도 판단.
- `PLAN_quotes-mobile-density.md` 헤더 `In Progress` 는 stale(본문 3 phase 전부 Complete). **본 트랙과 파일 중복 0** 이므로 이번 배치에서 건드리지 않음 — operator 게이트 확인 시 원 맥락에서 종결 처리 권장.
