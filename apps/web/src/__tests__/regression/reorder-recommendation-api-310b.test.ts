/**
 * §11.310b #reorder-recommendation — Regression sentinel
 *
 * 호영님 P1 spec (Q32 = A, 2026-05-26):
 *   재발주안 검토 sheet 의 추천 벤더 + 최근 구매 list 데이터.
 *   /api/inventory/reorder-recommendation 신규 (PurchaseRecord 집계) +
 *   useReorderRecommendation hook + panel wiring.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const API_PATH = "src/app/api/inventory/reorder-recommendation/route.ts";
const HOOK_PATH = "src/hooks/use-reorder-recommendation.ts";
const PANEL_PATH = "src/components/ai/inventory-ai-assistant-panel.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.310b — /api/inventory/reorder-recommendation route", () => {
  it("파일 존재 + GET handler", () => {
    expect(existsSync(join(REPO_ROOT, API_PATH))).toBe(true);
    const src = read(API_PATH);
    expect(src).toMatch(/export\s+async\s+function\s+GET\s*\(/);
  });

  it("auth() 인증 + 401 분기", () => {
    const src = read(API_PATH);
    expect(src).toMatch(/await\s+auth\(\)/);
    expect(src).toMatch(/Unauthorized.*401/);
  });

  it("productName 필수 (없으면 400)", () => {
    const src = read(API_PATH);
    expect(src).toMatch(/productName 은 필수입니다/);
  });

  it("최근 3개월 (90 days) 필터", () => {
    const src = read(API_PATH);
    expect(src).toMatch(/90\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    expect(src).toMatch(/purchasedAt:\s*\{\s*gte:\s*threeMonthsAgo\s*\}/);
  });

  it("itemName insensitive contains (productName 매칭)", () => {
    const src = read(API_PATH);
    expect(src).toMatch(/itemName:\s*\{\s*contains:\s*productName,\s*mode:\s*["']insensitive["']\s*\}/);
  });

  it("scopeKey 격리 (user.id)", () => {
    const src = read(API_PATH);
    expect(src).toMatch(/scopeKey\s*=\s*user\.id/);
    expect(src).toMatch(/where:\s*\{\s*\n\s*scopeKey,/);
  });

  it("recentPurchases — findMany take 3 + orderBy purchasedAt desc", () => {
    const src = read(API_PATH);
    expect(src).toMatch(/db\.purchaseRecord\.findMany[\s\S]{0,200}orderBy:\s*\{\s*purchasedAt:\s*["']desc["']\s*\}[\s\S]{0,80}take:\s*3/);
  });

  it("vendors — groupBy vendorName + _count + _max(purchasedAt+unitPrice) + take 3", () => {
    const src = read(API_PATH);
    expect(src).toMatch(/db\.purchaseRecord\.groupBy/);
    expect(src).toMatch(/by:\s*\[["']vendorName["']\]/);
    expect(src).toMatch(/_count:\s*\{\s*_all:\s*true\s*\}/);
    expect(src).toMatch(/_max:\s*\{\s*purchasedAt:\s*true,\s*unitPrice:\s*true\s*\}/);
    expect(src).toMatch(/take:\s*3/);
  });

  it("응답 shape — vendors + recentPurchases", () => {
    const src = read(API_PATH);
    expect(src).toMatch(/interface\s+ReorderRecommendationResponse/);
    expect(src).toMatch(/vendors:\s*ReorderVendorSuggestion\[\]/);
    expect(src).toMatch(/recentPurchases:\s*ReorderRecentPurchase\[\]/);
  });

  it("poNumber — quoteId 우선, 없으면 record id 단축", () => {
    const src = read(API_PATH);
    expect(src).toMatch(/poNumber:\s*r\.quoteId\s*\?\?\s*r\.id\.slice\(0,\s*8\)\.toUpperCase\(\)/);
  });
});

describe("§11.310b — useReorderRecommendation hook", () => {
  it("파일 존재 + export", () => {
    expect(existsSync(join(REPO_ROOT, HOOK_PATH))).toBe(true);
    const src = read(HOOK_PATH);
    expect(src).toMatch(/export\s+function\s+useReorderRecommendation/);
  });

  it("React Query useQuery + queryKey + queryFn", () => {
    const src = read(HOOK_PATH);
    expect(src).toMatch(/useQuery<ReorderRecommendationResponse>/);
    expect(src).toMatch(/queryKey:\s*\["reorder-recommendation",\s*productName\]/);
    expect(src).toMatch(/queryFn:\s*async/);
  });

  it("enabled: !!productName (null 시 호출 0)", () => {
    const src = read(HOOK_PATH);
    expect(src).toMatch(/enabled:\s*!!productName\s*&&\s*productName\.trim\(\)\.length\s*>\s*0/);
  });

  it("staleTime 60s + retry 1", () => {
    const src = read(HOOK_PATH);
    expect(src).toMatch(/staleTime:\s*60_000/);
    expect(src).toMatch(/retry:\s*1/);
  });

  it("응답 fallback (vendors / recentPurchases 빈 array)", () => {
    const src = read(HOOK_PATH);
    expect(src).toMatch(/vendors:\s*data\?\.vendors\s*\?\?\s*\[\]/);
    expect(src).toMatch(/recentPurchases:\s*data\?\.recentPurchases\s*\?\?\s*\[\]/);
  });
});

describe("§11.310b — panel wiring (hook → reorderReviewInput)", () => {
  it("useReorderRecommendation import + 호출", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/import\s*\{\s*useReorderRecommendation\s*\}\s*from\s*["']@\/hooks\/use-reorder-recommendation["']/);
    expect(src).toMatch(/recommendationData\s*=\s*useReorderRecommendation\(\s*selectedReorderForReview\?\.productName\s*\?\?\s*null\s*\)/);
  });

  it("vendors fallback chain — hook 데이터 우선 → suggestedVendor MVP fallback", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/recommendationData\.vendors\.length\s*>\s*0[\s\S]{0,300}recommendationData\.vendors\.map/);
    expect(src).toMatch(/selectedReorderForReview\.suggestedVendor/);
  });

  it("recentPurchases — hook 데이터 매핑 (poNumber/purchasedAt/quantity/unitPrice)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/recentPurchases:\s*recommendationData\.recentPurchases\.map/);
    expect(src).toMatch(/poNumber:\s*p\.poNumber/);
    expect(src).toMatch(/purchasedAt:\s*p\.purchasedAt/);
    expect(src).toMatch(/quantity:\s*p\.quantity/);
    expect(src).toMatch(/unitPrice:\s*p\.unitPrice/);
  });
});

describe("§11.310b — 회귀 0 (보존)", () => {
  it("§11.310 ReorderReviewSheet 컴포넌트 변경 0 (props shape 동일)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/<ReorderReviewSheet[\s\S]{0,200}open=\{isReorderSheetOpen\}/);
    expect(src).toMatch(/data=\{reorderReviewInput\}/);
  });

  it("§11.310 handleOpenReorderSheet — state 관리 보존", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/handleOpenReorderSheet/);
    expect(src).toMatch(/setSelectedReorderForReview/);
  });

  it("§11.310 sticky CTA green + 카드 button 분리 보존", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/data-testid="reorder-sticky-cta"/);
    expect(src).toMatch(/bg-green-600 hover:bg-green-700/);
    expect(src).toMatch(/data-testid="reorder-card-view-vendors-cta"/);
    expect(src).toMatch(/data-testid="reorder-card-view-history-cta"/);
  });
});
