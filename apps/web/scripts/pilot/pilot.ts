/**
 * Pilot Tenant Shared Identifiers — #P01 / ADR-002
 *
 * This file is the single source of truth for every pilot row the
 * pilot-seed and pilot-cleanup scripts are allowed to create or
 * delete. It is pure data + pure functions: no Prisma, no env, no
 * fs. Importable from both seed and cleanup so the two sides stay
 * in lockstep.
 *
 * Governance contract
 * -------------------
 * 1. Everything below is sentinel-scoped to the "pilot-internal"
 *    namespace. IDs deliberately collide with nothing in
 *    prisma/seed.ts (org-bioinsight-lab, guest-demo) or the ADR-001
 *    smoke sentinel (org-smoke-isolated, workspace-smoke-isolated,
 *    user-smoke-sentinel, product-smoke-sentinel).
 *
 * 2. The pilot owner is the existing ADMIN user (호영) — we attach
 *    membership rows to that user's cuid instead of creating a
 *    pilot-only User. Deleting the pilot never deletes the user;
 *    the cleanup plan targets membership rows keyed on the compound
 *    {userId, organizationId} / {workspaceId, userId} unique so the
 *    user's memberships in any other organization remain untouched.
 *
 * 3. The pilot target is PRODUCTION DB (project-ref
 *    xhidynwpkqeaojuudhsw, region ap-northeast-1 / Tokyo). The opt-in
 *    is enforced one layer up in ./guard.ts — this file assumes the
 *    guard has already cleared.
 *
 * 4. Any change to the catalog, identifiers, or owner cuid requires
 *    a fresh pilot-cleanup --apply run against the previous state to
 *    avoid orphan rows. ADR-002 §11 deviations must be appended when
 *    this file changes after first deploy.
 */

// ──────────────────────────────────────────────────────────
// Organization (root sentinel)
// ──────────────────────────────────────────────────────────

export const PILOT_ORG_ID = "org-pilot-internal";
export const PILOT_ORG_NAME = "Pilot Internal Org (#P01 ADR-002)";
export const PILOT_ORG_SLUG = "org-pilot-internal";

/**
 * Plan choice rationale (Q2, 2026-04-23): "ORGANIZATION" matches the
 * plan used by org-bioinsight-lab in prisma/seed.ts, removing the
 * FREE-tier maxMembers / maxQuotesPerMonth ceilings during pilot so
 * that feature limits do not mask workflow bugs. Subscription-limit
 * verification is a separate track.
 */
export const PILOT_ORG_PLAN = "ORGANIZATION" as const;

// ──────────────────────────────────────────────────────────
// Workspace (1:1 with the pilot org — onDelete: Cascade from org)
// ──────────────────────────────────────────────────────────

export const PILOT_WORKSPACE_ID = "workspace-pilot-internal";
export const PILOT_WORKSPACE_NAME = "Pilot Internal Workspace (#P01 ADR-002)";
export const PILOT_WORKSPACE_SLUG = "workspace-pilot-internal";

// ──────────────────────────────────────────────────────────
// Pilot owner (existing User reuse — Q1 approved 2026-04-23)
// ──────────────────────────────────────────────────────────

/**
 * The real cuid of the ADMIN user (호영, dlghdud64@gmail.com).
 * Captured from /api/admin/users during the ADR-001 session on
 * 2026-04-23. The user row itself is canonical and must never be
 * touched by pilot-seed or pilot-cleanup — see PILOT_OWNER_PROTECTION
 * guard messages below.
 */
export const PILOT_OWNER_USER_ID = "cmo4mcbih00003ut3ozub29tc";

/**
 * Documentation-only — the membership role the pilot owner takes
 * inside the pilot organization. Reflected in OrganizationMember
 * and WorkspaceMember upserts in pilot-seed.ts.
 */
export const PILOT_OWNER_ORG_ROLE = "ADMIN" as const;
export const PILOT_OWNER_WORKSPACE_ROLE = "ADMIN" as const;

