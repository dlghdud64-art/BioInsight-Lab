/**
 * §11.348-SEND-A (회귀) — 견적 요청 발송 reply-to(연구소/요청자) 명의 sentinel
 *
 * A 원칙: LabAxis = 발송 도구, 책임·관계는 연구소. 발송은 from=noreply@labaxis 라도
 * reply-to 를 요청자(연구소) 이메일로 두어 공급사 답장이 연구소로 가야 함.
 * (이전: replyTo 미설정 → 답장이 noreply 로 가서 유실 = A 원칙 위반.)
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

describe("§11.348-SEND-A — vendor-requests 가 요청자 이메일을 replyTo 로", () => {
  it("sendEmail 호출에 replyTo = 요청자(session) 이메일", () => {
    const src = read(ROUTE);
    expect(src).toContain("replyTo: session?.user?.email ?? undefined");
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
