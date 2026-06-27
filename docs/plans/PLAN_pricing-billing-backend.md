# Implementation Plan: §pricing-billing-backend — Stripe 결제 백엔드 (연간·trial·메인 플로우) 코드 READY (env 게이트 dormant)

- **Status:** ⏸️ Parked / Backlog (2026-06-27 — §pricing-prelaunch 우선. 결제 인프라는 추후 필요하나 PG 선정·법무 선결 후 착수)
- **재명명:** §billing-infrastructure (백로그). 착수 트리거 = 셀프서비스 수요가 PG 정당화 + 법무(전자상거래법·약관·환불정책·자동결제 동의) 선결. PG 선정(토스/포트원/나이스 등) = CEO.
- **Started:** 2026-06-27
- **Last Updated:** 2026-06-27
- **Work Type:** Billing / Entitlement (Stripe, prod-payment) — **scope A: 코드 READY, env 게이트 dormant**

**CRITICAL INSTRUCTIONS** (phase 완료마다):
1. ✅ 체크박스 2. 🧪 quality gate 3. ⚠️ 전 항목 통과 4. 📅 Last Updated 5. 📝 Notes 6. ➡️ 다음
⛔ quality gate 실패 진행 금지 · dead button/no-op/placeholder success 금지
⛔ **실결제 리스크**: Stripe 호출 코드는 **test mode 전제**로 작성·검증. 기본값 dormant(env 미설정 시 현행 DB-only 유지). prod 활성화는 별도 go-live(CEO/ops).
⛔ 백엔드 미완 기능(체험·연간 실청구)의 사용자 노출은 **billing-enabled 게이트** 뒤에서만(fake claim 0).

---

## 0. Truth Reconciliation
**Latest Truth:** §pricing-redesign(P1~P4)+cleanup+copy-cleanup land(ba6c37d7). 가격 SoT=PLAN_PRICES. trialEligible(Basic) 데이터 플래그 존재(노출 0). 연간=1mo-free 정책(표시만, 실청구 없음). 라벨스캔 enforce dormant.

**현 Stripe 배선:**
- `/api/billing/checkout`(POST): Stripe `checkout.sessions.create`, mode=subscription, **MONTHLY price만**(`STRIPE_PRICE_ID_TEAM/BUSINESS_MONTHLY`), card. trial·annual·billingCycle 없음. `STRIPE_SECRET_KEY` 미설정 시 placeholder(실패). 호출처 = **`/settings/billing` 단 1곳**.
- `/api/billing/webhook`: Stripe event → workspace.billingStatus(TRIALING/ACTIVE/...) 동기화.
- `/api/billing/portal`: Stripe billing portal.
- **메인 CTA 플로우**(/pricing→/dashboard/settings/plans→`CheckoutDialog`) → `/api/organizations/[id]/subscription` = **DB subscription upsert만**(Stripe·billingCycle 미처리). ← 결제 안 거치는 분기.
- trial-START: webhook(Stripe subscription.status==="trialing")에서만 설정. 주 플로우 trial 시작 0.

**Conflicts/갭:**
- 결제 플로우 2분기(Stripe checkout vs DB upsert). 메인 CTA는 DB-only.
- 연간 price ID/interval 미배선. trial_period_days 미배선.

**Chosen SoT:** 가격=PLAN_PRICES. 결제 상태=Stripe(webhook)→workspace.billingStatus. trial 자격=descriptor.trialEligible.

**Environment Reality:**
- sandbox: vitest 불가(rollup) → 정적 replay + operator-shell 게이트. Stripe 실호출 sandbox 금지(test-mode 코드만, 실행 검증은 operator/staging).
- **infra 의존(OOS, ops/CEO)**: Stripe 계정·annual price 생성·env 설정. 코드는 env 소비만.

## 1. Priority Fit
- [x] Post-release. §pricing 트랙이 OOS로 미룬 노출 3건(체험·연간 실청구·라벨 활성화 맥락)의 백엔드. honesty 부채 해소의 키스톤. **scope A** = 코드만, 활성화는 go-live.

## 2. Work Type
- [x] Billing / Entitlement · [x] Migration/Rollout (env 게이트 롤아웃)

## 3. Overview
**기능:** Stripe 결제 백엔드를 코드 레벨로 완성 — ① 연간 결제(yearly price/interval) ② Basic 30일 trial(`trial_period_days=30`) ③ 메인 CTA 플로우를 Stripe checkout 경로로(env 게이트). 모두 **env 미설정 시 dormant**(현행 무해). 활성화 시 체험·연간 노출도 함께 ON.