/** Human-readable reminder embedded into cleanup log output. */
export const PILOT_OWNER_PROTECTION =
  "Pilot cleanup must never delete the User row with id=" +
  PILOT_OWNER_USER_ID +
  " — only its OrganizationMember + WorkspaceMember rows scoped to PILOT_ORG_ID / PILOT_WORKSPACE_ID.";

// ──────────────────────────────────────────────────────────
// Pilot product catalog (15 items — Q3 approved 2026-04-23)
//
// Each entry must include id / name / category. Other fields are
// optional and deliberately omitted so the catalog stays minimal;
// brand / catalogNumber / specifications can be layered in a
// subsequent phase (#P02) without re-seeding.
// ──────────────────────────────────────────────────────────

export type PilotProductCategory =
  | "REAGENT"
  | "TOOL"
  | "EQUIPMENT"
  | "RAW_MATERIAL";

export interface PilotProductSpec {
  readonly id: string;
  readonly name: string;
  readonly nameEn: string;
  readonly category: PilotProductCategory;
}

export const PILOT_PRODUCT_CATALOG: readonly PilotProductSpec[] = [
  {
    id: "product-pilot-ethanol-500ml",
    name: "Ethanol 99.9% 500ml",
    nameEn: "Ethanol 99.9% 500ml",
    category: "REAGENT",
  },
  {
    id: "product-pilot-pbs-1l",
    name: "PBS 1X 1L",
    nameEn: "PBS 1X 1L",
    category: "REAGENT",
  },
  {
    id: "product-pilot-dmem-500ml",
    name: "DMEM high glucose 500ml",
    nameEn: "DMEM high glucose 500ml",
    category: "REAGENT",
  },
  {
    id: "product-pilot-fbs-500ml",
    name: "FBS heat-inactivated 500ml",
    nameEn: "FBS heat-inactivated 500ml",
    category: "REAGENT",
  },
  {
    id: "product-pilot-antibody-gapdh",
    name: "Anti-GAPDH antibody",
    nameEn: "Anti-GAPDH antibody",
    category: "REAGENT",
  },
  {
    id: "product-pilot-trypsin-100ml",
    name: "Trypsin-EDTA 100ml",
    nameEn: "Trypsin-EDTA 100ml",
    category: "REAGENT",
  },
  {
    id: "product-pilot-filter-022",
    name: "0.22μm sterile filter",
    nameEn: "0.22μm sterile filter",
    category: "TOOL",
  },
  {
    id: "product-pilot-falcon-50ml",
    name: "50ml Falcon conical tube",
    nameEn: "50ml Falcon conical tube",
    category: "TOOL",
  },
  {
    id: "product-pilot-tips-1000ul",
    name: "Pipette tips 1000μL",
    nameEn: "Pipette tips 1000μL",
    category: "TOOL",
  },
  {
    id: "product-pilot-hplc-c18",
    name: "HPLC C18 column",
    nameEn: "HPLC C18 column",
    category: "EQUIPMENT",
  },
  {
    id: "product-pilot-dish-100mm",
    name: "Cell culture dish 100mm",
    nameEn: "Cell culture dish 100mm",
    category: "TOOL",
  },
  {
    id: "product-pilot-plate-96well",
    name: "96-well plate",
    nameEn: "96-well plate",
    category: "TOOL",
  },
  {
    id: "product-pilot-bsa-100g",
    name: "BSA powder 100g",
    nameEn: "BSA powder 100g",
    category: "REAGENT",
  },
  {
    id: "product-pilot-tris-buffer",
    name: "Tris-HCl buffer",
    nameEn: "Tris-HCl buffer",
    category: "REAGENT",
  },
  {
    id: "product-pilot-sds-running-buffer",
    name: "SDS-PAGE Running Buffer",
    nameEn: "SDS-PAGE Running Buffer",
    category: "REAGENT",
  },
];

/** Helper — typed set of pilot product ids for cleanup filters. */
export const PILOT_PRODUCT_IDS: readonly string[] =
  PILOT_PRODUCT_CATALOG.map((p) => p.id);

