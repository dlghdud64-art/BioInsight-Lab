/**
 * §inbound-rfq-autocapture P4 (PLAN_inbound-rfq-autocapture) — 새 회신 도착 연구소 알림
 *
 * inbound parse 가 QuoteReply 생성 성공 시 quote owner(연구소)에게 알림 메일.
 *   §11.348-SEND-A 진화 정합: 직접수신 폐기를 알림으로 보완(원문은 LabAxis 집약, 알림으로 인지).
 *   - best-effort: 알림 실패해도 수신(QuoteReply) 보존, webhook 200 유지.
 *   - 알림 본문은 quotes 화면 링크(received 탭)로 유도 — 원문/첨부는 LabAxis 에서 확인.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const ROUTE = read("app/api/inbound/sendgrid/[secret]/route.ts");

describe("§inbound-rfq-autocapture P4 — 회신 도착 연구소 알림", () => {
  it("sendEmail + getAppUrl import(기존 발송 인프라 재사용)", () => {
    expect(ROUTE).toMatch(/import \{ sendEmail \} from "@\/lib\/email\/sender"/);
    expect(ROUTE).toMatch(/import \{ getAppUrl \} from "@\/lib\/env"/);
  });
  it("quote owner 조회 후 알림(owner.email)", () => {
    expect(ROUTE).toMatch(/db\.user\.findUnique/);
    expect(ROUTE).toMatch(/tokenRecord\.quote\.userId/);
    expect(ROUTE).toMatch(/owner\?\.email/);
  });
  it("알림 제목 + quotes 화면 링크(received 탭 유도)", () => {
    expect(ROUTE).toMatch(/새 견적 회신 도착/);
    expect(ROUTE).toMatch(/getAppUrl\(\)\}\/quotes\/\$\{quoteId\}/);
  });
});

describe("§inbound-rfq-autocapture P4 — best-effort(수신 비차단) + 회귀 0", () => {
  it("알림 try/catch — 실패해도 수신 보존(webhook 200)", () => {
    expect(ROUTE).toMatch(/catch\s*\(notifyError\)/);
    expect(ROUTE).toMatch(/logger\.warn\([^)]*수신은 정상/);
  });
  it("QuoteReply 생성 + matched 응답 보존", () => {
    expect(ROUTE).toMatch(/quoteReply\.create/);
    expect(ROUTE).toMatch(/matched: true, replyId: reply\.id/);
  });
  it("정직성 — 알림은 링크 유도, 실시간 SLA/전화 약속 0", () => {
    expect(ROUTE).not.toMatch(/실시간\s*(상담|응대|연결)|전화\s*드리|즉시\s*연락/);
  });
});
