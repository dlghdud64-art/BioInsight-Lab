# LabAxis Billing Lifecycle & Entitlement State Machine

> **문서 목적:** 결제 UI를 만들기 전에 조직 단위 billing lifecycle + entitlement state machine을 확정한다.
> **작성일:** 2026-04-17
> **우선순위:** 정책/도메인 확정 (코딩 이전 단계)
> **전제:** release-prep batch → Batch 10 운영 전환이 먼저. 결제 구현은 이 문서 확정 후.

---

## 1. 설계 원칙

1. **결제 truth와 entitlement 분리** — 구독/인보이스/결제는 billing truth. 현재 조직이 무엇을 쓸 수 있는지는 entitlement. UI state나 프론트 플래그가 canonical truth를 대신하면 안 된다.
2. **결제 주체는 Organization** — LabAxis는 연구 구매 운영 OS. 개인이 아닌 조직/워크스페이스 기준으로 결제한다.
3. **Webhook/Event 기반** — 버튼보다 이벤트가 중요하다. `BillingEvent`를 append-only로 쌓고, 서버가 `EntitlementSnapshot`을 재계산한다.
4. **운영 연속성 우선** — LabAxis에는 quote/purchase/inventory/order 흐름이 쌓인다. 미납이라고 전체 하드락을 걸면 현장 운영 리스크가 커진다.

---

## 2. 상태 전이도 (State Machine)

### 2.1 구독 상태 (SubscriptionStatus)

```
                    ┌─────────────────────────────────────────────────────┐
                    │                                                     │
                    v                                                     │
┌──────────┐    ┌──────────┐    ┌──────────────────┐    ┌──────────┐     │
│ trialing │───>│  active   │───>│ cancel_scheduled │───>│ canceled │     │
└──────────┘    └──────────┘    └──────────────────┘    └──────────┘     │
     │               │                    │                   │          │
     │               │                    │                   │          │
     │               v                    │                   v          │
     │          ┌──────────┐              │            ┌──────────┐     │
     │          │ past_due │──────────────┘            │  closed  │     │
     │          └──────────┘                           └──────────┘     │
     │               │                                                  │
     │               v                                                  │
     │          ┌──────────┐                                            │
     │          │  grace   │────────────────────────────────────────────┘
     │          └──────────┘          (결제 수단 갱신 → active 복귀)
     │               │
     │               v
     │          ┌───────────┐
     └─────────>│ suspended │
     (trial     └───────────┘
      미전환)         │
                      v
                ┌──────────┐
                │  closed  │
                └──────────┘
```

### 2.2 상태 전이 규칙

| From | To | Trigger | 조건 |
|------|----|---------|------|
| (none) | `trialing` | checkout_completed (trial) | trial period 설정됨 |
| (none) | `active` | checkout_completed (paid) | 결제 성공 |
| `trialing` | `active` | payment_succeeded | trial 종료 전 결제 수단 등록 + 첫 결제 성공 |
| `trialing` | `canceled` | cancellation_scheduled + trial_end | trial 중 취소 → trial 종료 시 자동 canceled |
| `trialing` | `suspended` | trial_ended (미전환) | trial 종료 후 결제 수단 없음 |
| `active` | `cancel_scheduled` | cancellation_scheduled | 사용자가 취소 요청. 기간 종료까지 사용 가능 |
| `active` | `past_due` | payment_failed | 갱신 결제 실패 |
| `active` | `active` | subscription_updated (upgrade) | 업그레이드: 즉시 적용 |
| `active` | `active` | subscription_updated (downgrade) | 다운그레이드: next renewal에 반영 (pending change) |
| `cancel_scheduled` | `active` | cancellation_reverted | 취소 철회 (기간 종료 전) |
| `cancel_scheduled` | `canceled` | period_ended | 기간 종료 → 자동 canceled |
| `cancel_scheduled` | `canceled` | refund_issued (immediate) | 환불 승인 → 즉시 canceled + revoke |
| `past_due` | `active` | payment_succeeded | 결제 수단 갱신 후 결제 성공 |
| `past_due` | `grace` | grace_period_started | 첫 실패 후 N일 경과 (기본 7일) |
| `past_due` | `canceled` | cancellation_scheduled | past_due 중 취소 요청 |
| `grace` | `active` | payment_succeeded | grace 기간 중 결제 성공 |
| `grace` | `suspended` | grace_period_expired | grace 만료 (기본 14일) |
| `suspended` | `active` | payment_succeeded | 결제 수단 갱신 + 결제 성공 |
| `suspended` | `closed` | suspension_expired | 장기 미납 (기본 90일) |
| `canceled` | `active` | reactivation_completed | 재활성화 (기존 데이터/설정/히스토리 복원) |
| `canceled` | `closed` | retention_expired | 해지 후 데이터 보관 기간 만료 (기본 180일) |

