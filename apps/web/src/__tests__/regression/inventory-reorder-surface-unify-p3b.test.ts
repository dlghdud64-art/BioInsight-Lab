/**
 * §inventory-reorder-surface-unify P3b — ReorderReviewSheet 바로 발주 purchasing-off 게이팅
 *   (PLAN: docs/plans/PLAN_inventory-reorder-surface-unify.md)
 *
 * honesty: ENABLE_PURCHASING off 시 "바로 발주"(PO) disabled + 정직 사유(§purchasing-hide 일관, dead button 아님).
 *   [견적 요청]·검토는 불변(live). §11.310 query-string/PO draft wiring + vendor-0 disable 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const SHEET = "src/components/inventory/ReorderReviewSheet.tsx";

describe("§inventory-reorder-surface-unify P3b — 바로 발주 purchasing-off 게이팅", () => {
  const src = read(SHEET);
  it("ENABLE_PURCHASING flag 조회(getFlag)", () => {
    expect(src).toMatch(/from "@\/lib\/feature-flags"/);
    expect(src).toMatch(/getFlag\("ENABLE_PURCHASING"\)/);
  });
  it("바로 발주 disabled = !hasVendor || !purchasingOn (vendor-0 + purchasing-off)", () => {
    expect(src).toMatch(/disabled=\{!hasVendor \|\| !purchasingOn\}/);
  });
  it("handleDirectPurchase 가드에 purchasing-off 포함", () => {
    expect(src).toMatch(/if \(!hasVendor \|\| !purchasingOn\) return/);
  });
  it("off 시 정직 사유 노출(dead button 아님) — testid + 안내 문구", () => {
    expect(src).toMatch(/data-testid="reorder-review-purchasing-off"/);
    expect(src).toMatch(/발주 기능은 준비 중입니다/);
    expect(src).toMatch(/!purchasingOn && \(/);
  });
});

describe("§inventory-reorder-surface-unify P3b — 회귀 0 (§11.310 보존)", () => {
  const src = read(SHEET);
  it("견적 요청(live) 불변 — quotes query string", () => {
    expect(src).toMatch(/router\.push\(`\/dashboard\/quotes\?\$\{params\.toString\(\)\}`\)/);
    expect(src).toMatch(/data-testid="reorder-review-request-quote-cta"/);
  });
  it("바로 발주 PO draft wiring 불변 — purchase-orders/new + prefill", () => {
    expect(src).toMatch(/router\.push\(`\/dashboard\/purchase-orders\/new\?\$\{params\.toString\(\)\}`\)/);
    expect(src).toMatch(/prefill:\s*["']reorder-recommendation["']/);
  });
  it("amber/orange 0 (§11.310 색상 정합) — 사유 문구 muted slate", () => {
    expect(src).not.toMatch(/bg-amber-|text-amber-|bg-orange-/);
  });
});
