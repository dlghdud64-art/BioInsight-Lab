# COMMIT — §11.348-A-3: 검증 대기 입고안(ReceivingDraft) 모델 추가 (migration)

```
feat(schema) §11.348-A-3 #receiving-draft-model — 발주→회신→입고 폐루프의 "검증 대기 입고안" 모델 추가 (ReceivingDraft/Item + enum, 순수 추가형 migration)
```

## 무엇 (호영님 A-3 착수 — 입고안 모델, 선행 핵심)
- §11.348-A 폐루프의 토대: 공급사가 발주(PO) 후 회신한 입고 정보(LOT·납기·실수량)를 보관하는 **검증 대기 입고안** 모델 신설.
- canonical 아님(derived 제안). 사람 승인(A-4)에서만 InventoryRestock(delivery-sync) 생성 → 입고 확정 canonical 승격.

## 설계 결정 (코드 정독 기반)
- **신규 모델로 분리 (InventoryRestock 재사용 X):** `delivery-sync.ts` 가 `productInventory.upsert(increment)` + `inventoryRestock.create` 를 **함께** 수행 → InventoryRestock 행 생성 자체가 재고 mutation. 입고안을 InventoryRestock.PENDING 으로 두면 §11.336 "승인 전 mutation 0" 위반. → **별 모델.**
- **orderItemId/productId = scalar** (OrderItem.productId 선례 따름) → Product/OrderItem 모델 무수정.
- 백릴레이션은 Order/User/Organization/Vendor 4곳만 (`receivingDrafts ReceivingDraft[]`).

## 모델
- `enum ReceivingDraftStatus`: AWAITING_REPLY / PENDING_REVIEW / APPROVED / REJECTED / EXPIRED.
- `ReceivingDraft`: orderId(FK Cascade) + userId(FK Cascade) + organizationId?(SetNull) + vendorId?(SetNull) + token@unique(회신링크) + status + submittedAt/reviewedAt/approvedById + snapshot(Json) + expiresAt + **restockSyncedAt(이중입고 idempotent 가드)** + items[].
- `ReceivingDraftItem`: receivingDraftId(FK Cascade) + orderItemId?/productId?(scalar) + name + expectedQuantity/receivedQuantity + unit + lotNumber + expiryDate + vendorNote.

## 불변 (스키마 레벨 보증)
- ReceivingDraft/Item 은 ProductInventory/InventoryRestock **relation 미보유** → 회신/입고안 생성만으로 재고 절대 미변동 (§11.336).

## migration (순수 추가형)
- `prisma/migrations/20260603120000_add_receiving_draft/migration.sql`
- CREATE TYPE ×1, CREATE TABLE ×2, CREATE INDEX ×11(@@index/@unique), AddForeignKey ×5.
- **기존 테이블 ALTER/DROP 0** (InventoryRestock/ProductInventory/Order 무변경). 데이터 손실 0.
- offline `prisma migrate diff`(from-schema-datamodel baseline → to 현재)로 생성. sandbox DB 미접속.

## 검증 (vitest)
- `receiving-draft-model-348a3.test.ts` → **6/6 passed** (모델/필드/enum/백릴레이션/불변/migration 순수추가).

## ⚠️ 적용 게이트 (호영님 환경)
- 이 커밋은 **DB migration 포함**. push 후 호영님 환경에서 `npx prisma migrate dev`(또는 deploy) 적용 시 실제 DB 변경.
- 순수 추가형이라 기존 데이터/테이블 무영향 — 그래도 production DB 변경이므로 **적용 전 dry-run SQL 확인 → "진행" 후 적용** 원칙.
- `prisma generate`(클라이언트 재생성)도 적용 환경에서 필요.

## Out of Scope (후속 phase)
- A-1 발주 회신 링크 생성/발송, A-2 공급사 회신 폼, A-4 승인→InventoryRestock 접합, A-5 현장 QR/스캔. (이번은 **모델만**.)

## Rollback
- migration 디렉토리 + schema 5개 블록(4 백릴레이션 + 모델/enum) + sentinel revert. 순수 추가형이라 독립.
```
footer 없음
```
