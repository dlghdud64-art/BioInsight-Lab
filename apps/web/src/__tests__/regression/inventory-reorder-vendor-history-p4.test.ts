/**
 * §inventory-redesign P4 (호영님 2026-07-10) — 추천 벤더 + 구매 이력 정합 가드.
 *   PLAN_inventory-redesign Phase 4. 핸드오프 §추천 벤더·구매 이력.
 *
 * 매핑 결론: "추천 벤더 + 최근 구매 이력" 은 재발주안 검토 시트(ReorderReviewSheet)에 이미 완전 구현.
 *   → 신규 모달/API 0. 본 sentinel = 현재 구현 회귀 가드 (page-per-feature 신규 모달 재발 방지).
 *
 * canonical:
 *   - 데이터 truth = /api/inventory/reorder-recommendation (PurchaseRecord 집계). 신규 mutation 0.
 *   - 발주/견적 = query string pre-fill (DB write 0) — placeholder success 아님.
 *   - dead button 0 — 벤더 0건 시 "바로 발주" disabled + 사유, "견적 요청" live.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

const SHEET = "src/components/inventory/ReorderReviewSheet.tsx";
const API = "src/app/api/inventory/reorder-recommendation/route.ts";

describe("§inventory-redesign P4 — 추천 벤더 + 최근 구매 렌더 (이미 구현)", () => {
  it("ReorderReviewSheet 추천 벤더 + 최근 구매 섹션 렌더", () => {
    const src = read(SHEET);
    expect(src).toMatch(/추천 벤더/);
    expect(src).toMatch(/최근 구매/);
  });

  it("가짜 0 금지 — 최근 구매 length>0 조건부 렌더", () => {
    const src = read(SHEET);
    expect(src).toMatch(/data\.recentPurchases\.length\s*>\s*0/);
  });
});

describe("§inventory-redesign P4 — dead button 0 (정직 disabled + 사유)", () => {
  it("바로 발주 = 벤더 없음/발주 OFF 시 disabled (placeholder success 아님)", () => {
    const src = read(SHEET);
    expect(src).toMatch(/disabled=\{!hasVendor\s*\|\|\s*!purchasingOn\}/);
  });

  it("발주 OFF 정직 사유 노출 (dead button 아님 — 견적 요청 live)", () => {
    const src = read(SHEET);
    expect(src).toMatch(/발주 기능은 준비 중입니다/);
    expect(src).toMatch(/견적 요청/);
  });

  it("발주/견적 = query string pre-fill (DB write 0) — 실 라우팅", () => {
    const src = read(SHEET);
    expect(src).toMatch(/prefill:\s*"reorder-recommendation"/);
    expect(src).toMatch(/params\.set\("supplier"/);
  });
});

describe("§inventory-redesign P4 — 데이터 truth = reorder-recommendation API (신규 0)", () => {
  it("API 가 PurchaseRecord 집계로 vendors + recentPurchases 응답", () => {
    const src = read(API);
    expect(src).toMatch(/recentPurchases/);
    expect(src).toMatch(/vendorName/);
  });
});
