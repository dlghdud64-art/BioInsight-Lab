/**
 * §audit-log-enhancement P2 (호영님 2026-07-04) — 활동 로그 피드(문장형·아바타·카테고리 dot·날짜그룹·실패).
 * 색 규칙: 빨강=실패행만, 카테고리색=아바타 dot만. canonical=ActivityLog 읽기.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const P = readFileSync(join(__dirname, "..", "..", "app/dashboard/audit/page.tsx"), "utf8");
const CODE = P.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§audit-log-enhancement P2 — 활동 피드", () => {
  it("피드 컨테이너 + 헬퍼(이니셜·카테고리)", () => {
    expect(CODE).toMatch(/data-testid="activity-feed"/);
    expect(CODE).toMatch(/function actorInitials/);
    expect(CODE).toMatch(/function activityCategory/);
  });
  it("문장형 + 날짜그룹 sticky + 변경칩(before→after)", () => {
    expect(CODE).toMatch(/님이 /);
    expect(CODE).toMatch(/sticky top-0/);
    expect(CODE).toMatch(/beforeStatus && log\.afterStatus/);
  });
  it("색 규칙 — 실패행만 빨강(bg-red-50), 카테고리색=dot", () => {
    expect(CODE).toMatch(/isFail \? "bg-red-50"/);
    expect(CODE).toMatch(/ACT_CAT_DOT\[cat\]/);
  });
  it("옛 단일 리스트(activityLogs.map 직접) 제거", () => {
    expect(CODE).not.toMatch(/<ul className="divide-y divide-slate-100">\s*\{activityLogs\.map/);
  });
});