**Success Criteria:**
- [ ] checkout가 `billingCycle`(monthly/yearly) 지원 + 연간 price env 분기.
- [ ] trialEligible(Basic) plan에 `trial_period_days=30` 적용.
- [ ] 메인 CTA가 billing-enabled 시 Stripe checkout, 미설정 시 현 DB-only(dormant).
- [ ] "30일 무료 체험"·연간 실청구 노출이 billing-enabled 게이트 뒤에서만(fake claim 0).
- [ ] 기본값 dormant — env 미설정 시 현행 동작·테스트 무변경. 신규 회귀 0.

**Out of Scope (⚠️):**
- [ ] Stripe 계정/annual price 생성·env 설정(ops/CEO) · prod go-live 활성화
- [ ] 한국 세금계산서/부가세(Stripe Tax/PG 정책 별도) · 라벨스캔 env 활성화(독립)

**User-Facing Outcome:** env 미설정(현재)=변화 없음. 활성화 시=연간 실결제·Basic 30일 체험·메인 CTA 실결제.

## 4. Product Constraints
**Must Preserve:** dormant 기본(현행 DB-only)·canonical(PLAN_PRICES·webhook→billingStatus)·dead button 0·기존 settings/billing checkout
**Must Not Introduce:** 실결제 강제(env 미설정 시) · 이중청구 · fake 체험/연간 노출 · webhook 비멱등
**Canonical Truth Boundary:** 결제상태 SoT=Stripe→webhook→workspace.billingStatus. 표시=billing-enabled config 게이트.
**UI Surface Plan:** [x] 기존 CheckoutDialog/카드 — billing-enabled 분기. 신규 surface 0.

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-offs |
|---|---|---|
| `isBillingEnabled()` env 게이트(SECRET_KEY + price IDs 존재) | dormant 기본·점진 활성화 | 분기 코드 |
| 연간 = 별도 YEARLY price ID(Stripe) | Stripe 표준(interval=year price) | env/price 2배 |
| trial_period_days=30 (Basic만) | trialEligible 정합·체험 정직 | webhook trial→active 처리 |
| 메인 CTA reroute env 게이트 | 활성화 전 현행 보존 | DB-flow와 공존(활성 후 정리) |
| Stripe 호출 test-mode 전제 | 실결제 사고 방지 | staging 검증 필요 |

**Touched(예상):** `api/billing/checkout/route.ts`(billingCycle·trial·price 분기) · `lib/billing/*`(isBillingEnabled helper) · `CheckoutDialog.tsx`/`settings/plans`(reroute 게이트) · `api/billing/webhook/route.ts`(trial/annual 동기화 검증) · /pricing·카드(노출 게이트) · 신규 sentinel.
**Dependencies:** Stripe 계정·price·env(ops) — 활성화 전제. 코드는 독립 작성.

## 6. Global Test Strategy
- 단위/sentinel: billingCycle 분기·trial_period_days·isBillingEnabled 게이트·reroute 분기·노출 게이트.
- Stripe 실호출은 mock/계약 검증(sandbox 실호출 금지). webhook 멱등성 단위.
- operator-shell: baseline·tsc·(staging) Stripe test-mode smoke.

## 7. Implementation Phases

### Phase 0 — Context & Truth Lock — [x] (2026-06-27)
> 기존 env: STRIPE_SECRET_KEY·STRIPE_WEBHOOK_SECRET·STRIPE_PRICE_ID_TEAM_MONTHLY·STRIPE_PRICE_ID_BUSINESS_MONTHLY·NEXT_PUBLIC_APP_URL.
> 신규 필요(ops OOS): STRIPE_PRICE_ID_TEAM_YEARLY·STRIPE_PRICE_ID_BUSINESS_YEARLY.
> isBillingEnabled() = SECRET_KEY + 해당 price ID 존재. 미충족=dormant(현행 DB-only·노출 0).
**🔴** Stripe 현 배선·결제 2분기·필요 env 목록 확정 · scope A(dormant) 확인
**🟢** `isBillingEnabled()` 정의(SECRET_KEY + 해당 price ID 존재) · env 목록 문서화 · dormant 기본 보장 설계
**🔵** OOS(ops Stripe 설정) 경계 명시
**✋ Gate:** 갭·env 목록·dormant 기본·infra 의존 문서화  **Rollback:** planning-only

