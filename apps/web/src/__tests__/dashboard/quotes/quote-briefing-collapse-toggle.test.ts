/**
 * §11.248e-2 #quote-briefing-collapse-toggle — 호영님 P0 §11.248 #5 잔여 백로그
 *
 * 호영님 spec ("일정 너비 이하... 접힘 토글" + 1200px+ 운영자 선택권 확장):
 *   - 1200px+ Briefing 패널 접힘/펼침 토글 (현재 항상 노출)
 *   - 접힘 = full hide (호영님 결정 옵션 A) + 우측 edge floating button
 *   - localStorage 으로 사용자 선택 영구화 (reload 보존)
 *
 * canonical truth lock:
 *   - §11.248e breakpoint min-[1200px]:flex 보존 (1200px+ 만 적용, <1200px bottom-sheet 분기 유지)
 *   - selectedQuote / selectedSignals / selectedOpStatus 시스템 보존
 *   - 패널 내부 모든 invariant 보존 (w-[480px] / OPERATIONAL BRIEFING / closeQuoteContextRail / 44px button / break-keep)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.248e-2 #1 — isBriefingCollapsed state + localStorage 영구화", () => {
  it("isBriefingCollapsed useState (default false)", () => {
    expect(page).toMatch(/(isBriefingCollapsed|briefingCollapsed)[\s\S]{0,80}useState/);
  });

  it("BRIEFING_COLLAPSED_LS_KEY localStorage key", () => {
    expect(page).toMatch(/labaxis-briefing-collapsed/);
  });

  it("localStorage hydration useEffect (window 존재 시)", () => {
    // mount 시 localStorage.getItem 호출 + setIsBriefingCollapsed
    expect(page).toMatch(/localStorage\.getItem\([\s\S]{0,100}briefing|labaxis-briefing-collapsed/);
  });

  it("localStorage persistence useEffect (collapsed 변경 시 setItem)", () => {
    expect(page).toMatch(/localStorage\.setItem\([\s\S]{0,150}(briefingCollapsed|isBriefingCollapsed|labaxis-briefing-collapsed)/);
  });
});

describe("§11.248e-2 #2 — 접기 button + 펼치기 floating button", () => {
  it("패널 header 안 접기 button (ChevronsRight + setIsBriefingCollapsed(true) 양방향)", () => {
    // onClick={() => setIsBriefingCollapsed(true)} ... <ChevronsRight /> 또는 반대
    expect(page).toMatch(
      /(ChevronsRight|ChevronRight)[\s\S]{0,500}setIsBriefingCollapsed\(true\)|setIsBriefingCollapsed\(true\)[\s\S]{0,500}(ChevronsRight|ChevronRight)/,
    );
  });

  it("패널 자체 conditional render — isBriefingCollapsed 분기 (early return 또는 !cond)", () => {
    // (a) if (isBriefingCollapsed) return null; 또는 (b) !isBriefingCollapsed 조건
    expect(page).toMatch(/(if\s*\(\s*isBriefingCollapsed\s*\)\s*return\s+null|!isBriefingCollapsed|!\s*briefingCollapsed)/);
  });

  it("floating expand button — ChevronsLeft + setIsBriefingCollapsed(false) 양방향", () => {
    expect(page).toMatch(
      /(ChevronsLeft|ChevronLeft)[\s\S]{0,500}setIsBriefingCollapsed\(false\)|setIsBriefingCollapsed\(false\)[\s\S]{0,500}(ChevronsLeft|ChevronLeft)/,
    );
  });

  it("floating expand button — min-[1200px] 한정 + sticky top + right-0", () => {
    // hidden min-[1200px]:flex 또는 비슷 분기 + sticky + right
    expect(page).toMatch(/min-\[1200px\]:(?:flex|block|inline-flex)[\s\S]{0,400}(sticky|fixed)[\s\S]{0,200}right-0/);
  });
});

describe("§11.248e-2 #3 — invariant 보존", () => {
  it("§11.248e breakpoint min-[1200px]:flex w-[480px] 보존", () => {
    expect(page).toMatch(/hidden\s+min-\[1200px\]:flex[\s\S]{0,200}w-\[480px\]/);
  });

  it("mobile bottom-sheet min-[1200px]:hidden 보존", () => {
    expect(page).toMatch(/min-\[1200px\]:hidden\s+fixed\s+inset-0/);
  });

  it("OPERATIONAL BRIEFING 헤더 보존", () => {
    expect(page).toMatch(/OPERATIONAL BRIEFING/);
  });

  it("selectedQuote && selectedSignals && selectedOpStatus gating 보존", () => {
    expect(page).toMatch(/selectedQuote && selectedSignals && selectedOpStatus/);
  });

  it("closeQuoteContextRail mutation 보존", () => {
    expect(page).toMatch(/closeQuoteContextRail/);
  });

  it("§11.248e break-keep + 44px Button 보존", () => {
    expect(page).toMatch(/leading-relaxed break-keep/);
    expect(page).toMatch(/min-h-\[44px\]\s+h-11/);
  });

  it("§11.248e-2 trace marker comment", () => {
    expect(page).toMatch(/§11\.248e-2[\s\S]{0,300}(collapse|접힘|토글|briefing|패널)/i);
  });
});
