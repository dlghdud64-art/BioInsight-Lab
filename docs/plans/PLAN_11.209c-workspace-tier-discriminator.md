# Implementation Plan: §11.209c Workspace Tier Discriminator wiring

- **Status:** ✅ Complete (CLOSED)
- **Started:** 2026-05-04
- **Last Updated:** 2026-05-04
- **Estimated Completion:** 2026-05-08 (Phase 0~4)
- **Actual Completion:** 2026-05-04 (single-day cluster — Phase 0 audit 가설 깨짐 → scope 축소 → Phase 1-3 GREEN → ADR close)

**CRITICAL INSTRUCTIONS** — After completing each phase:

1. ✅ Check off completed task checkboxes
2. 🧪 Run quality gate validation (vitest + tsc 최소)
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in §12 Notes & Learnings
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates / proceed with failing checks
⛔ DO NOT introduce schema migration (가설 깨짐 — 변경 0)
⛔ DO NOT activate row-level approval visualization (§11.209d 별도)

---

## 0. Truth Reconciliation

**Latest Truth Source (audit 결과 — 2026-05-04):**

- `Workspace.stripePriceId String?` (`schema.prisma:953`) — **이미 land**. schema 변경 가설 깨짐.
- Stripe webhook (`app/api/billing/webhook/route.ts:73, 163`) 가 `subscription.items.data[0]?.price.id` 를 workspace 에 set — 실시간 webhook 정합.
- `STRIPE_PRICE_ID_TEAM_MONTHLY` 환경변수 + checkout 호출 정합 (`api/billing/checkout/route.ts:119`).
- `PLAN_DESCRIPTOR.ts:78-79` 코멘트 — `business → SubscriptionPlan.TEAM (Stripe price: BUSINESS_MONTHLY)` SKU 분리 명시.
- `STRIPE_PRICE_ID_BUSINESS_MONTHLY` 환경변수 사용처 0 — 추가 wiring 필요.

**Conflicts Found:**

- ❌ "workspace 에 subscriptionPriceId field 추가" 가설 → `stripePriceId` 이미 존재. schema 변경 0.
- ❌ "admin UI + webhook 동시 land" → webhook 이미 정상. admin UI 별도 batch.
- ⚠️ `workspacePlanToIntent` 가 보수적 "team" 매핑만 — stripePriceId 분기 미land.

**Chosen Source of Truth:**

- schema (Workspace.stripePriceId) + Stripe webhook canonical
- `workspacePlanToIntent(plan, stripePriceId?)` signature 확장 — 두 input 으로 PlanIntent 결정
- `STRIPE_PRICE_ID_BUSINESS_MONTHLY` env 호영님 host Vercel/.env 설정 (Phase 4 prod 검증 시)

---

## 1. Priority Fit

**Category:** Post-release **lock-completion (P1.5)**
- §11.209b 의 옵션 1 한계 해소 → R&D Operations Tier 결재 약속 실제 visible
- §11.209 헤더 약속의 dead promise → live promise 전환 lock

---

## 2. Work Type

- [x] Billing / Entitlement (stripePriceId discriminator)
- [x] Workflow / Ontology Wiring (workspacePlanToIntent 확장)
- [x] Web (caller surface 분기)
- [ ] Migration (schema 변경 0)
- [ ] Mobile (자동 정합)

---

## 3. Overview

**약속의 본문:**

TEAM enum + BUSINESS_MONTHLY priceId workspace 사용자가 /dashboard/purchases 진입 시 헤더 카피 결재 약속 visible. §11.209b approval 흐름 자동 활성.

**Success Criteria:**

- [ ] `STRIPE_PRICE_ID_BUSINESS_MONTHLY` 환경변수 정의 + checkout 분기
- [ ] `workspacePlanToIntent(plan, stripePriceId?)` 확장 — TEAM + BUSINESS_MONTHLY → "business"
- [ ] purchases 헤더 카피 자동 활성 (showsApprovalPromise === true)
- [ ] 모든 caller (po-candidates / pricing / settings) 자동 정합 + 회귀 0

**Out of Scope:**

- [ ] admin UI for stripePriceId 수동 변경
- [ ] Enterprise 외부 ERP webhook (§11.209c-enterprise 별도)
- [ ] internalApprovalStatus row 시각화 (§11.209d 별도)
- [ ] Stripe checkout BUSINESS_MONTHLY 실 결제 (`#pricing-real-checkout` 별도)

**User-Facing Outcome:**

- TEAM + BUSINESS_MONTHLY: 헤더 카피 약속 visible
- TEAM + TEAM_MONTHLY: Lab Team 정합 유지 (변화 0)
- FREE / ENTERPRISE: 정합 유지

---

## 4. Product Constraints