// ──────────────────────────────────────────────────────────
// Pilot vendor catalog — minimum fixture (1 vendor, 15 links)
//
// ADR-002 §11.20 — closes #P02-followup-pilot-vendor-catalog. Without
// at least one ProductVendor row per pilot product, every "견적 담기"
// click in the pilot tenant takes the vendor-pending branch (correct
// per §11.16, but a partial verification surface — vendor-present
// path is never exercised). Option 1 (single supplier across all 15
// products) gives the smallest agreement surface that still exercises
// the canonical "vendor wired, price known" code path end to end.
//
// Operator may adjust priceInKRW or layer multiple suppliers in a
// follow-up pass; the seed is idempotent so re-running with new
// values upserts cleanly.
// ──────────────────────────────────────────────────────────

export interface PilotVendorSpec {
  readonly id: string;
  readonly name: string;
  readonly nameEn: string;
  readonly email: string | null;
  readonly country: string;
  readonly currency: string;
  // #vendor-partnership-tier Phase 1 — 4단계 enum (string literal type 으로
  // pilot.ts 가 prisma client 의존하지 않도록 분리). pilot-seed.ts 가 forward.
  readonly partnershipTier: "DIRECT_PARTNER" | "VERIFIED" | "GENERAL" | "UNVERIFIED";
}

// #user-supplier-registration Phase 1 — Vendor seed 다양화.
//   호영님 사업 확장 1단계 정합 — 한국 시약 시장의 글로벌 제조사 + 국내 총판
//   다양화. 모든 email 이 .invalid placeholder (pilot tenant, no real outbound).
//   id prefix `vendor-pilot-*` (isVendorPilot 매칭).
//
// 글로벌 제조사: Thermo Fisher (US/USD)
// 국내 총판: 바이오마트 / 코아바이오텍 / 다인바이오 / 지니아텍 / 머크코리아 (KR/KRW)
export const PILOT_VENDOR_CATALOG: readonly PilotVendorSpec[] = [
  // 글로벌 제조사 — 본사 직거래 / MOU
  {
    id: "vendor-pilot-thermofisher",
    name: "Thermo Fisher Scientific",
    nameEn: "Thermo Fisher Scientific",
    email: "pilot+thermofisher@labaxis.invalid",
    country: "US",
    currency: "USD",
    partnershipTier: "DIRECT_PARTNER",
  },
  // 국내 총판/대리점 — 한국 시약 시장 정합 (호영님 분석). 정기 거래 = VERIFIED.
  {
    id: "vendor-pilot-biomart",
    name: "바이오마트",
    nameEn: "Biomart Korea",
    email: "pilot+biomart@labaxis.invalid",
    country: "KR",
    currency: "KRW",
    partnershipTier: "VERIFIED",
  },
  {
    id: "vendor-pilot-koabiotech",
    name: "코아바이오텍",
    nameEn: "Koa Biotech",
    email: "pilot+koabiotech@labaxis.invalid",
    country: "KR",
    currency: "KRW",
    partnershipTier: "VERIFIED",
  },
  {
    id: "vendor-pilot-dainbio",
    name: "다인바이오",
    nameEn: "Dain Bio",
    email: "pilot+dainbio@labaxis.invalid",
    country: "KR",
    currency: "KRW",
    partnershipTier: "VERIFIED",
  },
  {
    id: "vendor-pilot-giniatech",
    name: "지니아텍",
    nameEn: "Ginia Tech",
    email: "pilot+giniatech@labaxis.invalid",
    country: "KR",
    currency: "KRW",
    partnershipTier: "VERIFIED",
  },
  {
    id: "vendor-pilot-merckkorea",
    name: "머크코리아",
    nameEn: "Merck Korea",
    email: "pilot+merckkorea@labaxis.invalid",
    country: "KR",
    currency: "KRW",
    partnershipTier: "VERIFIED",
  },
];

/** Helper — typed set of pilot vendor ids for cleanup. */
export const PILOT_VENDOR_IDS: readonly string[] =
  PILOT_VENDOR_CATALOG.map((v) => v.id);

