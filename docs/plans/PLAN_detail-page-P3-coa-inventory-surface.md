# Implementation Plan: §detail-page P3 — COA lot-scoped surface (route + inventory)

- **Status:** ⏳ Pending
- **Started:** 2026-06-13
- **Last Updated:** 2026-06-13
- **Estimated Completion:** TBD (medium, ~5 phases / 8–12h)
- **Tracker:** `#coa-inventory-surface` (reconcile P1-3 deferred RED 해소)

**CRITICAL INSTRUCTIONS** — 각 phase 완료 시:
1. ✅ 체크박스 체크
2. 🧪 quality gate 검증 명령 실행
3. ⚠️ gate 항목 전부 통과 확인
4. 📅 Last Updated 갱신
5. 📝 Notes에 learnings 기록
6. ➡️ 그 다음에만 다음 phase

⛔ quality gate 실패 / source-of-truth 충돌 미해결 / dead button·no-op·placeholder success 도입 시 진행 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `prisma/schema.prisma` — `SDSDocument`(P2 land: `inventoryId String?`, `docType` sds/coa, CHECK `SDSDocument_coa_lot_check` = coa→inventoryId NOT NULL / sds→NULL, FK `inventory ProductInventory? onDelete: Restrict`).
- `apps/web/src/__tests__/regression/detail-page-reconcile.test.ts` — P1-1 GREEN(catalog COA 제거), P1-2 GREEN(schema+CHECK), **P1-3 RED**(upload route inventoryId 미수용).
- `apps/web/src/app/api/products/[id]/sds/route.ts` — GET/POST. POST는 docType(sds/coa)+file 수용, organizationId=membership. **inventoryId 미수용**.
- inventory surface: `src/components/inventory/inventory-context-panel.tsx`, `InventoryTable.tsx`, `_workbench/_components/receiving-execution-workbench.tsx`(입고/lot).

**Secondary References:**
- `detail-page` ①④ contrast(da92dbcf/7b38a21b), P1-1(fa9d5cbd).
- `components/safety/sds-documents-section.tsx`(docType prop, productId 기반 upload).

**Conflicts Found:**
- ⚠️ **C1 — ProductInventory 단일행 제약:** `@@unique([userId, productId])` + `@@unique([organizationId, productId])` → 제품/조직당 **1행**. `lotNumber`는 단일 필드. 즉 `inventoryId` 기반 COA는 진짜 multi-lot 분리가 아니라 **inventory-record-scoped**. 진짜 다중 lot은 lot 엔티티 신설(별 migration) 필요.
- ⚠️ **C2 — COA POST 현재 DB 차단:** CHECK가 coa→inventoryId NOT NULL을 강제하나 route가 inventoryId 미수용 → 모든 COA POST가 CHECK 위반으로 실패. route+surface 동반 출시 전까지 COA 실사용 불가.

**Chosen Source of Truth:**
- 스키마 P2(`SDSDocument` + CHECK)가 truth. UI/route는 그에 정합.
- C1 해소: 이번 트랙은 **record-scoped COA**로 한정(ProductInventory 1행 + lotNumber 라벨). 진짜 multi-lot(lot 엔티티)은 **별 트랙 defer**.

**Environment Reality Check:**
- [x] repo/branch: main (origin 정합, unpushed 0)
- [x] runnable: `npx vitest run <file>` GREEN, `next build` (호영님 환경 pre-push)
- [x] 실행 blocker: git index.lock = 호영님 환경 소유(sandbox commit/checkout 불가) → 파일 변경은 sandbox, commit/push는 클로드코드. 작업 후 git-diff 점검 필수(desync 회귀 방지).

---

## 1. Priority Fit

**Current Priority Category:**
- [ ] P1 immediate
- [ ] Release blocker
- [x] Post-release (P3 surface)
- [ ] P2 / Deferred

**Why This Priority:**
- P1(catalog 경계)·P2(스키마 CHECK) land 완료, P3 surface가 다음 자연 단계.
- reconcile P1-3가 deferred RED로 트랙 미완 — 토대 깔린 지금이 적기.
- release blocker 아님(COA는 현재 미노출이라 사용자 영향 0, 회귀 위험 낮음).

---

## 2. Work Type

- [ ] Feature
- [ ] Bugfix
- [ ] API Slimming
- [x] Workflow / Ontology Wiring (입고 lot → COA 귀속)
- [ ] Migration / Rollout (이번 트랙 schema 변경 없음 — 스키마는 P2에 land됨)
- [ ] Billing / Entitlement
- [ ] Mobile (후속 mobile-inventory-view 반영은 별 항목)
- [x] Web
- [x] Design Consistency (same-canvas surface 흡수)

---

## 3. Overview

**Feature Description:**
COA(시험성적서)를 catalog(제품)이 아니라 **inventory record(입고분)**에 귀속시킨다. (1) upload route가 `inventoryId`를 수용·검증(coa→필수, sds→null)하여 P2 CHECK와 정합, (2) inventory surface에 COA 업로드/열람 affordance를 same-canvas로 신설. SDS는 product-canonical로 catalog에 유지(불변).

