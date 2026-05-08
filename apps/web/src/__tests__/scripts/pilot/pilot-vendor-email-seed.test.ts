/**
 * #vendor-email-seed-pilot — PILOT_VENDOR_CATALOG email RFC 2606 `.invalid`
 * placeholder regression guard.
 *
 * Goal: pilot vendor email 이 null 이 아닌 fake `.invalid` domain 으로
 *       채워졌는지 검증. real domain (thermofisher.com 등) 차단.
 *
 * design intent: "no real outbound mail" — `.invalid` TLD 가 RFC 2606 가
 * 정의한 placeholder, SMTP 자동 fail.
 */

import { describe, it, expect } from "vitest";
import { PILOT_VENDOR_CATALOG } from "@/../scripts/pilot/pilot";

describe("#vendor-email-seed-pilot — PILOT_VENDOR_CATALOG email seed", () => {
  it("모든 pilot vendor 가 email 보유 (null 아님)", () => {
    for (const vendor of PILOT_VENDOR_CATALOG) {
      expect(vendor.email, `Vendor ${vendor.id} email`).not.toBeNull();
    }
  });

  it("모든 pilot vendor email 이 `.invalid` TLD (RFC 2606 placeholder)", () => {
    for (const vendor of PILOT_VENDOR_CATALOG) {
      if (!vendor.email) continue;
      expect(vendor.email, `Vendor ${vendor.id} email`).toMatch(/\.invalid$/);
    }
  });

  it("모든 pilot vendor email 이 labaxis 도메인 prefix (operator clarity)", () => {
    for (const vendor of PILOT_VENDOR_CATALOG) {
      if (!vendor.email) continue;
      // labaxis.invalid 또는 labaxis-pilot.invalid 같은 organization marker
      expect(vendor.email, `Vendor ${vendor.id} domain`).toMatch(/labaxis/i);
    }
  });

  it("real vendor domain 차단 (thermofisher.com / sigmaaldrich.com / 등)", () => {
    const REAL_DOMAINS = [
      "thermofisher.com",
      "sigmaaldrich.com",
      "bio-rad.com",
      "corning.com",
      "welgene.com",
      "merck.com",
    ];
    for (const vendor of PILOT_VENDOR_CATALOG) {
      if (!vendor.email) continue;
      for (const realDomain of REAL_DOMAINS) {
        expect(vendor.email, `Vendor ${vendor.id} must not use ${realDomain}`).not.toContain(realDomain);
      }
    }
  });

  it("vendor.id prefix `vendor-pilot-` 정합 (isVendorPilot 매칭)", () => {
    for (const vendor of PILOT_VENDOR_CATALOG) {
      expect(vendor.id, `Vendor ${vendor.id} id`).toMatch(/^vendor-pilot-/);
    }
  });
});
