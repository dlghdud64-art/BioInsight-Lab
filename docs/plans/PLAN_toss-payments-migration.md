# Implementation Plan: Stripe → TossPayments Migration (Billing PG 전면 교체)

- **Status:** 🟡 **Deferred (2026-04-18 CEO 결정)** — 결제 기반 구축은 나중으로 연기. 제품/운영 기반 안정화 후 재개.
- **Deferred Reason:** 현 단계에선 vitest/prisma generate/enum drift/RFQ handoff smoke/MutationAuditEvent 등 P1 release-prep 이 우선. 파일럿 고객이 실제 결제 단계에 진입하기 전까지는 PG 교체 불필요. Stripe 는 그대로 두되 프로덕션 결제 트래픽은 금지.
- **Resume Trigger:** 파일럿 첫 유상 고객 계약 임박 시점, 또는 세금계산서 요구가 실제 발생한 시점.
- **Started:** (deferred)
- **Last Updated:** 2026-04-18
- **Estimated Completion:** (재개 시점부터 2주 내)
- **Total Phases:** 7 (0~6, Large scope, 18~25h)

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT proceed with unresolved source-of-truth conflicts
⛔ DO NOT introduce dead button / no-op / placeholder success
⛔ DO NOT create page-per-feature regression (same-canvas 유지)
⛔ DO NOT let preview/snapshot override canonical truth (Toss webhook 가 진실원)

---

## 0. Truth Reconciliation

### Latest Truth Source
- `docs/plans/BILLING_LIFECYCLE_STATE_MACHINE.md` (557 lines, 2026-04-17) — **PG-agnostic state machine + entitlement matrix**. `BillingEvent` append-only 기반이라 그대로 재사용.
- `docs/architecture/billing-lifecycle.md` (122 lines, Approved by CEO 2026-04-17) — 3단 분리 / 권한 분기 / Webhook-confirmed 완료 원칙 유지. "Stripe가 진실원" 문구만 "PG 가 진실원"으로 교체.

### Secondary References
- `STRIPE_BILLING_SETUP.md` (root, 454 lines) — **전량 deprecated 대상** (Phase 6 에서 `TOSS_BILLING_SETUP.md` 로 rewrite)
- Task #40 PR (webhook 멱등성 + `StripeEvent` 테이블) — **로직 재활용**, 테이블 `PaymentEvent(provider, eventId, type, processedAt)` 로 일반화

### Conflicts Found
1. `billing-lifecycle.md` §6.1 "Stripe가 진실원" ↔ PG 교체 결정 → PG-agnostic 원칙으로 재기술
2. `billing-lifecycle.md` §7 "Stripe Preview API 로 proration" ↔ Toss 는 preview API 없음 → 자체 일할계산 + Billing Key 재청구 전략
3. Task #37 (Stripe preview_invoice 전제) ↔ Toss 미지원 → **Phase 6 이후로 재범위**
4. Task #38 (Stripe 카드 step) ↔ Toss 위젯 플로우 → **Phase 3 에서 재설계**
5. `checkout/route.ts` + `portal/route.ts` + `webhook/route.ts` 3개 routes + `payment-methods/route.ts` 모두 Stripe SDK 직접 의존 → PaymentProvider abstraction 필수
6. 세금계산서 — Stripe 가정에선 논의 자체가 없었음 → **팝빌 별도 Phase 추가 (Phase 5 신규)**

### Chosen Source of Truth
- **State machine + Entitlement matrix:** `BILLING_LIFECYCLE_STATE_MACHINE.md` 유지 (PG-agnostic)
- **PG 구현체:** Stripe → **토스페이먼츠 (Billing Key 기반 정기결제)**
- **세금계산서:** **팝빌(Popbill) 별도 연동** (Toss B2B 자동발행 ✗, 수동발행 ✗)
- **Idempotency:** Task #40 create-first 패턴 → `PaymentEvent(provider, eventId)` PK 로 일반화
- **Canonical Truth:** **Toss webhook + 팝빌 발행 응답** — DB projection 은 반영일 뿐, 클라이언트 낙관적 성공 금지

### Environment Reality Check
- [x] repo / branch context: `ai-biocompare` main branch
- [x] runnable commands: `npm run db:generate`, `npm run prisma:migrate`, `npx tsc --noEmit`
- [ ] **execution blockers (Phase 0 에서 락):**
  - [ ] 토스페이먼츠 "자동결제(Billing Key)" 상품 승인 상태 확인
  - [ ] 토스 Test key / Live key 분리 발급 확인
  - [ ] 팝빌 계정 개설 + 링크ID / API 키 발급
  - [ ] 팝빌 연동테스트환경 (테스트 사업자번호) 세팅
  - [ ] 국세청 공인인증서 (전자세금계산서 발행용) 팝빌 등록

