# Implementation Plan: 견적 퍼널 — Floating 선택바(§4) + 테이블 빈상태 톤(§5)

- **Status:** 🔄 In Progress
- **Started:** 2026-06-29
- **Last Updated:** 2026-06-29

**CRITICAL**: 각 phase 완료 시 체크박스 갱신 → quality gate 통과 → Notes 기록 → 다음 phase. ⛔ gate 실패 시 진행 금지. ⛔ dead button / no-op / placeholder success 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source:** 업로드 "견적관리 퍼널 리디자인 핸드오프.md" (호영님 2026-06-28).

**Conflicts / 현황 대조:**
- §2 단계 퍼널: 핸드오프 "복원" ↔ **이미 구현됨** — `QuoteFunnel`(page 2336), 5단계·현재집중·`onStageClick`→`setStatusFilter`(2341). → verify-only.
- §3 액션존 단일화: ↔ **이미 구현됨** — `PriorityRecommendationCard`(page 2348), 단일 우선 추천 카드(computePriority 룰베이스). → verify-only.
- §4 Floating 선택바: ↔ **델타** — `BatchActionBar`(page 2422)가 `sticky top-2 z-30`(in-flow) → 선택 시 테이블을 아래로 밀어냄. 핸드오프 = 하단중앙 `fixed` floating(테이블 안 밀림, slide-up).
- §5 테이블 가독성: ↔ 부분 — 빈상태 태그 존재하나 disabled 회색 톤 점검 필요.

**Chosen Source of Truth:** 핸드오프 §4/§5만 코드 변경. §2/§3은 기존 구현 보존(회귀 위험 회피). 호영님 결정(2026-06-29): "기존 BatchActionBar 개조" + 스코프 §4+§5.

**Environment:** main HEAD 135e8cbd. operator-shell=vitest/tsc/build/push 권위. tailwindcss-animate 가용(slide-up OK).

## 1. Priority Fit
- [x] Post-release UX 개선(견적 운영 surface). 호영님 directed, §4가 "가장 중요"(다건 일괄 처리 UX).

## 2. Work Type
- [x] Design Consistency · [x] Bugfix(선택 시 테이블 push 제거)

## 3. Overview

**Success Criteria:**
- [ ] 행 선택 시 BatchActionBar가 하단중앙 floating으로 떠오름(slide-up), **테이블 안 밀림**
- [ ] 선택 0건 시 미노출(기존 conditional 보존)
- [ ] 내부 CTA(검토 시작/리마인더/상태 변경/선택 해제)·dropdown·preflight 합산 truth-lock
- [ ] §5: 테이블 빈상태 셀이 disabled 회색이 아닌 의도적 muted 태그

**Out of Scope (⚠️):**
- [ ] §2 퍼널 / §3 액션존 코드 변경(이미 구현, verify-only)
- [ ] BatchDispatchSheet/Reminder/StatusChange 내부 로직
- [ ] 데모 토글(시안 §7 전용 — 미구현)

**User-Facing Outcome:** 견적 다건 선택 시 액션바가 화면 하단에 떠서 테이블이 밀리지 않음. 빈 셀이 "비활성"이 아닌 "상태 표기"로 읽힘.

## 4. Product Constraints
- Must Preserve: workbench/queue/rail/dock · same-canvas · BatchActionBar 내부 truth(getQuoteDispatchPreflight 합산) · conditional render(0건 null)
- Must Not Introduce: dead button/no-op · preview가 truth 덮기 · page-per-feature
- Canonical Truth: selectedQuoteIds(Set) → dispatchable/hardBlock/reminderEligible(preflight 합산, page-level). 본 작업 = 위치/스타일만, truth 변형 0.
- UI Surface: [x] Floating overlay(하단중앙 fixed) — same-canvas, 신규 page 0.

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| BatchActionBar outer `sticky top-2` → `fixed left-1/2 bottom-6` | 핸드오프 §4: 테이블 안 밀림 | 하단중앙 = 우하단 운영 FAB와 좁은 화면 근접 가능(점검) |
| slide-up = tailwindcss-animate `animate-in slide-in-from-bottom` | 플러그인 가용·기존 사용례 다수 | 조건부 mount 진입 애니메이션(충분) |
| §2/§3 verify-only | 이미 구현·회귀 회피 | 핸드오프 "복원" 표현과 형식상 차이(실질 동일) |

**Integration:** `BatchActionBar`(page 2422 render, 변경 0) · component outer wrapper(batch-action-bar.tsx L106) · sentinel `quotes-page-217-phase3-action-bar`(sticky 단언 1개 진화).

## 6. Test Strategy
- §4: sentinel `quotes-page-217-phase3-action-bar` it "sticky positioning" → fixed bottom 단언 진화(나머지 it·c1·tooltip·selection 무영향). operator vitest 권위.
- §5: 시각 폴리시 — sentinel 강제 약함. 변경 셀 회귀 보호만.

## 7. Phases

### Phase 0: Truth Lock — [x] Complete
§2/§3 구현 확인 · §4 BatchActionBar sticky top-2 확인 · sentinel sticky 단언 1개(217-phase3) 확정 · tailwindcss-animate 가용 확인.

### Phase 1: §4 Floating 선택바 — [ ]
- sentinel: 217-phase3 it "sticky positioning" → `fixed` + 하단중앙(bottom/left-1/2) 단언, z- 유지. comment(c1 L10 stale) 정합.
- impl: batch-action-bar.tsx outer `sticky top-2 z-30 ... shadow-sm` → `fixed left-1/2 -translate-x-1/2 bottom-6 z-40 ... shadow-lg max-w-[calc(100vw-40px)] animate-in slide-in-from-bottom-4 fade-in duration-200`. 내부 truth-lock.
- ✋ Gate: tsc/build 0, 217-phase3 GREEN(진화), batch sentinel 무영향 GREEN, dead button 0.

### Phase 2: §5 테이블 빈상태 톤 — [ ]
- 테이블-뷰 빈상태 셀 audit(회신 미수신/공급사 미정/단계) → disabled 회색(text-slate-300/400) → 의도적 muted 태그(slate-500 + soft pill). 회색 disabled 금지.
- ✋ Gate: 회귀 0, 빈상태 가독 개선, dead button 0.

### Phase 3: Gate & Live — [ ]
operator tsc/build·batch sentinel·baseline 신규 RED 0 → push → 배포 → 라이브(선택 시 floating·테이블 안 밀림·<sm 미겹침).

## 9. Risks

| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 하단중앙 floating ↔ 우하단 운영 FAB 겹침(<sm) | Med | Low | bottom-6·max-w calc, 라이브 점검; 필요 시 FAB와 stagger |
| 217-phase3 외 다른 sentinel이 sticky 단언 | Low | Med | Phase 0 grep — c1=주석만, 단언 0 확인 |
| §5 시각 판정 auth 필요 | Med | Low | disabled-회색만 보수적 교체, 라이브 호영님 확인 |

## 10. Rollback
- Phase 1: batch-action-bar.tsx + sentinel revert
- Phase 2: page.tsx 셀 톤 revert
- Phase 3: 커밋 revert

## 11. Progress
- Overall: 15% · Current: Phase 1 · Blocker: 없음

## 12. Notes
- [2026-06-29] 핸드오프 4항목 중 §2/§3 이미 구현 — 실제 델타 §4(주)+§5(경). §4 = BatchActionBar sticky→fixed bottom floating.
