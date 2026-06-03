# Implementation Plan: §11.348-A — 발주→회신→입고 폐루프 (link-based)

- **Status:** 🗂️ Plan (Phase 0 진단 완료 — 큰 트랙, 분할 착수 승인 대기)
- **Last Updated:** 2026-06-03
- **유형:** 신규 흐름 (발주 후 입고 회신 → 검증대기 입고안 → 승인 → 입고확정). same-canvas·canonical 보호.
- **Scope:** **Large** (A-1~A-5 분할). 한 세션 surgical 불가 — phase별 별도 착수.
- **상위:** PLAN_11.348 roadmap §11.348-A. SEND-A(reply-to) 직속 후속.

## Phase 0 — 현황 (코드 정독, 2026-06-03)
- ✅ **견적 회신 인프라 BUILT (단, 견적 단계):** `quoteVendorRequest` + `responseItems`(QuoteVendorResponseItem) 모델 / `GET /api/vendor-requests/[token]`(공급사 폼 + canEdit) / `POST [token]/response`(회신 제출·status RESPONDED·editCount/limit·rate-limit). = "공급사가 우리 스키마로 회신"은 견적 price 회신으로 작동.
- ✅ **입고 확정 경로 BUILT (단, 별 경로):** Order status DELIVERED → `delivery-sync.ts` → InventoryRestock(idempotent). §11.326/§11.355-D.
- ❌ **미구현 = §11.348-A 본체:** "발주(PO) 후 입고 회신 → **검증 대기 입고안** → 사람 승인 → 입고확정 + PO 매칭". 현 회신(quoteVendorRequest)은 **견적 단계**지 발주 후 입고 회신이 아님. 입고는 Order DELIVERED 수동 경로뿐(공급사 회신 기반 아님).
- **핵심 갭:** 발주 단계 공급사 회신(LOT·납기·실수량) → 검증대기 입고안 객체 → 승인 → InventoryRestock. 이 흐름 신규.

## 핵심 원칙 (roadmap 계승)
- 회신/변환 = "검증 대기 입고안"(derived 제안), truth 아님. **승인 전 재고·LOT mutation 0** (§11.336).
- canonical(입고 확정) = 사람 승인 후만. 입고확정은 기존 delivery-sync/InventoryRestock 재사용(이중 입고 가드).
- 발송(A-1 회신링크) = SEND-A reply-to 위에. 외부발송 게이트.

## 분할 (착수 시 각 phase 별 SPEC + 승인)
- **A-1 발주 회신 링크:** PO별 고유 토큰 링크(견적 vendor-request-token 패턴 재사용, PO 컨텍스트). 발주 메일에 첨부(SEND 인프라 재사용).
- **A-2 입고 회신 폼:** 공급사가 PO 매핑 폼에서 품목 확정 + LOT·납기·실수량 입력. responseItems 스키마 재사용/확장(LOT/납기 필드).
- **A-3 "검증 대기 입고안" 모델 (선행 핵심):** 회신 = pending 입고안(신규 모델 or Restock pending state). canonical 승격 전 derived. **DB 모델 신규 → migration(dry-run→보고→진행).**
- **A-4 승인 → 입고 확정:** 사람 승인 게이트 → InventoryRestock 생성(delivery-sync 재사용) + PO 매칭. 이중입고 가드.
- **A-5 입고 현장 연결:** 확정 입고안 → QR 출력(§11.355-B) → 스캔(§11.349)→차감(§11.355-D). 기존 폐루프와 접합.

## 재사용 (신규 최소화)
- 토큰/회신 폼: `vendor-request-token` + `quoteVendorRequest`/`responseItems` 패턴.
- 발송: SEND-A(sendEmail + reply-to).
- 입고확정: `delivery-sync.ts` + InventoryRestock(idempotent).
- 라벨·스캔·차감: §11.355 폐루프.

## Risks
| Risk | Prob | Impact | Mitigation |
| :-- | :-- | :-- | :-- |
| 입고안 DB 모델 신규 = migration | High | High | A-3 dry-run→보고→진행(프로덕션 DB 원칙) |
| 견적 회신 vs 입고 회신 모델 혼용 | Med | High | 단계 구분 명확(quote vs PO 회신) — 별 모델/필드 |
| 승인 전 mutation 누수 | Med | High | §11.336 "승인 전 0" sentinel 강제 |
| 외부발송(A-1) 책임 | Med | Med | SEND-A reply-to + pilot 보호 위에 |
| 한 세션 과욕 | High | Med | A-1~A-5 phase별 착수·승인, surgical 금지 |

