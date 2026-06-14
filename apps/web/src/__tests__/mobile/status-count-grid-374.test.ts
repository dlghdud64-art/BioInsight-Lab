/**
 * §11.374 #mobile-surface-unify — 상태요약 단일 컴포넌트(StatusCountGrid) +
 * 견적 모바일 바 2x2 채택 sentinel (P1 계약 / P2 견적 적용).
 *
 * readFileSync + regex (CLAUDE.md sentinel 패턴).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const grid = readFileSync(
  resolve(__dirname, "../../components/layout/status-count-grid.tsx"),
  "utf8",
);
const quotes = readFileSync(
  resolve(__dirname, "../../app/dashboard/quotes/page.tsx"),
  "utf8",
);

describe("§11.374 StatusCountGrid 단일 컴포넌트 계약", () => {
  it("export + 2x2 그리드(grid-cols-2)", () => {
    expect(grid).toMatch(/export function StatusCountGrid/);
    expect(grid).toMatch(/grid grid-cols-2/);
  });

  it("표현 전용 — 자체 fetch/query 금지(canonical truth 보호)", () => {
    expect(grid).not.toMatch(/useQuery|fetch\(|csrfFetch/);
  });

  it("interactive 게이팅 — disabled 면 onClick 미연결(dead button 방지)", () => {
    expect(grid).toMatch(/const interactive = !!item\.onClick && !item\.disabled/);
    expect(grid).toMatch(/onClick=\{interactive \? item\.onClick : undefined\}/);
  });

  it("a11y — aria-pressed(active) + aria-disabled + 44px 터치", () => {
    expect(grid).toMatch(/aria-pressed=/);
    expect(grid).toMatch(/min-h-\[44px\]/);
  });
});

describe("§11.374 견적 모바일 바 — StatusCountGrid 채택", () => {
  it("StatusCountGrid import + 사용", () => {
    expect(quotes).toMatch(/import \{ StatusCountGrid \} from "@\/components\/layout\/status-count-grid"/);
    expect(quotes).toMatch(/<StatusCountGrid/);
  });

  it("회귀: 옛 가로 5-탭 바(flex items-stretch border-y) 제거", () => {
    expect(quotes).not.toMatch(/sm:hidden flex items-stretch border-y/);
    // 옛 per-item activeText 배열 구조 제거
    expect(quotes).not.toMatch(/activeText: "text-yellow-600"/);
  });

  it("canonical count 소스 보존(summaryStats.*.count 주입)", () => {
    expect(quotes).toMatch(/summaryStats\.dispatchPending\.count/);
    expect(quotes).toMatch(/summaryStats\.responseTracking\.count/);
    expect(quotes).toMatch(/summaryStats\.compareReview\.count/);
    expect(quotes).toMatch(/summaryStats\.approvalException\.count/);
    expect(quotes).toMatch(/summaryStats\.readyToConvert\.count/);
  });

  it("필터 wiring 보존(setStatusFilter 토글) + 비교 0건 가드", () => {
    expect(quotes).toMatch(/setStatusFilter\(\(prev\) => \(prev === it\.key \? "all" : it\.key\)\)/);
    expect(quotes).toMatch(/it\.key === "RESPONDED" && isZero/);
  });

  it("isLoadingTimeout fallback 보존", () => {
    expect(quotes).toMatch(/quote-kpi-mobile-summary-fallback/);
    expect(quotes).toMatch(/불러오기 실패/);
  });

  it("데스크탑 5-cell grid 유지(lg:grid-cols-5) — P2 모바일만 교체", () => {
    expect(quotes).toMatch(/lg:grid-cols-5/);
  });
});
