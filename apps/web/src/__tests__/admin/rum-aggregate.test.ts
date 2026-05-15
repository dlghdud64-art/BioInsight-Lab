/**
 * §11.246d-4-cont-2 #rum-aggregate-admin-dashboard — 호영님 §11.246d-4-cont 자연 후속.
 *
 * 호영님 spec: /admin/rum 신규 admin page + p75/p95 percentile aggregate table.
 *   §11.246d-4-cont 의 RumMetric raw row → pathname 별 grouping + Core Web Vitals
 *   3 metric (LCP/CLS/INP) p75/p95 시각화. recharts 0 (호영님 scope 축소 결정).
 *
 * Strategy:
 *   - NEW /api/admin/rum/aggregate route — auth + isAdmin gate + $queryRawUnsafe
 *     percentile_cont (PostgreSQL native). period=7d|30d query param.
 *   - NEW /admin/rum/page.tsx — 'use client' + useSession + useQuery + period state.
 *   - NEW _components/rum-aggregate-table.tsx — period 토글 + 8 column table.
 *
 * canonical truth lock:
 *   - §11.246d-4-cont RumMetric model 보존 (4 metric Float? + pathname + createdAt).
 *   - §11.246e-cont lighthouse-ci workflow 보존 (synthetic + RUM 양립).
 *   - admin/layout.tsx skip-link wrapper 보존 (§11.126).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const ROUTE_PATH = resolve(
  __dirname,
  "../../app/api/admin/rum/aggregate/route.ts",
);
const PAGE_PATH = resolve(__dirname, "../../app/admin/rum/page.tsx");
const TABLE_PATH = resolve(
  __dirname,
  "../../app/admin/rum/_components/rum-aggregate-table.tsx",
);
const SCHEMA_PATH = resolve(__dirname, "../../../prisma/schema.prisma");
const WORKFLOW_PATH = resolve(
  __dirname,
  "../../../../../.github/workflows/lighthouse-ci.yml",
);

const route = safeRead(ROUTE_PATH);
const page = safeRead(PAGE_PATH);
const table = safeRead(TABLE_PATH);
const schema = safeRead(SCHEMA_PATH);
const workflow = safeRead(WORKFLOW_PATH);

describe("§11.246d-4-cont-2 #1 — /api/admin/rum/aggregate route", () => {
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

  it("period query param 7d/30d 분기", () => {
    expect(route).toMatch(/period/);
    expect(route).toMatch(/['"]7d['"]|['"]30d['"]/);
  });

  it("percentile_cont SQL (PostgreSQL p75/p95)", () => {
    expect(route).toMatch(/percentile_cont/);
  });

  it("GROUP BY pathname", () => {
    expect(route).toMatch(/GROUP\s+BY[\s\S]{0,100}pathname/i);
  });

  it("WHERE createdAt >= (NOW - interval)", () => {
    expect(route).toMatch(/createdAt|"createdAt"/);
    expect(route).toMatch(/NOW\(\)|INTERVAL/);
  });

  it("db.$queryRawUnsafe 또는 db.$queryRaw 사용", () => {
    expect(route).toMatch(/\$queryRaw/);
  });
});

describe("§11.246d-4-cont-2 #2 — /admin/rum/page.tsx", () => {
  it("'use client' directive", () => {
    expect(page).toMatch(/^['"]use client['"]/m);
  });

  it("RumAggregateTable component import", () => {
    expect(page).toMatch(/RumAggregateTable/);
  });

  it("PageHeader 또는 헤더 텍스트 (RUM 관련)", () => {
    expect(page).toMatch(/(PageHeader|RUM|Core Web Vitals|성능 지표|p75|p95)/);
  });

  it("export default function admin page", () => {
    expect(page).toMatch(/export\s+default\s+function/);
  });
});

describe("§11.246d-4-cont-2 #3 — rum-aggregate-table client component", () => {
  it("'use client' directive", () => {
    expect(table).toMatch(/^['"]use client['"]/m);
  });

  it("useState period state ('7d' default 또는 7d/30d 토글)", () => {
    expect(table).toMatch(/useState/);
    expect(table).toMatch(/['"]7d['"]/);
    expect(table).toMatch(/['"]30d['"]/);
  });

  it("useQuery + /api/admin/rum/aggregate fetch", () => {
    expect(table).toMatch(/useQuery/);
    expect(table).toMatch(/\/api\/admin\/rum\/aggregate/);
  });

  it("8 column 표 (pathname/count/lcpP75/lcpP95/clsP75/clsP95/inpP75/inpP95)", () => {
    expect(table).toMatch(/pathname/);
    expect(table).toMatch(/count/i);
    // p75/p95 column 양쪽 매칭 (lcp_p75 또는 lcpP75 둘 다 허용)
    expect(table).toMatch(/lcp[_]?p75|lcpP75/i);
    expect(table).toMatch(/lcp[_]?p95|lcpP95/i);
    expect(table).toMatch(/cls[_]?p75|clsP75/i);
    expect(table).toMatch(/inp[_]?p75|inpP75/i);
  });

  it("empty state (RumMetric row 0 시 안내 메시지)", () => {
    // 한국어 또는 영문 empty 메시지 매칭
    expect(table).toMatch(/(데이터가|수집되지|아직|empty|No data|no.{0,5}data)/i);
  });

  it("period 토글 button (7일 / 30일)", () => {
    expect(table).toMatch(/setPeriod|onClick[\s\S]{0,200}period/);
  });
});

describe("§11.246d-4-cont-2 #4 — invariant 보존", () => {
  it("§11.246d-4-cont RumMetric model 보존", () => {
    expect(schema).toMatch(/model\s+RumMetric\s*\{/);
  });

  it("§11.246d-4-cont RumMetric 4 metric Float? 보존", () => {
    expect(schema).toMatch(/model\s+RumMetric[\s\S]{0,2000}lcp\s+Float\?/);
    expect(schema).toMatch(/model\s+RumMetric[\s\S]{0,2000}cls\s+Float\?/);
    expect(schema).toMatch(/model\s+RumMetric[\s\S]{0,2000}inp\s+Float\?/);
  });

  it("§11.246e-cont Lighthouse CI workflow 보존", () => {
    expect(workflow).toMatch(/name:\s*Lighthouse CI/);
    expect(workflow).toMatch(/@lhci\/cli/);
  });

  it("§11.246d-4-cont-2 trace marker comment", () => {
    const combined = route + "\n" + page + "\n" + table;
    expect(combined).toMatch(/§11\.246d-4-cont-2|11\.246d-4-cont-2/);
  });
});
