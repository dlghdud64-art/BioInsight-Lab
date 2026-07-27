import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * §inventory-delta-label-kpi Phase 1 — 복수 재발주 추천 API canonical 산식 정합 sentinel.
 *   핸드오프 §1: 권장수량 = 안전재고 갭 + 납기중 소진 → MOQ 반올림. 근거 3항(breakdown) 노출.
 *   canonical 단일점 computeReorderRecommendation 사용 강제(컴포넌트별 재계산 금지 = 웹·모바일 숫자 일치).
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const ROUTE = "src/app/api/inventory/reorder-recommendations/route.ts";

describe("§inventory-delta-label-kpi P1 — 복수 route canonical 산식", () => {
  it("computeReorderRecommendation 헬퍼 import + 호출(구 산식 제거)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/import \{ computeReorderRecommendation \} from "@\/lib\/inventory\/reorder-quantity"/);
    expect(src).toMatch(/computeReorderRecommendation\(\{/);
    // 구 산식(safetyStock + estimatedMonthlyUsage - currentQty) 제거 확인.
    expect(src).not.toMatch(/Math\.ceil\(safetyStock \+ estimatedMonthlyUsage - currentQty\)/);
  });

  it("recommendedQuantity·recommendedQty(alias) = 헬퍼 결과 단일 소스", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/recommendedQuantity: reorder\.recommendedQuantity/);
    expect(src).toMatch(/recommendedQty: reorder\.recommendedQuantity/);
  });

  it("근거 3항(breakdown) 응답 노출 — Phase 2 레일 소비", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/recommendationBreakdown: reorder\.breakdown/);
  });

  it("일평균 소진 = 저장값 우선, usageRecords 폴백(파생, 조작 0)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/inventory\.averageDailyUsage \?\? 0/);
    expect(src).toMatch(/dailyUsage = totalUsage \/ days/);
  });

  it("회귀 0 — isReorderNeeded 게이트 보존", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/isReorderNeeded\(\{ currentQuantity: currentQty/);
  });
});
