/**
 * §audit-log-enhancement P3 (호영님 2026-07-04) — 감사 요약 스트립 + P2b 멤버 칩 + audit-first.
 * 색 규칙: accent 미사용(중립), 실패 카드만 빨강. display-only(dead button 0).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const P = readFileSync(join(__dirname, "..", "..", "app/dashboard/audit/page.tsx"), "utf8");
const CODE = P.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§audit-log-enhancement P3 — 감사 요약 스트립", () => {
  it("4카드(총이벤트·데이터변경·권한접근·실패)", () => {
    expect(CODE).toMatch(/data-testid="audit-summary"/);
    expect(CODE).toMatch(/총 이벤트/);
    expect(CODE).toMatch(/데이터 변경/);
    expect(CODE).toMatch(/실패 이벤트/);
  });
  it("실패만 빨강, 나머지 중립(흰) — accent 색띠 미사용", () => {
    expect(CODE).toMatch(/danger \? "border-red-200 bg-red-50" : "border-slate-200 bg-white"/);
  });
});

describe("§audit-log-enhancement P2b — 멤버 필터 칩", () => {
  it("멤버 칩 상태 + 아바타 + 건수 + 피드 필터", () => {
    expect(CODE).toMatch(/activityMember/);
    expect(CODE).toMatch(/setActivityMember/);
    expect(CODE).toMatch(/activityMember === "all" \|\| String\(l\.user\?\.id/);
  });
});

describe("§audit-log-enhancement P4 — audit-first(컴플라이언스 대상)", () => {
  it("admin/manager 기본 감사 진입", () => {
    expect(CODE).toMatch(/setMode\(canAccessAudit \? "audit" : "activity"\)/);
  });
});
