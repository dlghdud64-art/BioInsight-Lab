/**
 * #user-supplier-registration Phase 1 RED — Vendor seed 다양화
 *
 * Goal: 한국 시약 시장 정합 — 글로벌 제조사 1 vendor (Thermo Fisher) 외에
 *       국내 총판 5~10 vendor 추가 seed.
 *
 * canonical truth lock:
 *   - 한국 총판 vendor 후보: 바이오마트, 코아바이오텍, 다인바이오, 지니아텍 등.
 *   - country: "KR" + currency: "KRW".
 *   - email: `.invalid` placeholder (pilot tenant — #vendor-email-seed-pilot 정합).
 *   - id prefix: `vendor-pilot-{slug}` (isVendorPilot 매칭).
 */

import { describe, it, expect } from "vitest";
import { PILOT_VENDOR_CATALOG } from "@/../scripts/pilot/pilot";

describe("#user-supplier-registration — Vendor seed 다양화", () => {
  it("최소 6 vendor (Thermo Fisher 1 + 한국 총판 5+)", () => {
    expect(PILOT_VENDOR_CATALOG.length).toBeGreaterThanOrEqual(6);
  });

  it("한국 총판 (KR + KRW) vendor 5+ 포함", () => {
    const krVendors = PILOT_VENDOR_CATALOG.filter(
      (v) => v.country === "KR" && v.currency === "KRW",
    );
    expect(krVendors.length).toBeGreaterThanOrEqual(5);
  });

  it("바이오마트 vendor 포함", () => {
    const biomart = PILOT_VENDOR_CATALOG.find((v) => v.id.includes("biomart"));
    expect(biomart, "바이오마트 vendor seed 부재").toBeDefined();
    expect(biomart?.country).toBe("KR");
  });

  it("코아바이오텍 (또는 koabiotech) vendor 포함", () => {
    const koa = PILOT_VENDOR_CATALOG.find((v) => v.id.includes("koa"));
    expect(koa, "코아바이오텍 vendor seed 부재").toBeDefined();
  });

  it("다인바이오 vendor 포함", () => {
    const dain = PILOT_VENDOR_CATALOG.find((v) => v.id.includes("dain") || v.id.includes("dainbio"));
    expect(dain, "다인바이오 vendor seed 부재").toBeDefined();
  });

  it("지니아텍 (또는 ginia) vendor 포함", () => {
    const ginia = PILOT_VENDOR_CATALOG.find((v) => v.id.includes("ginia"));
    expect(ginia, "지니아텍 vendor seed 부재").toBeDefined();
  });

  it("모든 vendor 가 .invalid TLD email (pilot 정합)", () => {
    for (const v of PILOT_VENDOR_CATALOG) {
      if (!v.email) continue;
      expect(v.email, `Vendor ${v.id} email`).toMatch(/\.invalid$/);
    }
  });

  it("모든 vendor id 가 `vendor-pilot-` prefix (isVendorPilot 매칭)", () => {
    for (const v of PILOT_VENDOR_CATALOG) {
      expect(v.id, `Vendor ${v.id} id`).toMatch(/^vendor-pilot-/);
    }
  });
});
