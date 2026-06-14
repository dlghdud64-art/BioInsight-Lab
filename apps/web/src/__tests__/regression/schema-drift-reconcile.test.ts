/**
 * #schema-drift-reconcile — db push 로만 prod 반영된 drift 를 정식 migration 으로 baseline.
 * drift: OrganizationVendor / OrganizationVendorProduct / VendorPartnershipTier(enum)
 *        / Vendor.partnershipTier / OrganizationMember.workflowCapabilities.
 * GREEN 목표: 위 객체가 migration 파일에 등장 + schema.prisma 정의 보존.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const WEB = join(__dirname, "..", "..", "..");
const read = (rel: string): string => readFileSync(join(WEB, rel), "utf8");
const MIG = "prisma/migrations";
function migHas(re: RegExp): boolean {
  const dir = join(WEB, MIG);
  for (const d of readdirSync(dir)) {
    const sql = join(dir, d, "migration.sql");
    if (existsSync(sql) && re.test(readFileSync(sql, "utf8"))) return true;
  }
  return false;
}

describe("#schema-drift-reconcile — migration baseline (GREEN)", () => {
  it("CREATE TYPE VendorPartnershipTier", () => {
    expect(migHas(/CREATE TYPE\s+"?VendorPartnershipTier"?/)).toBe(true);
  });
  it("CREATE TABLE OrganizationVendor", () => {
    expect(migHas(/CREATE TABLE\s+(IF NOT EXISTS\s+)?"?OrganizationVendor"?\s*\(/)).toBe(true);
  });
  it("CREATE TABLE OrganizationVendorProduct", () => {
    expect(migHas(/CREATE TABLE\s+(IF NOT EXISTS\s+)?"?OrganizationVendorProduct"?\s*\(/)).toBe(true);
  });
  it("Vendor.partnershipTier 컬럼 add", () => {
    expect(migHas(/ALTER TABLE\s+"?Vendor"?\s+ADD COLUMN\s+"?partnershipTier"?/)).toBe(true);
  });
  it("OrganizationMember.workflowCapabilities 컬럼 add", () => {
    expect(migHas(/ADD COLUMN\s+"?workflowCapabilities"?/)).toBe(true);
  });
});

describe("#schema-drift-reconcile — schema 보존 (회귀)", () => {
  it("schema.prisma 에 OrganizationVendor 모델 유지", () => {
    expect(read("prisma/schema.prisma")).toContain("model OrganizationVendor {");
  });
  it("schema.prisma 에 enum VendorPartnershipTier 유지", () => {
    expect(read("prisma/schema.prisma")).toContain("enum VendorPartnershipTier {");
  });
});
