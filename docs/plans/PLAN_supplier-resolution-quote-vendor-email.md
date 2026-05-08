# Implementation Plan: #supplier-resolution-quote-vendor-email

- **Status:** ✅ Complete (Phase 0~2 sandbox land, Phase 3 verify 호영님 push 후)
- **Started:** 2026-05-08
- **Last Updated:** 2026-05-08
- **Estimated Completion:** 2026-05-08 (~2h actual, small scope)

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT modify Quote / Product / Vendor / ProductVendor Prisma schema (canonical truth path 이미 존재)
⛔ DO NOT modify wizard POST /api/quotes payload (server-only fix)

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `apps/web/src/components/quotes/dispatch/resolve-suppliers.ts` — 3 source resolution (recent_rfq / supplier_book / ai_recommended).
- `apps/web/src/app/api/quotes/route.ts:432-451` — GET prisma include — `items.product` select 에 `id, name` 만, **`vendors` relation 누락**.
- `apps/web/src/app/api/quotes/route.ts:447-449` — `vendorRequests.select` 에 `id, status` 만, **`vendorEmail`, `vendorName` 누락**.
- `apps/web/prisma/schema.prisma:284,301-358` — `Product.vendors: ProductVendor[]` + `ProductVendor.vendor: Vendor` + `Vendor.email: String?` — canonical truth path 존재.

**Secondary References:**
- `apps/web/src/app/dashboard/quotes/page.tsx` 의 `getQuoteDispatchPreflight(q)` — `includedSuppliers.length === 0` 시 hardBlocked.
- §11.217 Phase 3 cluster (commit f54a38b5) — batch dispatch UI 정합 완료, supplier resolution 만 미완.
- Chrome smoke 결과 (2026-05-08) — production 의 `/api/quotes?status=PENDING` 응답에 `items[0].product = {id, name}` 만, `vendors` 부재 confirmed.

**Conflicts Found:**
- 충돌 0. schema 의 canonical truth path 와 route layer 의 누락이 root cause. wizard payload 와 무관.

**Chosen Source of Truth:**
- Path A — **server `/api/quotes` GET 의 prisma include + response mapping 확장** (canonical truth path 정합).
- ProductVendor seed 부재 — 호영님 확인 ("Vendor seed 는 없을거야"). Path A 적용 후 dispatchable 이 0 이어도 정합 (route 가 빈 array forward, resolveSuppliers 가 빈 result).
- 별도 트랙 `#vendor-master-seed-from-search` 가 ProductVendor seed 책임 (search → compare → quote flow 의 vendor 자동 등록).

**Environment Reality Check:**
- [x] repo / branch context: main, working dir.
- [x] runnable commands: vitest run, tsc --noEmit, Chrome smoke.
- [x] execution blockers: 0 (server file 만 수정, schema 변경 0).

---

## 1. Priority Fit

**Current Priority Category:**
- [ ] P1 immediate
- [ ] Release blocker
- [ ] Post-release
- [x] **P2 / Deferred — operator productivity** (§11.217 Phase 3 후속, batch dispatch flow 활성화 prerequisite)

**Why This Priority:**
- §11.217 Phase 3 batch dispatch UI 자체는 정합 (Chrome smoke 통과). 이번 트랙은 backend resolution chain 정합 — operator 가 실제 dispatch 가능 quote 식별 가능.
- canonical truth path 이미 schema 에 존재, route layer drift 만 fix.
- ProductVendor seed 부재로 즉시 dispatchable 증가 0 이어도, 향후 seed 트랙의 prerequisite (route 가 forward 안 하면 seed 만 채워도 0).
- P1 release-prep 와 충돌 0.

---

## 2. Work Type

- [x] **API Slimming / Contract Drift Cleanup** (route include + mapping 확장)
- [x] **Web** (server-side, mobile 분기 0)

---

## 3. Overview

**Feature Description:**
`/api/quotes` GET 응답에 `items[].product.vendors[].vendor.{id, name, email}` 과 `vendorRequests[].{vendorEmail, vendorName, respondedAt, createdAt}` 포함. resolveSuppliers 의 3 source (recent_rfq / supplier_book / ai_recommended) 가 정상 작동하도록 server forward chain 정합.

**Success Criteria:**
- [ ] `/api/quotes` GET 응답이 `items[].product.vendors[].vendor.email` 보유 (ProductVendor row 가 있는 경우).
- [ ] `/api/quotes` GET 응답의 `vendorRequests[]` 가 `vendorEmail`, `vendorName`, `respondedAt`, `createdAt` 보유.
- [ ] resolveSuppliers 가 supplier_book / recent_rfq 정상 채택 (mock 데이터로 검증).
- [ ] vitest sweep — 새 test PASS + 기존 quote tests 0 fail.
- [ ] tsc 0 new error on quotes/route.ts.
- [ ] Chrome smoke — production 의 `/api/quotes?status=PENDING` 응답 shape 에 vendors / vendorEmail 포함 (값은 ProductVendor 데이터에 따라 달라짐).

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] Prisma schema 변경 — Product / Vendor / ProductVendor / Quote 모두 canonical truth path 이미 존재.
- [ ] wizard POST /api/quotes payload 변경 — server-only fix.
- [ ] **`#vendor-master-seed-from-search`** (별도 트랙) — search → compare → quote flow 에서 vendor 자동 등록 + ProductVendor seed.
- [ ] mobile (`/api/quotes/[id]`) — 본 트랙은 list endpoint 만, detail endpoint 별도.
- [ ] /api/quotes/[id]/detail / vendor-replies 등 다른 quote endpoint — 본 트랙은 GET /api/quotes 만.

