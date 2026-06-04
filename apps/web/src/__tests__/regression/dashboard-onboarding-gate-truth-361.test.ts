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
  it("hasAnyOperationalData = 견적 OR 재고 (orderStats 미존재 필드 → 2기준)", () => {
    expect(SRC).toContain("hasAnyOperationalData");
    expect(SRC).toContain("stats.totalInventory > 0");
    // §11.361-1 hotfix: rawStats 에 발주 전용 필드 없음(opsFunnel 구조 불명) →
    //   추측 필드(orderStats) 제거, 견적+재고 2기준. 재고 마스킹 해소 목적은 totalInventory 로 충족.
    expect(SRC).toContain("const isOnboardingMode = !hasAnyOperationalData");
  });
  it("견적 단독 게이트(구) 제거", () => {
    expect(SRC).not.toContain("const isOnboardingMode = totalQuotesCount === 0;");
  });
});

describe("§11.361-1b — stats 쿼리 500 시 throw(swallow 금지) + retry", () => {
  it("!response.ok 에서 throw, return null 제거, retry>=2", () => {
    expect(SRC).toContain("throw new Error(`dashboard stats ${response.status}`)");
    expect(SRC).not.toContain('console.warn("[dashboard] stats API failed:", response.status);\n        return null;');
    expect(SRC).toContain("retry: 3");
    expect(SRC).toContain("retryDelay:");
  });
});
