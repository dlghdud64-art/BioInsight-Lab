/**
 * §11.361-1 (회귀) — 대시보드 온보딩 게이트 canonical truth sentinel
 *
 * 런타임 검증(Claude in Chrome): /api/dashboard/stats lowStockAlerts=2 정상인데
 * 대시보드는 "재고 부족 0건" 표기 = 온보딩 게이트(견적만 기준)가 재고 보유 운영
 * 유저를 신규로 오판해 실 KPI 마스킹. → 게이트에 재고/발주 포함(데이터 있으면 운영 모드).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const SRC = readFileSync(join(APP_WEB_ROOT, "src/app/dashboard/page.tsx"), "utf8");

describe("§11.361-1 — 온보딩 게이트가 견적 단독이 아님", () => {
  it("hasAnyOperationalData = 견적 OR 재고 OR 발주", () => {
    expect(SRC).toContain("hasAnyOperationalData");
    expect(SRC).toContain("stats.totalInventory > 0");
    expect(SRC).toContain("stats.orderStats?.totalOrders ?? 0");
    expect(SRC).toContain("const isOnboardingMode = !hasAnyOperationalData");
  });
  it("견적 단독 게이트(구) 제거", () => {
    expect(SRC).not.toContain("const isOnboardingMode = totalQuotesCount === 0;");
  });
});
