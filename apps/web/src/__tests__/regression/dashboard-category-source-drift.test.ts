/**
 * §category-source-drift — 카테고리별 지출 canonical 소스 정합 sentinel
 *
 * 근본원인: dashboard/stats 의 categorySpending 만 Order/OrderItem(ordersWithItems +
 *   productCategoryMap)에서 파생됐고, 나머지 모든 지출(트렌드/이번달/누적)은 PurchaseRecord 에서
 *   파생 → PurchaseRecord 로만 채워진 계정(guest-demo demo seed 등)에선 지출 트렌드는 뜨는데
 *   카테고리 비중만 영구 empty. (대시보드 A5/B1 카테고리 카드가 실데이터로 안 켜지던 원인.)
 *
 * 수리: categorySpending 을 canonical 지출원장 PurchaseRecord.category 에서 파생(spend 와 동일 소스).
 *   recentPurchaseRecords(6개월 window) select 에 category 추가 + 그 set 에서 category 별 합산.
 *   불필요해진 product category 조회(allProductIds/products/productCategoryMap)는 제거(쿼리 1개 절감).
 *
 * 회귀 0: categorySpendingArray 출력 shape + stats payload 키 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const STATS = readFileSync(join(REPO_ROOT, "src/app/api/dashboard/stats/route.ts"), "utf8");

describe("§category-source-drift — categorySpending = PurchaseRecord.category 파생", () => {
  it("recentPurchaseRecords(PurchaseRecord) 의 category 에서 파생", () => {
    expect(STATS).toMatch(/recentPurchaseRecords[\s\S]{0,120}\.forEach\([\s\S]{0,200}pr\.category/);
  });

  it("recentPurchaseRecords select 에 category 포함", () => {
    expect(STATS).toMatch(/select:\s*\{\s*amount:\s*true,\s*purchasedAt:\s*true,\s*category:\s*true\s*\}/);
  });
});

describe("§category-source-drift — 회귀(Order 파생 폐지 + 출력 보존)", () => {
  it("categorySpending 이 Order/OrderItem(productCategoryMap) 파생 아님", () => {
    expect(STATS).not.toMatch(/productCategoryMap/);
  });

  it("불필요 product category 조회(allProductIds) 제거(코드참조 0)", () => {
    // 주석 언급은 허용 — 실제 식별자 선언/사용(const allProductIds =) 만 차단.
    expect(STATS).not.toMatch(/const allProductIds\s*=/);
  });

  it("categorySpendingArray 출력 + stats payload 키 보존", () => {
    expect(STATS).toMatch(/categorySpendingArray/);
    expect(STATS).toMatch(/categorySpending:\s*categorySpendingArray/);
  });
});
