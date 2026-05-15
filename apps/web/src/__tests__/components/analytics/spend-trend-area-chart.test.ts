/**
 * §11.246b-1 #recharts-dynamic-bundle-split — 호영님 P0 성능 #1+#5
 *   분석 페이지 recharts 라이브러리 lazy load (mobile bundle ~200KB ↓)
 *
 * 호영님 spec:
 *   - 분석 페이지 진입 시 즉시 recharts 라이브러리 로드 = JS bundle 부담
 *   - lazy load 시 초기 hydration ↑, KPI 카드 먼저 표시 가능
 *   - chart 데이터 로딩 중 recharts unnecessary
 *
 * Scope (호영님 결정 "scope 축소 — recharts dynamic() 만 먼저"):
 *   - 신규 컴포넌트 1 file (real + mockup 둘 다 variant prop 으로 처리)
 *   - analytics/page.tsx 안 recharts inline import 8 named 제거
 *   - dynamic() import + Skeleton loading
 *
 * canonical truth lock:
 *   - server endpoint 변경 0 (§11.246b 의 endpoint 분리는 별도 트랙 park)
 *   - useQuery 구조 보존 (1 query 유지)
 *   - §11.244 Phase A/B/C invariant 보존 (Shimmer + mockup + timeout)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CHART_PATH = resolve(
  __dirname,
  "../../../components/analytics/spend-trend-area-chart.tsx",
);
const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/analytics/page.tsx");

const chart = readFileSync(CHART_PATH, "utf8");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.246b-1 #1 — SpendTrendAreaChart 신규 컴포넌트 (recharts wrapper)", () => {
  it("'use client' directive", () => {
    expect(chart).toMatch(/^['"]use client['"]/m);
  });

  it("recharts named import (AreaChart + Area + 등)", () => {
    expect(chart).toMatch(/import\s*\{[\s\S]{0,300}AreaChart[\s\S]{0,300}\}\s*from\s*["']recharts["']/);
  });

  it("variant prop — 'real' | 'mockup' 양 variant 처리", () => {
    expect(chart).toMatch(/variant[\s\S]{0,80}(["']real["']|["']mockup["'])/);
  });

  it("default export 함수 SpendTrendAreaChart", () => {
    expect(chart).toMatch(/export\s+default\s+function\s+SpendTrendAreaChart/);
  });

  it("data prop accept (array of { month, amount })", () => {
    expect(chart).toMatch(/data\s*:\s*(Array|ReadonlyArray)/);
  });
});

describe("§11.246b-1 #2 — analytics/page.tsx wiring", () => {
  it("recharts inline named import 제거 (AreaChart/Area/ResponsiveContainer 직접 import 0)", () => {
    // recharts inline import 가 page.tsx 에 없어야 함 (모두 dynamic 으로 이동)
    expect(page).not.toMatch(/^import\s*\{[\s\S]{0,300}AreaChart[\s\S]{0,300}\}\s*from\s*["']recharts["']/m);
  });

  it("next/dynamic import (alias 가능 — route segment config 와 충돌 회피)", () => {
    expect(page).toMatch(/import\s+(dynamic|nextDynamic|\w+)\s+from\s+["']next\/dynamic["']/);
  });

  it("SpendTrendAreaChart dynamic() import (alias 호출 정합)", () => {
    expect(page).toMatch(
      /(dynamic|nextDynamic|\w+)\(\s*\(\)\s*=>\s*import\(["']@\/components\/analytics\/spend-trend-area-chart["']\)/,
    );
  });

  it("dynamic options — ssr: false + loading skeleton", () => {
    // ssr: false (recharts 는 client only)
    expect(page).toMatch(/ssr:\s*false/);
    // loading 컴포넌트로 Skeleton 또는 div skeleton 제공
    expect(page).toMatch(/loading:\s*\([\s\S]{0,200}(Skeleton|skeleton|animate-pulse)/);
  });

  it("두 SpendTrendAreaChart 사용처 (real + mockup variant)", () => {
    // page.tsx 안 두 군데에 <SpendTrendAreaChart /> 사용 (real + mockup)
    const matches = page.match(/<SpendTrendAreaChart\s+/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe("§11.246b-1 #3 — invariant 보존", () => {
  it("§11.244 Phase A: Shimmer skeleton invariant (hasNoKpiData 또는 dataInsufficient)", () => {
    expect(page).toMatch(/dataInsufficient/);
  });

  it("§11.244 Phase B: MOCKUP_MONTHLY_DATA 상수 보존", () => {
    expect(page).toMatch(/MOCKUP_MONTHLY_DATA/);
  });

  it("§11.244 Phase C: ANALYTICS_TIMEOUT_MS + AbortController 보존", () => {
    expect(page).toMatch(/ANALYTICS_TIMEOUT_MS\s*=\s*10000/);
    expect(page).toMatch(/AbortController/);
  });

  it("useQuery 1 instance 유지 (endpoint 분리 trail 없음)", () => {
    expect(page).toMatch(/useQuery<AnalyticsDashboardData>/);
  });

  it("§11.246b-1 trace marker comment", () => {
    expect(chart).toMatch(/§11\.246b-1[\s\S]{0,300}(recharts|dynamic|lazy|bundle)/i);
  });
});