**Must Preserve:**

- [x] canonical truth (Stripe webhook + Workspace.stripePriceId single source)
- [x] PLAN_DESCRIPTOR (§11.201 lock)
- [x] §11.209b workspacePlanToIntent utility (Phase 2 lock)

**Must Not Introduce:**

- [x] schema 변경
- [x] page-per-feature
- [x] dead button

**Canonical Truth Boundary:**

- Source of Truth: `Workspace.stripePriceId` (Stripe webhook canonical)
- Derived Projection: `workspacePlanToIntent(plan, stripePriceId)` → PlanIntent
- Persistence Path: Stripe webhook → workspace.stripePriceId (변경 0)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| `workspacePlanToIntent(plan, stripePriceId?)` signature 확장 | optional 2nd arg → 기존 caller 호환 | caller audit 필요 |
| `STRIPE_PRICE_ID_BUSINESS_MONTHLY` env 추가 | Stripe checkout R&D Operations 가능 | 호영님 host Vercel/.env set 필요 |
| schema 변경 0 | 가설 깨짐 정합 | (없음) |

**Dependencies:**

- Required Before Phase 4: `STRIPE_PRICE_ID_BUSINESS_MONTHLY` env (호영님 host)
- Stripe Dashboard 에 R&D Operations price (₩349,000/월) 생성 (호영님 prod 검증 단계)

---

## 7. Implementation Phases (4 phases, 5-7h)

### Phase 0: Audit close ✅
- [x] 가설 깨짐 확인 (schema 변경 0)
- [x] Stripe webhook 정상 검증
- [ ] STRIPE_PRICE_ID_BUSINESS_MONTHLY env (호영님 Phase 4 시)

### Phase 1: workspacePlanToIntent 확장 RED + GREEN (2h)
- 🔴 RED: 5 case unit test
- 🟢 GREEN: signature 확장 + helper
- ✋ Quality Gate: 기존 caller 호환

### Phase 2: caller wiring 확장 (2h)
- 🔴 RED: caller 가 workspace.{plan, stripePriceId} 둘 다 select + 전달
- 🟢 GREEN: po-candidates / purchases / pricing surface 정합
- ✋ Quality Gate: 회귀 0

### Phase 3: Stripe checkout BUSINESS_MONTHLY 분기 (1-2h)
- 🔴 RED: PlanIntent === "business" 시 BUSINESS_MONTHLY env 사용
- 🟢 GREEN: 분기 + graceful fallback (env 부재 시 차단 + 운영자 친화 메시지)
- ✋ Quality Gate: env 부재 시 dead button 0

### Phase 4: Smoke + ADR (1h)
- prod 검증 (호영님 host)
- ADR-002 §11.209c entry append
- §11.209b plan 의 deferred follow-up close

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| BUSINESS_MONTHLY env 미설정 → checkout 깨짐 | High | Med | Phase 3 graceful fallback |
| workspacePlanToIntent caller 회귀 | Med | High | Phase 2 모든 caller audit |
| Stripe webhook unknown ID set | Med | Low | Phase 1 helper unknown → "team" fallback |
| 약속 본문 visible 후 row 시각화 부재 | Low | Med | §11.209d 후속 명시 |

---

## 11. Progress Tracking

- **Overall completion:** 100% (CLOSED 2026-05-04)
- **Current phase:** ✅ All complete — ADR-002 §11.209c entry land
- **Next validation step:** 호영님 host BUSINESS_MONTHLY env 설정 + Stripe Dashboard price 생성 후 prod smoke

**Phase Checklist:**

- [x] Phase 0 (audit & truth lock — 가설 깨짐, schema 변경 0)
- [x] Phase 1 (workspacePlanToIntent 확장 — 19/19 vitest)
- [x] Phase 2 (caller wiring 확장 — 33/33 vitest cluster)
- [x] Phase 3 (Stripe checkout BUSINESS_MONTHLY 분기 — 6/6 vitest + graceful fallback)
- [x] Phase 4 (ADR-002 entry append + plan close)

**총 verify:** vitest 87/87 PASS, tsc 0 새 errors.

---

## 12. Notes & Learnings

**Phase 0 발견 (2026-05-04):**
- §11.209b plan 시 workspace schema audit 누락 — `stripePriceId` 이미 land 발견. plan scope 가 큰 트랙 (4-5 phases, schema migration) → 중 트랙 (4 phases, schema 변경 0) 으로 축소.
- Stripe webhook (`app/api/billing/webhook/route.ts`) 가 이미 `stripePriceId` 정상 update — 추가 wiring 불필요.
- 가설을 audit 으로 깨는 패턴 = §11.209b 와 동일 (Karpathy "silent wrong assumption" 차단).