// ──────────────────────────────────────────────────────────
// #pilot-organization-vendor-seed-missing — Pilot OrganizationVendor 매핑
//
// PILOT_VENDOR_CATALOG 가 Vendor 테이블에는 들어가지만 settings/suppliers
// UI 는 OrganizationVendor scoped fetch — pilot 6 vendor 가 호영님 org 에
// 매핑되지 않아 노출 0 인 마찰 (M1, Chrome audit 2026-05-09) 차단.
//
// schema lock:
//   - OrganizationVendor.organization onDelete: Cascade (org 삭제 시 자동
//     정리 — pilot-cleanup 별도 op 불필요).
//   - @@unique([organizationId, vendorEmail]) — re-run idempotent.
//   - vendorId 는 Vendor row 와 link (optional, 단 catalog matching path
//     활성화 위해 항상 wire).
//   - createdById 는 PILOT_OWNER_USER_ID (audit, FK).
// ──────────────────────────────────────────────────────────

export interface PilotOrganizationVendorLinkSpec {
  readonly organizationId: string;
  readonly vendorId: string;
  readonly vendorName: string;
  readonly vendorEmail: string;
  readonly createdById: string;
  readonly partnershipTier: "DIRECT_PARTNER" | "VERIFIED" | "GENERAL" | "UNVERIFIED";
}

/**
 * 6 OrganizationVendor rows — one per PILOT_VENDOR_CATALOG entry, all
 * scoped to PILOT_ORG_ID. partnershipTier overlay 는 vendor baseline 과
 * 같은 값으로 시작 (operator 가 settings/suppliers 에서 override 가능).
 *
 * 정합 메모: vendorEmail 이 PILOT_VENDOR_CATALOG.email 과 1:1 — pilot vendor
 * 6 email 모두 unique `.invalid` placeholder 라 (organizationId, vendorEmail)
 * compound unique 충돌 0.
 */
export const PILOT_ORGANIZATION_VENDOR_LINKS: readonly PilotOrganizationVendorLinkSpec[] =
  PILOT_VENDOR_CATALOG.map((v) => ({
    organizationId: PILOT_ORG_ID,
    vendorId: v.id,
    vendorName: v.name,
    vendorEmail: v.email ?? `${v.id}@labaxis.invalid`,
    createdById: PILOT_OWNER_USER_ID,
    partnershipTier: v.partnershipTier,
  }));

export interface PilotProductVendorLinkSpec {
  readonly id: string; // ProductVendor.id (deterministic, idempotent upsert key)
  readonly productId: string;
  readonly vendorId: string;
  readonly priceInKRW: number;
  readonly stockStatus: string;
  readonly leadTime: number; // days
}

/**
 * 15 ProductVendor rows, one per pilot product, all pointing to the
 * sole pilot vendor. priceInKRW values are plausible Korean lab-supply
 * placeholders — operator may adjust without re-keying anything else.
 *
 * ProductVendor cascades on either Product or Vendor delete (schema
 * onDelete: Cascade on both relations), so cleanup never has to touch
 * ProductVendor directly — see buildPilotCleanupPlan().
 */
