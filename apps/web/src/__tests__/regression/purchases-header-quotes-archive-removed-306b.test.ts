/**
 * §11.306b #purchases-header-quotes-archive-removed — Regression sentinel
 *
 * 호영님 P2 spec (2026-05-26):
 * 구매 운영 (purchases/page.tsx) 헤더 우측 "견적 보관함" Link button 제거.
 * 하단 탭바 /dashboard/quotes 와 중복 → header CTA 단순화. 하단 탭바
 * wiring 보존 (사용자 접근 경로 0 회귀).
 *
 * Fix:
 *   - line 536-540 Link block 제거
 *   - FileText import 보존 (line 886/1399 다른 사용처 존재)
 *   - "소싱" Link CTA 보존 (line 531-535)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PURCHASES_PAGE_PATH = "src/app/dashboard/purchases/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.306b — '견적 보관함' header CTA 제거", () => {
  it("'견적 보관함' literal 0 occurrence (전체 file)", () => {
    const src = read(PURCHASES_PAGE_PATH);
    expect(src).not.toMatch(/견적 보관함/);
  });

  it("header 우측 영역 Link href=\"/dashboard/quotes\" 0 occurrence", () => {
    const src = read(PURCHASES_PAGE_PATH);
    // header 영역에서 /dashboard/quotes 로 가는 Link 제거 확인.
    // 다른 곳 (예: 모바일 탭바 같은 외부 컴포넌트 wiring) 는 본 file 외부 → 변경 0.
    expect(src).not.toMatch(/<Link\s+href="\/dashboard\/quotes">\s*\n\s*<Button[^>]*>\s*\n\s*<FileText/);
  });
});

describe("§11.306b — 회귀 0 (보존)", () => {
  it("header '소싱' Link CTA 보존 (line 531-535)", () => {
    const src = read(PURCHASES_PAGE_PATH);
    expect(src).toMatch(/<Link\s+href="\/app\/search">/);
    expect(src).toMatch(/<Search\s+className="h-4 w-4"\s*\/>\s*소싱/);
  });

  it("FileText import 보존 (line 886/1399 다른 사용처)", () => {
    const src = read(PURCHASES_PAGE_PATH);
    expect(src).toMatch(/FileText/);
    // line 886 "회신 N/M" 카드 — FileText 사용
    expect(src).toMatch(/<FileText className="h-3 w-3"\s*\/>회신/);
  });

  it("'일괄 발주 전환' header CTA (stats.ready_for_po > 0 분기) 보존", () => {
    const src = read(PURCHASES_PAGE_PATH);
    expect(src).toMatch(/stats\.ready_for_po\s*>\s*0/);
  });

  it("§11.277c isExpanded toggle 보존 (§11.306a 정합)", () => {
    const src = read(PURCHASES_PAGE_PATH);
    expect(src).toMatch(/data-testid="purchases-card-mobile-toggle"/);
    expect(src).toMatch(/expandedCardIds/);
  });

  it("§11.306a flex-col sm:flex-row 보존 (회귀 0)", () => {
    const src = read(PURCHASES_PAGE_PATH);
    expect(src).toMatch(/flex\s+flex-col\s+sm:flex-row\s+sm:items-start\s+gap-4/);
  });
});
