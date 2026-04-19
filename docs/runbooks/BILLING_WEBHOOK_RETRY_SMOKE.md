# Billing Webhook Retry Smoke Runbook (Task #40)

- **Purpose:** production 환경에서 Stripe webhook 멱등성 가드가 실제로 동작하는지 수동 검증
- **Scope:** `POST /api/billing/webhook` (commit `549fee1e feat(billing): Stripe webhook 멱등성 가드 (Task #40)`)
- **Evidence lock companion:** `apps/web/src/app/api/billing/webhook/__tests__/idempotency.test.ts` (Prisma mock 기반 unit evidence)
- **When to run:**
  - 릴리즈 직전 스모크 체크리스트
  - billing lifecycle 관련 배포 후
  - webhook endpoint 또는 `StripeEvent` 스키마 변경 후
- **Who:** Owner / Billing Admin (production Stripe Dashboard 접근 권한 필요)

---

## Pre-requisite

- [ ] Stripe Dashboard production mode 접근 권한
- [ ] Vercel logs 열람 권한 (`api/billing/webhook` route)
- [ ] 대상 workspace 의 `stripeCustomerId`, `stripeSubscriptionId` 확인 가능 (DB admin 또는 /settings/billing)
- [ ] 최근 처리된 Stripe event 1건 (최근 7일 이내 `customer.subscription.updated` 권장)

---

## Steps

### 1. Baseline 캡처 (retry 이전 상태 기록)

- Stripe Dashboard → Developers → Events → 최근 event 선택 (예: `evt_1Xyz...`)
  - [ ] event.id 기록
  - [ ] event.type 기록 (예: `customer.subscription.updated`)
- Workspace 상태 DB 조회 (또는 /settings/billing):
  - [ ] `plan` 값
  - [ ] `billingStatus` 값
  - [ ] `stripeCurrentPeriodEnd` 값

### 2. Webhook 재시도 트리거

- Stripe Dashboard → Developers → Events → 대상 event 선택 → **"Resend"** 버튼 클릭
- Resend target: production webhook endpoint

### 3. Vercel logs 확인 (1~2분 이내)

- Vercel → Project → Logs → Filter: `/api/billing/webhook`
- 다음 로그 라인 확인:
  - [ ] `"Webhook received"` (type / id 기록됨)
  - [ ] `"Duplicate webhook event skipped"` ← **이 로그가 나와야 멱등 가드 정상**
  - [ ] `"Updated workspace subscription"` 또는 유사 처리 로그가 **나오지 않아야 함**

### 4. Workspace 상태 불변 확인

- Workspace DB 재조회 (또는 /settings/billing 새로고침):
  - [ ] `plan` — Step 1 과 동일
  - [ ] `billingStatus` — Step 1 과 동일
  - [ ] `stripeCurrentPeriodEnd` — Step 1 과 동일

### 5. HTTP 응답 확인 (선택)

- Stripe Dashboard → Events → 대상 event → Webhook attempts 탭
- 최근 Resend attempt 의 response body:
  - [ ] `{"received":true,"duplicate":true}`
  - [ ] HTTP 200

---

## Expected Result

- logs 에 "Duplicate webhook event skipped" 노출
- workspace 필드 3건 모두 불변
- Stripe 응답 `{received:true, duplicate:true}`, HTTP 200

---

## Failure Path

### 증상: "Duplicate webhook event skipped" 로그가 안 찍힘 + workspace 상태 변함

- **원인 후보:**
  - `StripeEvent` table 이 비어있거나 drop 됨 (migration drift)
  - event.id PK create-first 로직이 변경됨
  - `Prisma.PrismaClientKnownRequestError` import 경로 변경 (P2002 instanceof 체크 실패)
- **즉시 조치:**
  1. webhook endpoint 를 Stripe Dashboard 에서 **disable** (event queue 만 쌓임)
  2. DB 에서 `SELECT COUNT(*) FROM "StripeEvent";` 로 row 존재 확인
  3. Vercel logs 에서 P2002 handling 에러 여부 확인
  4. route.ts L286-312 diff 최근 변경 이력 확인
- **Rollback:**
  - 최소 조치: webhook endpoint disable (Stripe 가 event queue 보관, 72시간 재시도)
  - 근본 조치: 마지막 안전 커밋 (`549fee1e` 또는 이후 regression 없는 커밋) 으로 revert
- **Follow-up:**
  - 새 residual tracker 로 등록
  - idempotency.test.ts 에 실패 재현 케이스 추가

### 증상: HTTP 500 반환 + "Failed to rollback StripeEvent after handler error" 로그

- **원인 후보:** handler 내부 DB 쓰기가 실패 → rollback delete 도 실패 (DB 연결 끊김 등)
- **영향:** 다음 재시도에서 `StripeEvent` row 가 남아있어 duplicate 로 오인 → 실제 처리 skip
- **즉시 조치:**
  1. DB 연결 복구 확인
  2. 문제의 `StripeEvent` row 를 수동 삭제: `DELETE FROM "StripeEvent" WHERE "eventId" = '<evt_id>';`
  3. Stripe Dashboard 에서 해당 event 다시 Resend

---

## Related

- Unit evidence: `apps/web/src/app/api/billing/webhook/__tests__/idempotency.test.ts`
- Implementation plan: `docs/plans/PLAN_webhook-idempotency-closeout.md`
- Architecture: `docs/billing-lifecycle.md` (Task #25)
- Source: `apps/web/src/app/api/billing/webhook/route.ts` L251-366
- Schema: `apps/web/prisma/schema.prisma` L1005-1012 (`StripeEvent`)
- Stripe docs: https://docs.stripe.com/webhooks (Handle duplicate events)

---

## Release Checklist Integration

릴리즈 전 billing 관련 체크리스트에 다음 한 줄 추가:

> - [ ] Billing webhook retry smoke (`docs/runbooks/BILLING_WEBHOOK_RETRY_SMOKE.md`) — duplicate skip 확인
