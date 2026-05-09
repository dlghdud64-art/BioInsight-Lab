/**
 * #vendor-partnership-tier Phase 1 — RED test
 *
 * Goal: Vendor + OrganizationVendor 에 partnership tier (4단계 enum) 추가.
 *       overlay pattern (Vendor 글로벌 baseline + OrganizationVendor 조직 override).
 *       PILOT_VENDOR_CATALOG seed 의 6 vendor 에 tier 부여.
 *
 * canonical truth lock:
 *   - VendorPartnershipTier enum: DIRECT_PARTNER / VERIFIED / GENERAL / UNVERIFIED.
 *   - Vendor.partnershipTier (글로벌 baseline, default GENERAL).
 *   - OrganizationVendor.partnershipTier (조직 override, nullable — null 시
 *     Vendor.partnershipTier 사용).
 *   - PILOT_VENDOR_CATALOG seed 의 6 vendor 모두 partnershipTier 정의:
 *     - Thermo Fisher → DIRECT_PARTNER (호영님 사업 확장 strategy 정합)
 *     - 한국 총판 5 (바이오마트 / 코아바이오텍 / 다인바이오 / 지니아텍 / 머크코리아)
 *       → VERIFIED
 *
 * 호영님 6 결정 (권장안 그대로):
 *   1.A 4단계 enum
 *   2.C overlay (Vendor + OrganizationVendor)
 *   3.A Prisma enum
 *   4.A settings/suppliers 흡수 (Phase 2)
 *   5.A confidence boost (Phase 3)
 *   6.A → B → C 분리 land
 *
 * Phase 1 scope: schema + seed 만. UI / ranking 은 Phase 2/3 별도.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCHEMA_PATH = resolve(__dirname, "../../../prisma/schema.prisma");
const PILOT_PATH = resolve(__dirname, "../../../scripts/pilot/pilot.ts");

const schema = readFileSync(SCHEMA_PATH, "utf8");
const pilot = readFileSync(PILOT_PATH, "utf8");

describe("#vendor-partnership-tier — schema enum", () => {
  it("VendorPartnershipTier enum 정의 존재", () => {
    expect(schema).toMatch(/enum\s+VendorPartnershipTier\s*\{/);
  });

  it("4 enum value — DIRECT_PARTNER / VERIFIED / GENERAL / UNVERIFIED", () => {
    expect(schema).toMatch(/DIRECT_PARTNER/);
    expect(schema).toMatch(/VERIFIED/);
    expect(schema).toMatch(/GENERAL/);
    expect(schema).toMatch(/UNVERIFIED/);
  });
});

describe("#vendor-partnership-tier — Vendor.partnershipTier (글로벌 baseline)", () => {
  it("Vendor model 안에 partnershipTier VendorPartnershipTier 필드", () => {
    // schema 안 model Vendor { ... partnershipTier VendorPartnershipTier ... }
    const vendorBlock = schema.match(/model\s+Vendor\s*\{[\s\S]*?\n\}/);
    expect(vendorBlock).toBeTruthy();
    expect(vendorBlock?.[0]).toMatch(/partnershipTier\s+VendorPartnershipTier/);
  });

  it("Vendor.partnershipTier 의 default 값 GENERAL", () => {
    const vendorBlock = schema.match(/model\s+Vendor\s*\{[\s\S]*?\n\}/);
    expect(vendorBlock?.[0]).toMatch(/partnershipTier\s+VendorPartnershipTier[\s\S]*?@default\(GENERAL\)/);
  });
});

describe("#vendor-partnership-tier — OrganizationVendor.partnershipTier (조직 override)", () => {
  it("OrganizationVendor model 안에 partnershipTier 필드 (nullable)", () => {
    const ovBlock = schema.match(/model\s+OrganizationVendor\s*\{[\s\S]*?\n\}/);
    expect(ovBlock).toBeTruthy();
    expect(ovBlock?.[0]).toMatch(/partnershipTier\s+VendorPartnershipTier\?/);
  });
});

describe("#vendor-partnership-tier — PilotVendorSpec interface", () => {
  it("PilotVendorSpec 에 partnershipTier 필드 (optional 또는 required)", () => {
    expect(pilot).toMatch(/partnershipTier/);
  });
});

describe("#vendor-partnership-tier — PILOT_VENDOR_CATALOG seed tier 부여", () => {
  it("Thermo Fisher → DIRECT_PARTNER", () => {
    // vendor-pilot-thermofisher 가 DIRECT_PARTNER tier
    const thermoBlock = pilot.match(/vendor-pilot-thermofisher[\s\S]{0,500}\}/);
    expect(thermoBlock?.[0]).toMatch(/partnershipTier:\s*["']?DIRECT_PARTNER["']?/);
  });

  it("바이오마트 (biomart) → VERIFIED", () => {
    const biomartBlock = pilot.match(/vendor-pilot-biomart[\s\S]{0,500}\}/);
    expect(biomartBlock?.[0]).toMatch(/partnershipTier:\s*["']?VERIFIED["']?/);
  });

  it("코아바이오텍 (koabiotech) → VERIFIED", () => {
    const koaBlock = pilot.match(/vendor-pilot-koabiotech[\s\S]{0,500}\}/);
    expect(koaBlock?.[0]).toMatch(/partnershipTier:\s*["']?VERIFIED["']?/);
  });

  it("다인바이오 (dainbio) → VERIFIED", () => {
    const dainBlock = pilot.match(/vendor-pilot-dainbio[\s\S]{0,500}\}/);
    expect(dainBlock?.[0]).toMatch(/partnershipTier:\s*["']?VERIFIED["']?/);
  });

  it("지니아텍 (giniatech) → VERIFIED", () => {
    const giniaBlock = pilot.match(/vendor-pilot-giniatech[\s\S]{0,500}\}/);
    expect(giniaBlock?.[0]).toMatch(/partnershipTier:\s*["']?VERIFIED["']?/);
  });

  it("머크코리아 (merckkorea) → VERIFIED", () => {
    const merckBlock = pilot.match(/vendor-pilot-merckkorea[\s\S]{0,500}\}/);
    expect(merckBlock?.[0]).toMatch(/partnershipTier:\s*["']?VERIFIED["']?/);
  });
});

describe("#vendor-partnership-tier — pilot-seed.ts upsert 정합", () => {
  it("vendor.upsert 의 create 에 partnershipTier forward", () => {
    const seedSrc = readFileSync(resolve(__dirname, "../../../scripts/pilot/pilot-seed.ts"), "utf8");
    // upsert create 안에 partnershipTier: spec.partnershipTier 매칭
    expect(seedSrc).toMatch(/partnershipTier:\s*spec\.partnershipTier/);
  });
});