**User-Facing Outcome:**
ProductVendor seed 가 채워진 후 (별도 트랙) batch action bar 의 "발송 가능 N건 / 보류 K건" 라벨이 정확히 분류 — operator 가 dispatch 가능 quote 한꺼번에 처리 가능. 본 트랙 즉시 효과는 server contract 정합만 (visible UI 변경 0, ProductVendor 데이터 부재 시).

---

## 4. Product Constraints

**Must Preserve:**
- [x] canonical truth — Quote / Product / Vendor / ProductVendor schema 그대로.
- [x] caller diversity — wizard / batch import / mobile / 다른 caller 모두 동일 응답 shape 사용 가능.
- [x] same-canvas — 견적 관리 surface 그대로.
- [x] dead-button 0 — preflight hardBlocked 분류가 데이터 기반으로 정확해짐.

**Must Not Introduce:**
- [x] page-per-feature — 0.
- [x] dead button / no-op — server 변경만, UI 영향 0.
- [x] N+1 — Prisma single nested include (join), payload 폭증 monitoring.
- [x] payload bloat — vendor email/name ~50bytes per vendor, quote 100건 × 평균 2 vendor = 10KB 증가 (수용 수준).

**Canonical Truth Boundary:**
- **Source of Truth:** Prisma schema (Product.vendors, Vendor.email, VendorRequest.vendorEmail).
- **Derived Projection:** resolveSuppliers 의 ResolvedSupplier (UI 표시용).
- **Snapshot / Preview:** dispatch sheet 의 read-only supplier list.
- **Persistence Path:** server-only fix, DB 변경 0.

**UI Surface Plan:**
- 변경 없음 (server-only fix). UI 효과는 ProductVendor seed 후에만 visible.

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| **server include + mapping 확장 (Path A)** | canonical truth path 이미 존재, route layer 만 fix. schema 변경 0 / migration 0 / wizard 변경 0. | ProductVendor seed 부재 시 즉시 효과 0 (별도 트랙 의존). |
| **`vendorRequests.select` 확장 (vendorEmail/Name/respondedAt/createdAt)** | resolveSuppliers 의 recent_rfq source 정상 작동. response shape 단일 source. | 약간의 payload 증가 (~30bytes per VR). |
| **mapping 에 vendors 직접 forward** | resolveSuppliers 가 quote.items[].product.vendors[].vendor.email 직접 사용. mapping 단계 변형 0. | response type definition 약간 길어짐. |
| **`/api/quotes` (list) 만 변경, `/api/quotes/[id]` 별도 트랙** | scope 분리 — list endpoint 가 batch dispatch UI 의 single source. detail endpoint 는 single dispatch / detail panel 별도 책임. | detail flow 의 supplier resolution 도 같은 issue 면 별도 트랙 필요. |

**Dependencies:**
- Required Before Starting: §11.217 Phase 3 cluster close (commit f54a38b5 land 정합).
- External Packages: 0.
- Existing Routes / Models / Services Touched:
  - `apps/web/src/app/api/quotes/route.ts` (modified — include + mapping).
  - `apps/web/src/components/quotes/dispatch/resolve-suppliers.ts` (read-only — 변경 0, 그대로 사용).

**Integration Points:**
- new test: `apps/web/src/__tests__/api/quotes/quotes-supplier-resolution.test.ts` (~70-100 line).
- modified: `apps/web/src/app/api/quotes/route.ts` (~+15 line — include + mapping).

---

## 6. Global Test Strategy

- **Phase 1 RED:** mock prisma response with vendor data → mapped response shape 검증. resolveSuppliers 호출 시 supplier 식별.
- **Phase 2 GREEN:** route include + mapping 확장 → test PASS.
- **Phase 3 verify:** sandbox vitest + tsc + Chrome smoke (production 응답 shape 확인).

---

## 7. Implementation Phases

### Phase 0 — Truth Lock + audit ✅
**Goal:** Plan 생성 + 호영님 승인.
- Status: [x] Complete

**🔴 RED:** sandbox grep 으로 quotes/route.ts include 부재 확인 + Chrome /api/quotes 응답 shape 검증.

**🟢 GREEN:** plan document 생성.

**🔵 REFACTOR:** scope 단순화 (server-only, schema/wizard/mobile 변경 0).

**✋ Quality Gate:** 호영님 승인 ✅.

**Rollback:** planning-only.

---

### Phase 1 — RED test
**Goal:** `/api/quotes` GET 응답 shape 검증 test 작성 (현재 fail).
- Status: [ ] Pending

