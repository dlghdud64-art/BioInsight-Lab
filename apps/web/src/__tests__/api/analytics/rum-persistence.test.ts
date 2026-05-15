/**
 * §11.246d-4-cont #rum-metric-db-persistence — 호영님 §11.246d-4 자연 후속
 *
 * 호영님 spec: §11.246d-4 가 structured log 만으로 land. 본 cluster 는 RumMetric
 *   Prisma model + migration SQL + route 안 db.rumMetric.create 추가. p75
 *   aggregate view 는 별도 백로그 (out of scope).
 *
 * Strategy:
 *   - schema.prisma 안 RumMetric model (4 metric Float? + pathname/userAgent
 *     String? + createdAt + 5 @@index).
 *   - migration SQL CREATE TABLE IF NOT EXISTS "RumMetric".
 *   - route.ts 안 try/catch 으로 db.rumMetric.create — 실패 시 console.log
 *     fallback (silent degrade, 회귀 0).
 *
 * canonical truth lock:
 *   - §11.246d-4 zod RumMetricSchema 보존 (lcp/cls/fid/inp optional).
 *   - §11.246d-3 observeLCP + §11.246d-5 observeCLS/FID/INP / window.__labaxis*
 *     / LcpObserverClient 시그니처 보존.
 *   - 본 cluster 는 backend infra only — UI surface 영향 0.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readdirSync } from "node:fs";

const SCHEMA_PATH = resolve(__dirname, "../../../../prisma/schema.prisma");
const ROUTE_PATH = resolve(
  __dirname,
  "../../../app/api/analytics/rum/route.ts",
);
const COMPONENT_PATH = resolve(
  __dirname,
  "../../../components/observability/lcp-observer-client.tsx",
);
const HELPER_PATH = resolve(__dirname, "../../../lib/performance/lcp-observer.ts");
const MIGRATIONS_DIR = resolve(__dirname, "../../../../prisma/migrations");

const schema = readFileSync(SCHEMA_PATH, "utf8");
const route = readFileSync(ROUTE_PATH, "utf8");
const component = readFileSync(COMPONENT_PATH, "utf8");
const helper = readFileSync(HELPER_PATH, "utf8");

// migration 파일 자동 탐색 (timestamp prefix + _rum_metric_table)
const migrationDir = readdirSync(MIGRATIONS_DIR).find((d) =>
  /^\d+_rum_metric_table$/.test(d),
);
const migration = migrationDir
  ? readFileSync(resolve(MIGRATIONS_DIR, migrationDir, "migration.sql"), "utf8")
  : "";

describe("§11.246d-4-cont #1 — RumMetric Prisma model", () => {
  it("schema.prisma 안 model RumMetric 선언", () => {
    expect(schema).toMatch(/model\s+RumMetric\s*\{/);
  });

  it("4 metric Float? (lcp/cls/fid/inp) 모두 optional", () => {
    expect(schema).toMatch(/model\s+RumMetric[\s\S]{0,2000}lcp\s+Float\?/);
    expect(schema).toMatch(/model\s+RumMetric[\s\S]{0,2000}cls\s+Float\?/);
    expect(schema).toMatch(/model\s+RumMetric[\s\S]{0,2000}fid\s+Float\?/);
    expect(schema).toMatch(/model\s+RumMetric[\s\S]{0,2000}inp\s+Float\?/);
  });

  it("pathname / userAgent / sessionId 모두 String? nullable", () => {
    expect(schema).toMatch(/model\s+RumMetric[\s\S]{0,2000}pathname\s+String\?/);
    expect(schema).toMatch(/model\s+RumMetric[\s\S]{0,2000}userAgent\s+String\?/);
    expect(schema).toMatch(/model\s+RumMetric[\s\S]{0,2000}sessionId\s+String\?/);
  });

  it("createdAt DateTime + @default(now())", () => {
    expect(schema).toMatch(
      /model\s+RumMetric[\s\S]{0,2000}createdAt\s+DateTime\s+@default\(now\(\)\)/,
    );
  });

  it("@@index 5개 (createdAt / pathname / lcp / cls / inp)", () => {
    const modelMatch = schema.match(/model\s+RumMetric\s*\{[\s\S]+?\n\}/);
    expect(modelMatch).not.toBeNull();
    const modelBlock = modelMatch?.[0] ?? "";
    expect(modelBlock).toMatch(/@@index\(\[createdAt\]\)/);
    expect(modelBlock).toMatch(/@@index\(\[pathname\]\)/);
    expect(modelBlock).toMatch(/@@index\(\[lcp\]\)/);
    expect(modelBlock).toMatch(/@@index\(\[cls\]\)/);
    expect(modelBlock).toMatch(/@@index\(\[inp\]\)/);
  });
});

describe("§11.246d-4-cont #2 — migration SQL", () => {
  it("migration 디렉토리 존재 (timestamp_rum_metric_table)", () => {
    expect(migrationDir).toBeTruthy();
  });

  it("CREATE TABLE IF NOT EXISTS \"RumMetric\" 패턴", () => {
    expect(migration).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+"RumMetric"/);
  });

  it("4 metric column DOUBLE PRECISION nullable", () => {
    expect(migration).toMatch(/"lcp"\s+DOUBLE\s+PRECISION/i);
    expect(migration).toMatch(/"cls"\s+DOUBLE\s+PRECISION/i);
    expect(migration).toMatch(/"fid"\s+DOUBLE\s+PRECISION/i);
    expect(migration).toMatch(/"inp"\s+DOUBLE\s+PRECISION/i);
  });

  it("CREATE INDEX 5개 (createdAt / pathname / lcp / cls / inp)", () => {
    expect(migration).toMatch(/CREATE\s+INDEX[\s\S]{0,200}"createdAt"/);
    expect(migration).toMatch(/CREATE\s+INDEX[\s\S]{0,200}"pathname"/);
    expect(migration).toMatch(/CREATE\s+INDEX[\s\S]{0,200}"lcp"/);
    expect(migration).toMatch(/CREATE\s+INDEX[\s\S]{0,200}"cls"/);
    expect(migration).toMatch(/CREATE\s+INDEX[\s\S]{0,200}"inp"/);
  });
});

describe("§11.246d-4-cont #3 — POST route db.rumMetric.create", () => {
  it("route.ts 안 db import (@/lib/db)", () => {
    expect(route).toMatch(/from\s+["']@\/lib\/db["']/);
  });

  it("route.ts 안 db.rumMetric.create 호출", () => {
    expect(route).toMatch(/db\.rumMetric\.create/);
  });

  it("create 호출이 try/catch 안에 있음 (silent degrade)", () => {
    // try { ... db.rumMetric.create ... } catch { ... } 패턴 매칭
    expect(route).toMatch(/try\s*\{[\s\S]{0,1000}db\.rumMetric\.create/);
  });

  it("data field 4 metric + pathname + userAgent + sessionId 전달", () => {
    expect(route).toMatch(/db\.rumMetric\.create[\s\S]{0,500}lcp/);
    expect(route).toMatch(/db\.rumMetric\.create[\s\S]{0,500}cls/);
    expect(route).toMatch(/db\.rumMetric\.create[\s\S]{0,500}fid/);
    expect(route).toMatch(/db\.rumMetric\.create[\s\S]{0,500}inp/);
    expect(route).toMatch(/db\.rumMetric\.create[\s\S]{0,500}pathname/);
    expect(route).toMatch(/db\.rumMetric\.create[\s\S]{0,500}userAgent/);
  });
});

describe("§11.246d-4-cont #4 — invariant 보존 (§11.246d-3/-4/-5)", () => {
  it("§11.246d-4 zod RumMetricSchema 보존 (4 metric optional)", () => {
    expect(route).toMatch(/RumMetricSchema/);
    expect(route).toMatch(/lcp:\s*z\.[^,]+optional/);
    expect(route).toMatch(/cls:\s*z\.[^,]+optional/);
    expect(route).toMatch(/fid:\s*z\.[^,]+optional/);
    expect(route).toMatch(/inp:\s*z\.[^,]+optional/);
  });

  it("§11.246d-4 safeParse + 400 invalid 보존", () => {
    expect(route).toMatch(/safeParse/);
    expect(route).toMatch(/status:\s*400/);
  });

  it("§11.246d-4 200 ok 응답 보존", () => {
    expect(route).toMatch(/status:\s*200/);
  });

  it("§11.246d-3 observeLCP + §11.246d-5 observeCLS/FID/INP helper 보존", () => {
    expect(helper).toMatch(/export\s+function\s+observeLCP/);
    expect(helper).toMatch(/export\s+function\s+observeCLS/);
    expect(helper).toMatch(/export\s+function\s+observeFID/);
    expect(helper).toMatch(/export\s+function\s+observeINP/);
  });

  it("§11.246d-4 LcpObserverClient navigator.sendBeacon + visibilitychange 보존", () => {
    expect(component).toMatch(/navigator\.sendBeacon/);
    expect(component).toMatch(/visibilitychange/);
    expect(component).toMatch(/\/api\/analytics\/rum/);
  });

  it("§11.246d-4-cont trace marker comment in route", () => {
    expect(route).toMatch(/§11\.246d-4-cont[\s\S]{0,400}(persist|RumMetric|db\.rumMetric)/i);
  });
});
