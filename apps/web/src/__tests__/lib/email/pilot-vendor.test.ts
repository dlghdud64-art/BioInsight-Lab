/**
 * #vendor-email-seed-pilot — isVendorPilot helper unit test
 *
 * Goal: Vendor.id prefix `vendor-pilot-` 분기 정확 매칭.
 *       cuid() 자동 생성 ID 와 충돌 0.
 */

import { describe, it, expect } from "vitest";
import { isVendorPilot, PILOT_VENDOR_ID_PREFIX } from "@/lib/email/pilot-vendor";

describe("#vendor-email-seed-pilot — isVendorPilot helper", () => {
  it("PILOT_VENDOR_ID_PREFIX === 'vendor-pilot-'", () => {
    expect(PILOT_VENDOR_ID_PREFIX).toBe("vendor-pilot-");
  });

  it("vendor-pilot-thermofisher → true (pilot tenant seed)", () => {
    expect(isVendorPilot("vendor-pilot-thermofisher")).toBe(true);
  });

  it("vendor-pilot-sigma → true (다른 pilot row)", () => {
    expect(isVendorPilot("vendor-pilot-sigma")).toBe(true);
  });

  it("cuid() 형식 → false (cluuxxx... random)", () => {
    expect(isVendorPilot("clt2x9jik0001abc123")).toBe(false);
    expect(isVendorPilot("clpv0i9jb000508lpb6un9j5x")).toBe(false);
  });

  it("non-prefix → false (user-input vendor)", () => {
    expect(isVendorPilot("vendor-001")).toBe(false);
    expect(isVendorPilot("custom-vendor-pilot-fake")).toBe(false); // 중간에 prefix
    expect(isVendorPilot("Vendor-Pilot-Mixed-Case")).toBe(false); // 대소문자 구분
  });

  it("empty / null-like → false (defensive)", () => {
    expect(isVendorPilot("")).toBe(false);
    expect(isVendorPilot("vendor-pilot-")).toBe(true); // prefix 자체는 match (edge case)
  });
});
