# COMMIT — §11.348-A-4: 입고안 승인/반려 → canonical 입고 확정

```
feat(receiving) §11.348-A-4 #receiving-approve — 입고안 승인(→ProductInventory 증분+InventoryRestock) / 반려 라우트 (다중 가드·이중입고 방지·재고 mutation 게이트)
```

## 무엇 (폐루프에서 처음 canonical 재고를 바꾸는 단계)
- `PENDING_REVIEW` 입고안을 연구소 **사람 승인** → 공급사 회신(LOT·실수량·유효기간) 기준으로 입고 확정:
  - ProductInventory 증분(productId 합산) + 품목별 InventoryRestock 생성(LOT 단위 보존).
  - 발주(Order) → `DELIVERED`(terminal) + actualDelivery = PO 매칭/입고 확정.
  - 입고안 → `APPROVED` + reviewedAt + approvedById + `restockSyncedAt`.
- 반려: `PENDING_REVIEW → REJECTED`, 재고 무변경.

## 신규 파일
- `api/receiving-drafts/[id]/approve/route.ts` (POST)
- `api/receiving-drafts/[id]/reject/route.ts` (POST)

## 다중 가드 (canonical 보호 — §11.336)
1. auth + 권한(draft.userId 또는 조직 멤버).
2. `status === PENDING_REVIEW` 만 승인/반려.
3. **이중입고 방지 ①**: `draft.restockSyncedAt != null` → 409(이미 확정).
4. **이중입고 방지 ②**: `order.status === DELIVERED` → 409(status 경로로 이미 입고). 승인 시 order→DELIVERED(terminal)로 전이해 status route(delivery-sync) 재sync 차단.
5. productId+실수량>0 품목 없으면 422.
6. 입고 반영 전체가 `db.$transaction` 원자성. 반려는 재고/입고 호출 0(sentinel 강제).

## 설계 결정
- **delivery-sync 미재사용**: `runDeliveryInventorySync` 는 order-item 수량 + 단일 defaults LOT 기반 → 공급사 회신의 품목별 실수량·LOT 를 반영 못 함. A-4 는 draft item 기반으로 직접 restock(LOT 단위 보존).
- audit: 전용 enum 부재 → 기존 `INGESTION_RECEIVED`(외부 입력 수신·반영) 재사용 → **enum migration 회피**. action=receiving_draft_approved/rejected.

## migration
- **없음.** A-3 모델 + 기존 ProductInventory/InventoryRestock/Order 위에서 동작.

## 검증 (vitest)
- `receiving-approve-348a4.test.ts` → **5/5 passed** (파일 / 권한·status·이중입고 가드 / canonical 반영 / 반려 무변경).

## Out of Scope (후속)
- **A-4b 리뷰 UI**: 연구소가 PENDING_REVIEW 입고안 목록·상세를 보고 승인/반려하는 surface(receiving 워크벤치). 본 커밋은 backend 라우트만 — 회신 도착 알림도 A-4b.
- A-5 현장 QR/스캔 접합.

## Rollback
- 신규 2파일 + sentinel 삭제. 신규 surface라 기존 동작 영향 0.
```
footer 없음
```
