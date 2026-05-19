/**
 * §11.263a #sourcing-header-mobile-spacer — 소싱 헤더 모바일 우측 배치
 *
 * 호영님 spec (소싱 모바일 #1 긴급):
 *   AS-IS: [LabAxis] [소싱] [📷] [≡]          (빈 공간)
 *   TO-BE: [LabAxis] [소싱]          (빈 공간) [📷] [≡]
 *
 * Root cause: 데스크탑은 검색 form `flex-1` (line 2298 hidden md:flex) 이
 * 자동 spacer 역할 → AI 스캔+햄버거 우측 정렬. 모바일은 검색 form 이
 * hidden 이라 spacer 부재 → 4 element 가 좌측에 붙음.
 *
 * Fix: 모바일 한정 spacer `<div className="flex-1 md:hidden" />` 추가.
 * LabAxis+소싱 block 과 AI 스캔+햄버거 block 사이에 위치.
 *
 * scope:
 *   (1) 소싱 헤더 1행에 모바일 spacer 추가 (flex-1 md:hidden)
 *   (2) §11.263a trace marker comment
 *
 * canonical truth lock:
 *   - LabAxis Link + 소싱 Link 보존
 *   - 데스크탑 검색 form (hidden md:flex flex-1) 보존
 *   - AI 라벨 스캔 button + Camera icon 보존
 *   - 햄버거 DropdownMenu + 5 entry (대시보드/견적/구매/재고/설정) 보존
 *   - DropdownMenuTrigger Menu icon + min-h-[44px] min-w-[44px] 보존
 *   - 햄버거 wiring (DropdownMenu Radix) 변경 0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.263a #1 — 소싱 헤더 모바일 spacer (우측 배치)", () => {
  it("§11.263a trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.263a/);
  });

  it("모바일 한정 spacer (flex-1 md:hidden) 헤더 1행 안 존재", () => {
    // 1행: LabAxis 소싱 + 검색바 + 유틸리티 marker 안에 spacer 추가
    expect(page).toMatch(
      /1행:\s*LabAxis\s*소싱[\s\S]+?<div\s+className="flex-1 md:hidden"[\s\S]+?\/>/,
    );
  });
});

describe("§11.263a #2 — invariant 보존 (canonical truth)", () => {
  it("LabAxis Link href='/' 보존", () => {
    expect(page).toMatch(/<Link href="\/"[\s\S]{0,200}LabAxis 홈으로 이동/);
  });

  it("소싱 Link href='/app/search' 보존", () => {
    expect(page).toMatch(/<Link href="\/app\/search"[\s\S]{0,200}소싱 검색으로 이동/);
  });

  it("데스크탑 검색 form (hidden md:flex flex-1 min-w-0) 보존", () => {
    expect(page).toMatch(
      /<form\s+onSubmit=\{handleSubmit\}\s+className="hidden md:flex items-center flex-1 min-w-0/,
    );
  });

  it("AI 라벨 스캔 button + Camera icon 보존", () => {
    expect(page).toMatch(/onClick=\{\(\) => setLabelScanOpen\(true\)\}/);
    expect(page).toMatch(/<Camera className="h-3\.5 w-3\.5" \/>/);
  });

  it("햄버거 DropdownMenu + Menu icon + min-h/min-w 44px 보존", () => {
    expect(page).toMatch(/§11\.254b[\s\S]{0,200}햄버거 메뉴/);
    expect(page).toMatch(/<DropdownMenu>[\s\S]{0,200}<DropdownMenuTrigger asChild>[\s\S]{0,400}<Menu className="h-5 w-5" \/>/);
    expect(page).toMatch(/aria-label="메뉴 열기"/);
    expect(page).toMatch(/min-h-\[44px\] min-w-\[44px\]/);
  });

  it("햄버거 5 entry (대시보드/견적/구매/재고/설정) 보존", () => {
    expect(page).toMatch(/<Link href="\/dashboard"[\s\S]{0,200}<span>대시보드<\/span>/);
    expect(page).toMatch(/<Link href="\/dashboard\/quotes"[\s\S]{0,200}<span>견적 관리<\/span>/);
    expect(page).toMatch(/<Link href="\/dashboard\/purchases"[\s\S]{0,200}<span>구매 운영<\/span>/);
    expect(page).toMatch(/<Link href="\/dashboard\/inventory"[\s\S]{0,200}<span>재고 관리<\/span>/);
    expect(page).toMatch(/<Link href="\/dashboard\/settings"[\s\S]{0,200}<span>설정<\/span>/);
  });

  it("헤더 1행 outer wrapper (flex items-center gap-3 md:gap-4) 보존", () => {
    expect(page).toMatch(/<div className="flex items-center gap-3 md:gap-4 px-4 md:px-6 py-2\.5 md:py-3"/);
  });
});
