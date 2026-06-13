# Implementation Plan: ② 소싱 워크벤치 CTA·token 통일 (shared variant)

- **Status:** ⏳ Pending
- **Started:** 2026-06-13
- **Last Updated:** 2026-06-13
- **Estimated Completion:** TBD (medium, ~5 phases)
- **Tracker:** `#sourcing-cta-unify` (detail-page surface 트랙 ② — ①③④ 완료 후 마지막)

**CRITICAL INSTRUCTIONS** — 각 phase 완료 시:
1. ✅ 체크박스 체크  2. 🧪 quality gate 검증  3. ⚠️ gate 통과 확인  4. 📅 Last Updated  5. 📝 Notes  6. ➡️ 다음 phase

⛔ quality gate 실패 / dead button·no-op·placeholder success 도입 / 시각 회귀 시 진행 금지.
⛔ 이 트랙은 **스타일 토큰 통일만** — CTA wiring(mutation/navigation/persistence)·canonical truth·문구는 **불변**.

---

## 0. Truth Reconciliation

**Latest Truth Source (실측):**
- `src/components/ui/button.tsx` — `buttonVariants`(cva). variant: `default`(`bg-blue-600 text-white hover:bg-blue-700`)·`destructive`·`outline`(slate-300/white)·`secondary`(`bg-el`)·`ghost`·`link`. size: `default`(h-10)·`sm`(h-9)·`lg`(h-11)·`icon`(h-10 w-10). #P02-button-type(type="button" 기본) 보존.
- 소싱 워크벤치 = `src/app/_workbench/_components/*.tsx` (76 파일).

**Conflicts Found (실측 — 추정 아님):**
- ⚠️ **D1 — bespoke CTA 난립:** 76 tsx 중 **44개가 `bg-blue-600` 인라인, 46개가 `bg-emerald-600` 인라인** 하드코딩. 62개가 공유 `Button` import하면서도 className으로 덧칠.
- ⚠️ **D2 — primary blue 시그니처 10종+:** `hover:bg-blue-500`(9) vs canonical `hover:bg-blue-700`(2), font `medium`/`semibold`/없음 혼재. 톤 변형 `bg-blue-600/[0.04]`·`/15`·`/30` 난립.
- ⚠️ **D3 — emerald CTA 무 variant:** "견적/입고/담기" 류 emerald CTA가 canonical variant 부재 → 전부 bespoke. (그래서 surface가 인라인을 굴림.)

**Chosen Source of Truth:**
- `Button`/`buttonVariants`가 CTA 스타일 SoT. surface는 **variant 사용**, bespoke className 금지(예외: 진짜 일회성 위치 보정만).
- 색 체계 = §11.302 신호등(blue=CTA/active·selected, green/yellow/red=status 전용, **amber 금지**). CLAUDE.md Mobile §9 정합.

**Environment Reality Check:**
- [x] runnable: `npx vitest run <file>`, `next build`(호영님 pre-push)
- [x] blocker: sandbox commit/checkout 불가(index.lock) → 변경 sandbox, commit/push 클로드코드. **변경 후 brace 균형 + git diff net-insertion 점검 필수**(이번 세션 desync 빈발 교훈).

---

## 1. Priority Fit
- [ ] P1 immediate  [ ] Release blocker  [x] Post-release (surface polish)  [ ] P2
- **Why:** detail-page surface 트랙 ②(호영님 원래 순서 ①④→③→②)의 마지막. ①③④ 완료. 위험 낮음(스타일만), 시각 일관성·유지보수성 향상.

## 2. Work Type
- [x] Design Consistency  [x] Web  [ ] Migration(스키마 0)  [ ] Feature

## 3. Overview
**Feature Description:** 소싱/견적 워크벤치 surface들이 굴리는 bespoke CTA className(`bg-blue-600 hover:bg-blue-500 h-7 …`·`bg-emerald-600 …`)을, `Button`의 **canonical variant**로 흡수한다. 누락 variant(emerald success·compact size)를 추가해 surface가 variant만 쓰게 한다. wiring·문구·truth 불변.

**Success Criteria:**
- [ ] `buttonVariants`에 누락 variant 추가(예: `success` emerald, compact size `xs`) — §11.302 정합
- [ ] core 소싱 surface(row·rail·cart·review·candidate)의 primary/secondary CTA가 bespoke className → variant 전환
- [ ] hover/weight 단일화(`hover:bg-blue-500` ↔ `700` 혼재 해소)
- [ ] 시각 회귀 0(전환 전후 동일 톤·크기), wiring/onClick 불변
- [ ] sentinel: canonical 시그니처 lock + core surface bespoke 부재

**Out of Scope (⚠️ 금지):**
- [ ] 76 파일 전수 한 번에 (core 먼저 → 나머지 follow-on 배치)
- [ ] status tone(green/yellow/red) 전면 sweep — 별 트랙(§11.302d)
- [ ] amber→yellow 전역 sweep — 별 트랙
- [ ] CTA wiring/문구/navigation 변경, 신규 페이지, 비-소싱 surface

**User-Facing Outcome:** 소싱 화면 버튼 톤·크기·hover가 일관 — 같은 의미 CTA가 같은 모양. 동작은 그대로.

