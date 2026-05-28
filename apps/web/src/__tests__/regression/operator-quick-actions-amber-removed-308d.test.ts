/**
 * §11.308d #operator-quick-actions-amber-removed — Regression sentinel
 *
 * 호영님 P1 spec (Q34 = A, 2026-05-26):
 *   §11.302 신호등 체계 정합 — operator-quick-actions.tsx 의 amber/orange
 *   4 위치를 yellow 로 1:1 swap. 컴포넌트 구조 변경 0.
 *
 *   - line 61 type 정의: "amber" → "yellow"
 *   - line 94 입고 처리 카드 tone: amber → yellow
 *   - line 110 TONE_MAP amber entry → yellow entry
 *   - line 274 dispatch step "연락처 필요" amber-50/200/700 → yellow-100/200/700
 *   - line 299 alert box amber-50/200/800 → yellow-100/200/800
 *
 * 회귀 보호:
 *   - 4 카드 구조 (견적 등록 / 발주 전환 / 입고 처리 / 재고 점검) 보존
 *   - countKey 매핑 (quotes/purchases/receiving/inventory) 보존
 *   - 견적 발송 progressive disclosure (§11.247) 보존
 *   - data-testid 모두 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PATH = "src/components/dashboard/operator-quick-actions.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.308d — amber/orange Tailwind class 0 (주석 제외)", () => {
  it("border-amber-* class 0 occurrence", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/border-amber-\d/);
  });

  it("bg-amber-* class 0 occurrence", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/bg-amber-\d/);
  });

  it("text-amber-* class 0 occurrence", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/text-amber-\d/);
  });

  it("border-l-amber-* class 0 occurrence (TONE_MAP)", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/border-l-amber-\d/);
  });

  it("orange Tailwind class 0 occurrence (defensive)", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/(border|bg|text|border-l)-orange-\d/);
  });

  it('tone type 에서 "amber" literal 제거', () => {
    const src = read(PATH);
    expect(src).not.toMatch(/tone:\s*"blue"\s*\|\s*"emerald"\s*\|\s*"amber"\s*\|\s*"purple"/);
  });

  it('카드 tone: "amber" 0 occurrence (입고 처리 카드)', () => {
    const src = read(PATH);
    expect(src).not.toMatch(/tone:\s*"amber"/);
  });
});

describe("§11.308d — yellow 신호등 swap 정합", () => {
  it('tone type 에 "yellow" literal 포함', () => {
    const src = read(PATH);
    expect(src).toMatch(/tone:\s*"blue"\s*\|\s*"emerald"\s*\|\s*"yellow"\s*\|\s*"purple"/);
  });

  it('입고 처리 카드 tone: "yellow"', () => {
    const src = read(PATH);
    expect(src).toMatch(/tone:\s*"yellow"/);
  });

  it("TONE_MAP yellow entry — border-l-yellow-500 + bg-yellow-50 + text-yellow-600", () => {
    const src = read(PATH);
    expect(src).toMatch(/yellow:\s*\{\s*accent:\s*"border-l-yellow-500"/);
    expect(src).toMatch(/iconBg:\s*"bg-yellow-50"/);
    expect(src).toMatch(/iconColor:\s*"text-yellow-600"/);
  });

  // §11.308d-2 — dispatch step/alert-box yellow 요소는 요약+진입 재설계로 제거됨
  //   (in-card 발송 플로우 시뮬레이션 삭제). 색상 가드는 amber/orange 0 + TONE_MAP 로 충분.
});

describe("§11.308d — 회귀 0 (4 카드 구조 + 핵심 wiring)", () => {
  it("4 카드 ACTIONS 배열 보존 (견적 등록 / 발주 전환 / 입고 처리 / 재고 점검)", () => {
    const src = read(PATH);
    expect(src).toMatch(/label:\s*"견적 등록"/);
    expect(src).toMatch(/label:\s*"발주 전환"/);
    expect(src).toMatch(/label:\s*"입고 처리"/);
    expect(src).toMatch(/label:\s*"재고 점검"/);
  });

  it("countKey 매핑 보존 (quotes/purchases/receiving/inventory)", () => {
    const src = read(PATH);
    expect(src).toMatch(/countKey:\s*"quotes"/);
    expect(src).toMatch(/countKey:\s*"purchases"/);
    expect(src).toMatch(/countKey:\s*"receiving"/);
    expect(src).toMatch(/countKey:\s*"inventory"/);
  });

  it("href route 보존 (real wiring, dead button 0)", () => {
    const src = read(PATH);
    expect(src).toMatch(/href:\s*"\/dashboard\/quotes"/);
    expect(src).toMatch(/href:\s*"\/dashboard\/purchases"/);
    expect(src).toMatch(/href:\s*"\/dashboard\/purchase-orders"/);
    expect(src).toMatch(/href:\s*"\/dashboard\/inventory\?filter=low"/);
  });

  it("견적 발송 progressive disclosure 보존 (§11.247)", () => {
    const src = read(PATH);
    expect(src).toMatch(/isQuoteDispatchExpanded/);
    expect(src).toMatch(/setIsQuoteDispatchExpanded/);
    expect(src).toMatch(/data-testid="dashboard-quote-dispatch-card"/);
  });

  it("§11.308d-2 — dispatch 요약+진입 testid (summary + primary-cta), 가짜 플로우 testid 제거", () => {
    const src = read(PATH);
    // 새 구조: 요약 블록 + 워크벤치 진입 CTA
    expect(src).toMatch(/data-testid="dashboard-quote-dispatch-summary"/);
    expect(src).toMatch(/data-testid="dashboard-quote-dispatch-primary-cta"/);
    // 제거된 in-card 발송 플로우 시뮬레이션 testid (회귀 가드)
    expect(src).not.toMatch(/data-testid="dashboard-quote-dispatch-state-matrix"/);
    expect(src).not.toMatch(/data-testid="dashboard-quote-dispatch-preview-tracking"/);
    expect(src).not.toMatch(/data-testid="dashboard-quote-dispatch-contact-warning"/);
    expect(src).not.toMatch(/data-testid="dashboard-quote-dispatch-stage"/);
  });

  it("모바일 grid-cols-2 + min-h-[110px] sm:min-h-[140px] 보존 (§11.252a)", () => {
    const src = read(PATH);
    expect(src).toMatch(/grid grid-cols-2 sm:grid-cols-\[repeat\(auto-fit,minmax\(280px,1fr\)\)\]/);
    expect(src).toMatch(/min-h-\[110px\] sm:min-h-\[140px\]/);
  });

  it('TONE_MAP 4 entry 보존 (blue/emerald/yellow/purple — amber → yellow swap)', () => {
    const src = read(PATH);
    expect(src).toMatch(/blue:\s*\{\s*accent:\s*"border-l-blue-500"/);
    expect(src).toMatch(/emerald:\s*\{\s*accent:\s*"border-l-emerald-500"/);
    expect(src).toMatch(/yellow:\s*\{\s*accent:\s*"border-l-yellow-500"/);
    expect(src).toMatch(/purple:\s*\{\s*accent:\s*"border-l-purple-500"/);
  });
});
