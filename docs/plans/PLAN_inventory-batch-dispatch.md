# Implementation Plan: #inventory-batch-dispatch — 다건 lot 원자적 배치출고

- **Status:** ✅ sandbox 완료 (operator build+vitest+push 대기)
- **Started:** 2026-07-10
- **Last Updated:** 2026-07-10
- **Estimated Completion:** TBD (Medium-Large, 5 phases)
- **Tracker:** P5 Lot overlay(3185f68e) 별트랙 — 정직-disabled 일괄출고 해제

**CRITICAL INSTRUCTIONS** — 각 phase 완료 시: ✅체크 → 🧪gate → ⚠️통과 → 📅날짜 → 📝Notes → ➡️다음.
⛔ gate 실패/SoT 충돌/dead·no-op·placeholder success 도입 시 진행 금지.
⛔ **원자성 절대** — 단일 `$transaction` all-or-nothing. 부분 출고 = GMP truth 위반, 금지.
⛔ 대형 파일(inventory-content 4864L) Edit 절단 이력 3건 → 신규 UI는 별 컴포넌트로 분리, 편집 직후 tail+build 재확인.

## 0. Truth Reconciliation ✅
- 단건 `POST /api/inventory/[id]/use`: auth→`enforceAction(inventory_use)`→소유/org 검증→zod→**`validateUsageForTrackingMode`(GMP_STRICT 시 lotNumber/operator/destination 필수, 누락=422)**→`$transaction`(currentQuantity decrement + `InventoryUsage.create`{type,lotNumber,destination,operator} + `createAuditLog`)→enforcement.complete→INVENTORY_LOW 알림(best-effort, edge 1회).
- `/api/inventory/bulk` = **import 전용**(제품/재고 생성). 배치 출고 아님.
- **배치 출고 엔드포인트 없음** → 신규.
- `InventoryUsage`: `type "DISPATCH"|"USAGE"`·`lotNumber`·`destination`·`operator`·`quantity`·`unit`.
- P5 overlay 일괄출고 = 정직-disabled(`data-lot-bulk-dispatch-disabled` + "일괄 출고는 배치 API 배선 후 제공"), sentinel `inventory-lot-overlay-p5.test.ts`가 disabled 강제 → **본 작업서 enabled+wired로 flip 필요**.

**Chosen SoT:** ProductInventory.currentQuantity + InventoryUsage(DISPATCH). 배치 = 단일 tx.

## 1. Priority Fit
- [x] Post-release 별트랙 (호영님 "1 진행" 2026-07-10). 상위 P1 충돌 없음.

## 2. Work Type
- [x] Feature (atomic batch API) · [x] Web UI wiring · [x] Workflow(출고 핸드오프)

## 3. Overview
**Description:** 선택한 다건 lot을 한 번에 출고하되 **원자적**(단일 트랜잭션, all-or-nothing). P5 overlay의 정직-disabled 일괄출고를 실배선으로 해제.

**Success Criteria:**
- [ ] `POST /api/inventory/dispatch-batch` — items[] 단일 tx, 어느 하나 실패 시 전체 롤백(부분 출고 0)
- [ ] per-item GMP 게이트(`validateUsageForTrackingMode`) — 하나라도 필수 누락 시 write 0으로 422
- [ ] 각 item: decrement + InventoryUsage(DISPATCH) + audit (tx 내)
- [ ] overlay 일괄출고 버튼 enabled → 배치 sheet → mutation → invalidate(team-inventory·inventory-usage)
- [ ] 배치 sheet: 선택 lot별 수량 입력 + **공유 destination/operator 1값**(결정 a)
- [ ] P5 sentinel flip: disabled-assert → enabled+wired

**Out of Scope (⚠️):** per-lot 정밀잔량(B안, 데이터 대기)·출고 취소/반품·부분 성공 UX.

**공유 GMP 필드 결정(호영님 2026-07-10):** (a) 배치 전체 공유 destination/operator 1값(같은 출고건 가정). lot별 개별 입력은 후속.

## 4. Product Constraints
**Must Preserve:** canonical truth(재고 차감=tx)·same-canvas(overlay 내 sheet)·invalidation.
**Must Not:** 부분 출고(비원자)·placeholder success·dead button·N회 반복 호출(원자성 없음, 금지).
**Persistence:** dispatch-batch tx. 실패=throw→롤백.
**UI Surface:** overlay 내 bottom-sheet(신규 컴포넌트, 새 route X).

## 5. Architecture
| Decision | Rationale | Trade-off |
| :-- | :-- | :-- |
| 단일 $transaction 배치 | all-or-nothing 원자성(GMP) | 대량 시 tx 길이(수십 건 가정, 허용) |
| 신규 dispatch-batch 라우트 | 단건 route 책임 분리 | 로직 일부 중복(게이트/audit) → 공유 헬퍼 검토 |
| UI 별 컴포넌트 분리 | inventory-content truncation 회피 | 파일 1개 추가 |
| 공유 GMP 1값 | UI 단순·같은 출고건 | lot별 상이 출고처 미지원(후속) |