---

## 1. Priority Fit

**Current Priority Category:**
- [x] **Release Blocker** (파일럿 전 반드시 교체)
- [ ] P1 immediate
- [ ] Post-release
- [ ] P2 / Deferred

**Why This Priority:**
- 한국 B2B 연구소/제약사 대상 SaaS — 세금계산서 발행 불가능한 Stripe 기반으로는 고객사 경리팀 반려 100%. 파일럿 1개도 못 받음.
- 현재 Stripe 활성 구독 0개 (프로덕션 결제 트래픽 없음) → **데이터 마이그레이션 리스크 낮음, 지금이 교체 적기**.
- Task #37/#38 이 Stripe 전제로 pending → 이 마이그레이션이 선결되어야 재개 가능.
- 기존 P1 트랙 (vitest/prisma generate/enum drift/RFQ smoke/MutationAuditEvent) 은 PG-agnostic → **병행 트랙으로 유지**.

**Deferred during this plan (명시):**
- Task #37 (Proration 계산 API) → Phase 6 이후 Toss 기준으로 재시작
- Task #38 (결제수단 조건부 단계) → Phase 3 에서 Toss 위젯 기준으로 흡수
- Task #39/#41/#42 → PG-agnostic, 병행 가능

---

## 2. Work Type

- [ ] Feature
- [ ] Bugfix
- [x] **API Slimming** (checkout/portal/webhook/payment-methods 4 routes 재설계)
- [x] **Workflow / Ontology Wiring** (Subscription status → Entitlement projection)
- [x] **Migration / Rollout** (Stripe → Toss 전면 교체)
- [x] **Billing / Entitlement** (primary)
- [ ] Mobile
- [x] Web
- [x] Design Consistency (same-canvas billing surface 유지)

---

## 3. Overview

### Feature Description
LabAxis 의 결제 PG 를 Stripe 에서 토스페이먼츠로 전면 교체한다. 세금계산서는 팝빌 연동으로 자동 발행한다. 이 과정에서 PaymentProvider abstraction 을 도입해 향후 다른 PG (네이버페이/카카오페이) 추가가 용이하도록 한다. 기존 Stripe 코드는 Phase 6 에서 완전 제거한다.

### Success Criteria
- [ ] 한국 B2B 고객이 토스페이먼츠 Billing Key 로 정기결제 등록 가능
- [ ] 결제 승인 → 자동 세금계산서 발행 (팝빌) → 고객 경리팀 수신
- [ ] State machine (trialing / active / cancel_scheduled / past_due / grace / suspended / canceled / closed) 전이 정상 동작
- [ ] Entitlement matrix 에 따른 기능 접근 제어 동작
- [ ] Webhook 멱등성 보장 (at-least-once delivery 대응)
- [ ] 모든 Stripe import / STRIPE_* env 제거 (`grep -r "stripe" src/` 결과 0)
- [ ] same-canvas billing surface 유지 (page-per-feature 회귀 없음)
- [ ] Owner / Billing Admin 권한 분기 유지

### Out of Scope (⚠️ 이번 플랜에서 절대 구현 금지)
- [ ] 글로벌 시장 Stripe 병행 지원
- [ ] 네이버페이 / 카카오페이 / 무통장 추가 PG
- [ ] 세금계산서 역발행 / 수정발행 / 거래명세서 자동화
- [ ] Enterprise 수동 인보이스 플로우
- [ ] 모바일 앱 결제 (RN / Expo) — 웹 먼저

### User-Facing Outcome
- 고객사 결제 담당자(Owner/Billing Admin): LabAxis 내부 `/dashboard/settings/plans` 에서 **토스 위젯으로 카드 등록 → Billing Key 발급 → 첫 결제 승인 → 세금계산서 이메일 수신** 까지 한 흐름.
- 일반 구성원: 현재 플랜 조회만 가능, 변경 CTA disabled + 안내.

---

## 4. Product Constraints

### Must Preserve
- [x] workbench / queue / rail / dock (billing surface 는 dashboard settings 안에 흡수)
- [x] same-canvas (신규 페이지 추가 금지, 기존 `/dashboard/settings/plans` + `billing/page.tsx` 유지)
- [x] canonical truth (Toss webhook / 팝빌 응답 = 진실원)
- [x] invalidation discipline (webhook 수신 후 query invalidate)
- [x] 3단 분리 (공개 `/pricing` / 앱 내부 settings / 모달 Wizard)

