# Implementation Plan: §11.326 Phase B v3 — 라벨→발주(Order) 매핑 동선

- **Status:** 🔄 In Progress
- **Started:** 2026-06-01
- **Last Updated:** 2026-06-01
- **Priority:** P0 (입고 통합 동선 핵심)
- **모델:** Opus 4.8

**CRITICAL:** 큰 파일 Python 원자 치환 + 매 편집 brace/paren/eof 확인. "회귀 0"은 정규식 단언 후 선언. 완료 마킹은 sentinel PASS 후. dead button / no-op / front-only success 금지.

⛔ DO NOT skip quality gates. ⛔ DO NOT 데이터 무결성(매핑분리)을 PO 매핑 회귀에 묶지 말 것 — Phase 0로 분리 고정.

## 0. Truth Reconciliation (2026-06-01 audit)

**Latest Truth Source:** sandbox 코드 (HEAD, 호영님 푸시 완료분 — Smart 모달 §11.326 데이터모델 land).

**확정 사실:**
- `SmartReceivingScannerModal`(579줄): `ConfirmedFormState` = packSize/packUnit/receivedQuantity/receivedUnit 분리 land 완료. handleSubmit: `quantity: form.receivedQuantity`, `packSize: Number(...)`. (회귀 고정 대상)
- `smart-receiving/route.ts`: 신규 Product 생성 + ocrJobId **필수**(감사). jobId 없으면 차단 = 호영님 보고 dead-end.
- **미입고 발주 = `Order`** (status `ORDERED`/`CONFIRMED`/`SHIPPING`; `DELIVERED`/`CANCELLED` 제외). `items: OrderItem[]`(name/brand/catalogNumber/quantity), `restocks: InventoryRestock[]`.
- **canonical 입고 경로 = `orders/[id]` PATCH** — status→`DELIVERED` 진입 시 `InventoryRestock` **자동 생성**(idempotent: before.status !== DELIVERED 분기). → 매핑 입고는 이 경로 재사용 = ocrJobId 불필요.

**Conflicts Found:**
- 직전 제안 "po-candidates 재사용" → **기각**. po-candidates = 견적→발주 전환 후보(stage=po_conversion_candidate)지 미입고 발주 아님. 매칭 소스 = `Order`.

**Chosen Source of Truth:**
- 발주(Order) = canonical truth. 라벨 추출값 = projection(덮어쓰기 금지).
- 입고 영속 = orders/[id] PATCH (기존), UI state 로 대체 금지.

**Environment Reality Check:**
- [x] repo/branch 이해
- [x] sandbox vitest 실행 불가 → sentinel(readFileSync+regex) 사용
- [x] sandbox push 불가 → 호영님 env push

## 1. Priority Fit
- [x] P1 immediate (P0 성격 — 입고 데이터 동선 핵심)
- §11.331(구매 운영 통합)은 메뉴 재설계 별도 batch. v3는 입고 모달 내부 동선이라 surface 독립 → 흡수 안 함.

## 2. Work Type
- [x] Feature  [x] Workflow / Ontology Wiring  [x] Web

## 3. Overview

**Feature:** 스마트 입고에서 라벨/거래명세서 스캔 → 품목 식별 → **기존 미입고 발주(Order) 자동 검색·매핑** → 매핑 시 발주 수량 자동 채움 + 발주 입고(PATCH DELIVERED) → 미매칭 시 현행 신규등록 fallback.

**Success Criteria:**
- [ ] review step 에 "매칭 발주 N건" 표시 + 선택 UI (same-canvas)
- [ ] 발주 선택 시 receivedQuantity prefill (발주 item quantity 기준)
- [ ] 발주 선택 입고 = orders/[id] PATCH (ocrJobId 불요) 경로
- [ ] 미매칭 = 현행 smart-receiving 신규등록 유지(fallback)
- [ ] §11.326 데이터모델(packSize/receivedQuantity) 회귀 0

