# Billing Lifecycle 설계 노트

> **상태**: 승인 (Approved by CEO) — 2026-04-17
> **연결 문서**: `organization-workspace-bootstrap.md` (옵션 B) — 본 설계의 선결 과제
> **공식 가격 기준**: `/pricing` 공개 페이지 — Team ₩129,000/월, Business ₩349,000/월, Enterprise 별도 문의
> **Proration 방식**: Stripe 내장 `proration_behavior: create_prorations` (직접 계산 없음)

## 1. 3단 분리 원칙 (Confirmed)

사용자가 billing과 만나는 표면을 역할로 분리한다.

| 표면 | 목적 | 보여주는 것 | 보여주지 않는 것 |
|---|---|---|---|
| 공개 `/pricing` | 플랜 비교·도입 범위 이해 | 가격, 도입 규모, self-serve vs 상담 분기 | 현재 구독 상태, 결제수단 |
| 앱 내부 `/dashboard/settings/plans` | **현재 구독 상태** 확인·관리 | 현재 플랜, 다음 결제일, 결제수단, 청구 내역, 취소/복구 상태 | 플랜 비교 마케팅 |
| 모달 Wizard | **실제 플랜 변경 실행** | 변경 확인 → 청구 정보 → (결제수단) → 최종 확인 → 완료 | 플랜 비교(이미 선택됨) |

이 분리는 "clickable no-op 금지" 원칙에 부합한다. 플랜 카드를 누르면 **반드시 실행 경로**로 이어진다.

## 2. 현재 불완전한 지점 (사장님 진단)

좋은 UI는 나왔으나 아직 billing lifecycle이 **덜 닫힌 상태**. 보완 항목:

### 2.1 주문 요약의 모호성
- `즉시 적용됩니다`만 표시 → 결제 불확실성.
- 최소 표시 필수:
  - **오늘 결제 금액** (proration 적용 후)
  - **다음 결제일부터 청구 금액** (recurring)
  - **적용 방식**: 즉시 업그레이드 / 다음 결제일부터 다운그레이드 / 해지 예약
  - **남은 기간 정산 방식**

### 2.2 결제수단 step 조건부 노출
- 현재 step 2는 청구 정보만 있고 결제수단 입력이 없음 → 무료→유료 전환 시 구멍.
- 분기:
  - **이미 결제수단 있음** → "등록된 카드 ****1234로 결제됩니다"만 표시 + 청구 정보 + 최종 확인 (3 step)
  - **결제수단 없음** → 청구 정보 다음에 결제수단 등록 step 추가 (4 step) 또는 Stripe hosted checkout로 handoff

### 2.3 완료 step의 낙관적 성공 금지
- 현재: `changePlanMutation.onSuccess`에서 바로 `setStep("complete")` → 내부 DB 변경만 보고 "완료" 표시. 실제 Stripe 결제 결과와 무관.
- 올바른 설계:
  1. Checkout Session 생성 후 `pending_confirmation` 상태
  2. Stripe webhook(`checkout.session.completed` / `customer.subscription.updated`)이 DB `subscription.status`를 `active`로 전이
  3. 클라이언트는 polling 또는 SSE로 webhook 반영 감지 → `complete` 표시
- 즉 **완료 = webhook-confirmed**, 낙관적 success가 아님.

### 2.4 플랜 변경 시나리오 분기
모달은 단일 흐름이 아니라 시나리오별로 문구·흐름이 달라야 한다.

| 시나리오 | Step 1 문구 | 적용 시점 | 비고 |
|---|---|---|---|
| 무료 → 유료 업그레이드 | "지금 결제하고 바로 사용" | 즉시 | 결제수단 등록 필요 |
| 유료 → 상위 업그레이드 | "즉시 적용, 일할 정산 차액 결제" | 즉시 + proration | Stripe 내장 계산 |
| 유료 → 하위 다운그레이드 | "다음 결제일부터 적용" | 기간 종료 시 전환 | 즉시 환불 없음 |
| 구독 취소 | "해지 예약, 현재 기간 종료일까지 사용 가능" | `cancel_at_period_end=true` | 복구 가능 |
| 취소 예정 → 복구 | "해지 예약 취소" | 즉시 | `cancel_at_period_end=false` |
| 결제 실패 / past_due | "결제 실패. 결제수단 업데이트 필요" | grace 기간 | 접근 일부 제한 |
| Enterprise | "도입 상담 필요" | 상담 분기 | self-serve 불가 |