### Must Not Introduce
- [x] page-per-feature (별도 `/billing/checkout`, `/billing/tax-invoice` 페이지 만들지 말 것)
- [x] chatbot / assistant 로 billing 재해석
- [x] dead button / no-op / placeholder success (결제 완료 표시는 webhook 반영 후에만)
- [x] fake billing / auth 단축 경로
- [x] preview / snapshot 이 actual truth 덮는 구조 (UI 금액 계산은 snapshot 이며 webhook 값이 최종)

### Canonical Truth Boundary

| 층위 | 담당 |
|---|---|
| **Source of Truth** | Toss 서버 (결제/구독 webhook) + 팝빌 발행 응답 (세금계산서) |
| **Derived Projection** | `Subscription.status`, `Workspace.plan`, `Workspace.billingStatus`, `Invoice.taxInvoiceIssued` |
| **Snapshot / Preview** | 체크아웃 모달 "오늘 결제 / 다음 결제" 금액 (자체 일할계산) |
| **Persistence Path** | `PaymentEvent` (append-only, provider+eventId PK) → 핸들러가 `Subscription`/`Workspace`/`Invoice` 업데이트 |

### UI Surface Plan
- [x] Inline expand (결제수단 상세)
- [x] Right dock (빌링 관리 액션)
- [x] Bottom sheet (체크아웃 모달 Wizard)
- [ ] Split panel
- [x] Existing route section (`/dashboard/settings/plans`)
- [x] Settings panel
- [ ] New page (⚠️ 절대 만들지 말 것)

---

## 5. Architecture & Dependencies

### Key Decisions

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| PaymentProvider abstraction 도입 | Phase 1 에서 Stripe → Toss 점진 전환 가능, 향후 PG 추가 용이 | 단기적 코드 레이어 증가 (1 interface + 2 impl) |
| 팝빌 별도 연동 (Phase 5) | 한국 B2B 표준, 발행/역발행/거래명세서 확장 용이 | 외부 벤더 1개 추가 (하지만 표준 관행) |
| Billing Key 기반 정기결제 | 토스 SaaS 표준, 카드 정보 LabAxis 가 보관 안함 | 첫 결제 0원 승인 처리 필요 |
| Proration 자체 계산 | Toss preview API 없음 | 일할계산 공식 내장 + 테스트 부담 |
| Toss Customer Portal 없음 → 자체 UI | same-canvas 유지, 일관된 UX | Phase 5 UI 구현 공수 증가 |
| StripeEvent → PaymentEvent 일반화 | 기존 멱등성 로직 재활용, multi-PG 대응 | 마이그레이션 필요 |

### Dependencies

**Required Before Starting:**
- [ ] 토스페이먼츠 자동결제(Billing Key) 상품 승인
- [ ] 토스 Test/Live Key 발급
- [ ] 팝빌 계정 개설 + API 키 발급
- [ ] 공인인증서 (전자세금계산서 발행용)

**External Packages (예상):**
- `@tosspayments/payment-sdk` (또는 위젯 JS)
- 팝빌 Node.js SDK (`popbill`) 또는 REST 직접 호출
- 기존 Stripe SDK 는 Phase 6 에서 제거

**Existing Routes / Models / Services Touched:**
- `apps/web/src/app/api/billing/checkout/route.ts`
- `apps/web/src/app/api/billing/portal/route.ts` (deprecated → 제거)
- `apps/web/src/app/api/billing/webhook/route.ts` (Stripe) + `webhook/toss/route.ts` (신규) + `webhook/popbill/route.ts` (신규)
- `apps/web/src/app/api/billing/payment-methods/route.ts`
- `apps/web/src/app/api/billing/invoices/` (세금계산서 다운로드 endpoint 신규)
- `apps/web/src/components/checkout/*`
- `apps/web/src/app/billing/page.tsx`
- `apps/web/src/app/dashboard/settings/plans/*`
- `apps/web/prisma/schema.prisma` (Workspace / Subscription / PaymentMethod / Invoice / StripeEvent → PaymentEvent)

### Integration Points
- 서버 액션 / API route: checkout, webhook, cancel, upgrade, downgrade, tax-invoice-download
- 쿼리 / 뮤테이션: `useSubscription`, `usePaymentMethods`, `useInvoices`, `useChangePlan`
- 라우트 / 패널 / 큐: `/dashboard/settings/plans`, CheckoutDialog, BillingDock
- 빌링 / 감사 / 웹훅 / 마이그레이션: `PaymentEvent`, `MutationAuditEvent`, Prisma migration 2회 (add + drop)

---

## 6. Global Test Strategy

모든 phase 는 Red-Green-Refactor 엄수.

