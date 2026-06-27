# Implementation Plan: §pricing-copy-cleanup — /pricing PO 문구 전면 치환 + trial 정책 플래그

- **Status:** ✅ Complete (코드 land 준비 · operator-shell 게이트 대기)
- **Started:** 2026-06-27
- **Last Updated:** 2026-06-27
- **Work Type:** Design Consistency (copy) + Billing/Entitlement (trial flag, 데이터만)

**CRITICAL INSTRUCTIONS** (phase 완료마다):
1. ✅ 체크박스 2. 🧪 quality gate 3. ⚠️ 전 항목 통과 4. 📅 Last Updated 5. 📝 Notes 6. ➡️ 다음
⛔ gate 실패 진행 금지 · dead button/no-op/placeholder success 금지 · **백엔드 미비 기능(trial·annual 실청구) 사용자 노출 금지(fake claim)**.

---

## 0. Truth Reconciliation
**Latest Truth:** §pricing-redesign P1~P4 land(201b83d7). P1이 `maxPurchaseOrdersPerMonth` field 제거(PO 한도 폐기)했으나 /pricing·settings 카드 카피의 PO 문구는 미정리 = **부분 반영 회귀**(호영님 2026-06-27 화면 확인).
**PO 카피 잔존 (descriptor.features):**
- Free "PO 발행 무제한"(L113) · Basic "요청 후 PO 추적"(L153)·"PO 발행 무제한"(L157) · Pro "발주 전 승인 1단계"(L195)·"PO 발행 무제한"(L199) · Enterprise "기관 승인 매트릭스 · PO 감사 추적"(L231)
- /pricing 비교표 "발주 준비·운영 큐" 행 · settings 카드(descriptor 통과).
- (Free "RFQ 5건/PO 5건"은 P3 cec64fb7에서 이미 "RFQ 3·발주 무제한"으로 수정 — stale build면 화면에 옛값 보일 수 있음.)
**결제 백엔드 현황 (★ honesty 게이트):**
- 주 결제 플로우(/pricing→settings/plans→CheckoutDialog→`/api/organizations/[id]/subscription`) = **DB upsert만, Stripe·billingCycle 처리 0**.
- 실 Stripe route(`/api/billing/checkout`)는 **MONTHLY price ID만**·`STRIPE_SECRET_KEY` 게이트·`settings/billing` 한 곳에서만 호출. 연간 interval·trial_period_days **미배선**.
- trial-START는 **Stripe webhook**에서만 설정(gated). 주 플로우 trial 시작 0 → **작동하는 30일 체험 메커니즘 없음**.
**Chosen Source of Truth:** descriptor.features = 카드 카피 SoT. trial 자격 = descriptor 플래그(`trialEligible`).
**결론:** PO 카피 치환 = 백엔드 무관·즉시 가능. trial 노출(30일 체험)·annual 실청구 = 백엔드 미비 → **사용자 노출 OOS**(별도 결제 트랙). 데이터 플래그만 이번에.

## 1. Priority Fit
- [x] Post-release. PO 문구 잔존은 **P1 PO 제거의 부분 반영 회귀** → 우선 정리. trial 정책은 데이터만(저위험).

## 2. Work Type
- [x] Design Consistency (copy) · [x] Billing/Entitlement (trialEligible 플래그 데이터)

## 3. Overview
**기능:** 4카드+settings+비교표의 PO(발주) 명사 카피를 견적·재고·추적 가치로 치환(기능 약속 후퇴 0). trial=Basic 정책을 descriptor 데이터 플래그로 명문화(노출은 안 함).

**Success Criteria:**
- [ ] descriptor.features·/pricing 비교표·settings 카드에서 "PO 발행"·"발주 준비"·"PO 추적"·"PO 감사" 등 PO 명사 카피 0. 가치는 견적/재고/추적/승인 단계로 보존.
- [ ] descriptor `trialEligible`: Basic=true / Free·Pro·Enterprise=false (데이터만).
- [ ] "30일 무료 체험" 등 trial 사용자 노출 0 (메커니즘 전까지). annual 실청구 OOS.
- [ ] 신규 회귀 0 · 값/CTA route 무변경 · dead button 0.

**Out of Scope (⚠️ 구현 금지 — 별도 결제 백엔드 트랙):**
- [ ] "30일 무료 체험" 배지/CTA 노출 · trial-START 메커니즘(Stripe trial_period_days)
- [ ] 연간 결제 실청구 배선(Stripe yearly price/interval) · 주 플로우 Stripe 연결
- [ ] §11.30x-cleanup(별도)

**User-Facing Outcome:** 카드에서 PO 전문용어 사라지고 운영 가치 언어로. 가격·CTA·체험 노출 변화 없음.

## 4. Product Constraints
**Must Preserve:** 4카드·1mo-free 토글·canonical(descriptor)·실기능 차별점(Pro 승인 단계·Enterprise 감사)·dead button 0
**Must Not Introduce:** 백엔드 없는 trial/annual 노출(fake) · 기능 약속 후퇴 · page-per-feature
**Canonical Truth Boundary:** SoT=descriptor.features/trialEligible. 노출=카드·비교표. trial/annual 실행=결제 백엔드(OOS).
**UI Surface Plan:** [x] 기존 카드/비교표 카피 수정 — 신규 surface 0.

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-offs |
|---|---|---|
| PO 명사 제거·가치 보존 reframe | P1 PO 폐기 정합·기능 약속 유지 | 카피 톤 재작성 |
| trialEligible 데이터 플래그(노출 X) | 정책 명문화하되 fake 노출 회피 | 노출은 결제 트랙 대기 |
| trial/annual 노출 OOS | 메커니즘 부재 = fake claim 방지 | 기능 완성은 결제 트랙 |