### 2.3 환불 전용 분기

```
refund_issued
  ├── type: partial_refund
  │     → 상태 변화 없음, 금액만 조정
  ├── type: full_refund + immediate_revoke: false
  │     → cancel_scheduled (기간 종료까지 사용)
  └── type: full_refund + immediate_revoke: true
        → canceled (즉시 권한 박탈)
```

기본 정책: `immediate_revoke = false`. 관리자가 명시적으로 승인한 경우에만 `true`.

---

## 3. Entitlement Matrix

### 3.1 기능 권한 매핑

| 기능 영역 | trialing | active | cancel_scheduled | past_due | grace | suspended | canceled | closed |
|-----------|----------|--------|-------------------|----------|-------|-----------|----------|--------|
| **Read (조회/검색)** | Full | Full | Full | Full | Full | Full | Read-only export | None |
| **Quote 생성** | Full | Full | Full | Full | Limited | Blocked | Blocked | Blocked |
| **Purchase Request 생성** | Full | Full | Full | Full | Limited | Blocked | Blocked | Blocked |
| **Purchase Request 승인** | Full | Full | Full | Full | Blocked | Blocked | Blocked | Blocked |
| **PO 전환/발주** | Full | Full | Full | Blocked | Blocked | Blocked | Blocked | Blocked |
| **재고 입출고** | Full | Full | Full | Full | Limited | Blocked | Blocked | Blocked |
| **AI Actions** | Full | Full | Full | Full | Blocked | Blocked | Blocked | Blocked |
| **Export (CSV/Excel)** | Full | Full | Full | Full | Full | Full | Full (grace) | None |
| **조직 설정 변경** | Full | Full | Full | Full | Full | Limited | Blocked | Blocked |
| **멤버 초대** | Full | Full | Blocked | Full | Blocked | Blocked | Blocked | Blocked |
| **Billing 설정/결제 수단** | Full | Full | Full | Full | Full | Full | Full | None |
| **Data Export (이관)** | Full | Full | Full | Full | Full | Full | Full | Time-limited |
| **배너/알림** | Trial 안내 | None | 해지 예정 | 결제 실패 | 결제 촉구 | Write 제한 | 재활성화 유도 | 보관 만료 |

### 3.2 핵심 정책

- **past_due**: 배너 노출 + 결제 갱신 유도. 대부분 기능 유지. PO 전환만 차단 (금전 관련).
- **grace**: 신규 유료 작업 일부 제한. AI, 승인, 멤버 초대 차단. 읽기/내보내기/결제 설정은 유지.
- **suspended**: write 제한 모드. read/export/billing/settings만 허용. 새 작업 생성/승인/발주 전환 전체 차단.
- **canceled**: 재활성화 가능 기간. read-only export 허용 (데이터 이관 목적). billing 설정 접근 유지 (재구독 가능).
- **closed**: 보관 기간 만료. 전체 접근 차단. 관리자 문의로만 복구 가능.

### 3.3 Entitlement 계산 규칙

```
EntitlementSnapshot = f(Subscription.status, Subscription.plan, Organization.features)
```

1. `Subscription.status`로 base entitlement 결정 (위 matrix)
2. `Subscription.plan` (FREE/TEAM/ORGANIZATION)으로 plan-level 제한 적용 (seat 수, 월간 quota 등)
3. `Organization` feature flags로 override 가능 (beta features, custom limits)
4. **Snapshot은 서버에서만 계산** — 프론트는 snapshot을 받아서 UI만 렌더링

---

## 4. Webhook → BillingEvent → EntitlementSnapshot 흐름

### 4.1 이벤트 흐름

```
[Stripe/PG Webhook]
        │
        v
┌─────────────────────┐
│  POST /api/billing/ │
│  webhook             │
│  (signature verify)  │
└─────────┬───────────┘
          │
          v
┌─────────────────────┐
│  BillingEvent        │  ← append-only INSERT
│  (idempotency key)   │
└─────────┬───────────┘
          │
          v
┌─────────────────────┐
│  processEvent()      │  ← 이벤트 타입별 핸들러
│  (same tx)           │
└─────────┬───────────┘
          │
          ├── Subscription.status 업데이트
          ├── Invoice 생성/업데이트
          └── EntitlementSnapshot 재계산 + 캐시 갱신
                    │
                    v
          ┌────────────────────┐
          │ invalidateCache()  │ ← React Query / Redis
          └────────────────────┘
```

