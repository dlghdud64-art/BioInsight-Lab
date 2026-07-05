/**
 * §support-center P4 (호영님 2026-07-05) — 티켓 파이프라인·SLA·답변본문·직접문의 배너 + CSRF fix.
 * 상태 파이프라인(접수→배정→확인→답변→완료) 계단식 fade-in · SLA 배지 · answerBody 실 노출(폴백은 없을 때만)
 * · 직접 문의 배너(/support 실배선). 🛑 handleSubmit /api/support/inquiry raw fetch → csrfFetch(전역 CSRF 게이트).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/support-center/page.tsx"), "utf8");

describe("§support-center P4 — 티켓 파이프라인·SLA·답변본문·CSRF", () => {
  it("§4 CSRF fix — handleSubmit csrfFetch(raw fetch 제거, 403 해소)", () => {
    expect(PAGE).toMatch(/import \{ csrfFetch \} from "@\/lib\/api-client"/);
    expect(PAGE).toMatch(/csrfFetch\("\/api\/support\/inquiry"/);
    expect(PAGE).not.toMatch(/await fetch\("\/api\/support\/inquiry"/);
  });
  it("§4 상태 파이프라인(접수→배정→확인→답변→완료) + 계단식 fade-in(reduced-motion)", () => {
    expect(PAGE).toMatch(/TICKET_STAGES = \["접수", "배정", "확인", "답변", "완료"\]/);
    expect(PAGE).toMatch(/animationDelay:/);
    expect(PAGE).toMatch(/motion-reduce:/);
  });
  it("§4 SLA 배지 + answerBody 실 노출", () => {
    expect(PAGE).toMatch(/slaHours/);
    expect(PAGE).toMatch(/answerBody/);
  });
  it("§4 직접 문의 배너", () => {
    expect(PAGE).toMatch(/찾는 답이 없/);
  });
});