### Test Strategy by Work Type
- **Business logic (proration, state transition):** unit tests 필수
- **API / route contract (checkout, webhook):** integration tests 필수
- **User-visible critical flow (CheckoutDialog → Billing Key):** 1+ E2E or smoke path 필수
- **Migration / Rollout (schema drop, provider flag):** smoke + rollback verification 필수
- **Billing / Entitlement:** state transition 테스트 matrix 필수
- **세금계산서 발행 (팝빌):** sandbox 발행 성공 확인 + webhook 응답 테스트

### Execution Notes
- vitest 미설치 상태면 "실행 불가" 명시 (P1 트랙에서 vitest install 병행)
- Toss sandbox / 팝빌 연동테스트 환경에서만 실 결제 시뮬레이션
- 운영 전환 (Phase 6) 전 반드시 실 카드 1건 sandbox 결제 + 세금계산서 발행 smoke

---

## 7. Implementation Phases

### Phase 0: Context & Truth Lock (1.5h)
**Goal:** 벤더 계약 상태, API 키, 세금계산서 정책을 확정하고 PaymentProvider interface 를 락.

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:**
- [ ] 토스 Billing Key 상품 승인 확인
- [ ] 팝빌 계정 / 공인인증서 상태 확인
- [ ] 현재 Stripe 활성 구독 0건 Supabase 쿼리로 검증
- [ ] 실패 시나리오 정의 (Billing Key 발급 실패, 팝빌 발행 실패, webhook 유실)

**🟢 GREEN:**
- [ ] PaymentProvider interface 시그니처 확정 (문서만, 코드 X)
- [ ] Phase 3~5 에서 쓸 env 변수 이름 확정 (`PAYMENT_PROVIDER`, `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`, `TOSS_WEBHOOK_SECRET`, `POPBILL_LINK_ID`, `POPBILL_SECRET_KEY`, `POPBILL_CORP_NUM`)
- [ ] 팝빌 사용할 API 목록 확정 (RegistIssue, GetEmailURL, GetPDFURL)

**🔵 REFACTOR:**
- [ ] 불필요한 scope 제거 (글로벌 지원, 카카오페이 등 defer)
- [ ] Phase 순서 최종 확정

**✋ Quality Gate:**
- [ ] 벤더 계약 / API 키 blocker 0
- [ ] 기존 Stripe 데이터 충돌 위험 0
- [ ] 세금계산서 발행 책임 경계 명시
- [ ] 우선순위 fit 문서화 (release blocker)

**Rollback:** planning-only, 코드 변경 없음

---

### Phase 1: PaymentProvider Abstraction + PaymentEvent 일반화 (3h)
**Goal:** Stripe SDK 직접 의존 제거, PaymentEvent 로 멱등성 로직 일반화.

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:**
- [ ] `PaymentProvider` interface 테스트 작성 (`createCustomer`, `issueBillingKey`, `chargeBillingKey`, `cancelSubscription`, `verifyWebhookSignature`, `parseWebhookEvent`)
- [ ] `PaymentEvent` 멱등성 테스트 (provider+eventId 중복 skip)
- [ ] 기존 Stripe webhook 회귀 테스트 (fallback 유지)

**🟢 GREEN:**
- [ ] `src/lib/billing/providers/types.ts` — `PaymentProvider` interface
- [ ] `src/lib/billing/providers/stripe.ts` — 기존 로직 wrap (임시, Phase 6 에서 제거)
- [ ] `src/lib/billing/providers/toss.ts` — skeleton (Phase 3 에서 구현)
- [ ] `src/lib/billing/providers/index.ts` — factory (env `PAYMENT_PROVIDER` 기반)
- [ ] Prisma migration: `StripeEvent` → `PaymentEvent` rename + `provider String` 컬럼 추가 + backfill `'stripe'`
- [ ] webhook/route.ts 를 PaymentProvider 경유로 리팩토링

**🔵 REFACTOR:**
- [ ] naming 일관성 (provider / providerCustomerId / providerEventId)
- [ ] 불필요한 Stripe-specific import 축소

**✋ Quality Gate:**
- [ ] 기존 Stripe webhook 멱등성 회귀 없음
- [ ] `npm run db:generate` 성공, `npx tsc --noEmit` 통과
- [ ] `PaymentEvent` 에 Stripe 데이터 백필 확인
- [ ] interface 가 Toss/팝빌 다 커버하는지 리뷰

**Rollback:** migration revert (PaymentEvent → StripeEvent), abstraction revert, webhook/route.ts 직접 Stripe 호출로 복구

---

### Phase 2: Schema — Provider-agnostic 필드 추가 (2h)
**Goal:** Workspace / Subscription / PaymentMethod / Invoice 에 provider-agnostic 필드 추가 (기존 stripe* 필드는 nullable 유지).

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:**
- [ ] 기존 Stripe 데이터 보존 마이그레이션 테스트
- [ ] provider enum 제약 테스트 (stripe / toss)

