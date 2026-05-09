/**
 * #quote-rationale-inventory-context Phase 2a — match helper RED test.
 *
 * Goal: quote.items × inventory rows 매칭 → 가장 위급한 1개 추출.
 *
 * canonical truth lock:
 *   - quote.items 의 productId × ProductInventory.productId 매칭.
 *   - low-stock 판정: safetyStock 또는 소진속도 (호영님 결정 2C).
 *     (a) safetyStock != null && currentQuantity < safetyStock
 *     (b) averageDailyUsage > 0 && leadTimeDays > 0 && (currentQuantity / averageDailyUsage) < leadTimeDays × 1.5
 *   - mostUrgent: low-stock 우선, 그 중 daysRemaining 최소 (또는 undefined 마지막).
 *   - 매칭 0 또는 모두 정상 → null (graceful).
 */

import { describe, it, expect } from "vitest";
import { findMostUrgentInventoryForQuote } from "../../../lib/operational-brief/build-rationale";

describe("#quote-rationale-inventory-context Phase 2a — findMostUrgentInventoryForQuote", () => {
  it("매칭 0 → null", () => {
    const result = findMostUrgentInventoryForQuote(
      [{ product: { id: "prod-A", name: "Product A" } }],
      [{ productId: "prod-OTHER", currentQuantity: 10, safetyStock: 5 }],
    );
    expect(result).toBeNull();
  });

  it("safetyStock 임계 통과 — isLowStock=true", () => {
    const result = findMostUrgentInventoryForQuote(
      [{ product: { id: "prod-A", name: "FBS" } }],
      [{
        productId: "prod-A",
        currentQuantity: 2,
        safetyStock: 5,
        product: { name: "FBS" },
      }],
    );
    expect(result?.isLowStock).toBe(true);
    expect(result?.productName).toBe("FBS");
  });

  it("소진속도 임계 통과 (currentQty / dailyUsage < leadTime × 1.5)", () => {
    const result = findMostUrgentInventoryForQuote(
      [{ product: { id: "prod-A", name: "PBS" } }],
      [{
        productId: "prod-A",
        currentQuantity: 5,         // 5개
        averageDailyUsage: 1,       // 일 1개 → 5일 남음
        leadTimeDays: 5,            // 5 × 1.5 = 7.5일 임계 → 5 < 7.5 → low-stock
        // safetyStock 없음
        product: { name: "PBS" },
      }],
    );
    expect(result?.isLowStock).toBe(true);
    expect(result?.daysRemaining).toBe(5);
  });

  it("정상 (safetyStock 통과 + 소진속도 충분) → null", () => {
    const result = findMostUrgentInventoryForQuote(
      [{ product: { id: "prod-A", name: "DMSO" } }],
      [{
        productId: "prod-A",
        currentQuantity: 100,
        safetyStock: 10,
        averageDailyUsage: 1,
        leadTimeDays: 5,
        product: { name: "DMSO" },
      }],
    );
    expect(result).toBeNull();
  });

  it("여러 매칭 중 daysRemaining 최소가 mostUrgent", () => {
    const result = findMostUrgentInventoryForQuote(
      [
        { product: { id: "p1", name: "FBS" } },
        { product: { id: "p2", name: "PBS" } },
      ],
      [
        { productId: "p1", currentQuantity: 10, safetyStock: 5, averageDailyUsage: 1, leadTimeDays: 5, product: { name: "FBS" } }, // 정상
        { productId: "p2", currentQuantity: 2, safetyStock: 5, averageDailyUsage: 1, leadTimeDays: 5, product: { name: "PBS" } }, // 2일 남음, low-stock
      ],
    );
    expect(result?.productName).toBe("PBS");
    expect(result?.daysRemaining).toBe(2);
  });

  it("daysRemaining 없으면 (averageDailyUsage 0) safetyStock 만으로 판정", () => {
    const result = findMostUrgentInventoryForQuote(
      [{ product: { id: "p1", name: "BSA" } }],
      [{
        productId: "p1",
        currentQuantity: 1,
        safetyStock: 5,
        averageDailyUsage: 0, // 사용량 없음 → daysRemaining 계산 불가
        leadTimeDays: 7,
        product: { name: "BSA" },
      }],
    );
    expect(result?.isLowStock).toBe(true);
    expect(result?.daysRemaining).toBeUndefined();
    expect(result?.leadTimeDays).toBe(7);
  });
});

describe("#quote-rationale-inventory-context Phase 2b — caller wiring (quotes/page.tsx)", () => {
  it("quotes/page.tsx 에 buildBriefRationaleSummary import", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../../app/dashboard/quotes/page.tsx"),
      "utf8",
    );
    expect(src).toMatch(/buildBriefRationaleSummary/);
  });

  it("quotes/page.tsx 에 findMostUrgentInventoryForQuote 사용 또는 inline 매칭", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../../app/dashboard/quotes/page.tsx"),
      "utf8",
    );
    expect(src).toMatch(/findMostUrgentInventoryForQuote|inventoryContext/);
  });

  it("quotes/page.tsx 에 /api/inventory useQuery", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../../app/dashboard/quotes/page.tsx"),
      "utf8",
    );
    expect(src).toMatch(/\/api\/inventory[^/]/);
  });
});
