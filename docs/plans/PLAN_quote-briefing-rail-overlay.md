# Implementation Plan: 견적 브리핑 레일 — overlay 전환 + 접기 폐기

- **Status:** 🔄 In Progress
- **Started:** 2026-06-29
- **Last Updated:** 2026-06-29
- **Estimated Completion:** 2026-06-29

**CRITICAL INSTRUCTIONS**: 각 phase 완료 시 체크박스 갱신 → quality gate 통과 확인 → Last Updated 갱신 → Notes 기록 → 다음 phase. ⛔ gate 실패 시 진행 금지. ⛔ source-of-truth 충돌 미해소 시 진행 금지. ⛔ dead button / no-op / placeholder success 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source:** 업로드 "견적관리 브리핑 레일 수정 핸드오프.md" (호영님 2026-06-28).

**Secondary References:**
- 코드: `apps/web/src/app/dashboard/quotes/page.tsx` (4937줄)
- sentinel: quote-briefing-collapse-toggle(§11.248e-2), quotes-workbench-rail-overlay-B(§rail B), quote-briefing-panel-responsive(§11.248e), preferences-briefing(§11.230c)

**Conflicts Found:**
1. 핸드오프 "세로 BRIEFING 탭 = 우하단 플로팅 버튼 = 같은 패널" ↔ **코드: 세로 탭 → ① 견적별 레일(`selectedQuote`) / 우하단 FAB(`OperationalBriefFloatingEntry`) → ② 전역 popup(`useOperationalBriefPopup`) — 서로 다른 surface.**
2. `§quotes-workbench-rail B`(1440+ push, 호영님 a) ↔ 신 핸드오프(테이블 항상 풀폭 overlay).

**Chosen Source of Truth:**
- 충돌1: **코드 사실** 채택. 세로 탭은 ①만 재펼침. ②(전역 popup)은 본 작업 범위 밖(불변).
- 충돌2: **신 핸드오프** 최신 → `§rail B` 1440-push supersede(항상 overlay).
- 접기 메커니즘: 호영님 결정 "접기 폐기 + 순수 overlay" (2026-06-29). overlay가 항상 풀폭이라 "접어서 폭 회복" 목적 소멸.

**Environment Reality Check:**
- [x] repo/branch: main, HEAD 68758268
- [x] runnable: cowford=정적검증, operator-shell=vitest/tsc/build/push
- [x] 실행 블로커: sandbox vitest 불가(rollup native) → operator 권위

## 1. Priority Fit
- [x] **Release blocker** — 견적 운영 surface 회귀(브리핑 열면 가로 스크롤·컬럼 찌그러짐 + 중복 진입점). 호영님 directed 활성 트랙.

## 2. Work Type
- [x] Bugfix · [x] Design Consistency (same-canvas overlay)

## 3. Overview

**Feature Description:** 견적별 브리핑 레일(①)을 ≥1200px 항상 overlay로 전환(1440+ in-flow push 제거)해 테이블을 항상 풀폭 유지. 우측 세로 "BRIEFING" 탭 + 접기(collapse) 메커니즘 폐기, 진입=행 선택 / 닫기=X·Esc.

**Success Criteria:**
- [ ] ≥1440px 브리핑 열어도 테이블 폭 불변(가로 스크롤·컬럼 잘림 0)
- [ ] 우측 세로 BRIEFING 탭 어떤 폭에서도 0
- [ ] X(헤더)·Esc로 닫힘, 행 재선택 시 패널 갱신(클릭 유지)
- [ ] <1200px bottom-sheet 불변

**Out of Scope (⚠️ 절대 구현 금지):**
- [ ] 퍼널 리디자인 / BatchActionBar floating (트랙 2)
- [ ] ② 전역 운영 브리핑 popup 거동
- [ ] preferences DB 컬럼 제거 (클라 wiring만 제거, 서버 필드·route·hook 보존 = backwards-compat)
- [ ] 데스크탑 click-to-close backdrop (§common "행 클릭 유지"와 충돌 → X/Esc로 닫기)

**User-Facing Outcome:** 브리핑을 열어도 표가 안 밀리고 가로 스크롤이 사라짐. 우측에 붙어있던 세로 탭 제거로 진입점 혼선 해소.

## 4. Product Constraints

**Must Preserve:** workbench/queue/rail/dock · same-canvas · canonical truth · `selectedQuote` gating · w-[480px] · 운영 브리핑 헤더 · `closeQuoteContextRail` · break-keep · 44px · mobile sheet(min-[1200px]:hidden)

**Must Not Introduce:** page-per-feature · chatbot 재해석 · dead button/no-op · preview가 truth 덮기

