/**
 * §11.230c (e) #quote-card-keyboard-nav — 호영님 v2 #23 sub-spec (e) 잔여 백로그
 *
 * 호영님 spec: 카드 뷰 키보드 nav — Home/End/PageUp/PageDown 4 키 + ArrowUp/ArrowDown.
 *   §11.230c (c) 테이블 4 키 패턴 reuse — 카드 뷰 unified index (urgentQuotes +
 *   inProgressQuotes + completedQuotes 합산) 으로 적용.
 *
 * canonical truth lock:
 *   - QuoteCard 시그니처 보존 (cardIndex optional prop 추가만)
 *   - 3 섹션 분기 (urgent/inProgress/completed) 보존
 *   - sortedQuotes / setSelectedQuoteId / openQuoteContextRail 보존
 *   - §11.230c (c) 테이블 4 키 패턴 lineage 유지
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.230c (e) #1 — QuoteCard cardIndex prop + data-card-index + tabIndex", () => {
  it("QuoteCard cardIndex prop 추가", () => {
    expect(page).toMatch(/cardIndex\?\s*:\s*number/);
  });

  it("QuoteCard outer wrapper data-card-index attr forward", () => {
    expect(page).toMatch(/data-card-index/);
  });

  it("QuoteCard outer wrapper tabIndex={0}", () => {
    expect(page).toMatch(/tabIndex=\{0\}/);
  });
});

describe("§11.230c (e) #2 — 키보드 nav (Home/End/PageUp/PageDown + Enter/Space)", () => {
  it("QuoteCard onKeyDown handler 추가", () => {
    expect(page).toMatch(/onKeyDown=\{[\s\S]{0,200}\(e\)\s*=>/);
  });

  it("onKeyDown 안 Home 분기 → querySelector [data-card-index]", () => {
    expect(page).toMatch(/e\.key\s*===\s*["']Home["'][\s\S]{0,800}\[data-card-index\]/);
  });

  it("onKeyDown 안 End 분기", () => {
    expect(page).toMatch(/e\.key\s*===\s*["']End["']/);
  });

  it("onKeyDown 안 PageUp + PageDown 분기 (5 step jump)", () => {
    expect(page).toMatch(/e\.key\s*===\s*["']PageUp["']/);
    expect(page).toMatch(/e\.key\s*===\s*["']PageDown["']/);
  });

  it("onKeyDown 안 Enter/Space → onSelect()", () => {
    expect(page).toMatch(/e\.key\s*===\s*["']Enter["'][\s\S]{0,200}onSelect/);
  });
});

describe("§11.230c (e) #3 — invariant 보존", () => {
  it("3 섹션 분기 (urgentQuotes / inProgressQuotes / completedQuotes) 보존", () => {
    expect(page).toMatch(/urgentQuotes/);
    expect(page).toMatch(/inProgressQuotes/);
    expect(page).toMatch(/completedQuotes/);
  });

  it("QuoteCard isSelected/onSelect/isSelectable/isSelectedForBatch/onToggleSelect 시그니처 보존", () => {
    expect(page).toMatch(/isSelected\?\s*:\s*boolean/);
    expect(page).toMatch(/onSelect\?\s*:\s*\(\)\s*=>\s*void/);
    expect(page).toMatch(/isSelectable\?\s*:\s*boolean/);
  });

  it("§11.230c (c) 테이블 4 키 패턴 보존 (data-row-index Home/End)", () => {
    expect(page).toMatch(/e\.key\s*===\s*["']Home["'][\s\S]{0,400}data-row-index/);
    expect(page).toMatch(/e\.key\s*===\s*["']End["'][\s\S]{0,400}data-row-index/);
  });

  it("§11.230c (e) trace marker comment", () => {
    expect(page).toMatch(/§11\.230c \(e\)[\s\S]{0,300}(card|keyboard|nav|focused)/i);
  });
});
