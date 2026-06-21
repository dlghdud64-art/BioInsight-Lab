/**
 * §11.217 Phase 6 — RED test
 *
 * Goal: quote list 의 카드 ↔ 테이블 toggle. 대량 quote 처리 시 한눈에 audit
 *       가능. localStorage persist (사용자 선호 기억).
 *
 * canonical truth lock:
 *   - useState viewMode: "card" | "table" (default "card").
 *   - localStorage key "labaxis-quote-view-mode" — mount 시 read, change 시 write.
 *   - toggle button — Layout/List icon (lucide-react) + aria-pressed.
 *   - table column: 제목 / 상태 / 품목 / 회신 / 등록일 / actions.
 *   - row click → openQuoteContextRail (기존 동일 — 같은 detail panel 진입).
 *   - card 와 table 둘 다 같은 데이터 (filteredQuotes / urgent / inProgress / completed).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const src = readFileSync(PAGE_PATH, "utf8");

describe("§11.217 Phase 6 — quote list 카드 ↔ 테이블 toggle", () => {
  it("viewMode useState 정의", () => {
    expect(src).toMatch(/const\s+\[viewMode,\s*setViewMode\]/);
  });

  it("viewMode 타입 — 'card' | 'table'", () => {
    expect(src).toMatch(/"card"\s*\|\s*"table"|'card'\s*\|\s*'table'/);
  });

  it("localStorage persist — 'labaxis-quote-view-mode' key", () => {
    expect(src).toMatch(/labaxis-quote-view-mode/);
  });

  it("toggle button — aria-pressed attribute (a11y)", () => {
    // viewMode 와 연동된 aria-pressed
    expect(src).toMatch(/aria-pressed=\{viewMode\s*===\s*["'](card|table)["']\}/);
  });

  it("table render 분기 — viewMode === 'table'", () => {
    expect(src).toMatch(/viewMode\s*===\s*["']table["']/);
  });

  it("table column header — 견적케이스 / 단계 / 회신 (§quote-table-sian P2 COLUMN_LABEL 매핑)", () => {
    // §quote-table-sian P2 — 제목→견적케이스, 상태→단계, 품목 컬럼 제거.
    expect(src).toMatch(/"견적케이스"/);
    expect(src).toMatch(/"회신"/);
  });

  it("§11.217 Phase 6 cluster trace marker", () => {
    expect(src).toMatch(/§11\.217 Phase 6|table view|뷰 모드|보기 모드/);
  });
});