export const PILOT_PRODUCT_VENDOR_LINKS: readonly PilotProductVendorLinkSpec[] = [
  { id: "pv-pilot-ethanol-500ml",         productId: "product-pilot-ethanol-500ml",         vendorId: "vendor-pilot-thermofisher", priceInKRW:  35_000, stockStatus: "IN_STOCK", leadTime: 5 },
  { id: "pv-pilot-pbs-1l",                productId: "product-pilot-pbs-1l",                vendorId: "vendor-pilot-thermofisher", priceInKRW:  18_000, stockStatus: "IN_STOCK", leadTime: 5 },
  { id: "pv-pilot-dmem-500ml",            productId: "product-pilot-dmem-500ml",            vendorId: "vendor-pilot-thermofisher", priceInKRW:  42_000, stockStatus: "IN_STOCK", leadTime: 5 },
  { id: "pv-pilot-fbs-500ml",             productId: "product-pilot-fbs-500ml",             vendorId: "vendor-pilot-thermofisher", priceInKRW: 380_000, stockStatus: "IN_STOCK", leadTime: 5 },
  { id: "pv-pilot-antibody-gapdh",        productId: "product-pilot-antibody-gapdh",        vendorId: "vendor-pilot-thermofisher", priceInKRW: 250_000, stockStatus: "IN_STOCK", leadTime: 5 },
  { id: "pv-pilot-trypsin-100ml",         productId: "product-pilot-trypsin-100ml",         vendorId: "vendor-pilot-thermofisher", priceInKRW:  45_000, stockStatus: "IN_STOCK", leadTime: 5 },
  { id: "pv-pilot-filter-022",            productId: "product-pilot-filter-022",            vendorId: "vendor-pilot-thermofisher", priceInKRW:  95_000, stockStatus: "IN_STOCK", leadTime: 5 },
  { id: "pv-pilot-falcon-50ml",           productId: "product-pilot-falcon-50ml",           vendorId: "vendor-pilot-thermofisher", priceInKRW:  80_000, stockStatus: "IN_STOCK", leadTime: 5 },
  { id: "pv-pilot-tips-1000ul",           productId: "product-pilot-tips-1000ul",           vendorId: "vendor-pilot-thermofisher", priceInKRW:  60_000, stockStatus: "IN_STOCK", leadTime: 5 },
  { id: "pv-pilot-hplc-c18",              productId: "product-pilot-hplc-c18",              vendorId: "vendor-pilot-thermofisher", priceInKRW: 850_000, stockStatus: "IN_STOCK", leadTime: 5 },
  { id: "pv-pilot-dish-100mm",            productId: "product-pilot-dish-100mm",            vendorId: "vendor-pilot-thermofisher", priceInKRW: 120_000, stockStatus: "IN_STOCK", leadTime: 5 },
  { id: "pv-pilot-plate-96well",          productId: "product-pilot-plate-96well",          vendorId: "vendor-pilot-thermofisher", priceInKRW: 140_000, stockStatus: "IN_STOCK", leadTime: 5 },
  { id: "pv-pilot-bsa-100g",              productId: "product-pilot-bsa-100g",              vendorId: "vendor-pilot-thermofisher", priceInKRW: 180_000, stockStatus: "IN_STOCK", leadTime: 5 },
  { id: "pv-pilot-tris-buffer",           productId: "product-pilot-tris-buffer",           vendorId: "vendor-pilot-thermofisher", priceInKRW:  25_000, stockStatus: "IN_STOCK", leadTime: 5 },
  { id: "pv-pilot-sds-running-buffer",    productId: "product-pilot-sds-running-buffer",    vendorId: "vendor-pilot-thermofisher", priceInKRW:  22_000, stockStatus: "IN_STOCK", leadTime: 5 },
];

// ──────────────────────────────────────────────────────────
// §11.178 — Pilot Quote 카탈로그 (1건 — RFQ/quote 진입 surface 활성화)
//
// Quote.organizationId 는 onDelete: SetNull 이라 org 삭제 시 orphan 됨.
// pilot-cleanup 에서 quote 별도 cleanup 필요 (PilotCleanupOperation 에 추가).
// ──────────────────────────────────────────────────────────

export interface PilotQuoteSpec {
  readonly id: string;
  readonly title: string;
  readonly status: "PENDING" | "REPLIED" | "REVIEW_REQUIRED" | "READY_FOR_PO" | "COMPLETED";
  readonly currency: string;
  readonly totalAmount: number;
  readonly description: string;
}

export const PILOT_QUOTE_CATALOG: readonly PilotQuoteSpec[] = [
  {
    id: "quote-pilot-cell-culture-starter",
    title: "Cell Culture Starter Pack — DMEM/FBS/Trypsin",
    status: "PENDING",
    currency: "KRW",
    totalAmount: 320_000,
    description: "세포 배양 시작 키트 시드 견적 (DMEM 500ml + FBS 500ml + Trypsin-EDTA 100ml)",
  },
];