**🔴 RED:**
- [ ] `apps/web/src/__tests__/api/quotes/quotes-supplier-resolution.test.ts` (NEW).
- [ ] verify: response 에 `items[].product.vendors[].vendor.{id, name, email}` 보존.
- [ ] verify: response 에 `vendorRequests[].vendorEmail` 보존.

**🟢 GREEN:** none yet (test fail).

**✋ Quality Gate:** test fail 정합 (RED).

**Rollback:** `git revert`.

---

### Phase 2 — GREEN: route include + mapping 확장
**Goal:** route prisma include + response mapping 수정 → test PASS.
- Status: [ ] Pending

**🔴 RED:** Phase 1 test fail 까지.

**🟢 GREEN:**
- [ ] `apps/web/src/app/api/quotes/route.ts:432-451` — items.include.product 의 select → include 로 변환 + vendors include 추가.
- [ ] vendorRequests.select 에 vendorEmail / vendorName / respondedAt / createdAt 추가.
- [ ] response mapping 에 vendors / vendorEmail forward.

**🔵 REFACTOR:** payload size + N+1 검증 (Prisma single join, polynomial 위험 minimal).

**✋ Quality Gate:**
- [ ] vitest 새 test PASS.
- [ ] 기존 quote tests 0 fail.
- [ ] tsc on quotes/route.ts 0 new error.

**Rollback:** `git revert`.

---

### Phase 3 — Verify + ADR + commit + Chrome smoke
**Goal:** production deploy 후 응답 shape 검증 + ADR + cluster close.
- Status: [ ] Pending

**🔴 RED:** Chrome smoke — fetch `/api/quotes?status=PENDING` → product.vendors / vendorRequests 의 새 field 확인.

**🟢 GREEN:**
- [ ] sandbox vitest sweep + tsc.
- [ ] 호영님 host commit + push + Vercel deploy.
- [ ] Chrome smoke 검증 — vendor email 보유 quote 식별.
- [ ] ADR `docs/decisions/ADR-002-pilot-tenant-seed.md` entry append.
- [ ] PLAN_*.md Status: Complete.

**🔵 REFACTOR:** ProductVendor seed 부재 명시 + 별도 트랙 `#vendor-master-seed-from-search` spawn (호영님 확인 정합).

**✋ Quality Gate:**
- [ ] Chrome 응답 shape 정합 (vendors / vendorEmail forward 확인).
- [ ] ProductVendor seed 부재 시 dispatchable 0 → 별도 트랙 명시.
- [ ] vitest sweep + tsc 정합.

**Rollback:** `git revert <SHA>`.

---

## 8. Optional Addenda

### C. API Slimming Addendum

**Waste Type:** Contract Drift — schema 의 canonical truth path 가 route layer 에서 forward 안 됨.
**Minimal Diff Fix:** items.include.product 의 select → include + vendors join 추가. mapping 도 forward.

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| **Prisma N+1 / payload 폭증** | Low | Low | single nested include (Prisma 가 1 query 로 join). payload 증가 ~10KB / 100 quote = 무시. monitoring 필요시 별도 트랙. |
| **mapping type definition drift** | Low | Med | TypeScript inline type 명시 — 기존 패턴 정합. 새 field forward 시 type 추가. |
| **ProductVendor seed 부재로 효과 0** | High | Low | 호영님 확인 — 별도 트랙으로 분리. 본 트랙은 prerequisite. |
| **다른 quote endpoint 도 같은 issue** | Med | Low | `/api/quotes/[id]/detail` 등 별도 트랙 (본 트랙은 list endpoint 만). |
| **regressed test (기존 quote test)** | Low | High | response mapping 에 새 field 추가만, 기존 field 0 손실. test 사전 sweep. |

---

## 10. Rollback Strategy

- If Phase 1 fails: revert test.
- If Phase 2 fails: revert route changes — schema 변경 0, migration 0.
- If Phase 3 fails: revert ADR entry — 코드 변경 0.

**Special:** server-only fix → DB migration 0 → rollback 단순.

---

## 11. Progress Tracking

- **Overall completion:** 25% (Phase 0 complete, Phase 1 진입)
- **Current phase:** Phase 1 (RED test 작성 중)
- **Current blocker:** 0
- **Next validation step:** RED test fail 확인 → Phase 2 GREEN.

**Phase Checklist:**
- [x] Phase 0 complete
- [x] Phase 1 complete (RED 9/9 fail 확인)
- [x] Phase 2 complete (GREEN — RED 9/9 → GREEN 21/21 PASS, tsc 0 new error)
- [ ] Phase 3 complete (Chrome smoke 호영님 host commit + push 후)

---

## 12. Notes & Learnings

**Architectural Decisions (from approval round):**
- Path A — server include + mapping 확장 (호영님 승인).
- ProductVendor seed 부재 — 별도 트랙 `#vendor-master-seed-from-search` (호영님 확인 "Vendor seed 는 없을거야").
- mobile / detail endpoint 별도 트랙.

**Implementation Notes:**
- (TBD)
