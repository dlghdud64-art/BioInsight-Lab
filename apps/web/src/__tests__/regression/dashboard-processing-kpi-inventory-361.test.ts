/**
 * §11.361-2b (회귀) — "처리 필요 항목" KPI 에 재고 부족 포함 (truth 정합)
 *
 * 런타임 검증(Chrome): 재고 부족 2건인데 "처리 필요 항목 0건" — executive-summary KPI 가
 * 발주/예산(승인+이상)만 집계, 재고 누락. dashboard processingRequiredCount(재고 포함)와
 * 불일치. reorderReviewCount(stats.lowStockAlerts) 전달 + KPI 합산으로 정합.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const EXEC = read("src/components/dashboard/executive-summary-section.tsx");
const PAGE = read("src/app/dashboard/page.tsx");

describe("§11.361-2b — executive-summary KPI 재고 포함", () => {
  it("reorderReviewCount prop + 값/breakdown 합산", () => {
    expect(EXEC).toContain("reorderReviewCount");
    expect(EXEC).toContain("kpis.pendingApprovalCount + kpis.anomalyCount + reorderReviewCount");
    expect(EXEC).toContain('{ label: "재고 부족", value: `${reorderReviewCount}건` }');
  });
});

describe("§11.361-2b — page.tsx 가 재고 카운트 전달", () => {
  it("reorderReviewCount={stats.lowStockAlerts}", () => {
    expect(PAGE).toContain("reorderReviewCount={stats.lowStockAlerts}");
  });
});
