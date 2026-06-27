# Implementation Plan: §pricing-sot-unify-p4 — 가격 단일 SoT 일원화 (PLAN_PRICES 파생)

- **Status:** ✅ Complete (코드 land 준비 · operator-shell 값불변 게이트 대기)
- **Started:** 2026-06-27
- **Last Updated:** 2026-06-27
- **Work Type:** Billing / Entitlement (refactor, 값불변)

**CRITICAL INSTRUCTIONS** (phase 완료마다):
1. ✅ 체크박스 갱신  2. 🧪 quality gate 실행  3. ⚠️ gate 전 항목 통과  4. 📅 Last Updated  5. 📝 Notes  6. ➡️ 다음 phase
⛔ quality gate 실패/충돌 미해소 진행 금지 · dead button/no-op/placeholder success 금지 · 가격 값 변경 금지(순수 파생).

---

## 0. Truth Reconciliation
**Latest Truth:** §pricing-redesign P1~P3 land(cec64fb7). 가격 = Basic 89,000 / Pro 259,000.
**가격 정의 3소스 (수기 중복):**
- `lib/plans.ts` `PLAN_PRICES`{TEAM 89000, ORG 259000} — 연간 함수 SoT(P1 단일화 완료).
- `lib/plans.ts` `PLAN_DISPLAY.monthlyPrice`(89000/259000) + `priceDisplay`("₩89,000/월" 문자열) — PLAN_PRICES와 별도 수기.
- `lib/billing/plan-descriptor.ts` `priceMonthlyKrw`(team 89000/business 259000) — 별도 수기.

**Conflicts / 매핑 subtlety:**
- `intentToWorkspacePlan`(plan-select.ts)은 **WorkspacePlan**(FREE|TEAM|ENTERPRISE), business→TEAM·enterprise→ENTERPRISE. *가격*은 **SubscriptionPlan**(FREE|TEAM|ORGANIZATION): Pro(business)=ORGANIZATION 259k. → 가격 파생엔 별도 intent→SubscriptionPlan(가격용) 매핑 필요(WorkspacePlan 매핑 재사용 금지).

**Chosen SoT:** `lib/plans.ts PLAN_PRICES`(SubscriptionPlan 키). PLAN_DISPLAY·descriptor는 여기서 파생.
**Environment:** sandbox vitest 불가(rollup 네이티브) → 정적 replay + operator-shell 권위 게이트. push 클로드코드 단독.

## 1. Priority Fit
- [x] Post-release / P2-일원화 (§pricing-redesign §0 명시). honesty/유지보수("가격=한 곳만 수정"). P1 충돌 0.

## 2. Work Type
- [x] Billing / Entitlement (refactor)

## 3. Overview
**기능:** 가격 89k/259k 의 수기 중복(3소스)을 제거하고 `PLAN_PRICES` 단일 SoT에서 파생. 향후 가격 변경 = PLAN_PRICES 한 곳만 수정.

**Success Criteria:**
- [ ] `PLAN_DISPLAY.monthlyPrice`·`priceDisplay` = PLAN_PRICES 파생(수기 89000/259000/"₩…" 리터럴 0).
- [ ] `descriptor.priceMonthlyKrw` = PLAN_PRICES 파생(intent→SubscriptionPlan 가격 맵 경유, 리터럴 0).
- [ ] 전 소비처(/pricing·dashboard/pricing·settings/plans·billing·checkout) 표시 가격 **값 불변**(89k/259k).
- [ ] 신규 회귀 0 · baseline 불변.

**Out of Scope (⚠️ 구현 금지):**
- [ ] WorkspacePlan↔SubscriptionPlan enum 이중성 정리(별도 batch)
- [ ] 가격 값 변경 · Stripe price id 재매핑 · §11.30x-cleanup

**User-Facing Outcome:** 변화 없음(값 동일). 내부 유지보수성만 향상.

## 4. Product Constraints
**Must Preserve:** canonical truth(PLAN_PRICES)·4카드·1mo-free·dead button 0·기존 표시 가격 값
**Must Not Introduce:** import cycle · 가격 값 drift · placeholder · fake
**Canonical Truth Boundary:** SoT=`PLAN_PRICES`(SubscriptionPlan). Derived=PLAN_DISPLAY·descriptor.priceMonthlyKrw·priceDisplay 문자열. Persistence: 없음(순수 상수 파생).
**UI Surface Plan:** [x] 변경 없음(파생 리팩토링, 표시 동일).

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-offs |
|---|---|---|
| descriptor가 plans.ts(PLAN_PRICES) import | 단일 SoT 파생 | 단방향 의존(cycle 0: plans.ts는 tracking-mode만 import) |
| intent→SubscriptionPlan **가격** 맵 신설 | business=ORGANIZATION(Pro 259k) 정확 매핑 | WorkspacePlan 맵과 별개(혼동 주의) |
| priceDisplay = 포매터(formatKrw(PLAN_PRICES)) | 문자열도 파생 | 포맷 변경 시 포매터 1곳 |

**Touched(예상):** `lib/plans.ts`(PLAN_DISPLAY 파생) · `lib/billing/plan-descriptor.ts`(priceMonthlyKrw 파생 + 가격 맵) · 신규 sentinel. (소비처 코드는 무변경 — 값 동일.)
**Integration Points:** /pricing·dashboard/pricing·settings/plans·billing·checkout-utils·api/billing (전부 읽기만, 파생값 동일).

