import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/api/admin";
import { db } from "@/lib/db";
// §cron-registry-drift — 운영 메타(목적·KST·차단 지점)를 서버에서 조인한다.
// 클라이언트가 직접 import 하면 운영 메타가 번들에 실리므로 응답 계약 1곳으로 수렴.
import {
  VERCEL_CRON_REGISTRY,
  getVercelCronRegistryEntry,
} from "@/lib/ops-console/vercel-cron-registry";

/**
 * #cron-monitoring-admin-dashboard — GET /api/admin/cron?period=7d|30d
 *
 * 호영님 backlog audit P0 (b). CronExecutionLog 시각화용 admin endpoint.
 *
 * Strategy:
 *   - admin gate 2 layer: auth() session + isAdmin(userId).
 *   - period 7d (default) | 30d 분기 — startedAt 필터.
 *   - 응답: cron 별 last execution + success rate + p95 duration + recent failures.
 *   - admin/rum/aggregate route 패턴 정확 reuse.
 *
 * canonical truth lock:
 *   - CronExecutionLog read-only — mutation 0.
 *   - cron 별 grouping (Vercel cron registry 5 path 동일 식별자).
 */

interface CronAggregateRow {
  cronPath: string;
  totalCount: bigint;
  successCount: bigint;
  failureCount: bigint;
  avgDurationMs: number | null;
  p95DurationMs: number | null;
  lastStartedAt: Date | null;
  lastSuccess: boolean | null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // period enum 분기 — SQL injection 차단 (literal 분기).
    const periodParam = request.nextUrl.searchParams.get("period");
    const period: "7d" | "30d" = periodParam === "30d" ? "30d" : "7d";
    const intervalDays = period === "30d" ? 30 : 7;

    // cron 별 aggregate — total + success/failure count + avg/p95 duration +
    // last execution. Number(intervalDays) cast 으로 SQL injection 안전.
    const sql = `
      SELECT
        "cronPath",
        COUNT(*)::bigint as "totalCount",
        COUNT(*) FILTER (WHERE "success" = true)::bigint as "successCount",
        COUNT(*) FILTER (WHERE "success" = false)::bigint as "failureCount",
        AVG("durationMs")::double precision as "avgDurationMs",
        percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs") as "p95DurationMs",
        MAX("startedAt") as "lastStartedAt",
        (
          SELECT "success" FROM "CronExecutionLog" inner_log
          WHERE inner_log."cronPath" = outer_log."cronPath"
          ORDER BY "startedAt" DESC
          LIMIT 1
        ) as "lastSuccess"
      FROM "CronExecutionLog" outer_log
      WHERE "startedAt" >= NOW() - INTERVAL '${Number(intervalDays)} days'
      GROUP BY "cronPath"
      ORDER BY "cronPath"
    `;

    const rows = (await db.$queryRawUnsafe(sql)) as CronAggregateRow[];

    // BigInt → Number 변환 + 안전한 직렬화.
    const safeRows = rows.map((r: CronAggregateRow) => ({
      cronPath: r.cronPath,
      totalCount: Number(r.totalCount),
      successCount: Number(r.successCount),
      failureCount: Number(r.failureCount),
      avgDurationMs: r.avgDurationMs != null ? Math.round(r.avgDurationMs) : null,
      p95DurationMs: r.p95DurationMs != null ? Math.round(r.p95DurationMs) : null,
      lastStartedAt: r.lastStartedAt ? r.lastStartedAt.toISOString() : null,
      lastSuccess: r.lastSuccess,
      successRate:
        Number(r.totalCount) > 0
          ? Math.round((Number(r.successCount) / Number(r.totalCount)) * 1000) / 10
          : null,
    }));

    // ── §cron-registry-drift — registry join ──────────────────────────
    // 규칙 2가지:
    //   1) 실행 이력이 0건인 registry 항목도 행으로 남긴다.
    //      "등록됐는데 안 도는 cron" = §11.250b(dead cron) 재발 신호이므로
    //      화면에서 사라지면 안 된다.
    //   2) registry 에 없는 cronPath 는 드롭하지 않고 registry: null 로
    //      내려보낸다. 무음 누락 금지 — 클라이언트가 경고 행으로 렌더한다.
    const statsByPath = new Map(safeRows.map((r) => [r.cronPath, r] as const));

    const emptyStats = (cronPath: string) => ({
      cronPath,
      totalCount: 0,
      successCount: 0,
      failureCount: 0,
      avgDurationMs: null as number | null,
      p95DurationMs: null as number | null,
      lastStartedAt: null as string | null,
      lastSuccess: null as boolean | null,
      successRate: null as number | null,
    });

    const toRegistryMeta = (cronPath: string) => {
      const entry = getVercelCronRegistryEntry(cronPath);
      if (!entry) return null;
      return {
        scheduleKst: entry.scheduleKst,
        purposeKo: entry.purposeKo,
        manualGateKo: entry.manualGateKo,
        operatorCheckKo: entry.operatorCheckKo,
        expectedResultKo: entry.expectedResultKo,
        environment: entry.environment,
      };
    };

    // registry 순서를 우선 유지 → 운영자가 보는 순서가 안정적.
    const registryRows = VERCEL_CRON_REGISTRY.map((entry) => ({
      ...(statsByPath.get(entry.path) ?? emptyStats(entry.path)),
      registry: toRegistryMeta(entry.path),
    }));

    // registry 에 없는데 실행 이력만 있는 path — 경고 대상.
    const registryPaths = new Set(VERCEL_CRON_REGISTRY.map((e) => e.path));
    const unregisteredRows = safeRows
      .filter((r) => !registryPaths.has(r.cronPath))
      .map((r) => ({ ...r, registry: null }));

    const rowsWithRegistry = [...registryRows, ...unregisteredRows];

    return NextResponse.json(
      {
        period,
        rows: rowsWithRegistry,
        unregisteredCount: unregisteredRows.length,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[admin/cron] route error:", error);
    return NextResponse.json(
      { error: "Failed to fetch cron aggregate" },
      { status: 500 },
    );
  }
}
