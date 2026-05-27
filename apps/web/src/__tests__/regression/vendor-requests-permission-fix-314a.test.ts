/**
 * §11.314-a #vendor-requests-permission-fix — Regression sentinel
 *
 * 호영님 §11.308 확인요청 → root cause + fix (옵션 A, 2026-05-27):
 *   견적 전송 "견적 요청 실패" = vendor-requests route 가 action
 *   'quote_request_resend'(buyer/ops_admin only) 하드코딩 → requester
 *   (연구원) 403.
 *   fix: 첫 발송 = quote_request_submit (requester 허용),
 *        isReminder=true = quote_request_resend (재발송 거버넌스 유지).
 *
 * 보안 유지:
 *   - checkQuoteAccess (3-source priority) 보존
 *   - enforceAction lock (complete/fail) 보존
 *   - vendor email 도메인 검증 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PATH = "src/app/api/quotes/[id]/vendor-requests/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.314-a — 견적 전송 권한 fix (isReminder 분기)", () => {
  it("action 이 isReminder 분기 (submit / resend)", () => {
    const src = read(PATH);
    expect(src).toMatch(/action:\s*isReminder\s*\?\s*'quote_request_resend'\s*:\s*'quote_request_submit'/);
  });

  it("action 'quote_request_resend' 하드코딩 0 (이전 버그 패턴)", () => {
    const src = read(PATH);
    // 하드코딩된 action: 'quote_request_resend' (분기 아닌 단독) 0
    expect(src).not.toMatch(/action:\s*'quote_request_resend',/);
  });

  it("body parse 가 enforceAction 앞에 위치 (isReminder 추출 후 action 결정)", () => {
    const src = read(PATH);
    const bodyParseIdx = src.indexOf("const { vendors, message, expiresInDays, isReminder } = validation.data;");
    const enforceIdx = src.indexOf("enforcement = enforceAction({");
    expect(bodyParseIdx).toBeGreaterThan(0);
    expect(enforceIdx).toBeGreaterThan(0);
    expect(bodyParseIdx).toBeLessThan(enforceIdx);
  });
});

describe("§11.314-a — 보안/wiring 회귀 0", () => {
  it("enforceAction lock complete/fail 보존 (§11.305 와 달리 정상 해제)", () => {
    const src = read(PATH);
    expect(src).toMatch(/enforcement\.complete\(/);
    expect(src).toMatch(/enforcement\?\.fail\(\)/);
  });

  it("enforcement.deny() 분기 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/if\s*\(!enforcement\.allowed\)\s*return enforcement\.deny\(\)/);
  });

  it("checkQuoteAccess 3-source priority 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/quote\.userId === session\.user\.id/);
    expect(src).toMatch(/isOrgMember/);
    expect(src).toMatch(/quote\.guestKey/);
  });

  it("vendor email 도메인 검증 (INVALID_TLDS + bare IP) 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/INVALID_TLDS/);
    expect(src).toMatch(/BARE_IP_REGEX/);
  });

  it("CreateVendorRequestsSchema validation 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/CreateVendorRequestsSchema\.safeParse\(body\)/);
  });

  it("sendEmail + successCount > 0 시 status SENT 전환 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/sendEmail\(/);
    expect(src).toMatch(/successCount > 0 && quote\.status === "PENDING"/);
    expect(src).toMatch(/status:\s*"SENT"/);
  });

  it("§11.228b isReminder cooldown (24h) 분기 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/REMINDER_COOLDOWN/);
    expect(src).toMatch(/isReminder/);
  });
});
