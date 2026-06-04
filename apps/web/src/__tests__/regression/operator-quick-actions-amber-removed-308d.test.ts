/**
 * §11.308d #operator-quick-actions-amber-removed — Regression sentinel
 *
 * §11.308d (2026-05-26): amber/orange → yellow 1:1 swap (TONE_MAP).
 * §11.364 D-2 (호영님 P1, 2026-06-04) supersede:
 *   데코 컬러 자체 제거 — 좌측 컬러바·TONE_MAP 팔레트 삭제, 아이콘 무채색.
 *   색은 상태값(§11.302)에만(건수 배지 노랑). amber/orange 0 가드는 유지.
 *   progressive disclosure(§11.247)는 §11.364 D-1 로 폐기 → 강등 가드.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PATH = "src/components/dashboard/operator-quick-actions.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.308d / §11.364 — amber/orange Tailwind class 0", () => {
  it("border/bg/text/border-l-amber-* class 0", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/(border|bg|text|border-l)-amber-\d/);
  });

  it("orange Tailwind class 0 (defensive)", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/(border|bg|text|border-l)-orange-\d/);
  });

  it('tone: "amber" literal 0', () => {
    const src = read(PATH);
    expect(src).not.toMatch(/tone:\s*"amber"/);
  });
});

describe("§11.364 D-2 — 데코 컬러바/TONE_MAP 제거 (색은 상태값에만)", () => {
  it("좌측 컬러바 border-l-* 제거", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/border-l-(blue|emerald|yellow|purple)-500/);
    expect(src).not.toMatch(/border-l-2/);
  });

  it("TONE_MAP 데코 팔레트 제거", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/TONE_MAP/);
  });

  it("건수 배지 = §11.302 노랑 상태색 (검토 대기)", () => {
    const src = read(PATH);
    expect(src).toMatch(/bg-yellow-100 text-yellow-700/);
  });
});

describe("§11.364 — 회귀 0 (4 카드 구조 + wiring)", () => {
  it("4 카드 ACTIONS 배열 보존 (견적 발송 / 발주 전환 / 입고 처리 / 재고 점검)", () => {
    const src = read(PATH);
    expect(src).toMatch(/label:\s*"견적 발송"/);
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
    expect(src).toMatch(/href:\s*"\/dashboard\/quotes\?labaxisPilot=quote-dispatch"/);
    expect(src).toMatch(/href:\s*"\/dashboard\/purchases"/);
    expect(src).toMatch(/href:\s*"\/dashboard\/purchase-orders"/);
    expect(src).toMatch(/href:\s*"\/dashboard\/inventory\?filter=low"/);
  });

  it("§11.364 D-1 — progressive disclosure 폐기 (순수 네비)", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/isQuoteDispatchExpanded/);
    expect(src).not.toMatch(/data-testid="dashboard-quote-dispatch-card"/);
    expect(src).not.toMatch(/data-testid="dashboard-quote-dispatch-summary"/);
  });

  it("모바일 grid-cols-2 + min-h-[110px] sm:min-h-[140px] 보존 (§11.252a)", () => {
    const src = read(PATH);
    expect(src).toMatch(/grid grid-cols-2 sm:grid-cols-\[repeat\(auto-fit,minmax\(280px,1fr\)\)\]/);
    expect(src).toMatch(/min-h-\[110px\] sm:min-h-\[140px\]/);
  });
});