**Canonical Truth Boundary:**
- Source of Truth: `selectedQuoteId` (URL query selected) → `selectedQuote`
- Derived: signals/opStatus
- Snapshot/Preview: 없음
- Persistence: URL query(selected). (접기 상태 서버영속 §11.230c 클라 wiring 폐기)

**UI Surface Plan:** [x] Right dock(overlay, ≥1200) · [x] Bottom sheet(<1200, 불변)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 1440+ push → 항상 fixed overlay | 테이블 풀폭 보장(핸드오프) | 와이드 화면서 패널이 표 위를 덮음(의도) |
| 접기 메커니즘 폐기 | overlay라 폭 회복 목적 소멸 | 접기 선호 서버영속 retire |
| backdrop 생략, X/Esc 닫기 | §common 행 클릭 유지 | 핸드오프 backdrop 미반영(flag) |

**Integration Points:** `closeQuoteContextRail`(1480, 기존) · Esc useEffect(1496, 기존) · X 버튼(3772, 기존) · 패널 className(3707)

## 6. Global Test Strategy
- UI 구조 변경 → sentinel(readFileSync+regex) 진화. operator vitest 권위.
- 영향: collapse-toggle(retire), rail-overlay-B(push→overlay evolve), preferences-briefing(page 클라 단언 retire·route/helper 보존), panel-responsive(보존 전부 GREEN — 진화 0).

## 7. Implementation Phases

### Phase 0: Context & Truth Lock — [x] Complete
caller map(366/1232/1237-51/1307-25/3673-85/3694-96/3714-22) + sentinel 4종 영향 확정. X/Esc 기존 존재 확인. ✋ Gate: 충돌 해소 ✓

### Phase 1: Sentinel Reconcile — [ ]
- collapse-toggle: 전면 retire(접기 단언 사망), 생존 invariant(w-480·mobile sheet·운영 브리핑·gating·closeRail·break-keep·44px)만 유지 + 신(세로탭 0·isBriefingCollapsed 0·항상 overlay).
- rail-overlay-B: 1440 push 단언 retire, 항상 overlay(min-[1200px]:fixed/right-4/z-30/shadow-2xl present, min-[1440px]:sticky 0).
- preferences-briefing: page #3(server hydration·updateBriefingCollapsed) + LS-key 단언 retire, route/helper/columnPrefs invariant 보존.
- ✋ Gate: 신 단언이 현 코드 기준 RED(구현 전), 생존 invariant GREEN.

### Phase 2: Implement — [ ]
- 제거: 세로탭(3673-85)·접기버튼(3714-22)·`isBriefingCollapsed` state(1232)·LS effect(1236-51)·서버 hydration/PATCH effect(1306-25)·`if(isBriefingCollapsed) return null`(3694-96)·`BRIEFING_COLLAPSED_LS_KEY`(366).
- 패널 className(3707): `min-[1440px]:sticky/right-auto/z-auto/shadow-none/ml-5/self-start` 토큰 제거 → 항상 overlay.
- 미사용 import 정리(ChevronsLeft/ChevronsRight 잔여 확인).
- <1200 sheet·X·Esc 불변.
- ✋ Gate: tsc/build EXIT 0, dead button 0.

### Phase 3: Gate & Live — [ ]
operator: tsc/build·quotes sentinel(진화 3종 GREEN·panel-responsive GREEN)·baseline 신규 RED 0 → push → 배포 → 라이브(≥1440 push 0·세로탭 0·X/Esc·<1200 시트).
- ✋ Gate: 배포 READY, 검수 통과.

## 9. Risk Assessment

| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| `isBriefingCollapsed` 제거가 모바일 시트 동기에 얽힘 | Low | Med | Phase 0 grep 완료 — 모바일 시트는 briefSheetOpen 별개, 얽힘 없음 |
| 패널 fixed 전환 시 표 컨테이너 잔여 gap | Low | Low | 1200-1439는 이미 fixed로 동작 중 → 1440+ 동일 거동 |
| preferences route/helper 잔존 필드 orphan | Low | Low | 서버 필드 보존(backwards-compat), 클라만 제거 |

## 10. Rollback Strategy
- Phase 1 실패: sentinel 3종 revert
- Phase 2 실패: page.tsx 1파일 revert(HEAD)
- Phase 3 실패: 커밋 revert(1파일)

## 11. Progress Tracking
- Overall: 25%
- Current phase: Phase 1
- Blocker: 없음
- Next: sentinel 진화 작성

## 12. Notes & Learnings
- [2026-06-29] X 버튼(3772)·Esc(1496) 기존 존재 → FIX1은 순수 제거. backdrop은 §common 충돌로 생략(X/Esc 대체).
- [2026-06-29] 핸드오프 "두 진입점=같은 패널" 전제 오류 — 세로탭(①)/FAB(②) 별개 surface. 코드 사실 채택.
