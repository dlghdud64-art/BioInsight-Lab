# Implementation Plan: #inventory-lot-entity — COA lot-scoping (InventoryRestock 활용)

- **Status:** ⏳ Pending
- **Started:** 2026-06-14
- **Last Updated:** 2026-06-14
- **Estimated Completion:** TBD (large, ~6 phases, migration 포함)
- **Tracker:** `#inventory-lot-entity` (flat COA 폭발 근본해결 — 호영님 진단 2026-06-13)

**CRITICAL INSTRUCTIONS** — 각 phase 완료 시:
1. ✅ 체크박스  2. 🧪 quality gate  3. ⚠️ gate 통과  4. 📅 Last Updated  5. 📝 Notes  6. ➡️ 다음 phase

⛔ quality gate 실패 / SoT 충돌 미해결 / dead button·no-op·placeholder success 도입 시 진행 금지.
⛔ prod schema/DB 변경 = **dry-run → 평이한 한국어 보고 → "진행" 후만 apply** (호영님 통제구조).

---

## 0. Truth Reconciliation

**Latest Truth Source (실측):**
- `prisma/schema.prisma` — **`InventoryRestock` = 이미 real lot 엔티티**: `inventoryId`(FK→ProductInventory, Cascade)·`quantity`·`lotNumber`·`expiryDate`·`receivingStatus`·`orderId`·`restockedAt`·`ocrJobId`/`extractedData`. ProductInventory 역방향 `restockRecords InventoryRestock[]`.
- `SDSDocument`(P3 land): `inventoryId String?` + CHECK `SDSDocument_coa_lot_check`(coa→inventoryId NOT NULL / sds→NULL). COA가 **ProductInventory.id(제품/조직당 1행)**에 묶임.
- `src/components/inventory/inventory-context-panel.tsx` — `const lots = generateMockLots(item)` (line 416). 실 `restockRecords`를 두고 **mock lot 생성**.
- `InventoryUsage`도 `inventoryId`+`lotNumber`(사용 차감, lot 라벨만).

**Conflicts Found:**
- ⚠️ **E1 — mock lot:** 화면 "LOT 정보 (N건)"이 `generateMockLots` 산출 = 가짜. 실 truth = `InventoryRestock`.
- ⚠️ **E2 — COA 폭발 근본:** COA가 inventory-record(1행)에 묶여 한 제품의 모든 lot COA가 단일 섹션에 누적. lot당 분리 안 됨.
- ⚠️ **E3 — P3 surface 재작업:** 방금 ship한 §detail-page P3 item-level COA 섹션(record-scoped interim)을 lot-scoped로 교체.

**Chosen Source of Truth:**
- **lot = `InventoryRestock`** (각 입고 = 1 lot). 새 엔티티 신설 **불요**.
- COA = lot-scoped → `SDSDocument.restockId`(신규 nullable FK→InventoryRestock)로 재-scope. `inventoryId`는 restock.inventoryId에서 파생(보존 또는 유지).

**Environment Reality Check:**
- [x] repo/branch: main
- [x] runnable: `npx vitest`, `next build`(호영님 pre-push). prod migration = DEV_RUNBOOK §9.5 drift 절차 준수.
- [x] blocker: sandbox commit/migration apply 불가 → 파일 변경 sandbox, commit/push·migration은 호영님 클로드코드. **변경 후 brace+diff 점검**(desync 교훈).

---

## 1. Priority Fit
- [ ] P1 immediate  [ ] Release blocker  [x] Post-release  [ ] P2
- **Why:** §detail-page ③ P3가 record-scoped interim으로 ship됨(폭발 잠재). 호영님 진단 트랙 — lot 잦은 입고 특성상 근본해결 필요. release blocker 아님(현재 lot mock·COA 1건). InventoryRestock 활용으로 규모 축소돼 지금이 적기.

## 2. Work Type
- [x] Workflow / Ontology Wiring (입고 lot → COA)  [x] Migration / Rollout (SDSDocument.restockId)  [x] Web  [ ] Billing

## 3. Overview
**Feature Description:** COA를 **lot(InventoryRestock)**에 종속시킨다. (A) context-panel의 `generateMockLots` → 실 `restockRecords` 렌더(mock 제거, honesty). (B) `SDSDocument.restockId` FK 추가 + CHECK 재조정 → COA를 각 lot에 귀속. (C) COA 업로드/열람을 lot 카드 단위로 이동(item-level 섹션 폐기). 결과: flat 폭발이 lot drill-down/접기에 흡수돼 구조적 소멸.