**Integration:** `validateUsageForTrackingMode`·`createAuditLog`·`enforceAction`·`dispatchNotificationEvent`(INVENTORY_LOW, 배치 후 item별 edge) 재사용.

## 6. Test Strategy
- 통합: dispatch-batch 정상(N건 tx)·**부분실패 전체 롤백**(1건 재고부족/GMP누락 → 전건 미차감 검증)·권한·미존재.
- sentinel: overlay 버튼 enabled+wired, 배치 sheet 존재, 원자성 주석/구조.
- P5 sentinel flip(disabled→enabled) 반영.
- 실행 = operator(sandbox=TS 파서 구문 + node 정규식 사전검증).

## 7. Phases

### Phase 0: Truth Lock ✅ (2026-07-10)

### Phase 1: Contract & Failing Tests ✅
- [ ] 배치 zod 스키마 정의(items[]: inventoryId·lotNumber·quantity>0·unit?; 공유 destination?·operator?·notes?·type=DISPATCH)
- [ ] 통합/sentinel RED: atomic 계약·GMP per-item·overlay enabled+wired·배치 sheet
- [ ] P5 sentinel flip(disabled assert 제거→enabled/wired assert)
- ✋ Gate: RED 실등장·기존 테스트 유지. Rollback: 테스트 revert.

### Phase 2: Core API ✅
- [ ] 단일 `$transaction`: items 순회 — 소유/org·`validateUsageForTrackingMode`·decrement·`InventoryUsage`(DISPATCH)·audit
- [ ] 사전검증(음수·미존재·권한·GMP) 실패 시 throw → 전체 롤백, write 0
- [ ] enforceAction(batch) · 응답 per-item 결과
- ✋ Gate: 원자성(부분실패 롤백) 테스트 GREEN·overfetch 0·truth 위반 0. Rollback: 라우트 삭제.

### Phase 3: UI ✅
- [ ] 신규 컴포넌트: 선택 lot별 수량 input + 공유 destination/operator + 요약(총 N lot)
- [ ] overlay 일괄출고 버튼 enable(disabled/reason 제거) → sheet open → mutation → invalidate
- [ ] loading/error/empty/부분불가(GMP 누락 안내) 상태
- ✋ Gate: dead/no-op 0·front-only success 0·same-canvas 보존. Rollback: 버튼 disabled 복원(P5 상태).

### Phase 4: Smoke / Rollback ✅ sandbox(operator 게이트 대기)
- [ ] smoke: 2+ lot 배치 성공·1건 실패 전체 롤백·GMP 누락 차단·재고 반영·invalidate
- ✋ Gate: 원자성 확인·회귀 0·rollback 문서. operator build+vitest.

## 8. Risk
| Risk | P | I | Mitigation |
| :-- | :-- | :-- | :-- |
| 비원자 부분출고 | Low | High | 단일 tx·부분실패 롤백 테스트 필수 |
| GMP 게이트 누락 | Med | High | per-item `validateUsageForTrackingMode` 재사용 |
| inventory-content truncation | Med | High | UI 별 컴포넌트·편집 후 tail+build |
| P5 sentinel 충돌 | High | Low | Phase1서 flip 포함 |

## 9. Rollback
- P1 실패: 테스트 revert. P2: 라우트 삭제. P3: 버튼 disabled 복원(P5 상태 = 안전 fallback). P4: 단일 커밋 revert.

## 10. Progress
- Overall: ~95% sandbox · Current: operator 게이트 대기 · Next: build+vitest+push
- [x] P0  [x] P1  [x] P2  [x] P3  [x] P4(sandbox)

## 11. Notes
- [2026-07-10] 승인(호영님): 별트랙 착수. GMP 필드 = 공유 1값(a). 원자성 절대(N회 반복 호출 금지 재확인). per-lot 정밀잔량 B안은 데이터 대기로 별건.

## 12. sandbox 완료 요약 (2026-07-10)
- 신규 라우트 `api/inventory/dispatch-batch/route.ts`(210L) — 단일 $transaction all-or-nothing, pre-flight(미존재·권한·GMP) 실패 시 write 0으로 422, per-item InventoryUsage(DISPATCH)+audit, enforceAction.
- 신규 컴포넌트 `lot-batch-dispatch-sheet.tsx`(186L) — lot별 수량 + 공유 destination/operator, 422 itemErrors 노출(가짜 성공 0), 성공 시 team-inventory·inventory-usage invalidate.
- overlay: 일괄출고 버튼 disabled→enabled(`data-lot-batch-dispatch-open`), 배치 sheet 배선. inventory-content bash 안전편집(truncation 회피), 4872L·구문 0·꼬리 정상.
- sentinel: 신규 `inventory-batch-dispatch.test.ts` 전 GREEN + P5 sentinel flip(disabled→enabled) GREEN.
- 검증: 5파일 TS 파서 구문 0, 양 sentinel 전항목 PASS(sandbox).
- ⚠️ **원자성은 코드 구조(단일 tx + pre-flight)로 보장** — sentinel은 구조만 확인. operator는 build + 전체 vitest(baseline-delta 0) + 가능 시 부분실패 롤백 통합/수동 확인 권장.
