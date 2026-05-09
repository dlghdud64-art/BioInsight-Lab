# Implementation Plan: #vendor-catalog-product-matching (3단계)

- **Status:** ✅ Complete (Phase 1 + 2a + 2b + 3 all GREEN — 3단계 cluster CLOSE)
- **Started:** 2026-05-09
- **Last Updated:** 2026-05-09

---

## 호영님 6 결정 (권장안 그대로)

| # | 결정 | 선택 |
|---|---|---|
| 1 | cluster 의미 | **A. OrganizationVendorProduct** (조직별 vendor-product link) |
| 2 | schema 구조 | **A. 새 model** `OrganizationVendorProduct` |
| 3 | data 출처 | **A. operator 직접 입력** (1단계 패턴) — 자동 추천 별도 트랙 |
| 4 | resolveSuppliers ranking | **A. product 매칭 시 confidence boost** (한 단계 ↑) |
| 5 | UI surface | **A. settings/suppliers 의 vendor 별 expand** (page-per-feature 회피) |
| 6 | land scope | **A. Phase 1 (schema) → Phase 2 (UI+API) → Phase 3 (ranking) 분리 push** |

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- 1단계 #user-supplier-registration: OrganizationVendor + resolveSuppliers org_book.
- 2단계 #vendor-partnership-tier: Vendor + OrganizationVendor partnershipTier overlay.

**Existing schema:**
- `ProductVendor` (platform-wide): product-vendor pricing/stock 모든 organization 공통.
- `OrganizationVendor` (조직별 vendor): 사용자 직접 등록.
- 매핑 (어떤 lab vendor 가 어떤 product carry) **없음** = 3단계 entry point.

**Conflicts Found:** 없음.

**Chosen Source of Truth:** 새 model `OrganizationVendorProduct` — organization × vendor × product 3-way unique 매핑.

---

## 1. Priority Fit

- [x] **Post-release** (사업 확장 strategy 3단계, 1+2단계 직후 자연 진입)

---

## 2. Work Type

- [x] **Feature** (새 schema + 새 surface + ranking 영향)

---

## 3. Overview

**Description:** organization 단위로 "어떤 vendor 가 어떤 product 를 carry 하는지" 매핑. resolveSuppliers 의 product-vendor matching 기반 confidence boost. settings/suppliers 의 vendor expand 안 product list 직접 입력.

**Success Criteria:**
- [ ] Phase 1: `OrganizationVendorProduct` schema + 관계 + unique([organizationId, vendorId, productId]) + index + vitest GREEN
- [ ] Phase 2: API CRUD (`/api/organization-vendor-products`) + settings/suppliers UI expand
- [ ] Phase 3: resolveSuppliers product matching → vendor confidence boost (한 단계 ↑)

**Out of Scope (절대 구현 X):**
- 자동 추천 (RFQ history inference) — 별도 트랙
- catalog auto-import (web scraping) — 별도 트랙
- platform ProductVendor 의 organization scope 확장 — 별도 트랙
- price/discount/payment-term 정보 — 별도 트랙

---

## 4. Product Constraints

**Must Preserve:**
- workbench/queue/rail/dock, same-canvas, canonical truth (1+2단계와 동일 source).

**Must Not Introduce:**
- page-per-feature, dead button, AI/chatbot UI.

**Canonical Truth Boundary:**
- Source of Truth: `OrganizationVendorProduct` (organization × vendor × product unique).
- Derived Projection: resolveSuppliers 의 confidence boost (Phase 3).
- Persistence Path: `prisma db push` (1단계 패턴).

**UI Surface:** settings/suppliers vendor 별 expand 안 product list (Dialog 또는 inline).

---

## 5. Architecture

| Decision | Rationale | Trade-offs |
|---|---|---|
| 새 model OrganizationVendorProduct | 1단계 OrganizationVendor 패턴 정합 + clean separation | column 추가 (organizationId, vendorId, productId) — 작은 schema 부담 |
| @@unique([organizationId, vendorId, productId]) | 같은 vendor-product 중복 차단 | upsert 패턴 강제 |
| Phase 1 schema-only (seed 0) | sample data 는 호영님 production 직접 입력 | minimal-diff land |

**Touched (Phase 1):**
- `apps/web/prisma/schema.prisma` (M)
- `apps/web/src/__tests__/schema/organization-vendor-product.test.ts` (NEW)

**Touched (Phase 2 — 별도):**
- `apps/web/src/app/api/organization-vendor-products/route.ts` (NEW)
- `apps/web/src/app/api/organization-vendor-products/[id]/route.ts` (NEW)
- `apps/web/src/app/dashboard/settings/suppliers/page.tsx` (M, expand 안 product list)

**Touched (Phase 3 — 별도):**
- `apps/web/src/components/quotes/dispatch/resolve-suppliers.ts` (M, product matching boost)

---

## 7. Implementation Phases

### Phase 1: Schema (현재)
- [ ] RED test 작성 (schema-level guard)
- [ ] schema.prisma — OrganizationVendorProduct model
- [ ] prisma 관계 (Organization, Vendor, Product back-relation)
- [ ] vitest GREEN
- [ ] ADR + commit + 호영님 push (host: prisma db push)

### Phase 2: API + UI
- [ ] RED test (POST/PATCH/DELETE zod + UI form)
- [ ] CRUD route 신설
- [ ] settings/suppliers vendor 별 expand 안 product picker (Dialog 또는 inline)
- [ ] 호영님 push

### Phase 3: resolveSuppliers ranking
- [ ] RED test (product matching matrix)
- [ ] resolveSuppliers 의 quote.items × organizationVendorProducts 매칭 → confidence boost
- [ ] 호영님 push

---

## 9. Risk

| Risk | P | I | Mitigation |
|---|---|---|---|
| ProductVendor (platform) vs OrganizationVendorProduct (org) 의미 혼선 | Med | Low | 코멘트 + ADR 명시 |
| operator 입력 부담 — empty state 가 dispatch 에 영향 0 | Low | Low | resolveSuppliers fallback (matching 없으면 기존 ranking 유지) |
| Phase 1 schema migration 시 conflict | Low | Med | atomic Phase 분리 + 1+2단계와 동일 prisma db push 패턴 |

---

## 10. Rollback

- Phase 1 fail: `git revert <SHA>` + (host) prisma db push 후 model drop
- Phase 2 fail: revert API + UI commit
- Phase 3 fail: revert resolver commit

---

## 11. Notes (실시간 update)

(Phase 진행 시 채워짐)
