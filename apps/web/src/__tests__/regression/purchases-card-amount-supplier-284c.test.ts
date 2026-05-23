/**
 * §11.284c #purchases-card-amount-supplier — 구매 운영 카드 본문 텍스트 제거 +
 *   금액 (견적가) + 공급사명 1줄 표시 (호영님 P0 spec, §11.284 cluster C).
 *
 * 호영님 spec: "본문 텍스트 ('안녕하세요. 아래 품목 1건에 대한…') 제거.
 *   카드에 금액 (견적가 기준) + 공급사명 표시."
 *
 * Truth Reconciliation (Phase 0 audit):
 *   - 위치: purchases/page.tsx line 770-810 (카드 본문 영역)
 *   - 기존: <p>{item.itemSummary}</p> (line 773, §11.277c 모바일 접힘/펼침 적용)
 *   - PurchaseConversionItem source:
 *     · totalBudget: number | null (견적가 합계)
 *     · currency: string (통화)
 *     · aiOptions[]: { id, supplierName, recommendationLevel, price, ... }
 *     · selectedOptionId: string | null (사용자 선택 옵션)
 *
 * Fix (minimum diff, 1 file 1 block swap):
 *   - <p>{item.itemSummary}</p> 제거 (UI 한정, data source 보존)
 *   - 신규 amount + supplier 1줄 (`data-testid="purchases-card-amount-supplier"`)
 *   - amount = Intl.NumberFormat KRW currency format (item.totalBudget)
 *   - supplier 우선순위: selectedOption?.supplierName > primary?.supplierName >
 *     aiOptions[0]?.supplierName > null
 *   - amount + supplier 모두 null 시 null return (카드 본문 정합 보존)
 *
 * canonical truth 보존:
 *   - item.itemSummary data source 보존 (engine + resolver 변경 0)
 *   - item.totalBudget / currency / aiOptions / selectedOptionId source 보존
 *   - h3 requestTitle 보존
 *   - 막힘 확인 / 다음 단계 block 보존 (§11.277b)
 *   - §11.277c isExpanded toggle button 보존 (모바일 접힘/펼침)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/dashboard/purchases/page.tsx"),
  "utf8",
);

describe("§11.284c — 카드 본문 텍스트 제거 + 금액/공급사명 추가", () => {
  it("§11.284c trace marker comment 존재", () => {
    expect(PAGE).toMatch(/§11\.284c/);
  });

  it("기존 itemSummary <p> 표시 제거 (line-clamp-2 패턴 잔존 부재)", () => {
    // §11.277c 의 isExpanded 분기로 line-clamp-2 + itemSummary 표시했던 패턴이
    // §11.284c 후속으로 제거. itemSummary 가 카드 본문에 더 이상 표시되지 않음.
    expect(PAGE).not.toMatch(/text-xs text-slate-500 mb-3 line-clamp-2[\s\S]{0,80}{item\.itemSummary}/);
  });

  it("금액/공급사명 1줄 testid 표시 (purchases-card-amount-supplier)", () => {
    expect(PAGE).toMatch(/data-testid="purchases-card-amount-supplier"/);
  });

  it("Intl.NumberFormat ko-KR currency format 사용 (item.totalBudget)", () => {
    expect(PAGE).toMatch(/Intl\.NumberFormat\("ko-KR"/);
    expect(PAGE).toMatch(/item\.totalBudget/);
    expect(PAGE).toMatch(/style:\s*"currency"/);
  });

  it("supplier 우선순위: selectedOption > primary > [0] (3-step fallback)", () => {
    expect(PAGE).toMatch(/selectedOptionId[\s\S]{0,80}aiOptions\.find/);
    expect(PAGE).toMatch(/recommendationLevel === "primary"/);
  });
});

describe("§11.284c — invariant 보존 (canonical truth)", () => {
  it("PurchaseConversionItem.itemSummary data source 보존 (engine 변경 0)", () => {
    // itemSummary 가 type 안에 보존되어야 함. page.tsx UI 본문 표시는 §11.284c
    // 후속 제거됐지만 search filter (`i.itemSummary.toLowerCase`) 안 사용 유지.
    // 패턴: `itemSummary` 단어 자체가 어딘가에 잔존 (data source 보존 signal).
    expect(PAGE).toMatch(/itemSummary/);
  });

  it("PurchaseConversionItem.totalBudget + currency + aiOptions + selectedOptionId source 보존", () => {
    expect(PAGE).toMatch(/item\.totalBudget/);
    expect(PAGE).toMatch(/item\.currency/);
    expect(PAGE).toMatch(/item\.aiOptions/);
    expect(PAGE).toMatch(/item\.selectedOptionId/);
  });

  it("h3 requestTitle 보존", () => {
    expect(PAGE).toMatch(/<h3[\s\S]{0,100}{item\.requestTitle}<\/h3>/);
  });

  it("§11.277b 다음 단계 onClick wiring (purchases-card-next-step-cta) 보존", () => {
    expect(PAGE).toMatch(/data-testid="purchases-card-next-step-cta"/);
  });

  it("§11.277c isExpanded toggle button (purchases-card-mobile-toggle) 보존", () => {
    expect(PAGE).toMatch(/purchases-card-mobile-toggle/);
  });

  it("막힘 확인 / blockerReason block 보존", () => {
    expect(PAGE).toMatch(/막힘 확인/);
    expect(PAGE).toMatch(/item\.blockerReason/);
  });
});