### 4.2 필수 이벤트 목록

| Event Type | Source | Handler Action |
|------------|--------|----------------|
| `checkout_completed` | Stripe checkout.session.completed | Subscription 생성, active/trialing 설정 |
| `payment_succeeded` | Stripe invoice.payment_succeeded | past_due/grace → active 복귀, Invoice 업데이트 |
| `payment_failed` | Stripe invoice.payment_failed | active → past_due, 재시도 카운트 증가 |
| `subscription_updated` | Stripe customer.subscription.updated | plan/seat/period 변경 반영 |
| `subscription_deleted` | Stripe customer.subscription.deleted | canceled 처리 |
| `cancellation_scheduled` | 내부 API (사용자 취소) | cancelAtPeriodEnd = true, status → cancel_scheduled |
| `cancellation_reverted` | 내부 API (취소 철회) | cancelAtPeriodEnd = false, status → active |
| `refund_issued` | Stripe charge.refunded | 환불 타입별 분기 (partial/full, immediate_revoke) |
| `dispute_opened` | Stripe charge.dispute.created | 분쟁 플래그 설정, 관리자 알림 |
| `grace_period_started` | 내부 cron (past_due N일 경과) | status → grace |
| `grace_period_expired` | 내부 cron (grace N일 경과) | status → suspended |
| `suspension_expired` | 내부 cron (suspended N일 경과) | status → closed |

### 4.3 Idempotency 보장

```typescript
// BillingEvent.eventKey — unique constraint
// 형식: {provider}:{eventType}:{providerEventId}
// 예: stripe:invoice.payment_succeeded:evt_1234567890
```

- Stripe webhook은 동일 이벤트를 재전송할 수 있음 → eventKey unique로 중복 방지
- P2002 (unique violation) → idempotent skip (MutationAuditEvent과 동일 패턴)

---

## 5. 플랜 변경 정책

| 변경 유형 | 적용 시점 | Proration | 비고 |
|-----------|----------|-----------|------|
| 업그레이드 (FREE→TEAM, TEAM→ORG) | 즉시 | 일할 계산 (남은 기간만큼 차액 청구) | entitlement 즉시 반영 |
| 다운그레이드 (ORG→TEAM, TEAM→FREE) | 다음 결제 주기 | 없음 | pendingPlanChange에 기록, renewal 시 적용 |
| Seat 추가 | 즉시 | 일할 계산 | currentSeats 즉시 증가 |
| Seat 감소 | 다음 결제 주기 | 없음 | 현재 활성 멤버 수 이하로 줄일 수 없음 |
| 월간 → 연간 | 즉시 | 월간 잔여분 크레딧 | 연간 할인 적용 |
| 연간 → 월간 | 다음 renewal | 없음 | 연간 계약 잔여분은 유지 |
| 해지 후 재활성화 | 즉시 | 신규 결제 | 기존 데이터/설정/히스토리 복원 |

---

## 6. 최소 DB 모델 (Prisma Schema Draft)

### 6.1 신규 모델

```prisma
// ── 구독 상태 enum (기존 status String → enum으로 전환) ──

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  CANCEL_SCHEDULED
  PAST_DUE
  GRACE
  SUSPENDED
  CANCELED
  CLOSED
}

// ── BillingEvent: provider webhook/event append-only 기록 ──

model BillingEvent {
  id               String   @id @default(cuid())
  organizationId   String
  eventKey         String   @unique  // idempotency: {provider}:{type}:{providerEventId}
  eventType        String             // checkout_completed, payment_succeeded, etc.
  provider         String   @default("stripe")  // stripe, manual, internal_cron
  providerEventId  String?            // Stripe event ID
  occurredAt       DateTime
  payload          Json               // raw webhook payload (audit 목적)
  processedAt      DateTime?          // 처리 완료 시각
  processingError  String?  @db.Text  // 처리 실패 시 에러 메시지
  createdAt        DateTime @default(now())

  // 관계
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, occurredAt])
  @@index([eventType])
  @@index([providerEventId])
}

// ── EntitlementSnapshot: 현재 조직의 기능 권한 스냅샷 ──

model EntitlementSnapshot {
  id               String   @id @default(cuid())
  organizationId   String   @unique  // 조직당 1개 (최신 스냅샷)
  subscriptionStatus SubscriptionStatus
  plan             SubscriptionPlan
  computedAt       DateTime @default(now())

  // 기능 권한 플래그
  canCreateQuote         Boolean @default(true)
  canCreateRequest       Boolean @default(true)
  canApproveRequest      Boolean @default(true)
  canConvertPO           Boolean @default(true)
  canManageInventory     Boolean @default(true)
  canUseAiActions        Boolean @default(true)
  canExport              Boolean @default(true)
  canInviteMembers       Boolean @default(true)
  canModifySettings      Boolean @default(true)
  canAccessBilling       Boolean @default(true)

  // Plan-level 제한
  maxSeats               Int?
  maxQuotesPerMonth      Int?
  maxAiActionsPerMonth   Int?

  // 메타
  triggerEventId   String?   // 이 스냅샷을 생성한 BillingEvent ID
  previousStatus   SubscriptionStatus?  // 이전 상태 (변경 추적)

  // 관계
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([subscriptionStatus])
}
```