**Success Criteria:**
- [ ] reconcile P1-3 RED→GREEN (route에 inventoryId 수용/요구)
- [ ] COA POST가 inventoryId와 함께 정상 저장(CHECK 통과), inventoryId 없는 coa는 422 거부(DB 차단 아닌 명시 검증)
- [ ] inventory item surface에서 COA 업로드/열람 가능(same-canvas, 새 페이지 0)
- [ ] sds POST는 inventoryId 무시/null 강제(회귀 0), catalog SDS 불변
- [ ] sentinel: route 계약 + inventory COA surface + SDS 보존 GREEN

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] SDS canonical 단일화 + 규제포털 auto-link (per-org dedup, 비가역 migration → **별 트랙**)
- [ ] 진짜 multi-lot(lot 엔티티 신설, ProductInventory unique 완화) — 별 트랙
- [ ] catalog detail에 COA 재노출(P1-1 회귀 금지)
- [ ] 신규 AI/chatbot UI, page-per-feature

**User-Facing Outcome:**
- 입고된 재고 항목에서 그 lot의 COA를 올리고 보는 흐름. catalog 제품 페이지에는 SDS만(제품 공통), COA는 재고(입고분)에.

---

## 4. Product Constraints

**Must Preserve:**
- [x] workbench / queue / rail / dock (inventory context-panel/workbench 흡수)
- [x] same-canvas (inventory surface 내 inline/expand)
- [x] canonical truth (`SDSDocument` + CHECK)
- [x] invalidation discipline (업로드 후 COA 목록 query invalidate)

**Must Not Introduce:**
- [ ] page-per-feature
- [ ] chatbot/assistant reinterpretation
- [ ] dead button / no-op / placeholder success (업로드 실패 시 정직한 error state)
- [ ] fake billing/auth shortcut
- [ ] preview overriding actual truth

**Canonical Truth Boundary:**
- Source of Truth: `SDSDocument`(coa→inventoryId NOT NULL / sds→null, CHECK)
- Derived Projection: inventory surface COA 목록(query)
- Snapshot / Preview: 없음
- Persistence Path: POST `/api/products/[id]/sds` (formData: file, docType, inventoryId)

**UI Surface Plan:**
- [x] Inline expand / Existing route section (inventory context-panel / receiving workbench)
- [ ] New page (⚠️ 금지)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| COA = record-scoped (ProductInventory 1행) | 스키마 P2가 이미 inventoryId FK 지원, 최소 diff | 진짜 multi-lot 미지원(lotNumber 라벨만) — 별 트랙 defer |
| route에서 coa→inventoryId 명시 검증(422) | DB CHECK 차단을 사용자 친화 error로 승격(dead fail 방지) | route 분기 추가 |
| SdsDocumentsSection 재사용(docType="coa"+inventoryId prop) | 컴포넌트 동형 재사용, page sprawl 0 | prop 1개 추가(하위호환) |

**Dependencies:**
- Required Before Starting: P2 스키마/CHECK land(완료), P1-1 catalog COA 제거(완료)
- External Packages: 없음
- Existing Routes/Models/Services Touched: `api/products/[id]/sds/route.ts`, `SDSDocument`, `ProductInventory`, `SdsDocumentsSection`, inventory context-panel

**Integration Points:**
- POST/GET `/api/products/[id]/sds` (inventoryId 수용/필터)
- inventory query(현 재고 record id) → COA surface에 inventoryId 공급
- COA 목록 query invalidation

---

## 6. Global Test Strategy

Red-Green-Refactor 엄수.
- route 계약 변경 → integration/sentinel(readFileSync+regex 또는 route 단위) 필수
- inventory COA surface → sentinel(컴포넌트 wiring) + 수동 smoke 1회
- 회귀: sds→null 강제, catalog SDS 보존, P1-1 미회귀
- 실행 불가 시 "실행 불가" 명시(추정 통과 금지)

---

## 7. Implementation Phases

### Phase 0: Context & Scope Lock
- Status: [ ] Pending
- **🔴 RED:** C1(record-scoped) / C2(POST 차단) 확정, inventory surface 타깃 1곳 확정(context-panel vs receiving workbench), 현 재고 record id 공급 경로 확인
- **🟢 GREEN:** runnable 명령 확정, 기존 SdsDocumentsSection upload 경로 확인
- **🔵 REFACTOR:** scope 축소(record-scoped 한정 재확인)
- **✋ Quality Gate:** 충돌 0 미해결, surface 타깃 단일 확정, 우선순위 문서화
- **Rollback:** planning-only

### Phase 1: Contract & Failing Tests
- Status: [ ] Pending
- **🔴 RED:** (a) route 계약 sentinel — POST가 inventoryId 수용 + coa→필수/sds→null; (b) inventory COA surface sentinel — docType="coa" + inventoryId 전달; (c) 회귀 — catalog SDS 보존·P1-1 미회귀. 실패 확인.
- **🟢 GREEN:** 최소 scaffolding
- **🔵 REFACTOR:** 네이밍/scope 정리
- **✋ Quality Gate:** 실패 test 실재, 기존 test GREEN 유지, lint/typecheck 문서화
- **Rollback:** test/scaffold revert

