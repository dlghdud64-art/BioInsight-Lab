/**
 * §11.280-2 #sourcing-header-menu-icon-pointer-events-none — 햄버거 button 안
 *   lucide-react `<Menu />` icon SVG hit-test trap 차단 (호영님 P0, §11.280 후속 root fix).
 *
 * 호영님 P0 spec (대화 메시지, 2026-05-23):
 *   §11.280 outer container `pointer-events-auto` fix 후에도 호영님 iOS Safari
 *   에서 햄버거 dead button 잔존. Chrome MCP 띄워진 크롬에서도 동일.
 *
 * Truth Reconciliation (Chrome MCP 재진단):
 *   - body / outer container / button 의 pointer-events 모두 auto (§11.280 fix 정합)
 *   - `elementsFromPoint(hamburger center)` stack: [line, svg, BUTTON, ...] —
 *     button path 깨끗하게 도달
 *   - 4 event 시뮬 결과:
 *     · `btn.click()` (native): ❌ open 안 됨
 *     · MouseEvent (mousedown + mouseup + click): ❌ open 안 됨
 *     · TouchEvent (touchstart + touchend): ❌ open 안 됨
 *     · **PointerEvent (pointerdown + pointerup): ✅ open**
 *   - SVG 자식 모두에 동적 `pointer-events: none` 적용 후:
 *     · `btn.click()` (native): ✅ open
 *
 * Root Cause:
 *   햄버거 button 안의 `<svg>` (lucide-react `<Menu />` icon) 이 PointerEvent
 *   target 으로 trap. Radix `DropdownMenuTrigger` 의 PointerEvent listener 는
 *   button element 에 부착되는데, SVG child 가 target 이면 button 으로 bubble
 *   차단되어 trigger 미발화. iOS Safari + 일부 Chrome 환경의 SVG hit-test
 *   alignment issue (lucide-react / Radix 조합의 known pattern).
 *
 * Fix (minimum diff, 1 file 1 className 추가):
 *   _workbench/search/page.tsx:3106 햄버거 button 안 `<Menu />` icon 의
 *   `className="h-5 w-5"` → `className="h-5 w-5 pointer-events-none"` swap.
 *
 *   `pointer-events: none` 으로 SVG 자체가 hit-test target 에서 제외 →
 *   PointerEvent / MouseEvent / click 모두 직접 button 으로 dispatch →
 *   Radix DropdownMenuTrigger 정상 발화.
 *
 * canonical truth 보존:
 *   - Radix DropdownMenu 5 entry (대시보드 / 견적 / 구매 / 재고 / 설정) 보존
 *   - 햄버거 button + DropdownMenuTrigger asChild + aria-label 보존
 *   - §11.280 outer container `pointer-events-auto` fix 보존 (별 cascade 차단)
 *   - Menu icon size (h-5 w-5) 보존 — 시각 변화 0
 *   - 5 Sheet/Dialog + LabelScannerModal mount 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/_workbench/search/page.tsx"),
  "utf8",
);

describe("§11.280-2 — 햄버거 Menu icon pointer-events-none 강제 (SVG hit-test trap 차단)", () => {
  it("§11.280-2 trace marker comment 존재", () => {
    expect(PAGE).toMatch(/§11\.280-2/);
  });

  it("햄버거 button 안 <Menu /> icon 에 pointer-events-none Tailwind class 명시", () => {
    // line 3106: <Menu className="h-5 w-5 pointer-events-none" />
    expect(PAGE).toMatch(
      /<Menu\s+className="h-5 w-5 pointer-events-none"\s*\/>/,
    );
  });

  it("Menu icon size (h-5 w-5) 보존 — 시각 변화 0", () => {
    expect(PAGE).toMatch(/<Menu\s+className="h-5 w-5/);
  });
});

describe("§11.280-2 — invariant 보존 (canonical truth)", () => {
  it("햄버거 button (§11.254b aria-label=\"메뉴 열기\") 보존", () => {
    expect(PAGE).toMatch(/aria-label="메뉴 열기"/);
  });

  // §11.283b supersede — Radix DropdownMenu/asChild 제거, plain 햄버거 메뉴로 교체(의도).
  it("§11.283b plain 햄버거 메뉴 보존 (Radix 제거)", () => {
    expect(PAGE).toMatch(/aria-haspopup="menu"/);
    expect(PAGE).toMatch(/aria-expanded=\{hamburgerOpen\}/);
    expect(PAGE).toMatch(/setHamburgerOpen\(/);
  });

  it("햄버거 5 항목 (대시보드 / 견적 관리 / 구매 운영 / 재고 관리 / 설정) Link 보존", () => {
    expect(PAGE).toMatch(/href="\/dashboard"/);
    expect(PAGE).toMatch(/href="\/dashboard\/quotes"/);
    expect(PAGE).toMatch(/href="\/dashboard\/purchases"/);
    expect(PAGE).toMatch(/href="\/dashboard\/inventory"/);
    expect(PAGE).toMatch(/href="\/dashboard\/settings"/);
    expect(PAGE).toMatch(/대시보드/);
    expect(PAGE).toMatch(/견적 관리/);
    expect(PAGE).toMatch(/구매 운영/);
    expect(PAGE).toMatch(/재고 관리/);
  });

  it("§11.280 outer container pointer-events-auto fix 보존 (별 cascade 차단)", () => {
    expect(PAGE).toMatch(
      /<div\s+className="fixed inset-0 z-\[60\][^"]*pointer-events-auto[^"]*"\s+style=\{\{\s*backgroundColor:\s*['"]#F8FAFC['"]/,
    );
  });

  it("AI 라벨 스캔 button (Camera icon) 보존", () => {
    expect(PAGE).toMatch(/setLabelScanOpen\(true\)/);
    expect(PAGE).toMatch(/<Camera/);
  });

  it("Radix Sheet/Dialog mount 보존 (§1-3: AI 분석 Sheet 제거)", () => {
    expect(PAGE).toMatch(/<Sheet open=\{isMobileFilterOpen\}/);
    // §1-3 — AI 분석 Sheet(aiAnalysisSheetOpen) 제거. 잔존 0 검증.
    expect(PAGE).not.toMatch(/<Sheet open=\{aiAnalysisSheetOpen\}/);
    expect(PAGE).toMatch(/<Dialog open=\{isLoginPromptOpen\}/);
    expect(PAGE).toMatch(/<AlertDialogContent>/);
  });

  it("LabelScannerModal mount 보존 (§11.264f)", () => {
    expect(PAGE).toMatch(/<LabelScannerModal/);
  });
});
