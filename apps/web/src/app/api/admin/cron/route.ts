import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/api/admin";
import { db } from "@/lib/db";

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

    return NextResponse.json({ period, rows: safeRows }, { status: 200 });
  } catch (error) {
    console.error("[admin/cron] route error:", error);
    return NextResponse.json(
      { error: "Failed to fetch cron aggregate" },
      { status: 500 },
    );
  }
}
