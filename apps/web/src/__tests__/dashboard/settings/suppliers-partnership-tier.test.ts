/**
 * #vendor-partnership-tier Phase 2 — RED test
 *
 * Goal: settings/suppliers UI badge + form select + API zod schema 확장.
 *       Phase 1 (schema + seed) 후속 — UI wiring.
 *
 * canonical truth lock:
 *   - settings/suppliers/page.tsx: VendorFormData 의 partnershipTier 필드 +
 *     form select element + list view badge (4 tone).
 *   - POST /api/organization-vendors: zod schema 에 partnershipTier (optional).
 *   - PATCH /api/organization-vendors/[id]: zod schema 에 partnershipTier (optional).
 *   - 기존 isPrimary / notes / vendorPhone field 보존.
 *
 * Phase 3 (resolveSuppliers ranking) 별도 — Out of scope.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/settings/suppliers/page.tsx");
const POST_PATH = resolve(__dirname, "../../../app/api/organization-vendors/route.ts");
const PATCH_PATH = resolve(__dirname, "../../../app/api/organization-vendors/[id]/route.ts");

const pageSrc = readFileSync(PAGE_PATH, "utf8");
const postSrc = readFileSync(POST_PATH, "utf8");
const patchSrc = readFileSync(PATCH_PATH, "utf8");

describe("#vendor-partnership-tier Phase 2 — settings/suppliers/page.tsx", () => {
  it("VendorFormData / OrganizationVendor type 에 partnershipTier 필드", () => {
    expect(pageSrc).toMatch(/partnershipTier/);
  });

  it("4 tier 라벨 한국어 매핑 — 직접 파트너 / 검증 거래 / 일반 / 미검증", () => {
    // PARTNERSHIP_TIER_LABEL 또는 inline mapping
    expect(pageSrc).toMatch(/직접 파트너|DIRECT_PARTNER/);
    expect(pageSrc).toMatch(/검증 거래|VERIFIED|검증/);
    expect(pageSrc).toMatch(/일반|GENERAL/);
    expect(pageSrc).toMatch(/미검증|UNVERIFIED/);
  });

  it("Form select element — partnershipTier 4 옵션", () => {
    // <select> 또는 shadcn Select with partnershipTier value
    expect(pageSrc).toMatch(/partnershipTier[\s\S]{0,200}(select|Select|option)/i);
  });

  it("List view badge — 4 tone 매핑 (violet/green/gray/amber 또는 동등)", () => {
    // tier 별 className 또는 tone matching — 4 tier 모두 distinct 표시
    expect(pageSrc).toMatch(/PARTNERSHIP_TIER_(LABEL|TONE|BADGE)|partnershipTier.*Badge/);
  });

  it("Mutation body 에 partnershipTier forward", () => {
    // POST/PATCH body 에 partnershipTier 포함
    expect(pageSrc).toMatch(/partnershipTier:\s*(input\.partnershipTier|formData\.partnershipTier|data\.partnershipTier)/);
  });

  it("기존 isPrimary / notes / vendorPhone 보존", () => {
    expect(pageSrc).toMatch(/isPrimary/);
    expect(pageSrc).toMatch(/notes/);
    expect(pageSrc).toMatch(/vendorPhone/);
  });

  it("#vendor-partnership-tier marker", () => {
    expect(pageSrc).toMatch(/#vendor-partnership-tier|partnershipTier/i);
  });
});

describe("#vendor-partnership-tier Phase 2 — POST /api/organization-vendors", () => {
  it("CreateOrganizationVendorSchema 에 partnershipTier (optional enum)", () => {
    // z.enum([..]) 또는 z.string() with optional/nullish
    expect(postSrc).toMatch(/partnershipTier:\s*z\.(enum|string)/);
  });

  it("DB create data 에 partnershipTier forward", () => {
    expect(postSrc).toMatch(/partnershipTier:\s*(data\.partnershipTier|parsed\.data\.partnershipTier)/);
  });

  it("GET select 에 partnershipTier 포함", () => {
    expect(postSrc).toMatch(/partnershipTier:\s*true/);
  });
});

describe("#vendor-partnership-tier Phase 2 — PATCH /api/organization-vendors/[id]", () => {
  it("UpdateOrganizationVendorSchema 에 partnershipTier (optional)", () => {
    expect(patchSrc).toMatch(/partnershipTier:\s*z\.(enum|string)/);
  });

  it("DB update data 에 partnershipTier forward", () => {
    expect(patchSrc).toMatch(/partnershipTier/);
  });
});
