/**
 * §11.348-SEND-A → §inbound-rfq-autocapture P1 (진화) — 견적 발송 reply-to sentinel
 *
 * A 원칙(불변): LabAxis = 발송 도구, 회신 유실 0. from=noreply 라도 reply-to 로 회신을 회수.
 * 진화(호영님 2026-06-18 승인): reply-to 를 요청자 이메일(직접수신)에서 자동수신 주소
 *   rfq+<token>@inbound.<domain> 로 전환 → 공급사 회신이 LabAxis 로 집약(QuoteReply).
 *   enabled=false(opt-out) 시에만 요청자 직접수신 폴백 보존. "유실 0"은 유지·강화.
 *
 * 문자열 매칭은 toContain (esbuild ts-loader 모호성 회피).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const SENDER = "src/lib/email/sender.ts";
const ROUTE = "src/app/api/quotes/[id]/vendor-requests/route.ts";

describe("§11.348-SEND-A — sender.ts replyTo 지원", () => {
  it("EmailOptions 에 replyTo 필드", () => {
    const src = read(SENDER);
    expect(src).toContain("replyTo?: string;");
  });
  it("resend.emails.send 에 replyTo 전달(있을 때만)", () => {
    const src = read(SENDER);
    expect(src).toContain("options.replyTo ? { replyTo: options.replyTo } : {}");
  });
});

describe("§inbound-rfq-autocapture P1 — vendor-requests reply-to 자동수신 전환", () => {
  it("sendEmail 호출의 replyTo = rfq 자동수신 주소(rfqReplyAddress)", () => {
    const src = read(ROUTE);
    expect(src).toContain("replyTo: rfqReplyAddress");
  });
  it("발송 전 quote당 RFQ 토큰 보장 + 주소 빌더 사용", () => {
    const src = read(ROUTE);
    expect(src).toContain("ensureRfqToken(id)");
    expect(src).toContain("buildRfqReplyAddress(rfqToken)");
  });
  it("enabled→시스템 집약 / opt-out→요청자 직접수신 폴백(유실 0 보존)", () => {
    const src = read(ROUTE);
    expect(src).toContain("rfqEnabled");
    expect(src).toContain("session?.user?.email ?? undefined");
  });
});

describe("§11.348-SEND-A 회귀 0 — 발송 인프라 보존", () => {
  it("Resend send + from(EMAIL_FROM) + pilot 보호 보존", () => {
    const src = read(SENDER);
    expect(src).toContain("resend.emails.send");
    expect(src).toContain('process.env.EMAIL_FROM ?? "noreply@labaxis.co.kr"');
    expect(src).toContain("isVendorPilot(options.vendorId)");
  });
  it("vendor-requests sendEmail wiring(to/subject/vendorId) 보존", () => {
    const src = read(ROUTE);
    expect(src).toContain("to: vendor.email");
    expect(src).toContain("vendorId: vendor.id");
  });
});
