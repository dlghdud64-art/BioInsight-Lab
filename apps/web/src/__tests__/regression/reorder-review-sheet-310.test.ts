/**
 * §11.310 #reorder-review-flow — Regression sentinel
 *
 * 호영님 P1 spec (2026-05-26):
 *   재고 운영 도우미 (inventory-ai-assistant-panel) 의 재발주 카드/sticky CTA
 *   재정렬 + ReorderReviewSheet 바텀시트 신규.
 *
 * 카드 button (호영님 spec):
 *   - "재발주안 검토하기" 제거 (sticky CTA 단일화 — 중복 해소)
 *   - "추천 벤더 보기" 유지 (탐색 액션)
 *   - "구매 이력 보기" 신설 (탐색 액션)
 *
 * Sticky CTA:
 *   - "재발주안 검토하기" → 바텀시트 wiring (handleOpenReorderSheet)
 *   - 색상: bg-blue-600 → bg-green-600 (호영님 spec "실행 가능 액션")
 *
 * 바텀시트 (호영님 spec):
 *   - 품목 / 권장 수량 / 보관 위치 요약
 *   - 추천 벤더 list (Q32 = A: PurchaseRecord 집계, MVP 빈 array)
 *   - 최근 구매 list (MVP 빈 array)
 *   - 예상 금액 = 권장 수량 × 최근 단가
 *   - [견적 요청] (Q30 = A: query string) / [바로 발주] (Q31 = A: query string + draft)
 *
 * 색상 정합:
 *   - urgency.high amber-50/amber-600 → yellow-100/yellow-700 (§11.302)
 *   - urgency.urgent red-50/red-600 → red-50/red-700 (text 강화)
 *   - isHighlighted bg-orange-50/50 → bg-emerald-50/40 (재발주 권장 톤)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SHEET_PATH = "src/components/inventory/ReorderReviewSheet.tsx";
const PANEL_PATH = "src/components/ai/inventory-ai-assistant-panel.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.310 — ReorderReviewSheet 컴포넌트", () => {
  it("파일 존재 + export", () => {
    expect(existsSync(join(REPO_ROOT, SHEET_PATH))).toBe(true);
    const src = read(SHEET_PATH);
    expect(src).toMatch(/export\s+function\s+ReorderReviewSheet/);
    expect(src).toMatch(/export\s+interface\s+ReorderReviewInput/);
  });

  it("Sheet (side=bottom) + testid", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/side="bottom"/);
    expect(src).toMatch(/data-testid="reorder-review-sheet"/);
  });

  it("[견적 요청] CTA — query string pre-fill (Q30 = A)", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/data-testid="reorder-review-request-quote-cta"/);
    expect(src).toMatch(/router\.push\(`\/dashboard\/quotes\?\$\{params\.toString\(\)\}`\)/);
    expect(src).toMatch(/productName:\s*data\.productName/);
    expect(src).toMatch(/reason:\s*["']안전 재고 미달/);
  });

  it("[바로 발주] CTA — query string + PO draft (Q31 = A)", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/data-testid="reorder-review-direct-purchase-cta"/);
    expect(src).toMatch(/router\.push\(`\/dashboard\/purchase-orders\/new\?\$\{params\.toString\(\)\}`\)/);
    expect(src).toMatch(/prefill:\s*["']reorder-recommendation["']/);
    expect(src).toMatch(/disabled=\{!hasVendor\}/);
  });

  it("색상 — green-600 (실행 가능 액션 — 호영님 spec)", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/bg-green-600 hover:bg-green-700/);
  });

  it("amber/orange 0 (§11.310 scope 정합)", () => {
    const src = read(SHEET_PATH);
    expect(src).not.toMatch(/bg-amber-/);
    expect(src).not.toMatch(/text-amber-/);
    expect(src).not.toMatch(/bg-orange-/);
    expect(src).not.toMatch(/border-amber-/);
  });

  it("추천 벤더 0건 시 fallback — '바로 발주' disabled + '견적 요청' only 안내", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/data-testid="reorder-review-no-vendor"/);
    expect(src).toMatch(/등록된 공급사가 없습니다.*견적 요청으로 시작/);
  });

  it("예상 금액 = 권장 수량 × 최근 단가 (자동 계산)", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/estimatedAmount\s*=\s*primaryVendor[\s\S]{0,80}data\.recommendedQty\s*\*\s*primaryVendor\.unitPrice/);
    expect(src).toMatch(/data-testid="reorder-review-estimated-amount"/);
  });

  it("최근 구매 + 추천 벤더 list — testid + map slice(0, 3)", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/data-testid="reorder-review-vendor-row"/);
    expect(src).toMatch(/data-testid="reorder-review-purchase-row"/);
    expect(src).toMatch(/data\.vendors\.slice\(0,\s*3\)/);
    expect(src).toMatch(/data\.recentPurchases\.slice\(0,\s*3\)/);
  });

  it("터치 영역 ≥ 44px (모바일 a11y, h-11 min-h-[44px])", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/h-11 min-h-\[44px\]/);
  });
});

describe("§11.310 — inventory-ai-assistant-panel wiring", () => {
  it("ReorderReviewSheet import", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/import\s*\{[^}]*ReorderReviewSheet[^}]*type\s+ReorderReviewInput[^}]*\}\s*from\s*["']@\/components\/inventory\/ReorderReviewSheet["']/);
  });

  it("isReorderSheetOpen + selectedReorderForReview state", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/isReorderSheetOpen.*useState\(false\)/);
    expect(src).toMatch(/selectedReorderForReview/);
  });

  it("handleOpenReorderSheet (선택된 recommendation + sheet open + caller props 호환)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/handleOpenReorderSheet[\s\S]{0,200}setSelectedReorderForReview/);
    expect(src).toMatch(/setIsReorderSheetOpen\(true\)/);
    expect(src).toMatch(/onReviewReorder\?\.\(recommendation\)/);
  });

  it("ReorderReviewInput 매핑 (productName / recommendedQty / vendors / recentPurchases)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/reorderReviewInput:\s*ReorderReviewInput\s*\|\s*null/);
    expect(src).toMatch(/productName:\s*selectedReorderForReview\.productName/);
    expect(src).toMatch(/recommendedQty:\s*selectedReorderForReview\.recommendedQty/);
  });

  it("StickyActions onReviewReorder = handleOpenReorderSheet (sticky CTA wiring)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/<StickyActions[\s\S]{0,200}onReviewReorder=\{handleOpenReorderSheet\}/);
  });

  it("Sticky CTA 색상 — green-600 (호영님 spec)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/data-testid="reorder-sticky-cta"/);
    expect(src).toMatch(/bg-green-600 hover:bg-green-700/);
  });

  it("ReorderReviewSheet 렌더 (panel Sheet 내부)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/<ReorderReviewSheet[\s\S]{0,200}open=\{isReorderSheetOpen\}[\s\S]{0,200}data=\{reorderReviewInput\}/);
  });
});

describe("§11.310 — 카드 내부 button 분리 (호영님 spec)", () => {
  it("'재발주안 검토하기' button 카드 내부에서 제거 (sticky CTA 단일화)", () => {
    const src = read(PANEL_PATH);
    // ReorderSection 안 (line 470~596) "재발주안 검토하기" button 제거 확인
    // sticky CTA (line 793~) 에는 보존 — 단일 위치
    const reorderSectionMatch = src.match(/function ReorderSection\([\s\S]{0,8000}\n\}\n\n\/\/ ── 5\. Lot/);
    expect(reorderSectionMatch).toBeTruthy();
    if (reorderSectionMatch) {
      expect(reorderSectionMatch[0]).not.toMatch(/재발주안 검토하기/);
    }
  });

  it("카드 '추천 벤더 보기' 유지 (testid)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/data-testid="reorder-card-view-vendors-cta"/);
    expect(src).toMatch(/추천 벤더 보기/);
  });

  it("카드 '구매 이력 보기' 신설 (testid + History icon + 라우팅)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/data-testid="reorder-card-view-history-cta"/);
    expect(src).toMatch(/구매 이력 보기/);
    expect(src).toMatch(/<History className="h-3 w-3 mr-1"/);
    expect(src).toMatch(/\/dashboard\/purchases\?/);
  });
});

describe("§11.310 — 색상 정합 (§11.302 신호등 체계, amber → yellow)", () => {
  it("urgency.high amber → yellow-100/yellow-700", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/high:\s*\{[\s\S]{0,200}bg-yellow-100 text-yellow-700 border-yellow-200/);
  });

  it("urgency.urgent — red 톤 보존 (text-red-700 강화)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/urgent:\s*\{[\s\S]{0,200}bg-red-50 text-red-700 border-red-200/);
  });

  it("ReorderSection isHighlighted — orange-50 → emerald-50 (재발주 권장 톤)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/isHighlighted \? "bg-emerald-50\/40"/);
  });

  it("ReorderSection 안 amber-50 / amber-600 / orange-50 잔여 0 (§11.310 scope)", () => {
    const src = read(PANEL_PATH);
    const reorderSectionMatch = src.match(/function ReorderSection\([\s\S]{0,8000}\n\}\n\n\/\/ ── 5\. Lot/);
    expect(reorderSectionMatch).toBeTruthy();
    if (reorderSectionMatch) {
      expect(reorderSectionMatch[0]).not.toMatch(/bg-amber-50 text-amber-600/);
      expect(reorderSectionMatch[0]).not.toMatch(/bg-orange-50\/50/);
    }
  });
});

describe("§11.310 — 회귀 0 (보존)", () => {
  it("ReorderSection 라벨 (재발주 우선순위 / 권장 발주 수량 / 추천 벤더) 보존", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/재발주 우선순위/);
    expect(src).toMatch(/권장 발주 수량/);
    expect(src).toMatch(/추천 벤더/);
  });

  it("StickyActions hasReorder 분기 + onViewActions + onCreatePurchaseRequest 보존", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/onCreatePurchaseRequest/);
    expect(src).toMatch(/onViewActions/);
    expect(src).toMatch(/hasReorder/);
  });

  it("LotExpirySection 변경 0 (§11.310 scope 외 — 후속 §11.302d-6)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/function LotExpirySection/);
    // LotExpirySection 의 isHighlighted bg-amber-50\/40 — out of scope (보존)
  });
});