**🟢 GREEN:**
- [ ] `Workspace.paymentProvider` (enum: STRIPE / TOSS), `providerCustomerId`, `providerSubscriptionId`, `providerBillingKey` 추가
- [ ] `Subscription.paymentProvider`, `providerCustomerId`, `providerSubscriptionId` 추가
- [ ] `PaymentMethod.paymentProvider`, `providerPaymentMethodId` 추가 (카드사, 마지막 4자리, billingKey 매핑)
- [ ] `Invoice.paymentProvider`, `providerInvoiceId`, `popbillIssueId`, `taxInvoiceUrl`, `taxInvoiceIssuedAt` 추가
- [ ] 기존 Stripe 데이터 백필 (`paymentProvider = 'stripe'`, provider* 컬럼에 stripe* 값 복사)

**🔵 REFACTOR:**
- [ ] `stripe*` 필드는 deprecated 주석 표시 (Phase 6 drop)
- [ ] Prisma schema 주석 정리

**✋ Quality Gate:**
- [ ] migration 양방향 (up/down) 성공
- [ ] `npm run db:generate` 성공
- [ ] 기존 webhook/checkout 빌드 통과
- [ ] Supabase 에 실 데이터 백필 확인

**Rollback:** migration down (provider 필드 drop), schema revert

---

### Phase 3: Toss Checkout Route + Billing Key 발급 (4h)
**Goal:** Toss 결제위젯 연동, Billing Key 발급, 첫 결제 승인 플로우 완성.

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:**
- [ ] `POST /api/billing/checkout` Toss flow 테스트 (success/fail/cancel)
- [ ] Billing Key 발급 후 첫 결제 승인 테스트
- [ ] 권한 분기 테스트 (Owner/Billing Admin 만)

**🟢 GREEN:**
- [ ] `TossProvider.issueBillingKey` 구현 (customerKey 생성, 위젯 URL 반환)
- [ ] `TossProvider.chargeBillingKey` 구현 (정기결제 승인 API 호출)
- [ ] `/api/billing/checkout` → Toss 위젯 URL 반환으로 교체 (PAYMENT_PROVIDER 분기)
- [ ] `CheckoutDialog` → Toss 위젯 overlay 로드 (same-canvas 유지, 신규 페이지 X)
- [ ] 결제수단 step 조건부 (`workspace.providerBillingKey` 유무 기준)

**🔵 REFACTOR:**
- [ ] CheckoutDialog 단일 surface 유지
- [ ] loading / error / empty states 추가
- [ ] 낙관적 성공 금지 — `pending_confirmation` 상태 도입

**✋ Quality Gate:**
- [ ] Toss sandbox 에서 Billing Key 발급 성공
- [ ] 첫 결제 승인 성공
- [ ] CheckoutDialog 에 dead button / no-op 없음
- [ ] 권한 없는 사용자 CTA disabled + 안내
- [ ] same-canvas 유지 확인 (신규 route 0)

**Rollback:** `PAYMENT_PROVIDER=stripe` env flag → Stripe checkout 재활성화 (Phase 1 abstraction 덕분에 가능)

---

### Phase 4: Toss Webhook + 멱등성 재활용 (3h)
**Goal:** Toss webhook endpoint 신규, Task #40 create-first 패턴 재활용, state machine 전이 완성.

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:**
- [ ] Toss webhook 페이로드 테스트 (결제승인/정기결제성공/실패/취소/환불)
- [ ] 중복 이벤트 skip 테스트 (PaymentEvent PK)
- [ ] 서명 검증 실패 → 400 테스트
- [ ] State machine 전이 matrix 테스트