**Success Criteria:**
- [ ] context-panel lot 섹션이 실 `restockRecords` 렌더(generateMockLots 제거)
- [ ] `SDSDocument.restockId` nullable FK + CHECK(coa→restockId NOT NULL) land, 기존 COA migration 무손실
- [ ] COA 업로드/열람이 lot 카드 단위(restock 별), item-level 섹션 폐기
- [ ] route가 restockId 수용·소유검증, sds는 restockId/inventoryId null 강제(회귀 0)
- [ ] sentinel: real-lot 렌더 + restockId 계약 + per-lot surface + 회귀(P1-1 catalog COA 미노출, SDS 보존)
- [ ] prod migration dry-run→보고→진행, rollback 문서화

**Out of Scope (⚠️ 금지):**
- [ ] SDS canonical 단일화(별 트랙)
- [ ] ProductInventory unique 완화/다중행 restructure(불요 — restock가 lot 담당)
- [ ] catalog detail COA 재노출(P1-1 회귀 금지)
- [ ] mobile-inventory-view 반영(후속)
- [ ] 신규 AI/chatbot UI, page-per-feature

**User-Facing Outcome:** 재고 항목의 각 입고 lot 카드 안에 그 lot의 COA(열람/업로드). lot 늘어도 접기/Lot전체추적 drill-down에 묻혀 길이 폭발 0.

## 4. Product Constraints
**Must Preserve:** workbench/queue/rail/dock·same-canvas·canonical truth(InventoryRestock·SDSDocument+CHECK)·invalidation·만료 lot 우선(§inventory).
**Must Not Introduce:** page-per-feature·chatbot·dead button/no-op/placeholder success·fake success·preview가 truth 대체·mock lot 잔존.

**Canonical Truth Boundary:**
- Source of Truth: `InventoryRestock`(lot) + `SDSDocument`(coa→restockId NOT NULL, CHECK).
- Derived Projection: lot 카드 목록(restock query), 카드별 COA 목록.
- Snapshot/Preview: 없음(mock lot 제거).
- Persistence Path: POST `/api/products/[id]/sds`(formData: file, docType, restockId).

**UI Surface Plan:** [x] inventory context-panel lot 카드 inline(same-canvas)  [ ] New page(금지)

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| lot = InventoryRestock(기존) | 새 엔티티·ProductInventory 재구성 불요, 최소 migration | restock 없는 제품 = lot 0(빈 상태 정직 처리) |
| COA: `restockId` FK 추가(inventoryId 유지) | lot-scope 정합, 기존 inventoryId 파생 보존 | CHECK 재정의 + 기존 COA migration |
| real-lot 렌더(P2)를 schema(P3)보다 먼저 | honesty 즉시 land, schema 위험 분리 | P2~P3 사이 COA는 아직 record-scoped |

**Dependencies:** P3 COA surface(land됨), DEV_RUNBOOK §9.5 migration 절차, Supabase storage(503 fix·버킷 land됨).
**Touched:** `prisma/schema.prisma`(SDSDocument.restockId), `api/products/[id]/sds/route.ts`, `inventory-context-panel.tsx`(lot 렌더+COA), `SdsDocumentsSection`(restockId prop), 신규 migration, restock 조회 query/API.

**Integration Points:** restock 조회(현재 context-panel에 restockRecords 미공급 — 확인 필요), POST/GET sds(restockId), COA invalidate.

## 6. Global Test Strategy
- schema/CHECK → migration sentinel(restockId FK·CHECK 양조건) + migrate status/diff.
- route 계약 → coa+restockId→저장, coa-no-restockId→422, sds→null.
- surface → sentinel(generateMockLots 부재·real restock 렌더·COA per-lot wiring) + 라이브 smoke.
- 회귀: P1-1 catalog COA 미노출, SDS 보존, 만료 lot 우선.
- 실행 불가 시 "실행 불가" 명시.

## 7. Implementation Phases

### Phase 0: Truth & Scope Lock
- Status: [ ] Pending
- **🔴 RED:** InventoryRestock=lot SoT 확정, context-panel에 restockRecords 공급 경로(query/API) 확인, COA 재-scope 스키마(restockId 추가 vs 교체) 결정, 기존 COA 1행(TEST) migration 방침, restock 없는 제품 빈-lot 처리.
- **🟢 GREEN:** runnable·migration 절차(§9.5) 확정.
- **✋ Gate:** 충돌 0, restock 조회 경로 단일 확정, migration 방침 문서화.  **Rollback:** planning-only.

