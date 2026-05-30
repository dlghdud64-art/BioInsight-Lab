/**
 * §11.314 Phase 2 — sender.ts Resend 실제 발송 (mock → production) sentinel
 *
 * 호영님 결정 (2026-05-30):
 *   - Provider = Resend (resend ^6.6.0 이미 설치됨)
 *   - From = noreply@labaxis.co.kr
 *   - env = RESEND_API_KEY + EMAIL_FROM
 *
 * 환경 경계 (변경 불가):
 *   - isVendorPilot 분기 보존 (no real outbound mail to pilot)
 *   - NODE_ENV=development 분기 보존 (sandbox 콘솔 로깅)
 *   - production 분기 = Resend SDK 실제 발송 (TODO 제거)
 *
 * caller 8개 — sendEmail() 시그니처 변경 0, 영향 0:
 *   quotes/[id]/vendor-requests, work-queue/purchase-conversion,
 *   vendor/quotes/[quoteId]/response, request/[id]/approve/reject,
 *   quotes/[id], orders/[id]/send-email, inventory/alerts/send
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SENDER = "src/lib/email/sender.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.314 Phase 2 — Resend SDK 통합 (production 분기)", () => {
  it("Resend import 존재 (from 'resend')", () => {
    const src = read(SENDER);
    expect(src).toMatch(/from\s+['"]resend['"]/);
  });

  it("production 분기 = Resend send() 실제 호출 (TODO 주석 제거)", () => {
    const src = read(SENDER);
    // TODO 주석 잔존 0 (mock placeholder 제거)
    expect(src).not.toMatch(/TODO:\s*실제 이메일|TODO.*이메일 서비스 연동 구현/);
    // Resend send 호출 존재
    expect(src).toMatch(/resend\.emails\.send|new Resend/);
  });

  it("RESEND_API_KEY env 참조 존재", () => {
    const src = read(SENDER);
    expect(src).toMatch(/RESEND_API_KEY/);
  });

  it("EMAIL_FROM env 또는 noreply@labaxis.co.kr from 주소 존재", () => {
    const src = read(SENDER);
    expect(src).toMatch(/EMAIL_FROM|noreply@labaxis/);
  });

  it("production SMTP 실패 시 throw (silent success 금지)", () => {
    const src = read(SENDER);
    // Resend error → throw (caller try/catch 에 전파)
    expect(src).toMatch(/throw|\.error\b[\s\S]{0,100}throw/);
  });

  it("EmailAttachment → Resend attachments 필드 매핑 존재", () => {
    const src = read(SENDER);
    // attachments 필드 Resend 포맷 (content: base64 string or Buffer)
    expect(src).toMatch(/attachments/);
  });
});

describe("§11.314 Phase 2 — canonical 보존 (pilot vendor + dev 분기)", () => {
  it("isVendorPilot 분기 보존 — pilot vendor SMTP skip", () => {
    const src = read(SENDER);
    expect(src).toMatch(/isVendorPilot/);
    // pilot 분기 후 return 보존
    expect(src).toMatch(/isVendorPilot[\s\S]{0,200}return/);
  });

  it("NODE_ENV=development 분기 보존 — sandbox 콘솔 로깅", () => {
    const src = read(SENDER);
    expect(src).toMatch(/NODE_ENV.*development|development.*NODE_ENV/);
    expect(src).toMatch(/console\.log/);
  });

  it("EmailOptions interface 보존 (to/subject/html/text/attachments/vendorId)", () => {
    const src = read(SENDER);
    expect(src).toMatch(/interface EmailOptions/);
    expect(src).toMatch(/to:\s*string/);
    expect(src).toMatch(/attachments\?:/);
    expect(src).toMatch(/vendorId\?:/);
  });

  it("sendEmail() 함수 시그니처 변경 0 (caller 8개 영향 0)", () => {
    const src = read(SENDER);
    expect(src).toMatch(/export async function sendEmail\s*\(\s*options:\s*EmailOptions\s*\)/);
  });
});

describe("§11.314 Phase 2 — .env.example 명세 (key 가이드)", () => {
  it(".env.example 에 RESEND_API_KEY + EMAIL_FROM 키 명시", () => {
    const env = read(".env.example");
    expect(env).toMatch(/RESEND_API_KEY/);
    expect(env).toMatch(/EMAIL_FROM/);
  });
});
