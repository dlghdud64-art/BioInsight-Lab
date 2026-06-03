# COMMIT — §11.348-A-2: 공급사 입고 회신 폼 + 라우트

```
feat(receiving) §11.348-A-2 #vendor-receiving-reply — /receiving/[token] 회신 폼 + GET/POST 라우트 (PO snapshot 기준 LOT·실수량·유효기간 → PENDING_REVIEW, 재고 mutation 0)
```

## 무엇 (폐루프 회신 수신)
- A-1 이 발송한 입고 회신 링크(`/receiving/[token]`)의 **공급사 폼 + 백엔드**.
- 공급사가 발주(PO) snapshot 기준 품목별 **LOT·실수량·유효기간·메모** 입력 → 제출 시 ReceivingDraft `AWAITING_REPLY → PENDING_REVIEW`.
- 견적 회신(`/vendor/[token]` + `/api/vendor-requests/[token]`) 패턴 미러링.

## 신규 파일
- `api/receiving/[token]/route.ts` (GET): token 검증(vendor-request 동일 48 base64url) + rate-limit(60/min) + `db.receivingDraft.findUnique` + 만료/종결(APPROVED/REJECTED/EXPIRED) 가드 + snapshot 기준 품목·기존 회신 반환.
- `api/receiving/[token]/response/route.ts` (POST): rate-limit(10/min) + zod 검증 + snapshot orderItemId 검증(live order 아님) + **트랜잭션 deleteMany+create**(항목 교체, A-3 모델에 @@unique 없어 migration 회피) + status `PENDING_REVIEW` + submittedAt.
- `receiving/[token]/page.tsx`: 로딩/에러/만료/제출완료 상태 + 품목 테이블(실수량/LOT/유효기간) + 회신 메모 + 제출.

## 핵심 불변 (§11.336)
- 회신 제출 = ReceivingDraft(Item)만 변경. **ProductInventory / InventoryRestock 절대 미변경** (sentinel: POST 코드에 inventory mutation 부재 강제). 입고 확정·재고 반영은 A-4 사람 승인 후.
- snapshot freeze 기준 검증 → 발주 후 live order 변동과 무관하게 회신 정합.

## migration
- **없음.** A-3 ReceivingDraft/Item 모델(적용 완료) 위에서 동작. 항목 교체를 upsert 대신 deleteMany+create 로 처리해 신규 @@unique/migration 회피.

## 검증 (vitest)
- `receiving-reply-form-348a2.test.ts` → **5/5 passed** (파일존재 / GET 가드 / POST 전이 / 불변(재고 0) / 폼).

## Out of Scope (후속)
- A-4 연구소 승인 → InventoryRestock(delivery-sync) + PO 매칭 + status APPROVED. A-5 현장 QR/스캔.
- 회신 도착 알림(연구소) — A-4 와 함께.

## Rollback
- 신규 3파일 + sentinel 삭제. 기존 동작 영향 0 (신규 surface).
```
footer 없음
```
