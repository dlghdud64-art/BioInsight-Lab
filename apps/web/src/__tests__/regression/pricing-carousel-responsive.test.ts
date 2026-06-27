/**
 * §pricing-carousel — /pricing 플랜 카드 반응형 (호영님 핸드오프 2026-06-27)
 *
 * 데스크톱(≥981) 4열 · 태블릿(561~980) 2열 · 모바일(≤560) 가로 스와이프 캐러셀(peek 84% + snap).
 * 아코디언(숨김) 미채택 — 기능 목록 항상 노출. 비교 가능한 4개 동등 카드 = 가로 스와이프 적합(ui-wizard §2).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PRICING = readFileSync(
  join(__dirname, "..", "..", "app/pricing/page.tsx"),
  "utf8",
);

describe("§pricing-carousel — 모바일 가로 스와이프", () => {
  it("캐러셀 컨테이너: flex + snap-x mandatory + overflow-x-auto", () => {
    expect(PRICING).toMatch(/flex snap-x snap-mandatory overflow-x-auto/);
  });
  it("카드 peek 84% + snap-center (래퍼)", () => {
    expect(PRICING).toMatch(/basis-\[84%\]/);
    expect(PRICING).toMatch(/snap-center/);
    expect(PRICING).toMatch(/shrink-0/);
  });
  it("스크롤바 숨김", () => {
    expect(PRICING).toMatch(/\[scrollbar-width:none\]/);
    expect(PRICING).toMatch(/\[&::-webkit-scrollbar\]:hidden/);
  });
});

describe("§pricing-carousel — 반응형 전환(2열·4열)", () => {
  it("태블릿 ≥561 grid 2열 + 캐러셀 해제", () => {
    expect(PRICING).toMatch(/min-\[561px\]:grid/);
    expect(PRICING).toMatch(/min-\[561px\]:grid-cols-2/);
    expect(PRICING).toMatch(/min-\[561px\]:overflow-x-visible/);
  });
  it("데스크톱 ≥981 grid 4열", () => {
    expect(PRICING).toMatch(/min-\[981px\]:grid-cols-4/);
  });
});

describe("§pricing-carousel — 힌트 + 기능 항상 노출", () => {
  it("모바일 전용 스와이프 힌트(≤560, min-[561px]:hidden)", () => {
    expect(PRICING).toMatch(/좌우로 넘겨 플랜을 비교하세요/);
    expect(PRICING).toMatch(/min-\[561px\]:hidden/);
  });
  it("기능 목록 항상 렌더(아코디언 X) — features.map 보존", () => {
    expect(PRICING).toMatch(/features\.map/);
    // 카드 기능 토글/아코디언 state 없음(항상 노출).
    // 주석 strip 후 코드만 검사 — FAQ Accordion(별개 컴포넌트 주석)은 plan 기능과 무관.
    const PRICING_CODE = PRICING.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(PRICING_CODE).not.toMatch(/featuresExpanded|showFeatures|accordion/i);
  });
});
