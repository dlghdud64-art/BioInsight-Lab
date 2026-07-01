/**
 * §11.298d #quotes-quote-panel-plain — quotes/page.tsx 2 + quote-panel 1 =
 *   3 dropdown Radix → inline plain. data-table.tsx (DropdownMenuCheckboxItem
 *   특수 pattern) 만 §11.298e 마지막 batch.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const QUOTES = readFileSync(resolve(__dirname, "../../app/dashboard/quotes/page.tsx"), "utf8");
const PANEL = readFileSync(resolve(__dirname, "../../app/_workbench/_components/quote-panel.tsx"), "utf8");

describe("§11.298d — quotes + quote-panel inline plain dropdown", () => {
  it("§11.298d trace marker (2 file)", () => {
    expect(QUOTES).toMatch(/§11\.298d/);
    expect(PANEL).toMatch(/§11\.298d/);
  });

  it("Radix DropdownMenu* import/사용 완전 부재 (2 file)", () => {
    [QUOTES, PANEL].forEach((src) => {
      expect(src).not.toMatch(/from "@\/components\/ui\/dropdown-menu"/);
      expect(src).not.toMatch(/<DropdownMenu(?:Trigger|Content|Item|Label|Separator)?\s/);
    });
  });

  describe("quotes/page.tsx — 모바일 더보기 + BOM upload", () => {
    it("isMobileMoreOpen + isBomDropdownOpen useState", () => {
      expect(QUOTES).toMatch(/const \[isMobileMoreOpen, setIsMobileMoreOpen\] = useState\(false\)/);
      expect(QUOTES).toMatch(/const \[isBomDropdownOpen, setIsBomDropdownOpen\] = useState\(false\)/);
    });

    it("모바일 더보기 — quote-header-more-actions-mobile testid + 견적서 비교/초안", () => {
      expect(QUOTES).toMatch(/data-testid="quote-header-more-actions-mobile"/);
      expect(QUOTES).toMatch(/runAiQuoteCompare\(\)/);
      // openQuoteDraftWorkbench 는 bare 핸들러 참조(onClick={openQuoteDraftWorkbench})로 wiring.
      expect(QUOTES).toMatch(/openQuoteDraftWorkbench\b/);
    });

    it("BOM upload — setIntakeDockSource('bom_import') + setIntakeDockOpen(true)", () => {
      expect(QUOTES).toMatch(/setIntakeDockSource\("bom_import"\)/);
      expect(QUOTES).toMatch(/setIntakeDockOpen\(true\)/);
    });
  });

  describe("quote-panel.tsx — 더보기 (CSV/공유)", () => {
    it("isExportMenuOpen useState + CSV 생성 + generateShareLink 보존", () => {
      expect(PANEL).toMatch(/const \[isExportMenuOpen, setIsExportMenuOpen\] = useState\(false\)/);
      expect(PANEL).toMatch(/quoteItems\.map\(\(item, index\) =>/);
      expect(PANEL).toMatch(/generateShareLink\("견적 요청 리스트", 30\)/);
    });

    it("CSV download blob + link.download 보존", () => {
      expect(PANEL).toMatch(/new Blob\(/);
      expect(PANEL).toMatch(/link\.download = `견적요청_/);
    });
  });
});