**Out of Scope (⚠️ 구현 금지):**
- 거래명세서 다수품목 일괄입고 (§11.309e)
- STORAGE_PROVIDER OcrResult 영속 (§11.290 Phase 5)
- 새 OCR 파이프라인
- §11.331 메뉴 통합 (별도 batch)

**User-Facing Outcome:** 발주한 시약 라벨 스캔 → "이 발주 맞나요?" 매칭 카드 → 한 번에 입고 처리.

## 4. Product Constraints

**Must Preserve:** workbench/queue/rail/dock · same-canvas · canonical truth(Order) · §11.326 데이터모델 · smart-receiving 신규등록 fallback

**Must Not:** page-per-feature · dead button/no-op/front-only success · preview(라벨값)가 발주 truth 덮기 · 데이터 매핑 회귀

**Canonical Truth Boundary:**
- Source of Truth: `Order` + `OrderItem` (DB)
- Derived Projection: 라벨 OCR 추출 form
- Snapshot/Preview: review step form (제출 전)
- Persistence Path: 매핑 → orders/[id] PATCH(DELIVERED→restock 자동) / 미매칭 → smart-receiving(신규)

**UI Surface Plan:** [x] Existing route section (Smart 모달 review step inline)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :-- | :-- | :-- |
| 매칭 소스 = Order (po-candidates 아님) | 미입고 발주가 canonical | 후보 조회 API 신설 가능성 |
| 입고 = orders/[id] PATCH 재사용 | DELIVERED→restock 자동, ocrJobId 불요 | 부분 입고는 별도(out of scope) |
| 미매칭 = smart-receiving 유지 | 회귀 0, fallback 보존 | 두 경로 분기 |

**Routes/Models Touched:** `SmartReceivingScannerModal.tsx` · (신규/재사용) 발주 후보 조회 · `orders/[id]` PATCH(read-only 재사용)

## 6. Global Test Strategy
- sentinel(readFileSync+regex). 매칭 로직 = 순수 함수 단위(가능 시 lib 분리).
- vitest 실행 불가 → "실행 불가" 명시, regex 단언으로 대체.

## 7. Implementation Phases

### Phase 0: 매핑 분리 회귀 고정 (데이터 무결성 잠금)
**Goal:** §11.326 packSize/receivedQuantity 분리가 PO 매핑 작업 중 깨지지 않도록 회귀 sentinel 선고정.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED→🟢 GREEN:** Smart 모달 데이터모델 회귀 sentinel 작성 → 현 코드로 즉시 PASS(이미 land).
**✋ Quality Gate:** ConfirmedFormState 4필드 / handleSubmit quantity=receivedQuantity / packSize=Number / receivedQuantity≤0 검증 단언 PASS.
**Rollback:** sentinel 파일 삭제.

### Phase 1: PO 후보 조회 계약 + Truth Lock
**Goal:** 라벨→발주 후보 조회 방식 확정(orders GET 재사용 vs 경량 후보 route), 매칭키/수량필드 잠금.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** 후보 조회 계약 실패 테스트(매칭키=catalogNumber/productName, status 필터).
**🟢 GREEN:** 최소 계약 — orders 조회 재사용 or `/api/inventory/po-candidates-for-label` 경량 신설.
**✋ Quality Gate:** 추정 0, 계약 확정, 기존 orders 회귀 0.
**Rollback:** route/계약 revert.

### Phase 2: 매칭 코어 로직
**Goal:** 라벨 추출값 ↔ 발주 item 매칭(catalog 우선, productName 보조) 순수 함수.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** match-label-to-order 단위 테스트(정확매칭/부분/미매칭).
**🟢 GREEN:** 매칭 함수 구현.
**✋ Quality Gate:** 단위 단언 PASS, truth-boundary 위반 0.
**Rollback:** lib 파일 revert.

