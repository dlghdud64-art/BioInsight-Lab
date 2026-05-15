/**
 * §11.246d-4-cont-3 #rum-trend-line-chart — 호영님 §11.246d-4-cont-2 자연 후속.
 *
 * 호영님 spec: /admin/rum 페이지에 일자별 LCP/CLS/INP p75 추세 line chart 추가.
 *   3 separate LineChart vertical stack (호영님 결정) + 30일 고정 (scope 최소).
 *   recharts dynamic import (§11.246b-1 패턴 reuse, bundle ~200KB lazy load).
 *
 * Strategy:
 *   - NEW /api/admin/rum/timeseries route — auth + isAdmin gate + percentile_cont
 *     0.75 + GROUP BY date_trunc('day', createdAt) + WHERE 30d + ORDER BY ASC.
 *   - NEW components/analytics/rum-trend-line-chart.tsx — LineChart 3 metric variant.
 *   - EXTEND admin/rum/page.tsx — section 추가 + nextDynamic lazy load.
 *
 * canonical truth lock:
 *   - §11.246d-4-cont RumMetric model 보존.
 *   - §11.246d-4-cont-2 RumAggregateTable 보존.
 *   - §11.246b-1 nextDynamic alias 패턴 reuse (force-dynamic symbol 충돌 회피).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const TIMESERIES_ROUTE_PATH = resolve(
  __dirname,
  "../../app/api/admin/rum/timeseries/route.ts",
);
const CHART_PATH = resolve(
  __dirname,
  "../../components/analytics/rum-trend-line-chart.tsx",
);
const PAGE_PATH = resolve(__dirname, "../../app/admin/rum/page.tsx");
const SCHEMA_PATH = resolve(__dirname, "../../../prisma/schema.prisma");

const route = safeRead(TIMESERIES_ROUTE_PATH);
const chart = safeRead(CHART_PATH);
const page = safeRead(PAGE_PATH);
const schema = safeRead(SCHEMA_PATH);

describe("§11.246d-4-cont-3 #1 — /api/admin/rum/timeseries route", () => {
  it("GET handler export", () => {
    expect(route).toMatch(/export\s+async\s+function\s+GET/);
  });

  it("auth() session gate + 401 분기", () => {
    expect(route).toMatch(/auth\(\)/);
    expect(route).toMatch(/status:\s*401/);
  });

  it("isAdmin() gate + 403 분기", () => {
    expect(route).toMatch(/isAdmin/);
    expect(route).toMatch(/status:\s*403/);
  });

  it("date_trunc('day', createdAt) grouping", () => {
    expect(route).toMatch(/date_trunc\(['"]day['"]/i);
  });

  it("percentile_cont 0.75 (p75 only, p95 별도 cluster)", () => {
    expect(route).toMatch(/percentile_cont\(0\.75\)/);
  });

  it("30일 fixed window (INTERVAL '30 days' 또는 30 day)", () => {
    expect(route).toMatch(/INTERVAL\s+['"]30\s*day/i);
  });

  it("ORDER BY date ASC (시간 순서)", () => {
    expect(route).toMatch(/ORDER\s+BY[\s\S]{0,100}ASC/i);
  });

  it("db.$queryRawUnsafe 또는 db.$queryRaw", () => {
    expect(route).toMatch(/\$queryRaw/);
  });
});

describe("§11.246d-4-cont-3 #2 — rum-trend-line-chart component", () => {
  it("recharts named import (LineChart + Line + XAxis + YAxis)", () => {
    expect(chart).toMatch(/from\s+["']recharts["']/);
    expect(chart).toMatch(/LineChart/);
    expect(chart).toMatch(/(\s|,)Line(\s|,)/);
    expect(chart).toMatch(/XAxis/);
    expect(chart).toMatch(/YAxis/);
  });

  it("ResponsiveContainer + height (260 또는 그 이상)", () => {
    expect(chart).toMatch(/ResponsiveContainer/);
    expect(chart).toMatch(/height=\{?[2-9]\d{2}/);
  });

  it("metric prop type (lcp | cls | inp)", () => {
    expect(chart).toMatch(/['"]lcp['"]/);
    expect(chart).toMatch(/['"]cls['"]/);
    expect(chart).toMatch(/['"]inp['"]/);
  });

  it("export default function (dynamic import target)", () => {
    expect(chart).toMatch(/export\s+default\s+function/);
  });

  it("date dataKey (XAxis)", () => {
    expect(chart).toMatch(/dataKey=["']date["']/);
  });

  it("Tooltip 포함 (운영자 hover 시 값 확인)", () => {
    expect(chart).toMatch(/Tooltip/);
  });
});

describe("§11.246d-4-cont-3 #3 — admin/rum/page.tsx extend", () => {
  it("nextDynamic import (§11.246b-1 패턴 reuse, alias)", () => {
    expect(page).toMatch(/import\s+nextDynamic\s+from\s+["']next\/dynamic["']/);
  });

  it("RumTrendLineChart dynamic import + ssr:false", () => {
    expect(page).toMatch(/RumTrendLineChart[\s\S]{0,500}nextDynamic/);
    expect(page).toMatch(/ssr:\s*false/);
  });

  it("RumTrendLineChart 호출 — 3 metric variant (lcp/cls/inp)", () => {
    // 양방향 매칭 — metric prop or path 매칭
    expect(page).toMatch(/RumTrendLineChart[\s\S]{0,500}lcp|metric=["']lcp["']/);
    expect(page).toMatch(/RumTrendLineChart[\s\S]{0,1500}cls|metric=["']cls["']/);
    expect(page).toMatch(/RumTrendLineChart[\s\S]{0,2500}inp|metric=["']inp["']/);
  });

  it("timeseries endpoint fetch (/api/admin/rum/timeseries)", () => {
    expect(page).toMatch(/\/api\/admin\/rum\/timeseries/);
  });
});

describe("§11.246d-4-cont-3 #4 — invariant 보존", () => {
  it("§11.246d-4-cont RumMetric model 보존", () => {
    expect(schema).toMatch(/model\s+RumMetric\s*\{/);
  });

  it("§11.246d-4-cont-2 RumAggregateTable import 보존 (page)", () => {
    expect(page).toMatch(/RumAggregateTable/);
  });

  it("§11.246d-4-cont-2 PageHeader RUM 성능 지표 보존", () => {
    expect(page).toMatch(/RUM 성능 지표|RUM/);
  });

  it("§11.246d-4-cont-3 trace marker", () => {
    const combined = route + "\n" + chart + "\n" + page;
    expect(combined).toMatch(/§11\.246d-4-cont-3|11\.246d-4-cont-3/);
  });
});
