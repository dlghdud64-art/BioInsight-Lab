# Implementation Plan: #vendor-partnership-tier (2단계)

- **Status:** ⏳ Pending (Phase 0 진입)
- **Started:** 2026-05-08
- **Last Updated:** 2026-05-08
- **Estimated Completion:** 2026-05-09 (Phase 1 단독 land 후 호영님 검증 + Phase 2/3 별도 진입)

---

## 호영님 6 결정 (권장안 그대로 승인)

| # | 결정 | 선택 |
|---|---|---|
| 1 | tier 단계 / semantic | **A. 4단계** — `DIRECT_PARTNER` / `VERIFIED` / `GENERAL` / `UNVERIFIED` |
| 2 | schema 위치 | **C. overlay** — Vendor.partnershipTier (글로벌 baseline) + OrganizationVendor.partnershipTier (조직 override, nullable) |
| 3 | tier value 형식 | **A. Prisma enum** — `VendorPartnershipTier` |
| 4 | UI 표시 위치 | **A. settings/suppliers** (1단계 surface 흡수) |
| 5 | resolveSuppliers ranking | **A. confidence boost** — DIRECT_PARTNER → "high", VERIFIED → "high", GENERAL → "medium", UNVERIFIED → "low" |
| 6 | land scope | **A → B → C 분리 land** — Phase 1 (schema + seed) 단독 우선 → push → 검증 → Phase 2 (UI) → Phase 3 (ranking) |

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- ADR-002 #user-supplier-registration cluster (1단계 land 결과)
- 호영님 한국 시약 시장 분석 — Thermo Fisher 글로벌 + 바이오마트/코아바이오텍/다인바이오/지니아텍/머크코리아 한국 총판 5
- 1단계 PILOT_VENDOR_CATALOG seed (vendor.id `vendor-pilot-` prefix, 6 vendor)

**Secondary References:**
- §11.142 운영 브리핑 lock
- 1단계 cluster 의 OrganizationVendor schema + resolveSuppliers 4-source priority chain

**Conflicts Found:**
- 없음 (자연 확장)

**Chosen Source of Truth:**
- 1단계 schema + seed = base. 2단계는 추가 enum + 추가 column 부착.

**Environment Reality Check:**
- [x] vitest runner 정상
- [x] prisma db push 가능 (호영님 host 측 manual)
- [x] git push + Vercel deploy 정상

---

## 1. Priority Fit

- [x] **Post-release** (사업 확장 strategy 2단계)

**Why This Priority:** 1단계 cluster 직후 자연 진입. 2단계 partnership tier 가 dispatch ranking + UI 우선순위 + 향후 sales motion 의 starting point.

---

## 2. Work Type

- [x] **Feature** (새 schema + 새 enum + 새 surface + ranking 영향)

---

## 3. Overview

**Feature Description:**
Vendor + OrganizationVendor 에 partnership tier (4단계 enum) 추가. 글로벌 baseline (Vendor) + 조직 override (OrganizationVendor) overlay pattern. settings/suppliers 에서 표시 + resolveSuppliers 의 confidence ranking 에 반영.

**Success Criteria:**
- [ ] Phase 1: schema 정합 + 1단계 seed 의 6 vendor 에 tier 부여 + vitest GREEN
- [ ] Phase 2: settings/suppliers UI badge + form select + vitest GREEN
- [ ] Phase 3: resolveSuppliers confidence boost (high/medium/low) + vitest GREEN

**Out of Scope (절대 구현하지 말 것):**
- Hard filter (UNVERIFIED 자동 제외) — 별도 트랙
- Admin platform-level vendor tier 관리 화면 — 별도 트랙
- 3단계 #vendor-catalog-product-matching — 별도 cluster
- Vendor.partnershipTier 의 자동 갱신 (e.g., 거래 빈도 기반) — 별도 트랙

**User-Facing Outcome:**
- Phase 1 완료 시: settings/suppliers list 의 vendor 가 tier 정보 보유 (UI 노출 0)
- Phase 2 완료 시: badge 표시 + form 에서 tier 선택 가능
- Phase 3 완료 시: dispatch sheet 의 vendor 추천이 tier 기반 우선순위로 정렬

---

## 4. Product Constraints

**Must Preserve:**
- [x] workbench / queue / rail / dock (UI 영향 0 of 그 구조)
- [x] same-canvas (settings/suppliers 흡수, page-per-feature 회피)
- [x] canonical truth — Vendor (글로벌) + OrganizationVendor (조직 override) overlay
- [x] resolveSuppliers 의 4-source priority chain 보존

**Must Not Introduce:**
- [x] page-per-feature 0
- [x] dead button 0
- [x] preview override of canonical truth
- [x] AI/chatbot UI 추가 0

**Canonical Truth Boundary:**
- Source of Truth: `Vendor.partnershipTier` (글로벌 baseline) + `OrganizationVendor.partnershipTier` (조직 override, null 시 Vendor.partnershipTier 사용)
- Derived Projection: resolveSuppliers 의 confidence (high/medium/low) — tier 기반 계산
- Persistence Path: 호영님 host 측 `npx prisma db push` (1단계와 동일)