### 2.5 권한 분기
- 모달은 **Owner / Billing Admin만 실행 가능**.
- 일반 구성원:
  - 현재 플랜 **조회만 가능**
  - 변경 버튼 disabled + "플랜 변경은 관리자만 가능합니다" 안내
  - 서버 측 이중 방어: `/api/organizations/{id}/subscription` POST에서 `role IN (ADMIN, OWNER)` 체크 (이미 구현됨)

## 3. Stripe 경로 진실원 정리

현재 결제 경로가 **두 갈래로 찢어져 있음**:

| 엔드포인트 | 구조 | Stripe 통합 | 지위 (제안) |
|---|---|---|---|
| `POST /api/organizations/{id}/subscription` | DB 직접 upsert | 없음 | **Ops 전용**으로 격하, 프론트엔드 호출 제거 |
| `POST /api/billing/checkout` | Stripe Checkout Session 생성 (`workspace.stripeCustomerId` 사용) | 있음 | **유일한 사용자-facing 결제 경로** |

CheckoutDialog는 (옵션 B 완료 후) `/api/billing/checkout`을 호출하도록 전환.

## 4. 옵션 B가 선결인 이유

Stripe는 `workspace.stripeCustomerId`를 사용한다. 지금은 Organization과 Workspace가 별개라서 CheckoutDialog가 organizationId만 들고 있고 Stripe 경로를 자연스럽게 탈 수 없다.

옵션 B(`Workspace.organizationId @unique`) 시행 후:
- CheckoutDialog는 `workspaceId`를 resolve해서 `/api/billing/checkout`로 바로 넘김
- Organization plan/Subscription은 webhook에서 Workspace 측 변경을 거울처럼 따라감
- `/api/organizations/{id}/subscription`은 ops 백오피스 전용

## 5. Phase 분리 및 실행 순서

### Phase 1 (즉시 가능, 독립적) — 본 PR에서 진행
- [x] 공식 가격 동기화: `lib/plans.ts` Team/Business 가격을 공개 `/pricing` 기준으로 맞춤
- [ ] 적용 시점 문구 분기 (업↑/다운↓/취소) — ConfirmStep + OrderSummary 문구만 변경
- [ ] Owner/Billing Admin 권한 분기 UI — 변경 버튼 disabled + 안내

### Phase 2 선결 — 별도 PR
- [ ] 옵션 B: `Workspace.organizationId @unique` + `createOrganization` 트랜잭션 확장 + backfill 스크립트

### Phase 2 본체 — Phase 2 선결 이후
- [ ] CheckoutDialog → `/api/billing/checkout` 경로로 전환
- [ ] Webhook 기반 완료 확인 (`checkout.session.completed` → polling/SSE로 UI 전이)
- [ ] 주문 요약에 오늘 결제 / 다음 결제 / proration 문구 추가 (Stripe Preview API 또는 Checkout Session line_items)
- [ ] 결제수단 step 조건부 노출 (`workspace.stripePaymentMethodId` 기반 분기)
- [ ] `/pricing` 하드코딩 제거 → `PLAN_CATALOG` import

### Phase 2 후속
- [ ] `/dashboard/settings/plans`에 상태 배지 (`active` / `cancel_scheduled` / `past_due` / `canceled`)
- [ ] 취소/복구 액션 UI (별도 확인 모달)
- [ ] 청구 내역(Invoices) 리스트

## 6. 비되돌림 원칙 (Invariants)

이 설계가 지켜야 할 것:

1. **Stripe가 진실원**: DB subscription.status는 webhook 결과의 반영일 뿐, 클라이언트 성공 콜백만으로 설정하지 않는다.
2. **Idempotent webhook**: 같은 Stripe 이벤트가 두 번 와도 멱등. `event.id` 기반 중복 방지.
3. **3단 분리 유지**: 공개 pricing은 앱 내부 상태를 알 수 없고, 앱 내부는 마케팅 문구를 갖지 않는다.
4. **권한 분기 이중화**: UI disable은 UX, 서버 `enforceAction + role check`는 보안. 둘 다 있어야 한다.
5. **No clickable no-op**: 모든 CTA는 실행 경로로 이어진다. disabled이면 이유를 표시한다.

---

## 7. 본 문서의 적용

본 문서는 billing 관련 코드 변경 시 **반드시 참조**되어야 한다. 새로운 PR이 이 원칙을 어기면 리뷰에서 이 문서 섹션을 인용하여 수정 요청한다.
