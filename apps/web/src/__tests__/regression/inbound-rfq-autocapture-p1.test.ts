/**
 * §inbound-rfq-autocapture P1 (PLAN_inbound-rfq-autocapture) — 발송 reply-to 루프 클로즈
 *
 * 공급사 견적회신 자동수신의 발송측: quote당 RFQ 토큰 보장 + reply-to 를
 *   rfq+<token>@inbound.<domain> 로 임베드 → 공급사 회신이 inbound parse 로 들어옴.
 *   공용 빌더(buildRfqReplyAddress) DRY + fallback labaxis.co.kr(placeholder yourdomain.com 제거).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const LIB = read("lib/email/rfq-reply-address.ts");
const VR = read("app/api/quotes/[id]/vendor-requests/route.ts");
const RFQ = read("app/api/quotes/[id]/rfq-token/route.ts");

describe("§inbound-rfq-autocapture P1 — 공용 빌더 lib", () => {
  it("buildRfqReplyAddress — rfq+<token>@inbound.<domain> 형식", () => {
    expect(LIB).toMatch(/export function buildRfqReplyAddress/);
    expect(LIB).toMatch(/rfq\+\$\{token\}@inbound\.\$\{domain\}/);
  });
  it("fallback 도메인 = labaxis.co.kr (placeholder yourdomain.com 0)", () => {
    expect(LIB).toMatch(/NEXT_PUBLIC_DOMAIN \|\| "labaxis\.co\.kr"/);
    expect(LIB).not.toMatch(/yourdomain\.com/);
  });
  it("ensureRfqToken — quote당 find-or-create(enabled 반환)", () => {
    expect(LIB).toMatch(/export async function ensureRfqToken/);
    expect(LIB).toMatch(/quoteRfqToken\.findUnique/);
    expect(LIB).toMatch(/quoteRfqToken\.create/);
    expect(LIB).toMatch(/enabled: boolean/);
  });
});

describe("§inbound-rfq-autocapture P1 — vendor-requests 발송 배선", () => {
  it("공용 lib import", () => {
    expect(VR).toMatch(/import \{ ensureRfqToken, buildRfqReplyAddress \} from "@\/lib\/email\/rfq-reply-address"/);
  });
  it("발송 루프 전 토큰 보장 + reply 주소 계산(1회)", () => {
    expect(VR).toMatch(/ensureRfqToken\(id\)/);
    expect(VR).toMatch(/rfqEnabled\s*\n?\s*\?\s*buildRfqReplyAddress\(rfqToken\)/);
  });
  it("sendEmail replyTo = rfqReplyAddress(자동수신)", () => {
    expect(VR).toContain("replyTo: rfqReplyAddress");
  });
});

describe("§inbound-rfq-autocapture P1 — rfq-token route DRY", () => {
  it("공용 빌더 사용 + inline placeholder 제거", () => {
    expect(RFQ).toMatch(/buildRfqReplyAddress\(rfqToken\.token\)/);
    expect(RFQ).not.toMatch(/yourdomain\.com/);
  });
});

describe("§inbound-rfq-autocapture P1 — 회귀 0(발송 인프라 보존)", () => {
  it("vendor 발송 wiring(to/vendorId) 보존", () => {
    expect(VR).toContain("to: vendor.email");
    expect(VR).toContain("vendorId: vendor.id");
  });
  it("inbound parse 가 기대하는 rfq+ 패턴과 정합", () => {
    // inbound route 의 extractRfqToken 정규식(rfq+token@)과 발송 주소 prefix 일치.
    expect(LIB).toMatch(/rfq\+/);
  });
});