### 6.2 기존 모델 변경

```prisma
// Subscription — status를 String에서 enum으로 전환
model Subscription {
  // ... 기존 필드 유지 ...
  status               SubscriptionStatus @default(ACTIVE)  // String → enum
  
  // 신규 필드
  gracePeriodEndsAt    DateTime?  // grace 만료일
  suspendedAt          DateTime?  // suspended 진입일
  pendingPlanChange    Json?      // 다운그레이드 예약: { plan, effectiveAt }
  canceledAt           DateTime?  // 취소 일시
  cancelReason         String?    // 취소 사유
  reactivatedAt        DateTime?  // 재활성화 일시

  // 관계 추가
  billingEvents BillingEvent[]  // (Organization 경유 가능하지만 직접 참조도 고려)
}

// Organization — EntitlementSnapshot 관계 추가
model Organization {
  // ... 기존 필드 유지 ...
  entitlement     EntitlementSnapshot?
  billingEvents   BillingEvent[]
}
```

### 6.3 기존 모델 유지 (변경 없음)

- `Invoice` — 이미 존재. 결제 이력 저장용으로 충분.
- `PaymentMethod` — 이미 존재. Stripe PaymentMethod ID 연동.
- `BillingInfo` — 이미 존재. 세금계산서/청구 정보.

---

## 7. 최소 UI Surface

### 7.1 필수 페이지/컴포넌트

| Surface | 위치 | 설명 | 우선순위 |
|---------|------|------|----------|
| Billing Dashboard | `/dashboard/settings` billing 탭 | 현재 플랜, 상태, 다음 청구일, 결제 수단, 인보이스 목록 | P1 |
| Plan Selection | `/dashboard/settings/plan` | 플랜 비교 + 업/다운그레이드 | P1 |
| Checkout | Stripe Checkout (hosted) | 외부 결제 페이지 (자체 구현 X) | P1 |
| Entitlement Banner | 전역 Layout | 상태별 배너 (past_due, grace, suspended 등) | P1 |
| Cancel Flow | Settings modal | 취소 확인 + 사유 수집 + cancel_at_period_end 안내 | P1 |
| Reactivation | Settings modal | 재활성화 (canceled 상태에서) | P2 |
| Seat Management | Settings 탭 | 현재 seat 수 / 추가/감소 | P2 |
| Invoice Detail | Settings 탭 | 개별 인보이스 상세 + PDF 다운로드 | P2 |

### 7.2 상태별 배너 메시지

| 상태 | 배너 유형 | 메시지 (예시) |
|------|----------|--------------|
| `trialing` | Info (blue) | "무료 체험 중입니다. N일 후 플랜이 만료됩니다." |
| `cancel_scheduled` | Warning (amber) | "구독 해지가 예정되어 있습니다. YYYY-MM-DD까지 사용 가능합니다." |
| `past_due` | Warning (amber) | "결제가 실패했습니다. 결제 수단을 확인해 주세요." |
| `grace` | Error (red) | "결제가 지연되고 있습니다. N일 내 결제하지 않으면 일부 기능이 제한됩니다." |
| `suspended` | Error (red) | "결제 미납으로 기능이 제한되었습니다. 결제를 완료하면 즉시 복구됩니다." |
| `canceled` | Neutral (slate) | "구독이 해지되었습니다. 재활성화하면 기존 데이터를 복원할 수 있습니다." |

### 7.3 Entitlement 차단 UX