### Phase 1 — 계약 & 실패 테스트 — [ ]
**🔴** sentinel(RED): checkout `billingCycle` param + yearly price 분기 · `trial_period_days` (trialEligible) · `isBillingEnabled` 게이트 · reroute 계약 · 노출 게이트
**🟢** 최소 스캐폴딩(helper 시그니처)
**✋ Gate:** 실패테스트 real · 기존 GREEN 유지 · typecheck  **Rollback:** sentinel revert

### Phase 2 — checkout 연간 + trial — [ ]
**🔴** billingCycle yearly + trial 단위
**🟢** checkout schema `billingCycle` · yearly price env 분기 · `subscription_data.trial_period_days=30`(trialEligible) · starter/enterprise 분기 정리(starter=checkout 불가, enterprise=contact)
**🔵** 분기 정리
**✋ Gate:** 연간 price 분기·trial 적용·env 미설정 graceful 400(dead button 0)  **Rollback:** checkout revert

### Phase 3 — 메인 CTA reroute (env 게이트) — [ ]
**🔴** reroute 분기 단위
**🟢** `CheckoutDialog`/settings-plans: isBillingEnabled 시 `/api/billing/checkout`(Stripe redirect), 미설정 시 현 DB-only 유지(dormant)
**🔵** 중복 정리
**✋ Gate:** 미설정 시 현행 무변경·설정 시 Stripe redirect·dead button 0  **Rollback:** reroute 분기 revert

### Phase 4 — webhook / entitlement — [ ]
**🔴** trial→active·연간 status 동기화·멱등 단위
**🟢** webhook trial/annual 처리 검증·trial 중 entitlement 부여·중복 이벤트 멱등
**🔵** 정리
**✋ Gate:** status 정합·멱등·entitlement 정직  **Rollback:** webhook 분기 revert

### Phase 5 — 조건부 노출 (honesty) — [ ]
**🔴** 노출 게이트 단위
**🟢** "30일 무료 체험" 배지(trialEligible && billing-enabled)·연간 실청구 문구 게이트. 미설정 시 노출 0(현행)
**🔵** 정리
**✋ Gate:** 백엔드 live일 때만 노출(fake claim 0)·미설정 노출 0  **Rollback:** 노출 게이트 revert

### Phase 6 — Smoke / Rollback / Rollout — [ ]
**🔴** rollout 실패모드·go-live 체크리스트
**🟢** Stripe **test mode** smoke(월/연/trial)·dormant 기본 확인·baseline·tsc
**🔵** notes
**✋ Gate:** test-mode 검증·dormant 안전·go-live 문서  **Rollback:** env 미설정으로 즉시 dormant 복귀

## 8. Addenda (B. Billing/Entitlement)
**States:** trialing(30d)/active/cancel/past_due/... webhook 동기. **Scenarios:** monthly/yearly checkout·trial 시작/종료·upgrade·payment failed·no-permission. **Validation:** logged-in 추가 로그인 0·selectedPlan/returnTo 보존·webhook 멱등.

## 9. Risks
| Risk | P | Impact | Mitigation |
|---|---|---|---|
| 실결제 사고(이중청구) | Med | High | test mode 우선·dormant 기본·webhook 멱등 |
| 메인 reroute가 파일럿 동작 변경 | Med | Med | env 게이트(미설정 현행 보존) |
| 체험/연간 노출 fake | Med | High | billing-enabled 게이트 뒤만 노출 |
| infra 미설정으로 dead checkout | Med | Med | graceful 400 + 영업 문의 fallback |
| 세금계산서 미비 | Med | Med | OOS 명시·go-live 전 PG/세무 트랙 |

## 10. Rollback Strategy
- 각 phase 독립 revert. 최종 안전판: **env 미설정 → 전체 dormant**(현행 DB-only·노출 0 복귀). schema 변경 없음(예상).

## 11. Progress Tracking
- Overall: 14%(P0 완료) · Current phase: P1 대기 · Blocker: 없음(infra는 OOS) · Next: P1 실패 sentinel
- [x] P0  [ ] P1  [ ] P2  [ ] P3  [ ] P4  [ ] P5  [ ] P6

## 12. Notes & Learnings
- 2026-06-27: 생성. scope A(코드 READY·dormant). infra(Stripe 계정·price·env)=ops/CEO OOS. 활성화 시 §pricing OOS 노출 3건(체험·연간·라벨 맥락) 정직 ON. 세금계산서=별도.