export const PILOT_QUOTE_IDS: readonly string[] =
  PILOT_QUOTE_CATALOG.map((q) => q.id);

// ──────────────────────────────────────────────────────────
// §11.178 — Pilot Inventory 카탈로그 (3건 — 재고 진입 surface 활성화)
//
// ProductInventory.organizationId 는 onDelete: Cascade 라 org 삭제 시
// 자동 cleanup. cleanup operation 별도 등록 불필요.
// ──────────────────────────────────────────────────────────

export interface PilotInventorySpec {
  readonly id: string;
  readonly productId: string;
  readonly currentQuantity: number;
  readonly unit: string;
  readonly safetyStock: number;
  readonly minOrderQty: number;
  readonly location: string;
  readonly lotNumber: string;
}

export const PILOT_INVENTORY_CATALOG: readonly PilotInventorySpec[] = [
  {
    id: "inv-pilot-dmem",
    productId: "product-pilot-dmem-500ml",
    currentQuantity: 5,
    unit: "bottle",
    safetyStock: 10,
    minOrderQty: 30,
    location: "Lab-A · Cold-4C",
    lotNumber: "LOT-DMEM-2026-04",
  },
  {
    id: "inv-pilot-fbs",
    productId: "product-pilot-fbs-500ml",
    currentQuantity: 40,
    unit: "bottle",
    safetyStock: 12,
    minOrderQty: 20,
    location: "Lab-A · Freezer-20C",
    lotNumber: "LOT-FBS-2026-04",
  },
  {
    id: "inv-pilot-trypsin",
    productId: "product-pilot-trypsin-100ml",
    currentQuantity: 0,
    unit: "bottle",
    safetyStock: 8,
    minOrderQty: 15,
    location: "Lab-A · Cold-4C",
    lotNumber: "LOT-TRY-2026-04",
  },
];

export const PILOT_INVENTORY_IDS: readonly string[] =
  PILOT_INVENTORY_CATALOG.map((i) => i.id);

// ──────────────────────────────────────────────────────────
// §11.178b — Pilot Order 카탈로그 (1건 — 발주/입고 surface 활성화)
//
// Order.quoteId 는 onDelete: Cascade 라 quote cleanup 으로 자동 삭제됨.
// cleanup operation 별도 등록 불필요 (PilotCleanupOperation 에 order model 0).
// orderNumber 는 deterministic 으로 고정 (re-run 시 conflict 0).
// ──────────────────────────────────────────────────────────

export interface PilotOrderSpec {
  readonly id: string;
  readonly quoteId: string;
  readonly orderNumber: string;
  readonly totalAmount: number;
  readonly status: "ORDERED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  readonly notes: string;
}

export const PILOT_ORDER_CATALOG: readonly PilotOrderSpec[] = [
  {
    id: "order-pilot-cell-culture-starter",
    quoteId: "quote-pilot-cell-culture-starter",
    orderNumber: "ORD-PILOT-2026-0001",
    totalAmount: 320_000,
    status: "ORDERED",
    notes: "Pilot order — Cell Culture Starter Pack (DMEM/FBS/Trypsin)",
  },
];

export const PILOT_ORDER_IDS: readonly string[] =
  PILOT_ORDER_CATALOG.map((o) => o.id);

// ──────────────────────────────────────────────────────────
// Cleanup plan — declarative, consumed by pilot-cleanup.ts
// ──────────────────────────────────────────────────────────

export type PilotModel =
  | "workspaceMember"
  | "organizationMember"
  | "workspace"
  | "organization"
  | "product"
  | "vendor"
  // §11.178 — Quote 는 SetNull on org delete → orphan 방지 위해 별도 cleanup
  | "quote";

/**
 * One cleanup operation. Deliberately models compound keys as a
 * separate field so the cleanup test can prove "no filter-based
 * delete ever runs" — see pilot-cleanup.test.ts in Phase 4.
 */