기능이 차단된 경우 버튼/액션을 완전히 숨기지 않고, **disabled + tooltip**으로 표시:

```
[발주 전환] (disabled)
tooltip: "결제 상태를 확인해 주세요. 결제가 완료되면 이 기능을 다시 사용할 수 있습니다."
→ CTA: "결제 설정으로 이동"
```

---

## 8. 테스트 시나리오 Walk-Through

### 시나리오 1: 가입 성공 → 즉시 활성화

```
1. 사용자가 TEAM 플랜 선택 → Stripe Checkout으로 이동
2. 결제 성공 → Stripe webhook: checkout.session.completed
3. BillingEvent INSERT (eventKey: stripe:checkout.session.completed:cs_xxx)
4. processEvent():
   - Subscription 생성 (status: ACTIVE, plan: TEAM)
   - EntitlementSnapshot 계산 (전체 기능 활성화)
5. 프론트: React Query invalidation → 대시보드에 TEAM 플랜 표시
```

### 시나리오 2: 가입 직후 취소 → 기간 종료일까지 유지

```
1. 사용자가 Settings에서 "구독 취소" 클릭
2. 내부 API: POST /api/billing/cancel
   - Stripe: subscription.update({ cancel_at_period_end: true })
3. BillingEvent INSERT (eventType: cancellation_scheduled)
4. processEvent():
   - Subscription.cancelAtPeriodEnd = true
   - Subscription.status → CANCEL_SCHEDULED
   - EntitlementSnapshot: 전체 기능 유지 (멤버 초대만 차단)
5. 배너: "YYYY-MM-DD까지 사용 가능합니다"
6. 기간 종료 시 Stripe webhook: customer.subscription.deleted
7. BillingEvent INSERT → Subscription.status → CANCELED
8. EntitlementSnapshot 재계산: read-only export + billing 접근만 허용
```

### 시나리오 3: 사용 중 중도 취소

```
시나리오 2와 동일. 기간 종료까지 정상 사용.
renewal만 중단. 즉시 revoke 없음.
```

### 시나리오 4: Trial 중 취소

```
1. Trial 기간 중 사용자가 취소 요청
2. BillingEvent INSERT (eventType: cancellation_scheduled)
3. Subscription.cancelAtPeriodEnd = true, status → CANCEL_SCHEDULED
4. Trial 종료 시:
   - 결제 수단 없음 → 자동 canceled
   - BillingEvent INSERT (eventType: trial_ended_no_conversion)
5. EntitlementSnapshot 재계산: canceled 권한
6. 과금 전이므로 환불 없음
```

### 시나리오 5: 갱신 결제 실패

```
1. Stripe webhook: invoice.payment_failed
2. BillingEvent INSERT (eventType: payment_failed)
3. processEvent():
   - Subscription.status → PAST_DUE
   - EntitlementSnapshot: PO 전환만 차단, 나머지 유지
   - 배너: "결제가 실패했습니다"
4. Stripe가 자동 재시도 (1일, 3일, 5일)
5. 재시도 성공 시: payment_succeeded → ACTIVE 복귀
6. 재시도 전부 실패 + 7일 경과:
   - 내부 cron: grace_period_started
   - Subscription.status → GRACE
   - EntitlementSnapshot: 추가 제한 적용
```

### 시나리오 6: Grace 기간 만료 → Suspended

```
1. Grace 14일 경과, 결제 여전히 미복구
2. 내부 cron: grace_period_expired
3. BillingEvent INSERT
4. Subscription.status → SUSPENDED
5. EntitlementSnapshot:
   - write 전체 차단 (quote 생성, request, 승인, PO, 재고, AI)
   - read/export/billing/settings만 허용
6. 배너: "기능이 제한되었습니다. 결제를 완료하면 즉시 복구됩니다."
```

### 시나리오 7: 결제 수단 갱신 → Active 복귀

```
1. Suspended 상태에서 사용자가 결제 수단 업데이트
2. Stripe: 즉시 미납 인보이스 결제 시도
3. payment_succeeded webhook
4. BillingEvent INSERT
5. processEvent():
   - Subscription.status → ACTIVE
   - suspendedAt = null
   - EntitlementSnapshot 재계산: 전체 기능 복원
6. 배너 제거, 정상 운영 복귀
```

### 시나리오 8: 업그레이드 (TEAM → ORGANIZATION)

