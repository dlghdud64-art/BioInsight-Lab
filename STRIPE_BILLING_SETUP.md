# Stripe 구독 결제 설정 가이드

Workspace 기반 Stripe 구독 결제 시스템 설정 가이드입니다.

## 개요

이 시스템은 Workspace별로 Stripe 구독을 관리합니다:

- **FREE 플랜**: 기본 플랜 (결제 불필요)
- **TEAM 플랜**: 월간 구독 (Stripe Checkout 통해 결제)
- **ENTERPRISE 플랜**: 향후 확장용

### 주요 기능

1. **체크아웃 세션**: Workspace 관리자가 TEAM 플랜 구독 시작
2. **빌링 포털**: 구독 관리, 결제 수단 변경, 해지
3. **Webhook 자동 처리**: 결제 성공/실패/해지 시 자동 플랜 업데이트
4. **Plan Gate**: Scope 기반 기능 접근 제어

## 환경 변수 설정

`.env` 파일에 다음 변수 추가:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Webhook Secret (Stripe CLI 또는 대시보드에서 생성)
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price ID (TEAM 월간 구독 가격)
STRIPE_PRICE_ID_TEAM_MONTHLY=price_...

# App URL (리디렉션용)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Stripe 설정

### 1. Stripe 계정 생성

1. [Stripe](https://stripe.com) 가입
2. 대시보드에서 API Keys 확인 (테스트 모드 사용 권장)

### 2. 상품 및 가격 생성

1. Stripe 대시보드 → Products → Add product
2. 상품 정보:
   - Name: "AI BioCompare - TEAM Plan"
   - Description: "Team collaboration features"
3. Pricing:
   - Model: Recurring
   - Billing period: Monthly
   - Price: 원하는 가격 설정 (예: $29/month)
4. 생성 후 Price ID 복사 → `STRIPE_PRICE_ID_TEAM_MONTHLY`

### 3. Webhook 설정

**방법 1: Stripe CLI (로컬 개발)**

```bash
# Stripe CLI 설치
brew install stripe/stripe-cli/stripe  # macOS
# 또는 https://stripe.com/docs/stripe-cli 참조

# 로그인
stripe login

# Webhook 포워딩 (로컬 개발)
stripe listen --forward-to localhost:3000/api/billing/webhook

# 출력된 webhook secret을 STRIPE_WEBHOOK_SECRET에 설정
```

**방법 2: Stripe 대시보드 (프로덕션)**

1. Stripe 대시보드 → Developers → Webhooks
2. Add endpoint 클릭
3. Endpoint URL: `https://yourdomain.com/api/billing/webhook`
4. 다음 이벤트 선택:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Add endpoint 후 Signing secret 복사 → `STRIPE_WEBHOOK_SECRET`

## 데이터베이스 스키마

### Workspace 모델 업데이트

```prisma
enum BillingStatus {
  ACTIVE      // 정상 구독 중
  TRIALING    // 무료 체험 기간
  PAST_DUE    // 결제 실패 (유예 기간)
  CANCELED    // 구독 취소됨
}

model Workspace {
  // 기존 필드...
  plan                    WorkspacePlan   @default(FREE)

  // Stripe 결제 필드
  stripeCustomerId        String?         @unique
  stripeSubscriptionId    String?         @unique
  stripePriceId           String?
  stripeCurrentPeriodEnd  DateTime?
  billingStatus           BillingStatus?
}
```

## API 엔드포인트

### 1. 체크아웃 세션 생성

**POST** `/api/billing/checkout`

Workspace 관리자가 TEAM 플랜 구독을 시작합니다.

**요청:**
```json
{
  "workspaceId": "clxyz123..."
}
```

**응답:**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

**권한:**
- 인증 필수
- Workspace ADMIN 역할 필요

**동작 흐름:**
1. Workspace 관리자 권한 확인
2. Stripe Customer 생성 (없으면)
3. Checkout Session 생성 (mode=subscription)
4. 성공 URL: `/workspace/{slug}/billing?success=true`
5. 취소 URL: `/workspace/{slug}/billing?canceled=true`

### 2. 빌링 포털 세션 생성

**POST** `/api/billing/portal`

구독 관리 포털 접속 링크를 생성합니다.

**요청:**
```json
{
  "workspaceId": "clxyz123..."
}
```

**응답:**
```json
{
  "url": "https://billing.stripe.com/..."
}
```

**권한:**
- 인증 필수
- Workspace ADMIN 역할 필요

**포털에서 가능한 작업:**
- 결제 수단 변경
- 구독 취소
- 청구서 다운로드
- 결제 내역 확인

### 3. Webhook 핸들러

**POST** `/api/billing/webhook`

Stripe에서 발생하는 이벤트를 자동으로 처리합니다.

**보안:**
- Raw body로 signature 검증
- `stripe-signature` 헤더 필수
- `STRIPE_WEBHOOK_SECRET`로 검증

**처리 이벤트:**

**checkout.session.completed**
- 결제 완료 시
- Workspace → TEAM 플랜 업그레이드
- billingStatus = ACTIVE 또는 TRIALING

**customer.subscription.created/updated**
- 구독 상태 변경 시
- status별 플랜 및 상태 업데이트:
  - `active` → plan=TEAM, billingStatus=ACTIVE
  - `trialing` → plan=TEAM, billingStatus=TRIALING
  - `past_due` → plan=TEAM, billingStatus=PAST_DUE
  - `canceled` → plan=FREE, billingStatus=CANCELED

**customer.subscription.deleted**
- 구독 삭제 시
- plan=FREE로 다운그레이드
- billingStatus=CANCELED

**invoice.payment_succeeded**
- 결제 성공 시
- billingStatus=ACTIVE 업데이트

**invoice.payment_failed**
- 결제 실패 시
- billingStatus=PAST_DUE 설정
- plan은 유지 (유예 기간)

## Scope 유틸리티 - Plan Gate 연동

### Plan 확인

```typescript
import { getScope, getWorkspacePlan } from "@/lib/auth/scope";

const scope = await getScope(request);
const plan = await getWorkspacePlan(scope);

// plan: "FREE" | "TEAM" | "ENTERPRISE"
// Guest scope는 항상 "FREE"
```

### Feature 접근 제어

```typescript
import { hasFeatureAccess } from "@/lib/auth/scope";

// 기능 레벨 체크
const canUseTeamFeatures = await hasFeatureAccess(scope, "team");

if (!canUseTeamFeatures) {
  return NextResponse.json(
    { error: "TEAM plan required" },
    { status: 403 }
  );
}
```

### Plan 요구 사항 강제

```typescript
import { requirePlan } from "@/lib/auth/scope";

// TEAM 플랜 이상 필요
await requirePlan(scope, "TEAM");
// Plan이 낮으면 에러 발생: "TEAM plan required. Current plan: FREE"
```

### Billing 상태 확인

```typescript
import { getBillingStatus } from "@/lib/auth/scope";

const billingStatus = await getBillingStatus(scope);

if (billingStatus === "PAST_DUE") {
  // 결제 실패 안내 표시
}
```

## 사용 예시

### 프론트엔드: 구독 시작

```typescript
async function handleSubscribe() {
  const response = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId: workspace.id }),
  });

  const { url } = await response.json();

  // Stripe Checkout으로 리디렉션
  window.location.href = url;
}
```

### 프론트엔드: 빌링 포털 접속

```typescript
async function handleManageBilling() {
  const response = await fetch("/api/billing/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId: workspace.id }),
  });

  const { url } = await response.json();

  // Stripe 빌링 포털로 리디렉션
  window.location.href = url;
}
```

### 백엔드: TEAM 기능 Gate

```typescript
// API 엔드포인트에서
export async function POST(request: NextRequest) {
  const scope = await getScope(request);

  // TEAM 플랜 필요
  await requirePlan(scope, "TEAM");

  // 여기서부터 TEAM 전용 기능 실행
  // ...
}
```

## 테스트

### 1. 로컬 테스트 (Stripe CLI)

```bash
# Webhook 포워딩 시작
stripe listen --forward-to localhost:3000/api/billing/webhook

# 개발 서버 실행
npm run dev

# 브라우저에서 체크아웃 테스트
# Stripe 테스트 카드 사용: 4242 4242 4242 4242
# CVC: 임의 3자리, 만료일: 미래 날짜
```

### 2. 테스트 시나리오

**시나리오 1: 신규 구독**
1. Workspace 생성
2. `/api/billing/checkout` 호출
3. Stripe Checkout 페이지에서 결제
4. webhook으로 `checkout.session.completed` 수신
5. Workspace plan=TEAM, billingStatus=ACTIVE 확인

**시나리오 2: 구독 취소**
1. 빌링 포털 접속
2. "Cancel subscription" 클릭
3. webhook으로 `customer.subscription.deleted` 수신
4. Workspace plan=FREE, billingStatus=CANCELED 확인

**시나리오 3: 결제 실패**
1. Stripe 대시보드에서 수동으로 결제 실패 시뮬레이션
2. webhook으로 `invoice.payment_failed` 수신
3. billingStatus=PAST_DUE 확인

### 3. Webhook 테스트 (Stripe CLI)

```bash
# 특정 이벤트 트리거
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
```

## 프로덕션 체크리스트

- [ ] Stripe 프로덕션 API Key 설정
- [ ] 실제 가격 설정 (Price ID 업데이트)
- [ ] Webhook 엔드포인트 등록 (프로덕션 URL)
- [ ] HTTPS 설정 확인
- [ ] 환경 변수 프로덕션 서버에 설정
- [ ] 로그 모니터링 설정
- [ ] 에러 알림 설정 (Sentry 등)
- [ ] 백업 및 롤백 계획
- [ ] 구독 취소 정책 문서화
- [ ] 환불 정책 문서화

## 보안 고려사항

1. **Webhook Signature 검증**
   - 모든 webhook은 signature 검증 필수
   - 검증 실패 시 400 에러 반환

2. **Admin 권한 체크**
   - 체크아웃/포털은 Workspace ADMIN만 접근 가능
   - 멤버 권한으로는 접근 불가

3. **API Key 보안**
   - `STRIPE_SECRET_KEY`는 서버 측에만 저장
   - Publishable key만 클라이언트에 노출

4. **Rate Limiting**
   - 체크아웃/포털 엔드포인트에 rate limit 적용 권장

5. **로그 관리**
   - 결제 관련 민감 정보는 로그에서 제외
   - PCI DSS 준수

## 모니터링

### 주요 지표

1. **전환율**: 체크아웃 시작 → 결제 완료
2. **해지율**: 월별 구독 해지 비율
3. **결제 실패율**: past_due 발생 빈도
4. **평균 구독 기간**: 고객 생명 주기

### 로그 확인

```bash
# Webhook 이벤트 로그
grep "api/billing/webhook" logs/app.log

# 체크아웃 세션 로그
grep "billing/checkout" logs/app.log

# Plan 업데이트 로그
grep "Updated workspace subscription" logs/app.log
```

## 문제 해결

### Webhook이 동작하지 않음

1. Stripe 대시보드에서 webhook 이벤트 로그 확인
2. Endpoint URL이 HTTPS인지 확인
3. Signature secret이 올바른지 확인
4. 서버 로그에서 에러 확인

### Plan이 업데이트되지 않음

1. Webhook 이벤트가 수신되었는지 확인
2. `metadata.workspaceId`가 올바른지 확인
3. 데이터베이스 직접 조회로 업데이트 여부 확인

### 체크아웃 리디렉션 실패

1. `NEXT_PUBLIC_APP_URL` 환경 변수 확인
2. Success/Cancel URL 경로 존재 여부 확인
3. CORS 설정 확인

## 향후 개선 사항

- [ ] 연간 구독 옵션 추가
- [ ] 쿠폰/프로모션 코드 지원
- [ ] 사용량 기반 과금 (usage-based billing)
- [ ] 구독 일시 중지 기능
- [ ] 자동 세금 계산 (Stripe Tax)
- [ ] 다중 통화 지원
- [ ] Invoice 이메일 커스터마이징
- [ ] 구독 업그레이드/다운그레이드 flow
