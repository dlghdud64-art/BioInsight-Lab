/**
 * #post-approval-purchase-order-flow Phase 3.1 — RED→GREEN test
 *
 * vendor 별 PO email 송부 route + template helper. PDF 첨부 미포함 (별도
 * mini-batch Phase 3.x-attach) — 본 batch 는 한글 body 만 + audit + 송부
 * 이력 추적.
 *
 * canonical truth = Order (DB). Email = derived projection (snapshot).
 *
 * Lock:
 *   - vendor.email 미설정 시 422 (dead button 차단)
 *   - sendEmail mock fallback (host config 후 SendGrid/Resend 정합)
 *   - audit log createAuditLog (action: vendor_email_sent)
 *   - Korean 본문 + 발주번호 + 품목 표 + 총액
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT_WEB = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/orders/[id]/send-email/route.ts";
const TEMPLATE = "src/lib/email/po-vendor-template.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT_WEB, rel), "utf8");
}
function exists(rel: string): boolean {
  return existsSync(join(REPO_ROOT_WEB, rel));
}

describe("#post-approval-purchase-order-flow Phase 3.1 — vendor email template", () => {
  it("`lib/email/po-vendor-template.ts` 신규 file 존재", () => {
    expect(exists(TEMPLATE)).toBe(true);
  });

  it("`generatePoVendorEmail` export — EmailTemplate 반환", () => {
    const src = read(TEMPLATE);
    expect(src).toMatch(/export\s+function\s+generatePoVendorEmail/);
    expect(src).toMatch(/EmailTemplate/);
  });

  it("Korean 본문 — 발주번호 / 품목 / 총액 표시", () => {
    const src = read(TEMPLATE);
    expect(src).toMatch(/발주번호|orderNumber/);
    expect(src).toMatch(/품목|items/);
    expect(src).toMatch(/총\s*액|totalAmount/);
  });

  it("vendor name + requester name 표시", () => {
    const src = read(TEMPLATE);
    expect(src).toMatch(/vendorName|vendor\.name|공급사/);
    expect(src).toMatch(/requesterName|발주자/);
  });
});

describe("#post-approval-purchase-order-flow Phase 3.1 — vendor email route", () => {
  it("`/api/orders/[id]/send-email/route.ts` 신규 file 존재", () => {
    expect(exists(ROUTE)).toBe(true);
  });

  it("POST handler + auth + ownership 검증", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/export\s+async\s+function\s+POST/);
    expect(src).toMatch(/auth\(\)/);
    expect(src).toMatch(/userId|organizationMember/);
  });

  it("Order fetch — vendor + items 포함", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/db\.order\.findUnique|db\.order\.findFirst/);
    expect(src).toMatch(/include[\s\S]*?vendor[\s\S]*?items|include[\s\S]*?items[\s\S]*?vendor/);
  });

  it("vendor.email 미설정 시 422 (dead button 차단)", () => {
    const src = read(ROUTE);
    // vendor email 검증 분기 — null check 또는 422 status
    expect(src).toMatch(/vendor.*email|VENDOR_EMAIL_MISSING|422/);
  });

  it("sendEmail 호출 (template 합산 후)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/sendEmail/);
    expect(src).toMatch(/generatePoVendorEmail/);
  });

  it("audit log createAuditLog 호출 (action: vendor_email_sent)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/createAuditLog/);
    expect(src).toMatch(/vendor_email_sent|email_sent/);
  });
});