## Open Questions (착수 전)
- [ ] 발주 회신 = `quoteVendorRequest` 확장(stage 필드) vs 신규 `PoVendorResponse` 모델?
- [ ] "검증 대기 입고안" = 신규 모델 vs `InventoryRestock` pending status(승인 전 비-canonical)?
- [ ] PO 매핑 = Order ↔ 회신 토큰 관계 (1 PO ↔ 1 회신링크).
- [ ] 공급사 회신률 낮을 때 fallback(§11.348-FALLBACK OCR) 비중.

## 권장 착수 순서
A-3(입고안 모델, migration dry-run) → A-1(발주 회신 링크) → A-2(입고 회신 폼) → A-4(승인→확정) → A-5(현장 QR·스캔 접합). A-3가 선행(모델 없이 나머지 불가).

## Notes
- SEND-A(reply-to) 이후 자연 후속이나 **본체는 Large** — phase별 plan→승인→구현, 추측 구현 금지.
- 견적 회신 인프라가 상당 부분 재사용 가능 → 신규는 입고안 모델 + 발주단계 회신 + 승인→확정 접합.

---
## 부록 — A-3 구현 완료 (Claude, 2026-06-03, push 대기)
- ✅ **모델 분리 결정 확정(코드 정독):** delivery-sync 가 `productInventory.upsert(increment)` + `inventoryRestock.create` 를 함께 수행 → InventoryRestock 생성 = 재고 mutation. 입고안을 InventoryRestock.PENDING 으로 두면 §11.336 위반 → **신규 모델 `ReceivingDraft`/`ReceivingDraftItem` + enum `ReceivingDraftStatus`(5상태).**
- ✅ **Open Q 해결:** (1) 신규 모델 vs InventoryRestock pending → **신규 모델.** (2) orderItemId/productId = **scalar**(OrderItem.productId 선례) → Product/OrderItem 무수정. (3) PO 매핑 = `ReceivingDraft.orderId` FK(Order, Cascade). 백릴레이션 4곳(Order/User/Org/Vendor).
- ✅ **불변(스키마 보증):** ReceivingDraft/Item 은 ProductInventory/InventoryRestock relation 미보유 → 회신/입고안 생성만으로 재고 미변동.
- ✅ **migration 순수 추가형:** `20260603120000_add_receiving_draft/migration.sql` — CREATE TYPE/TABLE만, 기존 테이블 ALTER/DROP 0. `prisma validate` 통과, offline diff 생성.
- ✅ **sentinel 6/6 green:** `receiving-draft-model-348a3.test.ts`.
- ⚠️ **적용 게이트:** push 후 호영님 환경 `prisma migrate dev` + `prisma generate` 필요. production DB 변경이므로 dry-run SQL 확인 → "진행" 후 적용.
- **다음:** A-1(발주 회신 링크) — A-3 모델 위에 token 발급 + 발주 메일 첨부(SEND-A 재사용).

---
## 부록 — A-1 구현 완료 (Claude, 2026-06-03, push 대기)
- ✅ **발주 메일 = 폐루프 입구.** `api/orders/[id]/send-email` 가 발송 시 `ReceivingDraft`(AWAITING_REPLY) **get-or-create**(token=vendor-request-token 재사용, expiresAt 14일, snapshot{orderNumber, items}). 재발송 idempotent(기존 미회신 draft token 재사용).
- ✅ **PO 메일 CTA**: `po-vendor-template` 에 `receivingReplyUrl` 입력 + "입고 정보 입력하기" 버튼(html/text). 링크 = `/receiving/${token}`(A-2 폼 대상).
- ✅ **reply-to = 발주자**(SEND-A 동형) — 이 라우트엔 reply-to 가 없었음(SEND-A 는 견적 라우트만) → A-1 에서 보강.
- ✅ **graceful**: draft try/catch — 실패해도 발주 메일 송부(링크만 생략). 기존 po-vendor-email 테스트 16/16 무영향.
- ✅ sentinel `po-receiving-reply-link-348a1` 6/6 green. A-3 migration 적용 완료 위에서 동작.
- **다음:** A-2(`/receiving/[token]` 회신 폼 페이지 + GET/POST 라우트 — snapshot 기반 freeze, LOT·납기·실수량 입력 → status PENDING_REVIEW).