## 6. Global Test Strategy
- 파생 정확성: 단위/sentinel(readFileSync+regex) — 리터럴 0 강제 + 런타임 값 89k/259k 유지(plan-descriptor.test 기존 toBe(89000) 보존).
- 소비처 값불변: operator-shell 권위 baseline-delta(신규 RED 0).

## 7. Implementation Phases

### Phase 0 — Context & Truth Lock — [ ]
**🔴** 3소스 중복·매핑 subtlety 확정, 가격 리터럴 핀 sentinel 전수 grep
**🟢** intent→SubscriptionPlan 가격 맵 값 확정(starter=FREE/team=TEAM/business=ORGANIZATION/enterprise=null), 값불변 보장
**🔵** 스코프 축소(enum 이중성 비건드림)
**✋ Gate:** 충돌 0·리터럴 핀 목록 확보·cycle 0 확인  **Rollback:** planning-only

### Phase 1 — 계약 & 실패 테스트 — [ ]
**🔴** sentinel(RED): plans.ts PLAN_DISPLAY monthlyPrice 수기 리터럴 0(파생) · descriptor priceMonthlyKrw 수기 리터럴 0(파생) · 런타임 값 89000/259000 유지
**🟢** 최소 계약 스캐폴딩(formatKrw·가격 맵 시그니처)
**🔵** 명명 정리
**✋ Gate:** 실패테스트 real·기존 GREEN 유지·typecheck 문서화  **Rollback:** sentinel revert

### Phase 2 — plans.ts 내부 일원화 — [ ]
**🔴** PLAN_DISPLAY 파생 단위테스트(monthlyPrice===PLAN_PRICES, priceDisplay===formatKrw)
**🟢** `formatKrw(n)` 헬퍼 + PLAN_DISPLAY.monthlyPrice = PLAN_PRICES[key] · priceDisplay = formatKrw(PLAN_PRICES[key])+"/월"
**🔵** 중복 제거
**✋ Gate:** 값불변(89k/259k)·문자열 동일("₩89,000/월")·cycle 0  **Rollback:** PLAN_DISPLAY 리터럴 복원

### Phase 3 — descriptor 파생 — [ ]
**🔴** descriptor priceMonthlyKrw 파생 단위테스트(team===PLAN_PRICES[TEAM], business===PLAN_PRICES[ORG])
**🟢** intent→SubscriptionPlan 가격 맵 + priceMonthlyKrw 파생(리터럴 89000/259000 제거). plan-descriptor.test toBe(89000/259000) GREEN 유지(값 동일)
**🔵** import 정리(단방향)
**✋ Gate:** 값불변·cycle 0·getPlanPriceMonthly 동일  **Rollback:** descriptor 리터럴 복원

### Phase 4 — Smoke / 회귀 / Rollback — [ ]
**🔴** 소비처 값불변 실패모드 정의
**🟢** operator-shell: 전 소비처 가격 표시 89k/259k 확인·baseline-delta 신규 RED 0·tsc/build EXIT 0
**🔵** notes 정리
**✋ Gate:** 값불변 확인·rollback 문서·잔여 격리  **Rollback:** 파생 3 phase 각 단독 revert(리터럴 복원)

## 8. Addenda
**B. Billing/Entitlement:** 값불변이라 결제/표시 영향 0. logged-in·checkout 흐름 무변경.

## 9. Risks
| Risk | P | Impact | Mitigation |
|---|---|---|---|
| 가격 맵 오매핑(business≠ORG) | Med | High | Phase 0 값확정 + sentinel runtime toBe(259000) |
| 가격 리터럴 핀 sentinel(missed-sweep) | Med | Med | 파생 전 전수 grep(89000/259000/"₩89/259") |
| import cycle | Low | Med | plans.ts→tracking-mode만, descriptor→plans 단방향 확인 |

## 10. Rollback Strategy
- P1 실패: sentinel revert
- P2 실패: PLAN_DISPLAY 리터럴 복원
- P3 실패: descriptor priceMonthlyKrw 리터럴 복원 + 가격 맵 제거
- P4 실패: 파생 전체 revert(값 동일이라 무해)

## 11. Progress Tracking
- Overall: 100%(코드) · Current phase: operator-shell 값불변 게이트 대기 · Blocker: 없음 · Next: push
- [x] P0  [x] P1  [x] P2  [x] P3  [x] P4(정적, operator-shell 권위 대기)

**Notes:** 2026-06-27 구현. formatKrwMonthly 헬퍼 + PLAN_DISPLAY(TEAM/ORG monthlyPrice·priceDisplay)·descriptor.priceMonthlyKrw(starter/team/business) 전부 PLAN_PRICES 파생. 수기 89k/259k 리터럴 0. cycle 0(plans.ts→tracking-mode만). 값불변(plan-descriptor.test toBe(89000/259000) 보존). 정적 replay 20/20 GREEN. 향후 가격 변경 = PLAN_PRICES 한 곳만.

## 12. Notes & Learnings
- 2026-06-27: 계획 생성. 범위 A(가격 3소스 일원화만, enum 이중성 제외). 값불변 refactor — sentinel은 "수기 리터럴 0 + 런타임 값 89k/259k 유지" 이중 강제.