```
1. 사용자가 Settings에서 ORG 플랜 선택
2. Stripe: subscription.update({ price: org_price, proration_behavior: 'create_prorations' })
3. Stripe webhook: customer.subscription.updated
4. BillingEvent INSERT (eventType: subscription_updated)
5. processEvent():
   - Subscription.plan → ORGANIZATION
   - 일할 계산 인보이스 자동 생성
   - EntitlementSnapshot 즉시 재계산: ORG 제한 적용 (seat 증가, 기능 확장)
6. 즉시 반영 — 다음 주기까지 기다리지 않음
```

### 시나리오 9: 다운그레이드 (ORGANIZATION → TEAM)

```
1. 사용자가 TEAM 플랜으로 변경 요청
2. 내부 API:
   - Subscription.pendingPlanChange = { plan: "TEAM", effectiveAt: currentPeriodEnd }
   - Stripe: subscription.update({ cancel_at_period_end: false }) (유지, 다음 주기에 변경)
3. 현재 주기 종료까지 ORG 기능 유지
4. Renewal 시 Stripe webhook: subscription_updated
5. processEvent():
   - Subscription.plan → TEAM
   - pendingPlanChange = null
   - EntitlementSnapshot 재계산: TEAM 제한 적용
6. Seat 초과 시: 관리자에게 멤버 정리 안내 (자동 삭제 안 함)
```

### 시나리오 10: 환불

```
Case A: Partial refund
1. 관리자가 Stripe Dashboard에서 부분 환불 처리
2. charge.refunded webhook
3. BillingEvent INSERT
4. 상태 변화 없음, 금액만 조정

Case B: Full refund + immediate_revoke = false (기본)
1. 관리자가 전체 환불 처리 (immediate_revoke 미승인)
2. BillingEvent INSERT
3. Subscription.status → CANCEL_SCHEDULED
4. 기간 종료까지 정상 사용

Case C: Full refund + immediate_revoke = true
1. 관리자가 전체 환불 + 즉시 revoke 승인
2. BillingEvent INSERT
3. Subscription.status → CANCELED
4. EntitlementSnapshot 즉시 재계산: canceled 권한
```

### 보너스 시나리오: 조직 Owner 변경/탈퇴

```
1. Owner가 조직을 탈퇴하려 함
2. 시스템 체크: billing admin이 다른 ADMIN 멤버에게 승계되었는지 확인
3. 승계 대상 없으면 → 탈퇴 차단 ("먼저 다른 관리자를 지정해 주세요")
4. 승계 대상 있으면 → billingAdminUserId 변경 + Owner 탈퇴 허용
5. Stripe customer.update({ metadata: { billingAdminUserId: newAdminId } })
```

---

## 9. 구현 순서 권장

> release-prep batch와 Batch 10 전환 이후에 실행

| Phase | 범위 | 산출물 |
|-------|------|--------|
| **Phase 0** (현재) | 이 문서 리뷰 + 정책 확정 | 팀 합의된 최종 정책 |
| **Phase 1** | DB 마이그레이션 (SubscriptionStatus enum, BillingEvent, EntitlementSnapshot) | Prisma migration |
| **Phase 2** | Webhook handler + BillingEvent 기록 + EntitlementSnapshot 계산 로직 | Server-side core |
| **Phase 3** | Entitlement middleware (API route 진입 시 권한 체크) | enforceEntitlement() |
| **Phase 4** | Billing Dashboard UI + Cancel Flow + 배너 | Frontend |
| **Phase 5** | Plan Selection + Checkout (Stripe hosted) + Upgrade/Downgrade | Frontend + Stripe |
| **Phase 6** | Cron jobs (grace_period, suspension, closed 전이) | Scheduled tasks |
| **Phase 7** | E2E 테스트 (10개 시나리오 전부) | Test suite |

---

## 10. 미결 사항 (팀 확인 필요)

1. **Grace period 기간**: 7일? 14일? 업종 표준 확인 필요
2. **Suspended → Closed 기간**: 90일? 더 길게?
3. **Canceled 데이터 보관 기간**: 180일? 법적 요건 확인
4. **Trial 기간**: 14일? 30일?
5. **FREE 플랜 제한 범위**: 현재 FREE가 어디까지 허용하는지 구체화
6. **연간 결제 할인율**: 20%? 별도 협의?
7. **한국 세금계산서 자동 발행**: Stripe Tax + BillingInfo 연동 방식
8. **Dispute 처리 정책**: 분쟁 발생 시 즉시 suspended? 아니면 조사 기간 유지?

---

*이 문서가 팀 리뷰를 거쳐 확정되면, Phase 1 DB 마이그레이션부터 시작합니다.*
