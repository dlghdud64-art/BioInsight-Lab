/**
 * §11.314 Phase 2 #email-sender-resend-integration — Regression sentinel (Phase 1 RED)
 *
 * 호영님 release-prep deferred (2026-05-30):
 *   §11.314-b PDF + mailto MVP (task #97) 완료 후 SMTP 자동발송 진입.
 *   sender.ts mock (NODE_ENV=development 콘솔 로깅 + production TODO) →
 *   Resend SDK production 분기 통합.
 *
 *   호영님 권장안 채택:
 *   - Provider = Resend ("resend": "^6.6.0" 이미 설치됨)
 *   - env = RESEND_API_KEY + EMAIL_FROM (.env.example 정합 완료)
 *   - From = no-reply@labaxis.co.kr (도메인 verification 호영님 dashboard)
 *   - retry = Resend SDK 내장 retry, 별도 큐 0
 *
 *   본 sentinel = Phase 1 RED. Phase 2 GREEN target:
 *   - `import { Resend } from "resend"` import + 모듈 레벨 인스턴스
 *   - production 분기 (NODE_ENV !== development) → resend.emails.send() 호출
 *   - attachments 정합 (Buffer | string content + filename + contentType)
 *   - Resend API error → throw Error (silent success 금지)
 *
 * canonical 보존 (Phase 3 가드):
 *   - EmailAttachment / EmailOptions interface 시그니처 변경 0
 *   - pilot vendor isVendorPilot 분기 보존 (no real outbound mail to pilot)
 *   - NODE_ENV=development 콘솔 로깅 보존 (sandbox 보호)
 *   - 8 caller try/catch 시그니처 영향 0 (await sendEmail(options) 동일)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SENDER_PATH = "src/lib/email/sender.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.314 Phase 2 — Resend SDK integration (Phase 2 GREEN target)", () => {
  it("Resend SDK import + 인스턴스 생성", () => {
    const src = read(SENDER_PATH);
    expect(src).toMatch(/import\s*\{\s*Resend\s*\}\s*from\s*["']resend["']/);
    expect(src).toMatch(/new Resend\(/);
  });

  it("production 분기 — resend.emails.send() 호출 + error throw", () => {
    const src = read(SENDER_PATH);
    expect(src).toMatch(/resend\.emails\.send\(/);
    // production error 발생 시 throw (silent success 금지)
    expect(src).toMatch(/throw new Error/);
  });

  it("EMAIL_FROM env 사용 (호영님 spec From 주소)", () => {
    const src = read(SENDER_PATH);
    expect(src).toMatch(/process\.env\.EMAIL_FROM/);
  });

  it("RESEND_API_KEY env 사용 + 누락 시 guard", () => {
    const src = read(SENDER_PATH);
    expect(src).toMatch(/process\.env\.RESEND_API_KEY/);
  });

  it("attachments 정합 — Resend send() options.attachments 전달", () => {
    const src = read(SENDER_PATH);
    // resend.emails.send({ ..., attachments: ... }) 패턴
    expect(src).toMatch(/resend\.emails\.send\([\s\S]{0,800}attachments/);
  });

  it("옛 production TODO 주석 잔존 0 (실제 구현 swap)", () => {
    const src = read(SENDER_PATH);
    // 옛 "TODO: 실제 이메일 서비스 연동 구현" 패턴 잔존 0
    expect(src).not.toMatch(/TODO:\s*실제 이메일 서비스 연동 구현/);
  });
});

describe("§11.314 Phase 2 — canonical 보존 (mock/pilot 분기 + caller 8 영향 0)", () => {
  it("EmailAttachment interface 시그니처 보존 (filename / content / contentType)", () => {
    const src = read(SENDER_PATH);
    expect(src).toMatch(/export interface EmailAttachment/);
    expect(src).toMatch(/filename:\s*string/);
    expect(src).toMatch(/content:\s*Buffer\s*\|\s*string/);
    expect(src).toMatch(/contentType:\s*string/);
  });

  it("EmailOptions interface 시그니처 보존 (to / subject / html / text / attachments? / vendorId?)", () => {
    const src = read(SENDER_PATH);
    expect(src).toMatch(/export interface EmailOptions/);
    expect(src).toMatch(/to:\s*string/);
    expect(src).toMatch(/subject:\s*string/);
    expect(src).toMatch(/attachments\?:\s*EmailAttachment\[\]/);
    expect(src).toMatch(/vendorId\?:\s*string/);
  });

  it("sendEmail 함수 시그니처 보존 (async + Promise<void>)", () => {
    const src = read(SENDER_PATH);
    expect(src).toMatch(/export async function sendEmail\(options:\s*EmailOptions\):\s*Promise<void>/);
  });

  it("pilot vendor 분기 보존 — isVendorPilot SMTP skip + audit-only console.log", () => {
    const src = read(SENDER_PATH);
    expect(src).toMatch(/isVendorPilot\(options\.vendorId\)/);
    expect(src).toMatch(/pilot dry-run/);
  });

  it("NODE_ENV=development 콘솔 로깅 분기 보존 (sandbox 보호)", () => {
    const src = read(SENDER_PATH);
    expect(src).toMatch(/process\.env\.NODE_ENV\s*===\s*["']development["']/);
    expect(src).toMatch(/개발 모드/);
  });
});