## 4. Product Constraints
**Must Preserve:** workbench/queue/rail/dock·same-canvas·canonical truth·CTA wiring·문구·#P02-button-type.
**Must Not Introduce:** dead button/no-op/placeholder success·page-per-feature·신규 AI UI·시각 회귀·amber.
**UI Surface Plan:** [x] 기존 컴포넌트 in-place 스타일 전환  [ ] New page(금지)

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 누락 variant를 `buttonVariants`에 추가 후 surface 전환 | SoT 단일화, surface는 variant만 | cva 확장 1회 + 소비처 migration |
| core surface 먼저, 나머지 배치 | 위험·리뷰 부담 분산 | 일시적 혼재(배치 사이) — sentinel로 core만 강제 |
| `default` hover 값 통일 신중 | 기존 default 소비처 광범위 | hover 변경 시 비-소싱 default 버튼 영향 → Phase 0에서 영향 측정 후 결정 |

**Touched:** `components/ui/button.tsx`(variant 추가), core 소싱 `_workbench/_components/*`(row·rail·cart·review·candidate), sentinel 신규.

## 6. Global Test Strategy
- variant 추가 → sentinel(buttonVariants에 canonical 시그니처 존재) + `next build`.
- surface 전환 → sentinel(core surface에 bespoke `bg-blue-600 hover:bg-blue-500` 부재 + variant 사용) + 시각 수동 1회(전후 비교).
- 회귀: onClick/wiring/문구 보존(sentinel 명시 매칭), §11.302 amber 부재.
- 실행 불가 시 "실행 불가" 명시.

## 7. Implementation Phases

### Phase 0: Inventory & Variant Spec Lock
- Status: [ ] Pending
- **🔴 RED:** 소싱 CTA 역할 분류(primary blue / success emerald / analysis blue / compact size / status), `default` hover 통일이 비-소싱 default 소비처에 미치는 영향 측정.
- **🟢 GREEN:** 추가할 variant·size 명세 확정(이름·class), §11.302 정합 확인.
- **🔵 REFACTOR:** core surface 6~8개로 1차 범위 한정.
- **✋ Gate:** 추가 variant 명세 단일 확정, hover 통일 영향 문서화, 회귀 위험 식별.
- **Rollback:** planning-only.

### Phase 1: Sentinel (RED)
- Status: [ ] Pending
- **🔴 RED:** (a) buttonVariants에 신규 variant 존재; (b) core surface에 bespoke `bg-blue-600 hover:bg-blue-500` 부재 + variant 사용; (c) 회귀 — onClick/wiring/문구 보존, amber 부재. 실패 확인.
- **✋ Gate:** 실패 test 실재, 기존 suite GREEN.  **Rollback:** sentinel revert.

### Phase 2: Extend buttonVariants
- Status: [ ] Pending
- **🟢 GREEN:** `success`(emerald, §11.302 정보 CTA)·compact size(`xs` h-7/h-8 text-xs) 등 누락분 추가. `default` hover는 Phase 0 측정대로 단일화. cva만 — 소비처 영향 0(추가는 비파괴).
- **✋ Gate:** `next build` GREEN, 기존 버튼 시각 불변(default 영향 측정 반영), sentinel a) GREEN.  **Rollback:** cva revert.

### Phase 3: Migrate Core Surfaces
- Status: [ ] Pending
- **🟢 GREEN:** row·rail·cart·review·candidate의 bespoke CTA className → variant. 위치 보정(w-full/gap)만 className 유지. onClick/문구/상태 분기 불변.
- **🔵 REFACTOR:** 중복 제거, 시각 parity 확인.
- **✋ Gate:** sentinel b)·c) GREEN, dead button/no-op 0, 시각 회귀 0(수동 전후), `next build`.  **Rollback:** surface 전환 revert(variant는 유지 가능).

### Phase 4: Follow-on Batch + Smoke
- Status: [ ] Pending
- **🟢 GREEN:** 나머지 소싱 surface(quote workqueue·reentry 등) 배치 전환. 라이브 smoke(소싱 화면 버튼 일관·동작 보존).
- **✋ Gate:** 잔여 bespoke 카운트 감소 추적, smoke PASS, rollback 문서화.

## 8. Risk Assessment
| Risk | P | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| `default` hover 통일이 비-소싱 버튼 변모 | Med | Med | Phase 0 영향 측정 → 변경 최소화/별 처리 |
| 시각 회귀(톤·크기 미세 차) | Med | Low | variant를 기존 값과 동일 매핑, 수동 전후 비교 |
| 대량 파일 migration 중 desync 손상 | Med | Med | 배치 소량 + brace/diff 점검 루틴 |
| bespoke 흡수하며 wiring 실수 절단 | Low | High | onClick/문구 sentinel 명시 매칭, 스타일만 diff |

## 9. Rollback Strategy
- Phase 1 실패: sentinel revert. Phase 2: cva revert(소비처 무영향). Phase 3/4: surface 전환 revert(variant 유지 가능, 점진). 스키마/데이터 변경 0.

## 10. Progress Tracking
- Overall: 0% · Current: Phase 0 대기 · Blocker: 없음 · Next: 소싱 CTA 역할 분류 + hover 영향 측정.
- Phase Checklist: [ ] P0 [ ] P1 [ ] P2 [ ] P3 [ ] P4

## 11. Notes & Learnings
- [2026-06-13] 실측: 76 tsx, 44 bg-blue-600 / 46 bg-emerald-600 인라인, primary blue 10종+ 시그니처. emerald CTA canonical variant 부재가 bespoke 원인.
- 이번 트랙은 스타일만 — wiring/truth/문구 불변(회귀 0이 최우선).
- To Revisit: status tone 전면 sweep·amber→yellow 전역(별 트랙).