### Phase 1: Contract & Failing Tests (RED)
- Status: [ ] Pending
- **🔴 RED:** (a) schema sentinel — SDSDocument.restockId FK + CHECK(coa→restockId); (b) route — restockId 수용/coa 필수; (c) surface — generateMockLots 부재·real restock 렌더·COA per-lot; (d) 회귀 — P1-1·SDS. 실패 확인.
- **✋ Gate:** 실패 test 실재, 기존 suite GREEN.  **Rollback:** test revert.

### Phase 2: Real-lot 렌더 (schema 0)
- Status: [ ] Pending
- **🟢 GREEN:** `generateMockLots` 제거 → context-panel이 실 `restockRecords`(lotNumber/expiry/qty/restockedAt) 렌더. restock 0건 = 정직한 빈 lot 상태. 만료 lot 우선 정합.
- **✋ Gate:** mock 제거 sentinel GREEN, dead/no-op 0, 빈/loading/error 상태, `next build`.  **Rollback:** generateMockLots 복귀.

### Phase 3: COA→restock schema (migration)
- Status: [ ] Pending
- **🔴 RED:** migration sentinel(restockId FK·CHECK 양조건), route 계약 test.
- **🟢 GREEN:** `SDSDocument.restockId String?` FK(→InventoryRestock, onDelete Restrict) + CHECK 재정의(coa→restockId NOT NULL). 기존 COA migration(inventoryId→해당 restock 매핑 또는 보류 규칙). route restockId 수용·소유검증. **dry-run→보고→진행.**
- **✋ Gate:** migrate status in-sync·diff empty, reconcile/회귀 GREEN, 데이터 무손실, no N+1.  **Rollback:** migration down + route revert.

### Phase 4: COA per-lot surface
- Status: [ ] Pending
- **🟢 GREEN:** 각 lot 카드 안에 그 lot COA(`SdsDocumentsSection docType="coa" restockId={…}` 또는 동형) 업로드/열람. item-level COA 섹션 폐기. 업로드 후 invalidate.
- **✋ Gate:** dead button 0, 상태별 UI, same-canvas, P1-1 미회귀, `next build`.  **Rollback:** surface revert(item-level 복귀 가능).

### Phase 5: Migration Smoke / Rollback
- Status: [ ] Pending
- **🟢 GREEN:** 라이브 smoke(real restock lot에 COA 업로드→해당 lot 카드 노출→열람→타 lot 미오염→catalog SDS 불변). 기존 COA migration 결과 확인.
- **✋ Gate:** smoke PASS, rollback 문서화, 잔여 blocker 격리.

## 8. Risk Assessment
| Risk | P | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| prod schema migration drift(§11.290 전례) | Med | High | DEV_RUNBOOK §9.5 절차, dry-run→보고→진행, migrate diff empty 게이트 |
| 기존 COA(1 TEST) re-scope 비가역 | Low | Med | migration에 명시 매핑, dry-run 검증, 무손실 확인 |
| P3 surface 재작업 회귀 | Med | Med | sentinel 회귀 락(P1-1·SDS), surface revert 경로 |
| restock 없는 제품 = lot 0 | Med | Low | 정직한 빈-lot 상태(가짜 0 금지) |
| context-panel restock 미공급 | Med | Med | Phase 0에서 query 경로 확정 후 진행 |

## 9. Rollback Strategy
- P1: test revert. P2: generateMockLots 복귀(schema 무관). P3: migration down(restockId drop) + route revert + CHECK 원복. P4: item-level COA 섹션 복귀. P5: 전체 revert 경로 문서.
- **Special:** prod migration = down migration 준비 + 데이터 백업 확인 후 apply.

## 10. Progress Tracking
- Overall: 0% · Current: Phase 0 대기 · Blocker: 없음 · Next: InventoryRestock=lot SoT + restock 공급 경로 확정.
- Phase Checklist: [ ] P0 [ ] P1 [ ] P2 [ ] P3 [ ] P4 [ ] P5

## 11. Notes & Learnings
- [2026-06-14] 핵심 재정의: `InventoryRestock`가 이미 lot 엔티티 → 새 엔티티/ProductInventory 재구성 불요. 트랙 규모 대폭 축소(new entity → restockId FK 1개 + render 교체).
- P2(real-lot 렌더)는 schema 0이라 단독 land 가능(honesty 즉시) — P3 schema 위험과 분리.
- §detail-page P3 COA surface(record-scoped)는 본 트랙 P4에서 lot-scoped로 교체됨.
- To Revisit: mobile-inventory-view lot/COA 반영(후속), InventoryUsage lot 라벨 정합.
