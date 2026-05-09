/**
 * §11.217 Phase 5 — RED test
 *
 * Goal: detail panel 의 4 chip (상태 요약 / 회신 현황 / 비교 진행 / 발주 전환)
 *       이 scroll-spy 로 현재 보이는 section 을 active highlight.
 *
 * canonical truth lock:
 *   - useState activeChipId: 현재 visible section 의 chip id.
 *   - IntersectionObserver: brief-summary / brief-facts / brief-facts2 / brief-next 감시.
 *   - chip active class: bg-blue-100 + text-blue-700 + font-semibold (또는 동등 active tone).
 *   - chip click 시 scrollIntoView + activeChipId 즉시 업데이트.
 *   - root: detail panel scroll container (overflow-y-auto div).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const src = readFileSync(PAGE_PATH, "utf8");

describe("§11.217 Phase 5 — chip scroll-spy active highlight", () => {
  it("activeChipId useState 정의", () => {
    expect(src).toMatch(/const\s+\[activeChipId,\s*setActiveChipId\]/);
  });

  it("IntersectionObserver 사용 (scroll-spy)", () => {
    expect(src).toMatch(/new\s+IntersectionObserver/);
  });

  it("4 chip ID 감시 — summary / facts / facts2 / next", () => {
    // observer 안에 brief-summary 등 element 또는 array 매칭
    expect(src).toMatch(/brief-summary|"summary"[\s\S]{0,200}"facts"[\s\S]{0,200}"next"/);
  });

  it("chip active class — bg-blue-100 또는 동등 active tone (activeChipId 매칭 시)", () => {
    // activeChipId === c.id 분기 + bg-blue-100 or text-blue-700
    expect(src).toMatch(/activeChipId\s*===\s*c\.id[\s\S]{0,200}(bg-blue-100|text-blue-700|font-semibold)/);
  });

  it("chip click 시 setActiveChipId 즉시 업데이트", () => {
    expect(src).toMatch(/setActiveChipId\s*\(\s*c\.id\s*\)/);
  });

  it("§11.217 Phase 5 cluster trace marker", () => {
    expect(src).toMatch(/§11\.217 Phase 5|chip scroll-spy|scroll-spy/);
  });
});