**UI Surface Plan:**
- [x] Existing route section (settings/suppliers) — Phase 2
- [x] Existing dispatch sheet (자동 ranking) — Phase 3
- [ ] 별도 admin (defer)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
|---|---|---|
| Overlay pattern (Vendor + OrganizationVendor) | 호영님 결정 2C — 글로벌 baseline + 조직 override | column 2개 (Vendor + OrganizationVendor) 동기화 필요 — null fallback 패턴 |
| Prisma enum | 호영님 결정 3A — type safety | migration 필요, enum 값 변경 시 migration 추가 |
| settings/suppliers 흡수 | 호영님 결정 4A — same-canvas | settings page 가 더 dense (badge + form select 추가) |
| Phased land (A→B→C) | 호영님 결정 6A — small batch | 3 phase 별도 push, total 시간 늘어남 |

**Dependencies:**
- 1단계 land 완료 (Vendor + OrganizationVendor + resolveSuppliers) — 충족
- prisma client regenerate (host 측) — Phase 1 land 후 호영님 manual

**Touched Files (Phase 1):**
- `apps/web/prisma/schema.prisma` — VendorPartnershipTier enum + Vendor.partnershipTier + OrganizationVendor.partnershipTier
- `apps/web/src/lib/seed/pilot-vendor-catalog.ts` (또는 seed 파일) — 6 vendor 의 tier 부여
- `apps/web/src/__tests__/schema/vendor-partnership-tier.test.ts` (NEW) — schema-level guard tests

**Touched Files (Phase 2 — 별도 land):**
- `apps/web/src/app/dashboard/settings/suppliers/page.tsx` — badge + form select
- `apps/web/src/app/api/organization-vendors/**` — POST/PATCH zod schema 확장
- 관련 vitest

**Touched Files (Phase 3 — 별도 land):**
- `apps/web/src/components/quotes/dispatch/resolve-suppliers.ts` — confidence boost 로직
- 관련 vitest

---

## 6. Test Strategy

**Phase 1:** schema-level vitest source guard (enum / column 존재 / seed tier 부여)
**Phase 2:** UI render test + form submit zod test
**Phase 3:** resolveSuppliers confidence matrix test (4 tier × 4 source)

---

## 7. Implementation Phases

### Phase 0: Context & Truth Lock (현재)
- [x] 호영님 6 결정 승인
- [ ] schema 위치 (prisma file path) 확정
- [ ] seed 위치 (PILOT_VENDOR_CATALOG) 확정
- [ ] 호영님 결정 2C overlay 의 helper (`getEffectivePartnershipTier`) 위치 결정

### Phase 1: Schema + Seed (RED → GREEN → push)
- [ ] **🔴 RED:** `vendor-partnership-tier.test.ts` — enum 4 value / Vendor.partnershipTier / OrganizationVendor.partnershipTier (nullable) / seed 의 6 vendor tier 부여
- [ ] **🟢 GREEN:** schema.prisma + enum + 두 column + seed 매핑 (Thermo Fisher → DIRECT_PARTNER, 한국 총판 5 → VERIFIED, 그 외 → GENERAL default)
- [ ] **🔵 REFACTOR:** seed file naming / enum order
- [ ] vitest verify + tsc clean
- [ ] ADR-002 entry append
- [ ] commit message draft + 호영님 push (host: prisma db push 필수)

### Phase 2: UI (settings/suppliers)
- [ ] **🔴 RED:** UI render test + form select test
- [ ] **🟢 GREEN:** badge display (4 tone — DIRECT_PARTNER violet, VERIFIED green, GENERAL gray, UNVERIFIED amber) + form select
- [ ] zod schema 확장 + POST/PATCH route
- [ ] 호영님 push

### Phase 3: resolveSuppliers ranking
- [ ] **🔴 RED:** confidence matrix test
- [ ] **🟢 GREEN:** tier → confidence (DIRECT_PARTNER/VERIFIED → "high", GENERAL → "medium", UNVERIFIED → "low")
- [ ] 4-source priority chain 정합 (org_book + tier 가 ai_recommended 보다 우선 보존)
- [ ] 호영님 push

### Phase 4 (optional): Smoke / Rollback
- [ ] Chrome smoke 검증
- [ ] ADR cluster close

---

## 8. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| migration 시 기존 6 vendor 의 tier null 잔존 → seed 정합 안 됨 | Med | Low | seed migration script (1회용) — host 측 manual run |
| OrganizationVendor.partnershipTier null fallback 누락 → undefined | Low | Med | 헬퍼 `getEffectivePartnershipTier(orgVendor, vendor)` 도입 — null fallback 명시 |
| Prisma enum 값 변경 시 migration 추가 부담 | Low | Low | Phase 1 에 4 값 충분 검토 — 향후 변경 트랙 분리 |
| Phase 2 의 zod schema drift | Low | Low | RED test 가 source-level guard |

---

## 9. Rollback Strategy

- Phase 1 fail: `git revert <SHA>` + (host) prisma db push 후 column drop
- Phase 2 fail: revert UI commit
- Phase 3 fail: revert resolver commit (1단계 baseline 보존)

---

## 10. Notes & Learnings (실시간 update)

(Phase 진행 시 채워짐)
