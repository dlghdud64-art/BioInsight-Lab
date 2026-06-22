/**
 * §dashboard-mobile-format #7+#8 — 호영님 모바일 라이브 (KPI 금액 잘림 / SpendTrend M표기).
 *
 * #7 StatLine: ₩ 금액(예: ₩10,810,000)이 모바일 grid-cols-3 폭을 넘쳐 잘림(★정확값 위반).
 *   → 모바일 가로 스크롤(카드가 금액 길이만큼 확장 → 잘림 0, §11.311 1줄·first-fold 보존) + 라벨 풀표기.
 * #8 SpendTrend: 영문 M/K(₩71.6M, Y축 80M)와 풀 ₩ 혼재 → 공용 wonCompact(만원/억) 통일.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const STATLINE = readFileSync(resolve(__dirname, "../../components/dashboard/stat-line.tsx"), "utf8");
const TREND = readFileSync(resolve(__dirname, "../../components/dashboard/spend-trend-card.tsx"), "utf8");
const DERIVE = readFileSync(resolve(__dirname, "../../lib/dashboard/summary-derive.ts"), "utf8");

describe("§dashboard-mobile-재검 #7 — StatLine 세로 스택(carousel 폐기)", () => {
  it("모바일 세로 1열 + md grid-cols-3 (carousel 잘림 오판 폐기, 호영님 라이브 재검)", () => {
    // §dashboard-mobile-재검 — #7 가로 carousel(첫 카드 잘려 깨짐)을 세로 스택으로 교정.
    //   모바일 grid-cols-1 풀폭(₩정확값), md+ grid-cols-3. overflow-x/min-w(carousel) 제거.
    expect(STATLINE).toContain("grid grid-cols-1 md:grid-cols-3");
    expect(STATLINE).not.toContain("overflow-x-auto");
    expect(STATLINE).not.toContain("min-w-[150px]");
    expect(STATLINE).toContain("whitespace-nowrap");
  });

  it("라벨 truncate 제거(풀표기) + won() 정확값 보존", () => {
    expect(STATLINE).not.toMatch(/tracking-\[0\.06em\] break-keep truncate/);
    expect(STATLINE).toContain("won(it.value)");
  });
});

describe("§dashboard-mobile-format #8 — SpendTrend 만원 통일", () => {
  it("영문 M/K 제거 → 공용 wonCompact", () => {
    expect(TREND).toContain("wonCompact");
    expect(TREND).not.toMatch(/\.toFixed\(\d\)\}M/);
    expect(TREND).not.toMatch(/\/ 1_000_000\)\.toFixed/);
  });

  it("wonCompact 공용 헬퍼 존재(만원/억)", () => {
    expect(DERIVE).toContain("export function wonCompact");
    expect(DERIVE).toContain("만");
    expect(DERIVE).toContain("억");
  });
});
