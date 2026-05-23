/**
 * §11.282-a #dashboard-header-menu-icon-pointer-events-none — 대시보드 햄버거
 *   Menu icon SVG hit-test trap 차단 (호영님 P0+ critical, §11.280-2 와 동일
 *   root cause, application-wide 회귀 첫 발견).
 *
 * 호영님 P0+ 보고 (대화 메시지, 2026-05-23):
 *   "잠시 대시보드 햄버거 아직도 작동안해"
 *
 * Truth Reconciliation (Phase 0 audit):
 *   - 대시보드 햄버거 source = apps/web/src/components/dashboard/Header.tsx:548-559
 *   - §11.280-2 fix 는 _workbench/search/page.tsx 한정 → Header.tsx 미적용
 *   - onMenuClick prop wiring 정합 (dashboard-shell.tsx:66 setIsMobileMenuOpen toggle)
 *   - 햄버거 구조: <Button variant="ghost" onClick={onMenuClick}><Menu className="h-5 w-5" /></Button>
 *     (Radix DropdownMenu 가 아니라 plain shadcn/ui Button + onClick handler)
 *
 * Root Cause (§11.280-2 와 동일):
 *   <Menu /> SVG icon 이 PointerEvent / click target 으로 trap. Button 의 onClick
 *   handler 는 button element 에 부착되는데, SVG child 가 hit-test target 이면
 *   event.target = SVG 자체 → React event delegation 또는 button bubble 차단으로
 *   onClick handler 미발화. iOS Safari + 일부 Chrome 환경의 SVG hit-test alignment
 *   issue. §11.280-2 가 이미 검증한 SVG-in-button known pattern.
 *
 * Fix (minimum diff, 1 file 1 className + 6 line trace comment):
 *   Header.tsx:557 <Menu className="h-5 w-5" /> → <Menu className="h-5 w-5 pointer-events-none" />
 *
 * canonical truth 보존:
 *   - Button variant="ghost" size="icon" + 기존 className 보존
 *   - onClick={onMenuClick} prop forwarding 보존
 *   - aria-label="메뉴 열기" 보존
 *   - Menu icon size (h-5 w-5) 보존 — 시각 변화 0
 *   - onMenuClick && conditional render 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HEADER = readFileSync(
  resolve(__dirname, "../../components/dashboard/Header.tsx"),
  "utf8",
);

describe("§11.282-a — 대시보드 햄버거 Menu icon pointer-events-none 강제 (SVG hit-test trap 차단)", () => {
  it("§11.282-a trace marker comment 존재", () => {
    expect(HEADER).toMatch(/§11\.282-a/);
  });

  it("대시보드 햄버거 Button 안 <Menu /> icon 에 pointer-events-none Tailwind class 명시", () => {
    expect(HEADER).toMatch(
      /<Menu\s+className="h-5 w-5 pointer-events-none"\s*\/>/,
    );
  });

  it("Menu icon size (h-5 w-5) 보존 — 시각 변화 0", () => {
    expect(HEADER).toMatch(/<Menu\s+className="h-5 w-5/);
  });
});

describe("§11.282-a — invariant 보존 (canonical truth)", () => {
  it("대시보드 햄버거 aria-label=\"메뉴 열기\" 보존", () => {
    expect(HEADER).toMatch(/aria-label="메뉴 열기"/);
  });

  it("Button variant=\"ghost\" size=\"icon\" 보존", () => {
    expect(HEADER).toMatch(/<Button\s+variant="ghost"\s+size="icon"/);
  });

  it("onClick={onMenuClick} prop forwarding 보존 (dashboard-shell.tsx setIsMobileMenuOpen wiring)", () => {
    expect(HEADER).toMatch(/onClick=\{onMenuClick\}/);
  });

  it("onMenuClick && conditional render 보존", () => {
    expect(HEADER).toMatch(/\{onMenuClick && \(/);
  });

  it("mobile-menu-button + lg:hidden + min touch target className 보존", () => {
    expect(HEADER).toMatch(/h-11 w-11[\s\S]{0,80}mobile-menu-button[\s\S]{0,40}lg:hidden/);
  });
});