### Phase 2: Upload Route Lot Handling (P1-3)
- Status: [ ] Pending
- **🔴 RED:** route 단위/계약 test (coa+inventoryId→저장, coa-no-inventoryId→422, sds→null 강제)
- **🟢 GREEN:** POST formData `inventoryId` 파싱, docType=coa면 inventoryId 필수+소유 검증(해당 org의 ProductInventory), docType=sds면 inventoryId=null 강제. CHECK 정합.
- **🔵 REFACTOR:** 분기 단순화, 중복 제거
- **✋ Quality Gate:** reconcile P1-3 GREEN, no overfetch/N+1, 권한(membership) 검증 불변, fake success 0
- **Rollback:** route를 Phase 1 상태로 revert(스키마 불변이라 안전)

### Phase 3: Inventory COA Surface 신설
- Status: [ ] Pending
- **🔴 RED:** inventory surface에 COA 섹션 sentinel(wiring)
- **🟢 GREEN:** `SdsDocumentsSection docType="coa" inventoryId={...}`를 inventory context-panel/item에 same-canvas로 흡수. 업로드 후 목록 invalidate. loading/error/empty/disabled 상태 구비.
- **🔵 REFACTOR:** UI 중복 제거, same-canvas 유지
- **✋ Quality Gate:** dead button/no-op 0, front-only success 0, 상태별 UI 존재, page-per-feature 0
- **Rollback:** surface wiring revert(route는 유지 가능)

### Phase 4: Smoke / Rollback
- Status: [ ] Pending
- **🔴 RED:** 실패 모드 식별(권한 없는 업로드, inventoryId 불일치, 대용량 파일), smoke path 정의
- **🟢 GREEN:** smoke 실행(입고 record에 COA 업로드→열람→catalog SDS 불변 확인), audit/모니터링 확인
- **🔵 REFACTOR:** 임시 계측 제거, Notes 마감
- **✋ Quality Gate:** rollout 안전, rollback 문서화, 잔여 blocker 격리
- **Rollback:** surface 비노출 fallback(route는 무해), 필요 시 commit revert

---

## 8. Optional Addenda

### A. Workflow / Ontology Addendum (inventory/safety 적용)
- **Resolver Input:** 현 재고 record(productId+org) / 입고 여부 / COA 존재 여부
- **Expected Output:** COA 업로드 가능 여부, COA 미비 경고(선택)
- **Surface Rules:** inventory context-panel/row CTA, same-canvas overlay만. chatbot/terminal 금지.
- **Validation:**
  - [ ] inventory row에서 COA 업로드 CTA 정확
  - [ ] COA 미비 시 정직한 empty(거짓 성공 0)
  - [ ] catalog는 SDS만(COA 미노출) 유지

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| ProductInventory 단일행(multi-lot 불가) | High | Med | record-scoped 한정, multi-lot 별 트랙 defer(문서화) |
| COA POST DB 차단(C2) | High | High | route(P2)+surface(P3) 동반 출시, route 먼저 GREEN |
| 권한 우회(타 org inventoryId) | Low | High | POST에서 inventoryId 소유(membership) 검증 |
| sds→null 회귀 | Low | Med | sentinel로 sds inventoryId=null 강제 검증 |
| desync 손상(작업 중) | Med | Med | 각 변경 후 `git diff --stat` 점검, bash 권위 사본 검증 |

---

## 10. Rollback Strategy

- Phase 1 실패: test/scaffold revert
- Phase 2 실패: route를 이전 상태로 revert(스키마 불변 → 안전)
- Phase 3 실패: surface wiring revert(route 유지 가능)
- Phase 4 실패: surface 비노출 fallback / commit revert
- **Special:** 스키마 변경 없음(이번 트랙). COA 데이터는 append-only, FK onDelete: Restrict로 보호.

---

## 11. Progress Tracking

- Overall completion: 0%
- Current phase: Phase 0 (대기)
- Current blocker: 없음
- Next validation step: Phase 0 surface 타깃 확정

**Phase Checklist:**
- [ ] Phase 0 complete
- [ ] Phase 1 complete
- [ ] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Phase 4 complete

---

## 12. Notes & Learnings

**Blockers Encountered:**
- [2026-06-13] ProductInventory `@@unique([organizationId, productId])` → 진짜 multi-lot 불가 발견 → record-scoped로 한정, multi-lot defer.
- [2026-06-13] COA POST가 CHECK로 DB 차단 상태 → route+surface 동반 필요.

**Implementation Notes:**
- SDS canonical 단일화 + 규제포털 auto-link = **별 트랙**(호영님 결정 2026-06-13). 비가역 per-org dedup이라 dry-run→보고→승인 게이트 별도.
- 이번 트랙 스키마 변경 0(P2에 land됨). route+surface+sentinel만.

**To Revisit:**
- 진짜 multi-lot(lot 엔티티) 필요 시점 재평가.
- mobile-inventory-view COA 반영(후속).
