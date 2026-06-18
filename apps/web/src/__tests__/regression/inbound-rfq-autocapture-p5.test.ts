/**
 * §inbound-rfq-autocapture P5 (PLAN_inbound-rfq-autocapture) — rollout gate + graceful(트랙 종결)
 *
 * cutover 안전: P1 reply-to 전환이 MX(inbound.labaxis.co.kr→SendGrid Parse) 준비 전 배포되면
 *   공급사 회신이 수신 불가 주소로 가서 유실 위험 → INBOUND_RFQ_ENABLED flag 로 게이트.
 *   - flag 미설정/false(기본): 직접수신(요청자 이메일) 유지 = 현행, 유실 0, 인프라 무관 무해.
 *   - 인프라 준비 후 flag on: 자동수신 활성.
 * graceful: inbound webhook 은 SENDGRID_INBOUND_SECRET 미설정/불일치 시 401 거부(아무 것도 처리 안 함).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const VR = read("app/api/quotes/[id]/vendor-requests/route.ts");
const ROUTE = read("app/api/inbound/sendgrid/[secret]/route.ts");

describe("§inbound-rfq-autocapture P5 — rollout gate(cutover 안전)", () => {
  it("INBOUND_RFQ_ENABLED flag — 기본 직접수신 유지(유실 0)", () => {
    expect(VR).toMatch(/process\.env\.INBOUND_RFQ_ENABLED === "true"/);
    expect(VR).toMatch(/let rfqReplyAddress: string \| undefined = session\?\.user\?\.email/);
  });
  it("flag on 일 때만 토큰 보장 + rfq 주소(인프라 미비 시 발송 무해)", () => {
    expect(VR).toMatch(/if \(autocaptureOn\)/);
    expect(VR).toMatch(/if \(rfqEnabled\) rfqReplyAddress = buildRfqReplyAddress\(rfqToken\)/);
  });
});

describe("§inbound-rfq-autocapture P5 — graceful(인프라 미비 무해)", () => {
  it("inbound webhook — secret 미설정/불일치 시 401 거부", () => {
    expect(ROUTE).toMatch(/SENDGRID_INBOUND_SECRET/);
    expect(ROUTE).toMatch(/!expectedSecret \|\| params\.secret !== expectedSecret/);
    expect(ROUTE).toMatch(/status: 401/);
  });
});