**🟢 GREEN:**
- [ ] `POST /api/billing/webhook/toss` 신규 route
- [ ] Toss 서명 검증 (`TOSS_WEBHOOK_SECRET`)
- [ ] `PaymentEvent.create({ provider: 'toss', eventId })` create-first 패턴 (Task #40 재활용)
- [ ] 이벤트 → 상태 전이 매핑:
  - `PAYMENT_CONFIRMED` → Subscription.status = `active`
  - `BILLING_CHARGE_FAILED` → `past_due`
  - `BILLING_CANCELED` → `canceled` or `cancel_scheduled`
  - etc.
- [ ] 핸들러 실패 시 PaymentEvent rollback + 500 (Stripe 패턴과 동일)

**🔵 REFACTOR:**
- [ ] 기존 `/api/billing/webhook` (Stripe) → 410 Gone + deprecated 로그 (Phase 6 에서 삭제)
- [ ] 핸들러 공통 로직 추출 (`updateSubscriptionStatus`, `triggerTaxInvoice`)

**✋ Quality Gate:**
- [ ] webhook 멱등성 유지 (중복 이벤트 skip 로그)
- [ ] State machine 전이 matrix 검증
- [ ] canonical truth 경계 유지 (DB = projection)
- [ ] 핸들러 실패 시 Stripe 스타일 500 → 재시도 받음

**Rollback:** Toss webhook route 비활성화, Stripe webhook fallback

---

### Phase 5: 팝빌 전자세금계산서 연동 (3h)
**Goal:** 결제 승인 시 자동 세금계산서 발행, `Invoice` 에 발행 결과 저장, 고객사 이메일 수신.

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:**
- [ ] 팝빌 `RegistIssue` API 호출 테스트
- [ ] 발행 실패 시 재시도 정책 테스트
- [ ] 사업자번호 형식 검증 테스트
- [ ] Invoice.taxInvoiceUrl 링크 접근 테스트

**🟢 GREEN:**
- [ ] `src/lib/billing/tax-invoice/popbill.ts` — 팝빌 SDK 연동
- [ ] Organization 모델에 `businessNumber`, `businessName`, `representativeName`, `billingEmail` 필드 추가 (이미 있으면 skip)
- [ ] Toss webhook 의 `PAYMENT_CONFIRMED` 핸들러에서 팝빌 `RegistIssue` 호출
- [ ] 발행 성공 시 `Invoice.popbillIssueId`, `taxInvoiceUrl`, `taxInvoiceIssuedAt` 저장
- [ ] 발행 실패 시 `Invoice.taxInvoiceStatus = 'pending_retry'` + BackgroundJob 등록
- [ ] 설정 UI 에서 사업자번호 / 빌링 이메일 / 대표자명 편집 가능

**🔵 REFACTOR:**
- [ ] 발행 로직을 queue 기반으로 (webhook handler 안에서 동기 호출 금지, 별도 job)
- [ ] 팝빌 응답 로깅 정리

**✋ Quality Gate:**
- [ ] 팝빌 연동테스트 환경에서 세금계산서 1건 발행 성공
- [ ] 고객사 이메일 수신 확인
- [ ] 사업자번호 검증 로직 동작
- [ ] 발행 실패 재시도 정책 동작
- [ ] 수동 발행 fallback 경로 존재 (운영 복원력)

**Rollback:** 팝빌 호출 비활성화, Invoice 발행 플래그 false, 수동 발행 복귀

---

### Phase 6: 자체 Billing 관리 UI (Toss 는 hosted portal 없음) (4h)
**Goal:** Stripe Customer Portal 의존 제거, LabAxis 내부 UI 로 결제수단 관리 / 플랜 변경 / 세금계산서 다운로드 / 청구 내역 제공.

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:**
- [ ] 결제수단 교체 UI 테스트
- [ ] 플랜 변경 (업/다운/취소) UI 테스트
- [ ] 세금계산서 다운로드 테스트 (`Invoice.taxInvoiceUrl` 리다이렉트)
- [ ] 청구 내역 리스트 테스트
- [ ] Owner/Billing Admin 권한 분기 테스트

**🟢 GREEN:**
- [ ] `/dashboard/settings/plans` 내부 dock/sheet 로 billing 관리 surface 구현
- [ ] 결제수단 섹션: 등록된 카드 카드사/마지막 4자리 + 교체 CTA (Billing Key 재발급)
- [ ] 플랜 변경 섹션: 업/다운/취소 버튼 → CheckoutDialog 재사용
- [ ] 청구 내역 섹션: Invoice 리스트 + 세금계산서 다운로드 링크
- [ ] `GET /api/billing/invoices` 신규 route
- [ ] `GET /api/billing/invoices/:id/tax-invoice-url` (팝빌 Pop-up URL 프록시)
- [ ] `/api/billing/portal/route.ts` 삭제 (Stripe Customer Portal 의존 제거)

**🔵 REFACTOR:**
- [ ] `billing/page.tsx` 단일 surface 유지 (page-per-feature 방지)
- [ ] 결제 실패 / 해지 예약 / grace 상태 배너 통합

**✋ Quality Gate:**
- [ ] dead button / no-op 0
- [ ] loading / error / empty states 모두 존재
- [ ] Owner/Billing Admin 권한 이중 방어 (UI disable + 서버 enforceAction)
- [ ] same-canvas 유지 (신규 page 0)
- [ ] page-per-feature 회귀 없음

**Rollback:** portal route 임시 재활성화 (Phase 4 까지 Stripe 살아있음)

---

### Phase 7: Rollout + Stripe Cleanup (2h)
**Goal:** `PAYMENT_PROVIDER=toss` 전환, Stripe 코드 / 필드 / env 완전 제거.

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:**
- [ ] soft_enforce: Stripe 활성 구독 0건 재확인
- [ ] smoke path 전체 통과 (checkout → Billing Key → 첫 결제 → 세금계산서 → 다음 결제 갱신)
- [ ] rollback 시나리오 테스트 (`PAYMENT_PROVIDER=stripe` 복귀 가능 확인)

**🟢 GREEN:**
- [ ] Vercel / `.env.production` → `PAYMENT_PROVIDER=toss` full_enforce
- [ ] Stripe routes 삭제 (`/api/billing/webhook/route.ts` 의 Stripe 경로, `/api/billing/portal/route.ts`)
- [ ] Stripe SDK import 전부 제거
- [ ] Prisma migration: Workspace.stripe* / Subscription.stripe* / PaymentMethod.stripe* / Invoice.stripe* drop
- [ ] `StripeProvider` 삭제
- [ ] STRIPE_* env 제거

**🔵 REFACTOR:**
- [ ] `docs/architecture/billing-lifecycle.md` rewrite (Stripe → PG-agnostic)
- [ ] `STRIPE_BILLING_SETUP.md` → `TOSS_BILLING_SETUP.md` (팝빌 연동 포함)
- [ ] README / 온보딩 문서 업데이트

**✋ Quality Gate:**
- [ ] `grep -r "stripe" apps/web/src/` 결과 0 (주석 포함)
- [ ] `grep -r "STRIPE_" apps/web/` 결과 0
- [ ] Prisma schema 에 stripe* 필드 0
- [ ] 모든 smoke path 통과
- [ ] #37/#38 재범위 확정 (Toss 기준 task 재발행)

**Rollback:** Phase 7 migration down (복잡), 사실상 이 시점은 되돌리지 않는 것이 원칙. 문제 발견 시 Phase 6 상태로 복귀 (Stripe provider 재활성).

---

## 8. Optional Addenda

### A. Billing / Entitlement Addendum

**States:** `trialing` / `active` / `cancel_scheduled` / `past_due` / `grace` / `suspended` / `canceled` / `closed`
(참조: `BILLING_LIFECYCLE_STATE_MACHINE.md` §2)

**Scenarios:**
- [ ] 무료 → Team 업그레이드 (Billing Key 발급 + 첫 결제)
- [ ] Team → Business 업그레이드 (즉시 적용 + 일할 정산 차액)
- [ ] Business → Team 다운그레이드 (다음 결제일부터)
- [ ] 구독 취소 (cancel_at_period_end)
- [ ] 취소 예정 → 복구
- [ ] 결제 실패 → past_due → grace → suspended
- [ ] 결제수단 교체 (Billing Key 재발급)
- [ ] Enterprise 문의 분기 (self-serve 불가)

**Validation:**
- [ ] 로그인한 사용자는 추가 로그인 프롬프트 없음
- [ ] selectedPlan / returnTo 보존
- [ ] Toss webhook / 팝빌 응답 = 진실원, DB 는 projection

### B. API Slimming Addendum

**Waste Type:**
- [x] Duplicate Projection (billing webhook 핸들러 내 워크스페이스 업데이트 중복)
- [x] Contract Drift (Stripe → Toss 이벤트 타입 불일치)
- [x] No-op Endpoint (portal/route.ts 가 Phase 6 에서 Stripe hosted portal 의존)

**Minimal Diff Fix:**
- PaymentProvider abstraction 으로 route 책임 분리
- 공통 핸들러 로직 추출 (`updateSubscriptionStatus`, `triggerTaxInvoice`, `recordPaymentEvent`)
- portal/route.ts 삭제 (Toss 는 hosted portal 없음, 자체 UI 로 대체)

### C. Migration / Rollout Addendum

**Rollout Gate:**
- soft_enforce (`PAYMENT_PROVIDER=stripe` 유지, Toss route 는 shadow)
- 24~48h monitoring (Stripe 실 트래픽 없음 확인)
- full_enforce (`PAYMENT_PROVIDER=toss`)
- Phase 7 cleanup (stripe* 필드 drop)

**Migration Path:**
- Phase 1: StripeEvent → PaymentEvent (backfill)
- Phase 2: stripe* → provider* 필드 복사 (backfill)
- Phase 7: stripe* 필드 drop

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 토스 Billing Key 승인 지연 | Med | High | Phase 0 병행, 테스트키로 Phase 1~4 완주 |
| 팝빌 공인인증서 발급 지연 | Med | High | Phase 0 병행, 수동 발행 fallback 확보 |
| 팝빌 사업자번호 형식 / 휴/폐업 조회 미통과 | Low | Med | 발행 전 사업자 상태 조회 API 호출 |
| Proration 자체 계산 버그 | Med | Med | Phase 1 에 전용 unit test matrix |
| Canonical truth 경계 깨짐 (front-only success) | Low | High | Phase 4 quality gate 에서 명시 검증 |
| 기존 Stripe 테스트 구독 잔존 | Low | Med | Phase 7 soft_enforce 단계에서 Supabase 쿼리 확인 |
| Toss 위젯 SDK iframe 보안 이슈 | Low | Med | 공식 SDK 만 사용, CSP 조정 |
| 팝빌 발행 실패 시 사용자 혼란 | Med | Med | 재시도 queue + 수동 발행 fallback UI |
| 세금계산서 역발행 (고객 요청) 미지원 | Med | Low | Out of Scope 로 defer, Phase 7 이후 별도 phase |
| 모바일 앱 결제 향후 필요 | Low | Low | PaymentProvider abstraction 덕분에 대응 가능, 지금은 Out of Scope |

---

## 10. Rollback Strategy

- **If Phase 0 Fails:** 벤더 계약 / API 키 재확보 (코드 변경 없음)
- **If Phase 1 Fails:** PaymentEvent → StripeEvent rename revert, abstraction 제거, webhook 직접 Stripe 호출 복구
- **If Phase 2 Fails:** migration down, schema revert (provider 필드 제거)
- **If Phase 3 Fails:** `PAYMENT_PROVIDER=stripe` env flag → Stripe checkout 재활성화
- **If Phase 4 Fails:** Toss webhook route 비활성화, Stripe webhook fallback
- **If Phase 5 Fails:** 팝빌 호출 비활성화, 수동 발행 복귀
- **If Phase 6 Fails:** portal route 임시 재활성화, Stripe provider 유지
- **If Phase 7 Fails:** 사실상 되돌리지 않음 (운영 전환). 문제 발견 시 Phase 6 상태 유지 (Stripe provider 재활성).

**Special Cases:**
- **DB migration rollback:** Prisma migration down 스크립트 준비 (Phase 1, 2, 7)
- **Billing:** `PAYMENT_PROVIDER` env flag 로 즉시 전환 가능 (Phase 3~6)
- **soft_enforce → full_enforce:** Phase 7 에서 Vercel env 변경 1줄

---

## 11. Progress Tracking

- **Overall completion:** 0%
- **Current phase:** Phase 0 (pending user approval of Phase 0 kickoff)
- **Current blocker:** 벤더 계약 상태 확인 필요 (Toss Billing Key 승인 / 팝빌 공인인증서)
- **Next validation step:** Phase 0 RED 항목 4개 완료

### Phase Checklist
- [ ] Phase 0: Context & Truth Lock
- [ ] Phase 1: PaymentProvider Abstraction + PaymentEvent 일반화
- [ ] Phase 2: Schema Provider-agnostic 필드
- [ ] Phase 3: Toss Checkout + Billing Key
- [ ] Phase 4: Toss Webhook + 멱등성
- [ ] Phase 5: 팝빌 전자세금계산서 연동
- [ ] Phase 6: 자체 Billing 관리 UI
- [ ] Phase 7: Rollout + Stripe Cleanup

---

## 12. Notes & Learnings

### Blockers Encountered
- (Phase 진행하면서 업데이트)

### Implementation Notes
- (Phase 진행하면서 업데이트)

### Deferred Items (재범위 대상)
- Task #37: Proration 계산 API — Phase 7 이후 Toss 기준으로 재시작
- Task #38: 결제수단 조건부 단계 — Phase 3 에서 Toss 위젯 기준으로 흡수됨 (재시작 불필요할 가능성)
- 글로벌 시장 Stripe 병행 지원 — 고객 요청 발생 시 별도 plan
- 네이버페이 / 카카오페이 / 무통장 — PaymentProvider abstraction 위 후속
- 세금계산서 역발행 / 수정발행 자동화 — Phase 7 이후
- 모바일 앱 결제 — 웹 안정화 후

### Design Decisions (확정)
- [x] PG: 토스페이먼츠 (Billing Key 기반 정기결제)
- [x] 세금계산서: 팝빌 연동 (option b 확정 2026-04-18)
- [x] Abstraction: PaymentProvider interface 도입
- [x] Canonical truth: Toss webhook + 팝빌 응답
- [x] UI: same-canvas 유지, Stripe Customer Portal 대체 UI 자체 구현
- [x] Rollout: soft_enforce → full_enforce → Stripe cleanup 단계별 전환
