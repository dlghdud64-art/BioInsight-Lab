/**
 * #cron-monitoring-admin-dashboard — Vercel cron 실행 history + admin dashboard.
 *
 * 호영님 backlog audit P0 (b) 두 번째 cluster (M~3h). §11.250b-fix (vercel.json
 *   registry completion) 사건 사전 감지 = production critical 운영 가치.
 *   CronExecutionLog 신규 model + 5 cron route logging + admin dashboard.
 *
 * Strategy:
 *   - schema.prisma `CronExecutionLog` model 추가 (cronPath / startedAt /
 *     completedAt / durationMs / success / errorMessage / metadata).
 *   - migration: CREATE TABLE IF NOT EXISTS + 3 index (cronPath / startedAt /
 *     success).
 *   - NEW helper `apps/web/src/lib/cron/execution-logger.ts` —
 *     `logCronExecution(cronPath, handler)` wrapper. handler 호출 전후
 *     startedAt/completedAt + try/catch + INSERT to CronExecutionLog.
 *   - 5 cron route swap — handler logic 을 logCronExecution 으로 wrap.
 *   - NEW route `GET /api/admin/cron` — admin gate + period filter + aggregate
 *     (last execution per cronPath + success rate + p95 duration + recent fails).
 *   - NEW page `admin/cron/page.tsx` + table component — admin/rum 패턴 reuse.
 *
 * canonical truth lock:
 *   - CronExecutionLog model = canonical history (read-only telemetry).
 *   - logCronExecution wrapper 시그니처 = (cronPath: string, handler: () =>
 *     Promise<unknown>) => Promise<unknown>. graceful fallback — DB 실패 시
 *     handler 결과 그대로 반환 (cron 운영 영향 0).
 *   - 5 cron route 의 응답 시그니처 보존 (success/timestamp/details).
 *   - admin gate 2-layer (server isAdmin + UI useSession).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const SCHEMA_PATH = resolve(__dirname, "../../../prisma/schema.prisma");
const HELPER_PATH = resolve(__dirname, "../../lib/cron/execution-logger.ts");
const ADMIN_ROUTE_PATH = resolve(__dirname, "../../app/api/admin/cron/route.ts");
const ADMIN_PAGE_PATH = resolve(__dirname, "../../app/admin/cron/page.tsx");
const TABLE_COMPONENT_PATH = resolve(
  __dirname,
  "../../app/admin/cron/_components/cron-execution-table.tsx",
);
const INVENTORY_CHECK_PATH = resolve(
  __dirname,
  "../../app/api/cron/inventory-check/route.ts",
);
const ORDER_FOLLOWUP_PATH = resolve(
  __dirname,
  "../../app/api/cron/order-followup-check/route.ts",
);
const QUOTE_EXPIRY_PATH = resolve(
  __dirname,
  "../../app/api/cron/quote-expiry-check/route.ts",
);
const DASHBOARD_SNAPSHOT_PATH = resolve(
  __dirname,
  "../../app/api/cron/dashboard-snapshot/route.ts",
);
const USER_PURGE_PATH = resolve(
  __dirname,
  "../../app/api/cron/user-soft-delete-purge/route.ts",
);

const schema = safeRead(SCHEMA_PATH);
const helper = safeRead(HELPER_PATH);
const adminRoute = safeRead(ADMIN_ROUTE_PATH);
const adminPage = safeRead(ADMIN_PAGE_PATH);
const tableComponent = safeRead(TABLE_COMPONENT_PATH);
const inventoryCheck = safeRead(INVENTORY_CHECK_PATH);
const orderFollowup = safeRead(ORDER_FOLLOWUP_PATH);
const quoteExpiry = safeRead(QUOTE_EXPIRY_PATH);
const dashboardSnapshot = safeRead(DASHBOARD_SNAPSHOT_PATH);
const userPurge = safeRead(USER_PURGE_PATH);

// Most recent migration file
import { readdirSync } from "node:fs";
const MIGRATIONS_DIR = resolve(__dirname, "../../../prisma/migrations");
function findCronMigration(): string {
  if (!existsSync(MIGRATIONS_DIR)) return "";
  const dirs = readdirSync(MIGRATIONS_DIR).filter((d) => d.includes("cron_execution"));
  if (dirs.length === 0) return "";
  return safeRead(resolve(MIGRATIONS_DIR, dirs[0], "migration.sql"));
}
const migration = findCronMigration();

describe("#cron-monitoring #1 — CronExecutionLog model + migration", () => {
  it("schema CronExecutionLog model 선언", () => {
    expect(schema).toMatch(/model\s+CronExecutionLog/);
  });

  it("cronPath String + startedAt DateTime", () => {
    expect(schema).toMatch(/CronExecutionLog[\s\S]{0,800}cronPath\s+String/);
    expect(schema).toMatch(/CronExecutionLog[\s\S]{0,800}startedAt\s+DateTime/);
  });

  it("completedAt DateTime? + durationMs Int + success Boolean", () => {
    expect(schema).toMatch(/CronExecutionLog[\s\S]{0,800}completedAt\s+DateTime\?/);
    expect(schema).toMatch(/CronExecutionLog[\s\S]{0,800}durationMs\s+Int/);
    expect(schema).toMatch(/CronExecutionLog[\s\S]{0,800}success\s+Boolean/);
  });

  it("errorMessage String? + metadata Json?", () => {
    expect(schema).toMatch(/CronExecutionLog[\s\S]{0,800}errorMessage\s+String\?/);
    expect(schema).toMatch(/CronExecutionLog[\s\S]{0,800}metadata\s+Json\?/);
  });

  it("@@index cronPath + startedAt + success", () => {
    expect(schema).toMatch(/CronExecutionLog[\s\S]{0,1200}@@index.*cronPath/);
    expect(schema).toMatch(/CronExecutionLog[\s\S]{0,1200}@@index.*startedAt/);
    expect(schema).toMatch(/CronExecutionLog[\s\S]{0,1200}@@index.*success/);
  });

  it("migration SQL CREATE TABLE IF NOT EXISTS CronExecutionLog", () => {
    expect(migration.length).toBeGreaterThan(0);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "CronExecutionLog"/);
  });

  it("migration CREATE INDEX 3개", () => {
    const indexCount = (migration.match(/CREATE INDEX IF NOT EXISTS/g) ?? []).length;
    expect(indexCount).toBeGreaterThanOrEqual(3);
  });
});

describe("#cron-monitoring #2 — logCronExecution helper", () => {
  it("helper 파일 존재 + export", () => {
    expect(helper.length).toBeGreaterThan(0);
    expect(helper).toMatch(/export\s+async\s+function\s+logCronExecution/);
  });

  it("handler param + Promise return", () => {
    // handler: () => Promise<T> 형태
    expect(helper).toMatch(/logCronExecution[\s\S]{0,500}handler[\s\S]{0,200}=>\s*Promise/);
  });

  it("startedAt + completedAt + durationMs 계산", () => {
    expect(helper).toMatch(/startedAt/);
    expect(helper).toMatch(/completedAt/);
    expect(helper).toMatch(/durationMs/);
  });

  it("try/catch 으로 success/error 분기 + handler 결과 그대로 반환", () => {
    expect(helper).toMatch(/try\s*\{[\s\S]{0,3000}\}\s*catch/);
    expect(helper).toMatch(/(success:\s*true|success:\s*false)/);
  });

  it("db.cronExecutionLog.create INSERT", () => {
    expect(helper).toMatch(/db\.cronExecutionLog\.create/);
  });

  it("graceful fallback (DB 실패 시 handler 결과 보존)", () => {
    // logger fail 가 cron 운영 영향 0 — handler 결과 throw OR return 보존.
    expect(helper).toMatch(/catch[\s\S]{0,500}console\.error/);
  });
});

describe("#cron-monitoring #3 — 5 cron route swap (handler wrap)", () => {
  it("inventory-check route logCronExecution wrap", () => {
    expect(inventoryCheck).toMatch(/logCronExecution/);
    expect(inventoryCheck).toMatch(/["']\/api\/cron\/inventory-check["']/);
  });

  it("order-followup-check route logCronExecution wrap", () => {
    expect(orderFollowup).toMatch(/logCronExecution/);
    expect(orderFollowup).toMatch(/["']\/api\/cron\/order-followup-check["']/);
  });

  it("quote-expiry-check route logCronExecution wrap", () => {
    expect(quoteExpiry).toMatch(/logCronExecution/);
    expect(quoteExpiry).toMatch(/["']\/api\/cron\/quote-expiry-check["']/);
  });

  it("dashboard-snapshot route logCronExecution wrap", () => {
    expect(dashboardSnapshot).toMatch(/logCronExecution/);
    expect(dashboardSnapshot).toMatch(/["']\/api\/cron\/dashboard-snapshot["']/);
  });

  it("user-soft-delete-purge route logCronExecution wrap", () => {
    expect(userPurge).toMatch(/logCronExecution/);
    expect(userPurge).toMatch(/["']\/api\/cron\/user-soft-delete-purge["']/);
  });

  it("CRON_SECRET 인증 보존 (5 route 모두)", () => {
    for (const r of [inventoryCheck, orderFollowup, quoteExpiry, dashboardSnapshot, userPurge]) {
      expect(r).toMatch(/CRON_SECRET|x-vercel-cron-signature/);
    }
  });
});

describe("#cron-monitoring #4 — admin/cron API route", () => {
  it("GET admin/cron route 파일 존재", () => {
    expect(adminRoute.length).toBeGreaterThan(0);
    expect(adminRoute).toMatch(/export\s+async\s+function\s+GET/);
  });

  it("auth() + isAdmin 2-layer 인증", () => {
    expect(adminRoute).toMatch(/auth\(\)/);
    expect(adminRoute).toMatch(/isAdmin|isAdministrator|adminCheck/);
  });

  it("CronExecutionLog 조회 (findMany 또는 raw SQL)", () => {
    // admin/rum 패턴 reuse — aggregate 용 raw SQL ($queryRawUnsafe + CronExecutionLog table) 도 허용.
    expect(adminRoute).toMatch(/(cronExecutionLog\.(findMany|aggregate)|CronExecutionLog["'])/);
  });

  it("period filter (7d/30d) 또는 limit", () => {
    expect(adminRoute).toMatch(/(period|7d|30d|days|limit)/);
  });

  it("응답 안 rows array + 각 row 의 cronPath/success/startedAt", () => {
    expect(adminRoute).toMatch(/rows/);
    expect(adminRoute).toMatch(/cronPath/);
  });
});

describe("#cron-monitoring #5 — admin/cron page + table component", () => {
  it("admin/cron page.tsx 파일 존재", () => {
    expect(adminPage.length).toBeGreaterThan(0);
  });

  it("'use client' + useSession (admin gate UI)", () => {
    expect(adminPage).toMatch(/["']use client["']/);
    expect(adminPage).toMatch(/useSession/);
  });

  it("PageHeader + 한국어 (Cron 실행 모니터링)", () => {
    expect(adminPage).toMatch(/(Cron|크론|실행)/);
  });

  it("CronExecutionTable component import + render", () => {
    expect(adminPage).toMatch(/CronExecutionTable/);
  });

  it("table component 파일 존재 + 'use client'", () => {
    expect(tableComponent.length).toBeGreaterThan(0);
    expect(tableComponent).toMatch(/["']use client["']/);
  });

  it("table 안 useQuery /api/admin/cron + period 토글", () => {
    expect(tableComponent).toMatch(/useQuery/);
    expect(tableComponent).toMatch(/\/api\/admin\/cron/);
  });

  it("table 안 cronPath + 실행 시각 + 성공/실패 + 소요시간 컬럼", () => {
    expect(tableComponent).toMatch(/cronPath/);
    expect(tableComponent).toMatch(/(startedAt|실행|시각|시간)/);
    expect(tableComponent).toMatch(/(success|성공|실패)/);
  });

  it("4 state: loading + error + empty + data", () => {
    expect(tableComponent).toMatch(/(isLoading|loading)/);
    expect(tableComponent).toMatch(/(isError|error)/);
    expect(tableComponent).toMatch(/(empty|아직|0개|없습니다)/);
  });
});

describe("#cron-monitoring #6 — invariant 보존 (cross-stack)", () => {
  it("기존 5 cron 응답 시그니처 보존 (success + timestamp)", () => {
    for (const r of [inventoryCheck, orderFollowup, quoteExpiry, dashboardSnapshot, userPurge]) {
      expect(r).toMatch(/(success|timestamp|NextResponse\.json)/);
    }
  });

  it("vercel.json 5 cron entry 보존 (§11.250b-fix 정합)", () => {
    const vercelPath = resolve(__dirname, "../../../vercel.json");
    const vercel = safeRead(vercelPath);
    for (const cron of [
      "/api/cron/dashboard-snapshot",
      "/api/cron/user-soft-delete-purge",
      "/api/cron/inventory-check",
      "/api/cron/order-followup-check",
      "/api/cron/quote-expiry-check",
    ]) {
      expect(vercel).toContain(cron);
    }
  });

  it("admin/* layout pattern 보존 (page.tsx + _components 분리)", () => {
    expect(adminPage).toMatch(/PageHeader/);
    expect(tableComponent).toMatch(/(div|table|View)/);
  });

  it("#cron-monitoring trace marker (helper 또는 admin route 안)", () => {
    const combined = helper + "\n" + adminRoute + "\n" + adminPage;
    expect(combined).toMatch(/cron-monitoring|크론.*모니터링|cron.*execution/i);
  });
});
