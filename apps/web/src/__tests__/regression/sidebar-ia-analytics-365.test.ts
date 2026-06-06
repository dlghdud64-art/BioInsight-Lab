/**
 * §11.365 (회귀 보호) — 사이드바 IA: "지출 분석"을 상단 독립 → PURCHASE 그룹 이동.
 *
 * 데스크탑 사이드바에서 "지출 분석"이 dashboardLinks(상단 독립)에 떠 있던 것을
 * "구매 및 예산 (PURCHASE)" 그룹으로 옮겨 IA 정합(구매·예산 분석류 인접).
 *
 * sentinel(readFileSync+regex). href/icon 보존, 그룹 소속만 변경.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const SIDEBAR = "src/app/_components/dashboard-sidebar.tsx";

function purchaseGroupBlock(src: string): string {
  const start = src.indexOf("구매 및 예산 (PURCHASE)");
  const end = src.indexOf("랩 운영 (LAB MANAGEMENT)");
  return src.slice(start, end);
}
function dashboardLinksBlock(src: string): string {
  const start = src.indexOf("const dashboardLinks");
  return src.slice(start, src.indexOf("];", start));
}

describe("§11.365 — 지출 분석 PURCHASE 그룹 이동", () => {
  it('"지출 분석"이 PURCHASE 그룹에 존재', () => {
    const block = purchaseGroupBlock(read(SIDEBAR));
    expect(block).toMatch(/지출 분석/);
    expect(block).toMatch(/\/dashboard\/analytics/);
  });

  it('"지출 분석"이 상단 dashboardLinks 에서 제거됨', () => {
    const block = dashboardLinksBlock(read(SIDEBAR));
    expect(block).not.toMatch(/지출 분석/);
  });

  it("대시보드는 상단 dashboardLinks 에 유지", () => {
    const block = dashboardLinksBlock(read(SIDEBAR));
    expect(block).toMatch(/대시보드/);
  });
});

describe("§11.365 — 회귀 0", () => {
  it("analytics href/icon + ICON_TINT 보존", () => {
    const src = read(SIDEBAR);
    expect(src).toMatch(/icon: PieChart/);
    expect(src).toMatch(/"\/dashboard\/analytics":\s*\{/);
  });

  it("PURCHASE 기존 항목(견적/구매/발주/구매 리포트/예산) 보존", () => {
    const block = purchaseGroupBlock(read(SIDEBAR));
    for (const t of ["견적 관리", "구매 운영", "발주 관리", "구매 리포트", "예산 관리"]) {
      expect(block).toMatch(new RegExp(t));
    }
  });
});