export type PilotCleanupOperation =
  | {
      readonly model: "workspaceMember";
      readonly where: {
        readonly workspaceId_userId: {
          readonly workspaceId: string;
          readonly userId: string;
        };
      };
    }
  | {
      readonly model: "organizationMember";
      readonly where: {
        readonly userId_organizationId: {
          readonly userId: string;
          readonly organizationId: string;
        };
      };
    }
  | {
      readonly model: "workspace";
      readonly where: { readonly id: string };
    }
  | {
      readonly model: "organization";
      readonly where: { readonly id: string };
    }
  | {
      readonly model: "product";
      readonly where: { readonly id: string };
    }
  | {
      readonly model: "vendor";
      readonly where: { readonly id: string };
    }
  // §11.178 — Quote cleanup (Order 는 quote cascade 로 자동 삭제, ProductInventory 는 org cascade)
  | {
      readonly model: "quote";
      readonly where: { readonly id: string };
    };

export interface PilotCleanupPlan {
  readonly operations: readonly PilotCleanupOperation[];
}

/**
 * Build the full pilot cleanup plan. Order matters:
 *
 *   1. WorkspaceMember   — drop pilot owner's workspace membership.
 *   2. OrganizationMember — drop pilot owner's org membership.
 *   3. Workspace         — delete the pilot workspace shell.
 *   4. Organization      — deleting the org cascades residual rows
 *                          (e.g., remaining OrganizationMember if any
 *                          got added out-of-band), but Quote /
 *                          ProductInventory are SetNull so they
 *                          survive — we do not rely on org cascade
 *                          for those.
 *   5. Products          — remove each pilot product by exact id,
 *                          one call per id. No deleteMany, no filter.
 *                          Product cascade from ProductInventory /
 *                          QuoteListItem / ProductVendor (onDelete:
 *                          Cascade) handles any downstream rows. So
 *                          most ProductVendor rows are gone after
 *                          step 5.
 *   6. Vendors           — remove each pilot vendor by exact id.
 *                          Vendor cascade picks up any ProductVendor
 *                          rows that survived step 5 (defensive — in
 *                          practice none, but it costs nothing).
 *                          Added in §11.20 with the vendor catalog.
 *
 * The pilot OWNER USER is intentionally NOT in this plan — the user
 * row is canonical. See PILOT_OWNER_PROTECTION.
 */
export function buildPilotCleanupPlan(
  /** Override for smoke-DB deviation (ADR-002 §11). Defaults to PILOT_OWNER_USER_ID. */
  ownerUserId: string = PILOT_OWNER_USER_ID,
): PilotCleanupPlan {
  const operations: PilotCleanupOperation[] = [
    {
      model: "workspaceMember",
      where: {
        workspaceId_userId: {
          workspaceId: PILOT_WORKSPACE_ID,
          userId: ownerUserId,
        },
      },
    },
    {
      model: "organizationMember",
      where: {
        userId_organizationId: {
          userId: ownerUserId,
          organizationId: PILOT_ORG_ID,
        },
      },
    },
    // §11.178 — Quote cleanup 우선 (org 삭제 시 SetNull 되어 orphan 됨, Order 는
    //          Quote cascade 로 자동 삭제). ProductInventory 는 org Cascade 로
    //          처리되므로 별도 op 불필요.
    ...PILOT_QUOTE_IDS.map(
      (id): PilotCleanupOperation => ({
        model: "quote",
        where: { id },
      }),
    ),
    {
      model: "workspace",
      where: { id: PILOT_WORKSPACE_ID },
    },
    {
      model: "organization",
      where: { id: PILOT_ORG_ID },
    },
    ...PILOT_PRODUCT_IDS.map(
      (id): PilotCleanupOperation => ({
        model: "product",
        where: { id },
      }),
    ),
    ...PILOT_VENDOR_IDS.map(
      (id): PilotCleanupOperation => ({
        model: "vendor",
        where: { id },
      }),
    ),
  ];
  return { operations };
}
