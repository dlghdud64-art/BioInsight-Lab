# COMMIT — §11.348-A-1: 발주 메일 입고 회신 링크

```
feat(orders) §11.348-A-1 #po-receiving-reply-link — 발주 발송 시 ReceivingDraft(AWAITING_REPLY) get-or-create + 입고 회신 링크 PO 메일 주입 + reply-to(발주자)
```

## 무엇 (A-3 모델 위 폐루프 입구)
- 발주(PO) 메일 발송 시 입고 회신 폐루프의 입구를 연다:
  1. `ReceivingDraft`(AWAITING_REPLY) **get-or-create** → 회신 토큰 발급(견적 vendor-request-token 재사용).
  2. PO 메일에 **"입고 정보 입력하기" CTA** 주입 → 공급사가 납품 시 LOT·납기·실수량을 우리 스키마로 회신(A-2 폼 대상).
  3. `reply-to = 발주자(연구소)` 이메일 (SEND-A 동형, A 원칙 — 답장이 noreply 로 유실 안 됨).

## Fix (file별)
- `api/orders/[id]/send-email/route.ts`:
  - `generateVendorRequestToken` import.
  - sendEmail 전: `db.receivingDraft.findFirst`(AWAITING_REPLY/PENDING_REVIEW) → 있으면 token 재사용(재발송 idempotent, 중복 링크 방지), 없으면 `create`(token + expiresAt 14일 + snapshot{orderNumber, items[]}).
  - 회신 URL = `${NEXT_PUBLIC_APP_URL}/receiving/${token}` → 템플릿 인자 `receivingReplyUrl` 전달.
  - sendEmail 에 `replyTo: order.user?.email`.
  - **graceful**: draft 로직 try/catch — 실패해도 발주 메일은 본문/PDF 로 송부(링크만 생략).
- `lib/email/po-vendor-template.ts`:
  - 입력 `receivingReplyUrl?: string | null` 추가.
  - `receivingReplyHtml`(CTA 박스 + 버튼) + `receivingReplyText` 조건부 렌더 → html/text 본문 주입. 미전달 시 미표시(회귀 0).

## Canonical truth
- ReceivingDraft = derived 입고안(승인 전 비-canonical). 재고·LOT mutation 0 (§11.336). A-1 은 링크 발급·발송까지 — 회신 수신/검증은 A-2/A-4.
- 발주(Order) canonical 무변경. draft 는 별 테이블(A-3).

## 검증 (vitest)
- `po-receiving-reply-link-348a1.test.ts` → **6/6 passed** (draft get-or-create / idempotent / URL+인자 / reply-to / 템플릿 CTA / 회귀).
- 기존 `po-vendor-email(.attach).test.ts` → **16/16 passed** (graceful try/catch 덕에 무영향).

## 의존
- A-3(ReceivingDraft 모델) DB migration **적용 완료**(2026-06-03) 위에서 동작. `db.receivingDraft` 사용 — Prisma Client 갱신 전제(적용 환경 완료).

## Out of Scope (후속)
- A-2 입고 회신 폼(`/receiving/[token]` 페이지 + GET/POST 라우트), A-4 승인→InventoryRestock, A-5 현장 QR/스캔.

## Rollback
- 2 파일 패치 + sentinel revert. draft 로직 graceful 라 독립.
```
footer 없음
```