### Phase 3: review step UI wiring
**Goal:** Smart 모달 review 에 매칭 카드 + 선택 + prefill + 분기 제출.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** review step sentinel(매칭 카드 testid / 선택 핸들러 / 발주선택 시 PATCH 경로 / 미매칭 fallback).
**🟢 GREEN:** 후보 fetch + 선택 state + 분기 handleSubmit(매핑→PATCH / 미매칭→smart-receiving).
**✋ Quality Gate:** dead button 0, front-only success 0, loading/empty/error 상태 존재, §11.326 회귀 0.
**Rollback:** UI wiring revert(Phase 2 상태로).

### Phase 4: Smoke / Rollback / Closeout
**Goal:** 매핑입고+fallback smoke, rollback 문서, commit draft.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**✋ Quality Gate:** 전체 sentinel PASS, 회귀 0, rollback 문서.

## 9. Risk Assessment

| Risk | Prob | Impact | Mitigation |
| :-- | :-- | :-- | :-- |
| 데이터모델(매핑분리) 회귀 | Low | High | Phase 0 선고정 sentinel |
| 후보 조회 overfetch/N+1 | Med | Med | select 축소, status 필터, 페이지 |
| 발주 PATCH 부분입고 미지원 혼선 | Med | Med | 전량 입고만, 부분=out of scope 명시 |
| 큰 파일 truncation | Med | High | Python 원자 치환 + 무결성 |
| 매칭 오탐(잘못된 발주 입고) | Med | High | 사용자 확인 필수(자동입고 금지) |

## 10. Rollback Strategy
- Phase 0: sentinel 삭제 · Phase 1: route revert · Phase 2: lib revert · Phase 3: UI wiring revert · Phase 4: 문서

## 11. Progress Tracking
- Overall: ~90% (Phase 0~3 GREEN, 호영님 env 빌드/푸시 + 시각검증 대기)
- Current phase: Phase 4 closeout (sandbox 작업 완료, smoke=호영님 env)
- Next: 호영님 env `next build` + push + 매핑입고/fallback smoke

**Phase Checklist:**
- [x] Phase 0 매핑분리 회귀고정 (sentinel 13/13 PASS)
- [x] Phase 1 후보 조회 계약 + Truth Lock (Order 확정, orders PATCH 재사용)
- [x] Phase 2 매칭 코어 (match-label-to-order.ts, 단위 6/6 PASS)
- [x] Phase 3 review UI wiring (매칭카드+선택+prefill+분기제출, 22/22 PASS)
- [ ] Phase 4 smoke (호영님 env)

## 12. Notes & Learnings
- [2026-06-01] po-candidates 기각, 매칭소스=Order 확정. 입고경로=orders/[id] PATCH(DELIVERED→restock 자동) 재사용 → ocrJobId dead-end 자연 우회.
- 호영님 지시: 매핑분리(데이터 무결성)를 PO 매핑 회귀에 묶지 말 것 → Phase 0 분리.
- [2026-06-01] **신규 파일**: `src/lib/inventory/match-label-to-order.ts`(순수 매칭), `src/app/api/inventory/po-candidates-for-label/route.ts`(읽기전용 후보조회), sentinel 2종.
- [2026-06-01] **SmartReceivingScannerModal U+FFFC 76개**(HEAD=working, 빌드 정상) → Read/Edit 글리치 → Python 원자 치환, FFFC 76→76 불변 + brace/paren/eof 무결 확인.
- ⚠️ **알려진 한계(follow-up)**: 매핑 경로(PATCH DELIVERED)는 발주 item 수량 기준 restock 자동생성 → 라벨에서 읽은 **LOT/유효기한은 매핑 입고에 미부착**. 신규등록(fallback) 경로는 LOT/유효기한 정상 입력. 매핑 입고에 LOT/유효기한 부착 = orders restock 계약 확장 필요(별도 batch). 데이터 손실 아님(수량·발주 정합 정확).
- ⚠️ **부분 입고 out of scope**: 매핑 입고는 전량(DELIVERED) 기준.
