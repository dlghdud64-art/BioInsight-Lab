/**
 * §dashboard-surface-unify (호영님 2026-07-04) — 작업 페이지 회색 캔버스(#F1F5F9) 통일.
 * canonical 토큰 bg-canvas 단일 소스. 작업 페이지 root = bg-canvas, 대시보드 홈(§11.283b)·admin 제외.
 * 내부 카드는 흰색 유지(회색 위에 부양) — 카드 배경 canvas 금지.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const R = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(R, p), "utf8");

const WORK_PAGES = [
  "app/dashboard/quotes/page.tsx",
  "app/dashboard/purchases/page.tsx",
  "app/dashboard/budget/page.tsx",
  "app/dashboard/organizations/page.tsx",
  "app/dashboard/safety/page.tsx",
  "app/dashboard/settings/page.tsx",
  "app/dashboard/analytics/page.tsx",
  "app/dashboard/reports/page.tsx",
  "app/dashboard/inventory/inventory-content.tsx",
  "app/dashboard/support-center/page.tsx",
];

describe("§dashboard-surface-unify — 작업 페이지 회색 캔버스 통일", () => {
  it("canonical 토큰 정의 — tailwind canvas + globals --surface-canvas #E9EEF4", () => {
    // §canvas-contrast(호영님 2026-07-10) — #F1F5F9(slate-100)가 흰색과 구분 안 돼 카드 부양감
    //   없음 → #E9EEF4 로 살짝 진하게. tailwind canvas 는 var 참조라 무변경.
    expect(rd("../tailwind.config.ts")).toMatch(/canvas:\s*"var\(--surface-canvas\)"/);
    expect(rd("app/globals.css")).toMatch(/--surface-canvas:\s*#E9EEF4/i);
  });
  it("각 작업 페이지가 bg-canvas 사용", () => {
    for (const p of WORK_PAGES) {
      expect(rd(p), p).toMatch(/bg-canvas/);
    }
  });
  it("quotes 하드코딩 bg-[#f1f5f9] 잔재 0(토큰 단일 소스화)", () => {
    expect(rd("app/dashboard/quotes/page.tsx")).not.toMatch(/bg-\[#f1f5f9\]/);
  });
  it("analytics·reports 전폭 — bg-canvas full-width 외곽 + max-w-7xl 내부(중앙 회색 컬럼 방지)", () => {
    for (const p of ["app/dashboard/analytics/page.tsx", "app/dashboard/reports/page.tsx"]) {
      const src = rd(p);
      expect(src, p).toMatch(/<div className="w-full bg-canvas min-h-screen">/);
      // 배경을 중앙정렬(max-w-7xl) 요소에 결합 금지 — 결합이 "가운데 회색 컬럼" 원인.
      expect(src, p).not.toMatch(/bg-sh[^"]*max-w-7xl|max-w-7xl[^"]*bg-sh/);
    }
  });
  it("대시보드 홈 제외 — dashboard/page.tsx는 canvas 아님(§11.283b 흰색/bg-sh 유지)", () => {
    expect(rd("app/dashboard/page.tsx")).not.toMatch(/bg-canvas/);
  });
});
