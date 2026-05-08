# Implementation Plan: #user-supplier-registration (1단계 — 사용자 공급사 직접 등록)

- **Status:** ✅ Complete (2026-05-08, Path A close — Phase 1~5 production 검증 + ADR cluster-close + 별도 트랙 #quote-vendor-requests-organization-scope spawn)
- **Started:** 2026-05-08
- **Last Updated:** 2026-05-08
- **Actual Completion:** 2026-05-08 (~6h actual, single-day cluster)

⛔ DO NOT start implementation 전 호영님 schema 결정 + Vertical scope 승인 필요
⛔ DO NOT skip Phase 0 audit (UserVendor / OrganizationVendor / WorkspaceVendor 옵션 비교)
⛔ DO NOT commingle batch dispatch sheet 의 supplier 편집 path 변경과 schema 작업 (별도 트랙)

---

## 0. Truth Reconciliation

**호영님 사업 확장 전략 (피드백 정합):**
> "1단계 — 공급사 DB를 플랫폼의 자산으로 만들기. 지금 당장 모든 벤더 이메일을 확보할 수는 없으니까, 사용자가 직접 거래처 정보를 입력하게 하는 거예요. '내 공급사 등록' 기능을 만들어서, 연구실 구매 담당자가 기존에 거래하던 총판 연락처를 넣으면 그 데이터가 플랫폼에 쌓이는 구조. 이게 네트워크 효과의 시작점이에요."

**한국 시약 시장 특성 (호영님 분석):**
- 글로벌 제조사 (Thermo Fisher / Sigma-Aldrich / Bio-Rad) 직접 거래보다 **국내 총판/대리점** 거래가 많음 (바이오마트, 코아바이오텍, 다인바이오, 지니아텍 등).
- 같은 품목도 총판마다 가격 다름.
- 연구소마다 기존 거래처 보유 → "FBS 견적 받아줘" → "어느 총판한테?" 가 즉시 따라옴.

**Latest Truth Source:**
- Vendor schema (schema.prisma:301-328) — 글로벌 single-tenant Vendor 만 보유 (`isPremium`, `leadPricePerQuote` 등 partner-tier 위한 field 존재, user/organization 별 association 부재).
- ProductVendor (schema.prisma:331-358) — 글로벌 product↔vendor join (사용자별 분리 0).
- Quote.userId / organizationId / workspaceId 보유 — quote 단위 ownership 정합.

**핵심 schema 결정 — 호영님 승인 필수:**

### Option Schema-A — `OrganizationVendor` (조직 단위)
```prisma
model OrganizationVendor {
  id             String       @id @default(cuid())
  organizationId String
  vendorId       String?      // 기존 Vendor 연결 (선택)
  // 또는 inline vendor info (organization 만 알고 platform Vendor table 미등록 시)
  vendorName     String       // operator-input
  vendorEmail    String       // operator-input (.invalid 차단 권장)
  vendorPhone    String?
  isPrimary      Boolean      @default(false)  // 우선 거래처
  notes          String?      // 메모 (예: "신규 거래, 단가 협상 중")
  createdById    String       // 누가 등록했는지 (audit)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  vendor       Vendor?      @relation(fields: [vendorId], references: [id], onDelete: SetNull)
  createdBy    User         @relation(fields: [createdById], references: [id], onDelete: Cascade)

  @@unique([organizationId, vendorEmail])  // 동일 조직 내 중복 차단
  @@index([organizationId])
  @@index([vendorId])
}
```
**Pros:** 조직 단위로 거래처 공유 (여러 user 가 등록한 거래처를 같은 조직 안에서 reuse). 한국 연구실의 실 운영 패턴 정합 (실험실 단위 거래처 명단).
**Cons:** Quote.organizationId 가 nullable — guest / unattached user 의 vendor 등록 path 부재.

### Option Schema-B — `UserVendor` (사용자 단위)
**Pros:** guest 포함 모든 user 가 개인 거래처 관리. simpler model.
**Cons:** 같은 조직 안 user 마다 거래처 중복 입력 (정보 silo).

### Option Schema-C — `WorkspaceVendor` (워크스페이스 단위)
**Pros:** §11.99 / §11.209 의 workspace 단위 권한 모델 정합. multi-tenant cleanest.
**Cons:** Workspace.organizationId 와 cardinality 중복 가능성 (workspace ⊂ organization 정합 시 OrganizationVendor 와 사실상 동일 효과).

**권장 (호영님 검토 필수):** **Option Schema-A (OrganizationVendor)**.
- 한국 시약 시장의 "연구실 단위 거래처 명단" 패턴 정합.
- 같은 조직 내 reuse + 누가 등록했는지 audit (createdById).
- guest path 는 별도 트랙 (개인 사용자가 organization 없이 견적 요청 시 user-input email 만, vendor-book 미생성).

### Vertical Scope — 세포배양 시약 (호영님 승인 정합)

**Pros (호영님 분석):**
- FBS, 배지, PBS, 트립신 — 거의 모든 바이오 연구소 사용.
- 총판 한정 → 공급사 DB 빠르게 채우기 가능.
- 호영님 QC 도메인 정합 — domain knowledge 무기화.

**Implementation 정합:**
- ProductCategory enum 또는 tag 에 `CELL_CULTURE` 추가.
- Vendor seed 에 세포배양 전문 총판 5~10개 사전 등록 (바이오마트, 코아바이오텍, 다인바이오 등).
- Search / Compare / Quote wizard 의 default 카테고리 = 세포배양 (operator confusion 0).

---

## 1. Priority Fit

**Current Priority Category:**
- [x] **P2 — Strategic large feature** (사업 확장 cluster 의 1단계)

**Why This Priority:**
- 견적 발송 dead-button 의 **근본 해결책** (호영님 정확히 짚으심: "정작 보낼 곳이 없으면 그 버튼은 dead button").
- 네트워크 효과 시작점.
- 호영님 명시 — 1단계 → 2단계 (총판 파트너십) → 3단계 (카탈로그 매칭) 순서.

---

## 2. Work Type

- [x] **Feature** (large)
- [x] **Schema migration** (OrganizationVendor 신설)
- [x] **Web** (mobile 분기는 별도 트랙)
- [x] **Strategic** (사업 확장 1단계)

---

## 3. Overview

**Feature Description:**
조직 단위 공급사 등록 surface (`/dashboard/vendors` 또는 `/dashboard/settings/suppliers`). OrganizationVendor schema 신설. 견적 wizard / batch dispatch sheet 의 supplier 선택 단계에 "내 거래처에서 선택" path 추가 (호영님 명시 3-path entry point 의 옵션 1). 세포배양 시약 vertical 우선 — Vendor seed + UI default category.

**Success Criteria (호영님 검토 필수):**
- [ ] OrganizationVendor 신설 + migration land + idempotent seed.
- [ ] `/dashboard/settings/suppliers` (또는 `/dashboard/vendors`) surface — 등록/편집/삭제 + 검색.
- [ ] 견적 요청 wizard `/app/quote` 의 supplier 선택에 "내 거래처에서 선택" combobox.
- [ ] batch dispatch sheet (`batch-dispatch-sheet.tsx`) 에 "내 거래처에서 선택" + "이메일 직접 입력" 두 path.
- [ ] resolveSuppliers 4 source 확장 — `org_book` (OrganizationVendor) 추가, recent_rfq / supplier_book / ai_recommended 보존.
- [ ] 세포배양 vertical seed — 바이오마트 / 코아바이오텍 / 다인바이오 등 5~10 vendor + ProductVendor 매칭 (FBS / 배지 / PBS / 트립신 5~10 product).
- [ ] vitest + tsc + Chrome smoke (호영님 본인 거래처 5건 등록 → quote 1건 발송 → toast 성공).

**Out of Scope:**
- [ ] **2단계 — 파트너십 onboarding** (`#vendor-partnership-tier`) — admin tool + tier enum + 프리미엄 ranking.
- [ ] **3단계 — 카탈로그 자동 매칭** (`#vendor-catalog-product-matching`) — search/wizard 시 "취급 공급사 N곳, 단가 ₩XX" 자동 표시.
- [ ] **mobile** — `/dashboard/settings/suppliers` mobile 분기 (별도).
- [ ] **guest user** — organization 없는 user 의 vendor 등록 path (별도).
- [ ] **CSV import** — 기존 거래처 명단 일괄 업로드 (P3 nice-to-have).
- [ ] **Vendor verification** — 등록된 vendor 의 실재 검증 (2단계 일부).

**User-Facing Outcome:**
호영님 본인 또는 연구실 구매 담당자가 `/dashboard/settings/suppliers` 진입 → "공급사 추가" → 이름 / 이메일 / 전화 / 메모 입력 → 저장 → 견적 요청 wizard 의 supplier 선택에서 "내 거래처에서 선택" 으로 즉시 노출 → 견적 1건 발송 → toast 성공.

---

## 4. Product Constraints

**Must Preserve:**
- [x] canonical truth — Vendor / Quote / VendorRequest 기존 schema 보존, OrganizationVendor 추가만.
- [x] same-canvas — `/dashboard/settings/suppliers` 추가는 settings 의 sub-section (page-per-feature 회피).
- [x] design intent — pilot vendor 의 "no real outbound mail" 보호 (#vendor-email-seed-pilot 정합 — 새 OrganizationVendor 도 isVendorPilot 분기 적용 가능).
- [x] dead-button 0 — supplier 등록 후 즉시 wizard / batch sheet 에 노출.

**Must Not Introduce:**
- [x] page-per-feature — settings 의 sub-section 으로 통합.
- [x] chatbot / assistant — selectable work object surface 만.
- [x] organization 단위 vendor 와 global Vendor 의 ID 충돌 (OrganizationVendor.id 별도 namespace).
- [x] N+1 — 견적 list / wizard 의 supplier source 합산 시 nested include 또는 separate query 명확.

**Canonical Truth Boundary:**
- **Source of Truth:** OrganizationVendor (org-input) + Vendor (platform global) + VendorRequest (dispatch history).
- **Derived Projection:** resolveSuppliers 의 4 source 합산 (org_book / supplier_book / recent_rfq / ai_recommended).
- **Snapshot / Preview:** wizard / batch sheet 의 supplier list.
- **Persistence Path:** OrganizationVendor.create / update / delete + Vendor 연결 (vendorId nullable optional).

**UI Surface Plan:**
- [x] **Settings sub-section** — `/dashboard/settings/suppliers` (또는 `/dashboard/settings/vendors`).
- [x] **Wizard combobox** — `/app/quote` supplier 선택 단계.
- [x] **Batch sheet picker** — batch-dispatch-sheet.tsx 의 supplier 분기.
- [ ] New page (⛔ 금지 — settings sub-section 만).

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| **OrganizationVendor 신설 (Option Schema-A)** | 한국 연구실 단위 거래처 명단 정합. 누가 등록했는지 audit (createdById). 같은 조직 내 reuse. | guest path 별도 트랙. workspace 와 cardinality 중복 가능성 (organization 단일 운영 가정 시 정합). |
| **resolveSuppliers 4 source 확장 (org_book 추가)** | canonical helper 재사용. 우선순위: recent_rfq → org_book → supplier_book → ai_recommended. | 호영님 검토 필요 — org_book 우선순위 (high confidence — operator 직접 등록). |
| **Vertical 세포배양 vendor seed (바이오마트 등 5~10)** | 한국 시장 진입 entry point. 호영님 도메인 무기화. | 일반 vertical (LCMS / 분자생물학 등) 별도. 본 트랙은 cell culture 만. |
| **Settings sub-section path** | page-per-feature 회피 + same-canvas 보존. | settings 의 다른 sub-section (members / billing / notifications 등) 와 navigation 정합 필요. |

**Dependencies:**
- Required Before Starting: 호영님 schema 결정 (Option A vs B vs C) + Vertical scope 확정 + UI surface 위치.
- External Packages: 0.
- Existing Routes / Models / Services Touched:
  - **NEW** schema (OrganizationVendor) + migration.
  - **NEW** route: `/api/organizations/[id]/vendors` (GET/POST/PUT/DELETE).
  - **NEW** page: `/dashboard/settings/suppliers/page.tsx` (또는 `/dashboard/vendors`).
  - **MODIFIED** `apps/web/src/components/quotes/dispatch/resolve-suppliers.ts` — org_book source 추가.
  - **MODIFIED** `apps/web/src/components/quotes/dispatch/batch-dispatch-sheet.tsx` — supplier picker 확장.
  - **MODIFIED** `apps/web/src/app/app/quote/page.tsx` 또는 wizard — combobox 확장.
  - **MODIFIED** seed scripts — Vertical vendor seed.

**Integration Points:**
- 5~7 phase, 각 1-3h, 총 ~15-20h.

---

## 6. 호영님 결정 정합 (2026-05-08)

| 결정 항목 | 선택 | 정합 |
| :--- | :--- | :--- |
| 1. Schema | **A — OrganizationVendor** | 한국 연구실 단위 거래처 명단 |
| 2. Vertical scope | **다양화** (PILOT_PRODUCT_CATALOG 전체 카테고리) | 세포배양 + 분자생물학 + Lab consumables 모두 |
| 3. UI surface | **`/dashboard/settings/suppliers`** | settings sub-section, page-per-feature 회피 |
| 4. resolveSuppliers priority | **recent_rfq → org_book → supplier_book → ai_recommended** | 회신이력 > 명시등록 > platform매칭 > AI추출 |
| 5. `#vendor-master-seed-from-search` | **별도 트랙** | organization-level vs platform-level 의미 분리 |
| 6. 2/3단계 | **1단계 완료 후 별도 cluster** | scope 분리 + sequential delivery |

---

## 7. Phased Delivery (호영님 결정 정합)

### Phase 0 — Truth Lock + 결정 반영 ✅
- Status: [x] Complete
- 호영님 6 결정 plan document 반영.
- Phase 1~6 detail breakdown 확정.

### Phase 1 — Schema migration + Vendor seed 다양화
- Status: [x] Complete (sandbox land, 호영님 host migration + push 대기)
- 🔴 RED: schema migration test (OrganizationVendor 신설), seed test (한국 총판 5~10).
- 🟢 GREEN: `prisma/schema.prisma` 에 OrganizationVendor model + migration `20260508_*_add_organization_vendor` + Vendor seed update (바이오마트 / 코아바이오텍 / 다인바이오 / 지니아텍 등 5~10 vendor + ProductVendor 매칭 다양 카테고리).
- ✋ Quality Gate: prisma generate + migration sandbox 검증 + seed idempotent + vitest test PASS.
- Rollback: migration drop + seed revert.

### Phase 2 — Server route + zod schema
- Status: [x] Complete (sandbox land — vitest 17/17 + tsc 0 new error)
- 🔴 RED: `/api/organizations/[id]/vendors` CRUD route test (GET / POST / PATCH / DELETE).
- 🟢 GREEN: route 신설 + zod schema (vendorName / vendorEmail / vendorPhone / notes / isPrimary) + ownership check (organization member 만 access) + audit log.
- ✋ Quality Gate: vitest 통과 + tsc + auth/permission 정합.
- Rollback: route file 삭제.

### Phase 3 — resolveSuppliers org_book source 추가
- Status: [x] Complete (sandbox land — vitest 18/18 + tsc 0 new error)
- 🔴 RED: resolveSuppliers 4 source 합산 test (recent_rfq → org_book → supplier_book → ai_recommended priority).
- 🟢 GREEN: ResolvedSupplier interface 에 `org_book` contactSource 추가 + helper signature 에 `organizationVendors?: OrganizationVendor[]` 추가 + priority 합산 로직.
- ✋ Quality Gate: 기존 resolveSuppliers 호출 caller 영향 0 (optional param).
- Rollback: resolveSuppliers 변경 revert.

### Phase 4 — Settings surface (`/dashboard/settings/suppliers`)
- Status: [x] Complete (sandbox land — vitest 15/15)
- 🔴 RED: page render test (등록/편집/삭제 button + form + table).
- 🟢 GREEN: `/dashboard/settings/suppliers/page.tsx` (NEW, ~200-300 line) + 등록 dialog + 편집 inline + 삭제 confirm + table view (vendorName / email / phone / notes / isPrimary / actions).
- ✋ Quality Gate: settings nav 정합 + a11y (skip-link / focus-visible) + 한국어 라벨.
- Rollback: page + dialog 파일 삭제.

### Phase 5 — Wizard combobox + batch sheet picker
- Status: [x] Complete (sandbox land — wiring 7/7 + label/icon org_book + caller forward 정합)
- 🔴 RED: wizard `/app/quote` 의 supplier 선택 단계 + batch sheet 의 picker 3-path test (org_book / 직접 입력 / LabAxis 추천 placeholder).
- 🟢 GREEN: wizard 의 supplier select combobox 확장 (org_book + 직접 입력) + batch-dispatch-sheet.tsx 의 picker 분기 (3-path).
- ✋ Quality Gate: 기존 dispatch flow 회귀 0 + dead-button 0 (LabAxis 추천 path 는 `coming soon` placeholder + tooltip).
- Rollback: combobox + picker 변경 revert.

### Phase 6 — Verify + Chrome smoke + ADR + cluster close
- Status: [x] Complete (Chrome smoke production 검증 — settings 등록 → batch action bar "발송 가능 2건" 직접 효과 입증)
- 🔴 RED: Chrome smoke scenario — 호영님 본인이 거래처 5건 등록 → quote 1건 발송 (org_book vendor 선택) → toast 성공.
- 🟢 GREEN: sandbox vitest sweep + tsc + 호영님 host commit + push + Vercel deploy + Chrome smoke + ADR entry.
- ✋ Quality Gate: production 의 OrganizationVendor 등록 → wizard 노출 → dispatch 성공 + KPI 반영.
- Rollback: 전체 cluster commit 들 revert.

---

---

## 7. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| **Schema migration 실패 (production data 영향)** | Low | High | OrganizationVendor 는 신설 — 기존 row 영향 0. migration 사전 sandbox 검증 + Vercel staging. |
| **resolveSuppliers 4 source 합산 priority 충돌** | Med | Med | 호영님 검토 — recent_rfq → org_book → supplier_book → ai_recommended 권장. |
| **세포배양 vendor seed 의 실제 정합** | Med | Low | 호영님 도메인 검토 — 실제 거래 가능 vendor 만 seed. 잘못된 vendor 는 호영님 직접 수정 가능. |
| **Settings navigation 정합 (sub-section 추가)** | Low | Low | 기존 settings 의 패턴 정합 (members / billing / notifications) — sub-section icon + route. |
| **batch dispatch sheet 의 picker UI 복잡도** | Med | Med | 3-path (org_book / 직접 입력 / LabAxis 추천) 분기 — UX 단순화 (tabs 또는 select). 호영님 검토. |

---

## 8. 호영님 결정 정합 ✅ (2026-05-08)

모든 결정 완료. Phase 1 RED 진입.

---

## 9. Notes & Learnings

(TBD)
