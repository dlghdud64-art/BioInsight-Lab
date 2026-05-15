/**
 * §11.229c #vendor-email-domain-validation — 호영님 P0 견적 #229 잔여 백로그
 *
 * 호영님 spec: vendor.email 도메인 검증 강화 — RFC 5322 기본 검증 외에
 *   (a) TLD blacklist: .test/.invalid/.example/.localhost (RFC 6761 invalid)
 *   (b) bare IP 주소 차단: user@127.0.0.1 등
 *
 * 현재 상태 (Phase 0 audit):
 *   - VendorSchema.email = z.string().email("Invalid email address") (line 29)
 *   - RFC 5322 기본 검증만 적용 — TLD blacklist + bare IP 통과
 *
 * canonical truth lock:
 *   - z.email() 기본 검증 보존 (chain add only)
 *   - VendorSchema name/id optional 보존
 *   - vendors: z.array(VendorSchema).min(1) 보존
 *   - CreateVendorRequestsSchema isReminder/expiresInDays/message 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE_PATH = resolve(
  __dirname,
  "../../../app/api/quotes/[id]/vendor-requests/route.ts",
);
const route = readFileSync(ROUTE_PATH, "utf8");

describe("§11.229c #1 — TLD blacklist 상수 + bare IP regex", () => {
  it("INVALID_TLDS set 또는 array (test/invalid/example/localhost)", () => {
    expect(route).toMatch(/INVALID_TLDS[\s\S]{0,300}(test|invalid|example|localhost)/);
    // RFC 6761 4 TLD 모두 포함
    expect(route).toMatch(/test/);
    expect(route).toMatch(/invalid/);
    expect(route).toMatch(/example/);
    expect(route).toMatch(/localhost/);
  });

  it("BARE_IP_REGEX (\\d+\\.\\d+\\.\\d+\\.\\d+ pattern)", () => {
    expect(route).toMatch(/BARE_IP_REGEX[\s\S]{0,200}\\d\+\\\.\\d\+/);
  });
});

describe("§11.229c #2 — VendorSchema.email .refine() chain 적용", () => {
  it("z.string().email() 뒤 .refine 1+ chain", () => {
    expect(route).toMatch(/email:\s*z\.string\(\)\s*\.email\([\s\S]{0,200}\)\s*\.refine/);
  });

  it("TLD blacklist refine — INVALID_TLDS.has 체크", () => {
    expect(route).toMatch(/INVALID_TLDS\.has/);
  });

  it("bare IP refine — BARE_IP_REGEX.test 체크", () => {
    expect(route).toMatch(/BARE_IP_REGEX\.test/);
  });

  it("refine error message (한국어 사용자 안내)", () => {
    // 테스트/예제 도메인 또는 IP 주소 사용 불가 메시지
    expect(route).toMatch(/(테스트|예제|도메인|IP\s*주소)/);
  });
});

describe("§11.229c #3 — invariant 보존", () => {
  it("VendorSchema name/id optional 보존", () => {
    expect(route).toMatch(/name:\s*z\.string\(\)\.optional/);
    expect(route).toMatch(/id:\s*z\.string\(\)\.optional/);
  });

  it("vendors array min(1) 보존", () => {
    expect(route).toMatch(/vendors:\s*z\.array\(VendorSchema\)\.min\(1/);
  });

  it("CreateVendorRequestsSchema isReminder/expiresInDays/message 보존 (§11.228b lineage)", () => {
    expect(route).toMatch(/isReminder:\s*z\.boolean/);
    expect(route).toMatch(/expiresInDays/);
    expect(route).toMatch(/message:\s*z\.string\(\)\.optional/);
  });

  it("§11.229c trace marker comment", () => {
    expect(route).toMatch(/§11\.229c[\s\S]{0,300}(domain|email|TLD|IP|validation|도메인)/i);
  });
});
