/**
 * §quote-management-redesign P1a — stage 라벨 "요청 발송 전" → "발송 대기" (호영님 시안 정합)
 *   (PLAN: docs/plans/PLAN_quote-management-redesign.md)
 *
 * 퍼널 단계명과 통일(시안 §08·README "단계 칩 라벨 발송 대기"). canonical 상태 키(요청_접수)·
 * §11.302 신호색(bg-blue-100)·발송 대상 게이팅(request_not_sent)은 불변.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const PAGE = readFileSync(
  join(REPO_ROOT, "src/app/dashboard/quotes/page.tsx"),
  "utf8",
);

describe("§quote-management-redesign P1a — 발송 대기 라벨", () => {
  it("OP_STATUS 요청_접수 라벨 = '발송 대기'(퍼널 통일)", () => {
    expect(PAGE).toMatch(/요청_접수:[\s\S]{0,40}label: "발송 대기"/);
  });
  it("signals badge = '발송 대기'", () => {
    expect(PAGE).toMatch(/badge: "발송 대기"/);
  });
  it("회귀 0 — 요청_접수 키 + §11.302 bg-blue-100(신호색) 보존", () => {
    expect(PAGE).toMatch(/요청_접수:[\s\S]{0,80}bg-blue-100/);
  });
  it("회귀 0 — 발송 대상 게이팅(canonical request_not_sent) 보존", () => {
    expect(PAGE).toMatch(/request_not_sent/);
  });
});
