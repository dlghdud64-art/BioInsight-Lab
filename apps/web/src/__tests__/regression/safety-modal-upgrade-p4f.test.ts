/**
 * §safety-modal-upgrade SM-P4f (호영님 2026-07-04) — 안전 목록 최근점검 투영 배선.
 * P4b 물질 점검 저장이 Product.lastInspectedAt 갱신 → 어댑터가 lastInspection 으로 투영(이전 하드코딩 null).
 * GET /api/safety/products 는 include 사용이라 Product 스칼라(lastInspectedAt) 자동 반환.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const R = join(__dirname, "..", "..");
const ADAPTER = readFileSync(join(R, "lib/safety/product-to-safety-item.ts"), "utf8");

describe("§safety-modal-upgrade SM-P4f — 최근점검 투영", () => {
  it("SafetyApiProduct 에 lastInspectedAt 필드", () => {
    expect(ADAPTER).toMatch(/lastInspectedAt\?:\s*string \| null/);
  });
  it("lastInspection = product.lastInspectedAt 매핑(하드코딩 null 반전)", () => {
    expect(ADAPTER).toMatch(/lastInspection: p\.lastInspectedAt \?/);
    expect(ADAPTER).not.toMatch(/lastInspection: null,/);
  });
});