**Touched:** `lib/billing/plan-descriptor.ts`(features 카피 + trialEligible) · `app/pricing/page.tsx`(비교표 행) · (settings/plans는 descriptor 통과 — 무변경 예상) · 신규 sentinel.
**Dependencies:** 없음(카피·데이터). 결제 백엔드 트랙과 독립.

## 6. Global Test Strategy
- sentinel(readFileSync+regex): PO 명사 카피 0 + 가치 카피 존재 + trialEligible 값 + trial 사용자 노출 0.
- 값/CTA 무변경: operator-shell baseline-delta 신규 RED 0.

## 7. Implementation Phases

### Phase 0 — Context & Truth Lock — [ ]
**🔴** PO 카피 인벤토리·trial/annual 백엔드 부재 확정 · 기능 차별점(승인/감사) 보존 카피 초안
**🟢** trialEligible 값 확정(Basic only) · 치환 카피 확정(견적/재고/추적/승인 단계)
**🔵** 신규 surface 0 확인
**✋ Gate:** PO 카피 목록 확보·기능 약속 후퇴 0 카피·trial 노출 OOS 명시  **Rollback:** planning-only

### Phase 1 — 계약 & 실패 테스트 — [ ]
**🔴** sentinel(RED): descriptor/비교표 PO 명사 0 · 가치 카피 존재 · trialEligible Basic만 true · "30일 무료 체험"/"무료 체험" 사용자 카피 0
**🟢** 최소 스캐폴딩
**✋ Gate:** 실패테스트 real·기존 GREEN 유지  **Rollback:** sentinel revert

### Phase 2 — PO 카피 치환 — [ ]
**🔴** 카피 치환 매핑 확정
**🟢** descriptor.features 4티어 PO 명사 → 가치(예: "PO 발행 무제한"→제거/"견적·발주 운영", "요청 후 PO 추적"→"요청·구매 추적", "발주 전 승인 1단계"→"구매 전 승인 단계", "PO 감사 추적"→"구매 감사 추적") · /pricing 비교표 "발주 준비·운영 큐"→"구매 준비·운영 큐"
**🔵** 톤 일관성
**✋ Gate:** PO 명사 0·기능 가치 보존·값/CTA 무변경·dead button 0  **Rollback:** features 카피 revert

### Phase 3 — trialEligible 플래그 (데이터만) — [ ]
**🔴** trialEligible 단위(Basic true·그 외 false)
**🟢** PlanDescriptor에 `trialEligible: boolean` + 4티어 값. **노출 로직 0**(데이터만)
**🔵** 타입 정합
**✋ Gate:** Basic만 true·사용자 노출 0·타입 통과  **Rollback:** 필드 revert

### Phase 4 — Smoke / 회귀 / Rollback — [ ]
**🔴** 값/CTA/노출 무변경 실패모드
**🟢** operator-shell: 가격·CTA·토글 무변경·PO 명사 0·trial 노출 0·baseline 신규 RED 0·tsc EXIT 0
**🔵** notes
**✋ Gate:** 무변경 확인·rollback 문서  **Rollback:** 카피/플래그 phase 단독 revert

## 8. Addenda
**B. Billing/Entitlement:** trialEligible은 데이터 계약만. 실제 trial 부여/노출 = 결제 백엔드 트랙(OOS). annual 실청구도 동.

## 9. Risks
| Risk | P | Impact | Mitigation |
|---|---|---|---|
| 기능 약속 후퇴(승인/감사 삭제) | Med | High | PO 명사만 제거·가치 보존 reframe·sentinel로 가치 카피 존재 강제 |
| trial 노출이 fake claim | Med | High | 노출 OOS·sentinel "체험 카피 0" 강제 |
| 카피 변경이 기존 sentinel 핀 깸 | Med | Med | 치환 전 PO/승인 카피 핀 grep(missed-sweep) |

## 10. Rollback Strategy
- P1 실패: sentinel revert · P2 실패: features 카피 복원 · P3 실패: trialEligible 제거 · P4 실패: 전체 revert(값 무변경이라 무해)

## 11. Progress Tracking
- Overall: 100%(코드) · Current phase: operator-shell 게이트 대기 · Blocker: 없음 · Next: push(+§11.30x-cleanup git rm 동반)
- [x] P0  [x] P1  [x] P2  [x] P3  [x] P4(정적)

**Notes:** 2026-06-27 구현. PO/발주 → 구매 치환(descriptor 5 + /pricing 4) — 기능 약속 보존(Pro "구매 전 승인 1단계"·Enterprise "구매 감사 추적"). trialEligible(Basic only) 데이터 플래그(노출 0). missed-sweep 봉합: plan-descriptor.test `/구매|PO|발주/`·po-303b 5 단언 진화. 정적 replay 24/24 GREEN. trial 노출·annual 실청구 = OOS(결제 백엔드 트랙).

## 12. Notes & Learnings
- 2026-06-27: 계획 생성. PO 카피 치환(P1 회귀 정리)이 핵심·즉시. trial=Basic·annual은 **결제 백엔드 미비**로 사용자 노출 OOS(데이터 플래그만). 별도 §pricing-billing-backend 트랙 권장(Stripe 주 플로우 연결·trial_period_days·yearly price).
