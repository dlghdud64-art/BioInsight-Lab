/**
 * §11.280 #sourcing-header-pointer-events-auto — 소싱 outer container pointer-events
 *   강제 auto override (호영님 P0, 햄버거 dead button 픽스).
 *
 * 호영님 P0 spec (대화 메시지, 2026-05-23):
 *   소싱 화면 (/app/search ⊃ _workbench/search/page.tsx 렌더) 햄버거 메뉴 미작동.
 *   "대시보드, 견적 관리, 재고 관리 등 다른 화면으로 진입 불가 → dead-end".
 *
 * Truth Reconciliation (Chrome MCP 검증):
 *   - 햄버거 button (line 3075-3120) wiring 정상 (DropdownMenu + DropdownMenuTrigger
 *     + 5 DropdownMenuItem, §11.254b)
 *   - production /app/search 진입 시 `<body>` 에 `pointer-events: none` 잔존 →
 *     CSS pointer-events 의 inherited cascade 로 모든 descendant hit-test 차단
 *   - 햄버거 button 의 `pe: "none"` cascade → click hit-test 차단 (dead button)
 *   - elementsFromPoint(hamburger center) → ["HTML"] 만 반환 → hit-test 차단 확정
 *
 * Root Cause:
 *   Radix UI Dialog/Sheet (또는 5 Sheet/Dialog 중 일부) 가 mount 시 `<body>` pointer-events:
 *   none 추가 후 unmount cleanup 누락. 알려진 race condition (Radix issue #2122).
 *
 * Fix (minimum diff, 1 file 1 className 추가):
 *   _workbench/search/page.tsx:681 outer container
 *   `<div className="fixed inset-0 z-[60] flex flex-col overflow-hidden">`
 *   → `pointer-events-auto` Tailwind class 추가.
 *
 *   CSS pointer-events 가 inherited 이지만 own property 가 명시되면 cascade 차단.
 *   outer container 가 `pointer-events: auto` 명시 → 모든 descendant 가 정상 hit-test.
 *
 * canonical truth 보존:
 *   - Radix modal 자체의 의도된 차단 behavior 는 Radix 자체 overlay 안에서 작동 (별 z-index
 *     + body sibling) → 다른 modal 영향 0
 *   - 햄버거 button + DropdownMenu wiring 변경 0 (§11.254b 정합 보존)
 *   - 5 Sheet/Dialog (mobile filter / AI analysis / left drawer / AlertDialog / login prompt)
 *     mount + onClick + onOpenChange 보존
 *   - outer container 의 다른 className (fixed inset-0 z-[60] flex flex-col overflow-hidden)
 *     + style backgroundColor 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/_workbench/search/page.tsx"),
  "utf8",
);

describe("§11.280 — 소싱 outer container pointer-events-auto 강제", () => {
  it("§11.280 trace marker comment 존재", () => {
    expect(PAGE).toMatch(/§11\.280/);
  });

  it("outer container 에 pointer-events-auto Tailwind class 명시 (Radix body pe:none cascade 차단)", () => {
    // line 681 outer div: `<div className="fixed inset-0 z-[60] flex flex-col overflow-hidden pointer-events-auto" ...>`
    expect(PAGE).toMatch(
      /<div\s+className="fixed inset-0 z-\[60\][^"]*pointer-events-auto[^"]*"\s+style=\{\{\s*backgroundColor:\s*['"]#F8FAFC['"]/,
    );
  });

  it("outer container 의 기존 className (fixed inset-0 z-[60] flex flex-col overflow-hidden) 보존", () => {
    expect(PAGE).toMatch(/className="fixed inset-0 z-\[60\] flex flex-col overflow-hidden/);
  });

  it("outer container 의 inline style backgroundColor #F8FAFC 보존", () => {
    expect(PAGE).toMatch(/backgroundColor:\s*['"]#F8FAFC['"]/);
  });
});

describe("§11.280 — invariant 보존 (canonical truth)", () => {
  it("햄버거 button (§11.254b aria-label=\"메뉴 열기\") 보존", () => {
    expect(PAGE).toMatch(/aria-label="메뉴 열기"/);
  });

  it("DropdownMenu + DropdownMenuTrigger asChild 보존", () => {
    expect(PAGE).toMatch(/<DropdownMenu>/);
    expect(PAGE).toMatch(/<DropdownMenuTrigger asChild>/);
  });

  it("DropdownMenu 5 항목 (대시보드 / 견적 관리 / 구매 운영 / 재고 관리 / 설정) 보존", () => {
    expect(PAGE).toMatch(/href="\/dashboard"[\s\S]{0,200}대시보드/);
    expect(PAGE).toMatch(/href="\/dashboard\/quotes"[\s\S]{0,200}견적 관리/);
    expect(PAGE).toMatch(/href="\/dashboard\/purchases"[\s\S]{0,200}구매 운영/);
    expect(PAGE).toMatch(/href="\/dashboard\/inventory"[\s\S]{0,200}재고 관리/);
    expect(PAGE).toMatch(/href="\/dashboard\/settings"[\s\S]{0,200}설정/);
  });

  it("AI 라벨 스캔 button (Camera icon) 보존", () => {
    expect(PAGE).toMatch(/setLabelScanOpen\(true\)/);
    expect(PAGE).toMatch(/<Camera/);
  });

  it("5 Radix Sheet/Dialog mount 보존", () => {
    expect(PAGE).toMatch(/<Sheet open=\{isMobileFilterOpen\}/);
    expect(PAGE).toMatch(/<Sheet open=\{aiAnalysisSheetOpen\}/);
    expect(PAGE).toMatch(/<Dialog open=\{isLoginPromptOpen\}/);
    expect(PAGE).toMatch(/<AlertDialogContent>/);
  });

  it("LabelScannerModal mount 보존 (§11.264f)", () => {
    expect(PAGE).toMatch(/<LabelScannerModal/);
  });

  it("outer container 의 fixed inset-0 z-[60] visual 정합 (overlay 구조)", () => {
    expect(PAGE).toMatch(/fixed inset-0 z-\[60\]/);
  });
});
