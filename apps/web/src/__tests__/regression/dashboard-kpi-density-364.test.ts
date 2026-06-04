import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const ES = "src/components/dashboard/executive-summary-section.tsx";
const TREND = "src/components/dashboard/spend-trend-card.tsx";

describe("§11.364 D-3 (1) — 데스크탑 KPI 밀도 축소 (폰트 24-30 유지)", () => {
  it("카드 패딩 p-5 → p-4", () => {
    const src = read(ES);
    expect(src).toMatch(/bg-white p-4 shadow/);
    expect(src).not.toMatch(/bg-white p-5 shadow/);
  });

  it("value 폰트 24-30 유지 (text-2xl md:text-3xl) — 과축소(text-xl) 금지", () => {
    const src = read(ES);
    expect(src).toMatch(/text-2xl md:text-3xl font-black/);
    // §11.311-1(text-lg/xl) 기계 적용 금지 — 데스크탑 대표 KPI는 24-30.
    expect(src).not.toMatch(/text-3xl md:text-\[32px\]/);
    expect(src).not.toMatch(/text-(lg|xl) md:text-(lg|xl) font-black/);
  });

  it("높이 축소 = 여백에서 (헤더 mb-3, 아이콘 w-10, hint mt-1.5, bar mt-3)", () => {
    const src = read(ES);
    expect(src).toMatch(/justify-between mb-3/);
    expect(src).toMatch(/w-10 h-10 rounded-xl flex/);
    expect(src).toMatch(/mt-1\.5 text-\[11px\] text-slate-500 break-keep/);
    expect(src).toMatch(/mt-3 h-1\.5 rounded-full bg-slate-100/);
  });
});

describe("§11.364 D-3 (3) — 빈 차트 mockup 유지 (§11.243b#4 P0 우선, D-3 접기 철회)", () => {
  it("mockup 보존 (§11.243b#4 onboarding affordance)", () => {
    const src = read(TREND);
    expect(src).toMatch(/MOCKUP_SPEND_DATA/);
  });

  it("조건① data≥1 클린 스왑 — isEmpty 배타 삼항 (mockup ↔ 실차트 동시 노출 0)", () => {
    const src = read(TREND);
    expect(src).toMatch(/isEmpty \? \([\s\S]*?\) : \(/);
  });

  it("조건② 예시/미리보기 캡션 유지", () => {
    const src = read(TREND);
    expect(src).toMatch(/위 차트는 예시 데이터/);
    expect(src).toMatch(/실제 데이터 1건\+ 시 자동 활성화/);
  });
});
