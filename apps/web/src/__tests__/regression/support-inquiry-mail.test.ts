/**
 * §support-inquiry-mail(호영님, 2026-06-17 승인) — 도입·문의 접수 알림 메일 2건
 *
 * 버그헌터 진단: /api/support/inquiry 는 ContactInquiry DB 저장 후 {success:true} 만 반환,
 *   Resend 발송 0 = front-only success(메일 leg 누락). DB 인입은 진짜였음(dead button 아님).
 * 수정: 기존 sendEmail(@/lib/email/sender, 루트 verified noreply@labaxis.co.kr) 재사용해 2건.
 *   ① 운영 알림 to=support@, replyTo=문의자(회신 시 문의자에게).
 *   ② 문의자 접수확인 to=문의자, replyTo=support@.
 *   - best-effort: DB 인입은 절대 막지 않음(try/catch, throw 금지, console.error 만).
 *   - 정직성: "영업일 1일 이내"만, 실시간 SLA/전화/전담 약속 금지.
 *   - from 미override(sender 기본값 = 루트 verified). EMAIL_FROM 변경 0.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const ROUTE = readFileSync(join(ROOT, "app/api/support/inquiry/route.ts"), "utf8");

describe("§support-inquiry-mail — 발송 배선", () => {
  it("sendEmail import(@/lib/email/sender 재사용, 신규 mailer 0)", () => {
    expect(ROUTE).toMatch(/import\s*\{\s*sendEmail\s*\}\s*from\s*"@\/lib\/email\/sender"/);
  });
  it("메일 2건 호출(운영 알림 + 문의자 접수확인)", () => {
    const calls = (ROUTE.match(/await sendEmail\(/g) || []).length;
    expect(calls).toBe(2);
  });
  it("① 운영 알림 — to=support@ + replyTo=문의자(회신 분리)", () => {
    expect(ROUTE).toMatch(/to:\s*SUPPORT_INBOX/);
    expect(ROUTE).toMatch(/replyTo:\s*cleanEmail/);
    expect(ROUTE).toMatch(/SUPPORT_INBOX\s*=\s*"support@labaxis\.co\.kr"/);
  });
  it("② 문의자 접수확인 — to=문의자 + replyTo=support@", () => {
    expect(ROUTE).toMatch(/to:\s*cleanEmail/);
    expect(ROUTE).toMatch(/replyTo:\s*SUPPORT_INBOX/);
  });
  it("from 미override — EMAIL_FROM 변경 0(루트 verified 기본값 유지)", () => {
    expect(ROUTE).not.toMatch(/EMAIL_FROM/);
    expect(ROUTE).not.toMatch(/from:\s*["']/);
  });
});

describe("§support-inquiry-mail — best-effort(DB 인입 비차단) + 정직성", () => {
  it("try/catch best-effort — 메일 실패 시 throw 금지, console.error 만", () => {
    expect(ROUTE).toMatch(/catch\s*\(mailError\)/);
    expect(ROUTE).toMatch(/console\.error\([^)]*접수는 정상/);
  });
  it("DB create 가 메일보다 먼저(인입 우선) — create 인덱스 < 첫 sendEmail", () => {
    const createIdx = ROUTE.indexOf("contactInquiry.create");
    const mailIdx = ROUTE.indexOf("await sendEmail(");
    expect(createIdx).toBeGreaterThan(-1);
    expect(mailIdx).toBeGreaterThan(createIdx);
  });
  it("HTML 이스케이프(사용자 입력 인젝션·깨짐 방지)", () => {
    expect(ROUTE).toMatch(/function esc\(/);
    expect(ROUTE).toMatch(/esc\(cleanMessage\)/);
    expect(ROUTE).toMatch(/esc\(cleanName\)/);
  });
  it("정직성 — 영업일 1일 이내만, 실시간 SLA/전화/전담 약속 0", () => {
    expect(ROUTE).toMatch(/영업일 기준 1일 이내/);
    // 사용자 노출 약속 구문만 검사 — 가드 설명 주석("정직성: 실시간 SLA 약속 금지")의 bare 단어는
    //   false positive 라 제외. 실제 과약속(실시간 상담/응대, 전화·전담·즉시 연락)만 금지.
    expect(ROUTE).not.toMatch(/실시간\s*(상담|채팅|응대|연결|회신)|24시간 내|전화\s*드리|전담\s*매니저|즉시\s*연락/);
  });
});
