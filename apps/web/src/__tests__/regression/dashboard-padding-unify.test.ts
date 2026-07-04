/**
 * §dashboard-padding-unify (호영님 2026-07-04) — 이중 패딩 해소.
 * 셸 <main>의 uniform 패딩 제거(pb 유지) → 각 페이지 자체 패딩만(단일). 대시보드 꽉채움.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const R = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(R, p), "utf8");

describe("§dashboard-padding-unify — 셸 중복 패딩 제거", () => {
  it("셸 <main>에 uniform p-8 없음(pb 안전영역만 유지)", () => {
    const shell = rd("app/dashboard/_components/dashboard-shell.tsx");
    const main = shell.match(/flex-1 min-w-0 overflow-y-auto[^"]*/)?.[0] ?? "";
    expect(main).not.toMatch(/\bp-3 sm:p-4 md:p-8\b/);
    expect(main).toMatch(/pb-\[calc\(8rem/); // 모바일 하단 클리어런스 보존
  });
  it("대시보드 페이지 자체 패딩 보유(셸 제거 대응)", () => {
    expect(rd("app/dashboard/page.tsx")).toMatch(/p-3 pt-4 md:p-8 md:pt-7/);
  });
  it("위임형 work-queue 자체 패딩 wrap(엣지 방지)", () => {
    expect(rd("app/dashboard/work-queue/page.tsx")).toMatch(/<div className="p-4 md:p-8">\s*<WorkQueueConsole/);
  });
});
