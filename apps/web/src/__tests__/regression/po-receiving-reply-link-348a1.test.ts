/**
 * §11.348-A-1 (회귀) — 발주 메일 입고 회신 링크 sentinel
 *
 * A-1: 발주(PO) 발송 시 ReceivingDraft(AWAITING_REPLY) get-or-create →
 * token 으로 입고 회신 링크 생성 → PO 메일에 CTA 주입. 공급사가 납품 시
 * LOT·납기·실수량을 우리 스키마로 회신(A-2 폼). reply-to = 발주자(A 원칙).
 *
 * 재사용: vendor-request-token(견적) + ReceivingDraft(A-3) + sendEmail/replyTo(SEND-A).
 * 문자열 매칭은 toContain (esbuild ts-loader 모호성 회피).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const ROUTE = "src/app/api/orders/[id]/send-email/route.ts";
const TEMPLATE = "src/lib/email/po-vendor-template.ts";

describe("§11.348-A-1 — send-email 이 ReceivingDraft get-or-create", () => {
  it("token 헬퍼 + receivingDraft create + AWAITING_REPLY", () => {
    const src = read(ROUTE);
    expect(src).toContain('from "@/lib/api/vendor-request-token"');
    expect(src).toContain("db.receivingDraft.findFirst");
    expect(src).toContain("db.receivingDraft.create");
    expect(src).toContain('status: "AWAITING_REPLY"');
    expect(src).toContain("generateVendorRequestToken()");
  });
  it("재발송 idempotent — 기존 미회신 draft token 재사용", () => {
    const src = read(ROUTE);
    expect(src).toContain('status: { in: ["AWAITING_REPLY", "PENDING_REVIEW"] }');
    expect(src).toContain("existingDraft?.token");
  });
  it("회신 링크 URL + 템플릿 인자 전달", () => {
    const src = read(ROUTE);
    expect(src).toContain("/receiving/${token}");
    expect(src).toContain("receivingReplyUrl,");
  });
  it("reply-to = 발주자(연구소) 이메일 (A 원칙, SEND-A 동형)", () => {
    const src = read(ROUTE);
    expect(src).toContain("replyTo: order.user?.email ?? undefined");
  });
});

describe("§11.348-A-1 — PO 템플릿 회신 CTA", () => {
  it("receivingReplyUrl 입력 + html/text CTA 조건부 렌더", () => {
    const src = read(TEMPLATE);
    expect(src).toContain("receivingReplyUrl?: string | null;");
    expect(src).toContain("const receivingReplyHtml = data.receivingReplyUrl");
    expect(src).toContain("const receivingReplyText = data.receivingReplyUrl");
    expect(src).toContain("입고 정보 입력하기");
    // 본문/텍스트에 실제 주입
    expect(src).toContain("${receivingReplyHtml}");
    expect(src).toContain("${receivingReplyText}");
  });
});

describe("§11.348-A-1 회귀 0 — 기존 발주 메일 동작 보존", () => {
  it("PDF 첨부 + 본문 + audit 보존", () => {
    const src = read(ROUTE);
    expect(src).toContain("generatePoPdf");
    expect(src).toContain("generatePoVendorEmail");
    expect(src).toContain('eventType: "VENDOR_EMAIL_SENT"');
    expect(src).toContain('code: "VENDOR_EMAIL_MISSING"');
  });
});
