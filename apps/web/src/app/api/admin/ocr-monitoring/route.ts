import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/api/admin";
import { db } from "@/lib/db";

/**
 * §11.290 Phase 6 #ocr-monitoring-admin-dashboard —
 *   GET /api/admin/ocr-monitoring?period=7d|30d
 *
 * 호영님 P1 spec (2026-05-23):
 *   §11.290 family cost monitoring 마무리. Phase 5.5 + 5.5.b 의
 *   OcrResult.costUsd / OcrJob.imageHash 데이터 source 위에 per-provider +
 *   per-day + cache reuse + status breakdown aggregation.
 *
 * Strategy (admin/cron route 패턴 정합):
 *   - admin gate 2 layer: auth() session + isAdmin(userId)
 *   - period 7d (default) | 30d 분기 — createdAt 필터
 *   - $queryRawUnsafe + Number(intervalDays) cast (SQL injection 차단)
 *   - BigInt → Number 안전 직렬화
 *
 * Response shape:
 *   {
 *     period: "7d" | "30d",
 *     totals: { jobs, costUsd, uniqueHashes },
 *     perProvider: [{ provider, count, costUsd, avgLatencyMs }],
 *     perDay: [{ day, count, costUsd }],
 *     statusBreakdown: [{ status, count }],
 *     cacheReuseRatio: number  // (jobs - uniqueHashes) / jobs (cache eligible proxy)
 *   }
 *
 * canonical truth lock:
 *   - OcrJob/OcrResult read-only — mutation 0
 *   - 정확한 cache hit count 는 별도 audit table 필요 (Phase 6.b 백로그)
 */

interface PerProviderRow {
  provider: string;
  count: bigint;
  costUsd: number | null;
  avgLatencyMs: number | null;
}

interface PerDayRow {
  day: Date;
  count: bigint;
  costUsd: number | null;
}

interface StatusRow {
  status: string;
  count: bigint;
}

interface TotalsRow {
  jobs: bigint;
  uniqueHashes: bigint;
  costUsd: number | null;
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
    const intervalSql = `${Number(intervalDays)} days`;

    // (1) per-provider — OcrResult groupBy provider + count + sum(costUsd)
    const perProviderRows = (await db.$queryRawUnsafe(`
      SELECT
        r."provider",
        COUNT(*)::bigint as "count",
        SUM(r."costUsd")::double precision as "costUsd",
        AVG(r."latencyMs")::double precision as "avgLatencyMs"
      FROM "OcrResult" r
      INNER JOIN "OcrJob" j ON j."id" = r."jobId"
      WHERE j."createdAt" >= NOW() - INTERVAL '${intervalSql}'
      GROUP BY r."provider"
      ORDER BY r."provider"
    `)) as PerProviderRow[];

    // (2) per-day — OcrJob count + OcrResult sum(costUsd) by day (KST)
    const perDayRows = (await db.$queryRawUnsafe(`
      SELECT
        DATE(j."createdAt" AT TIME ZONE 'Asia/Seoul') as "day",
        COUNT(DISTINCT j."id")::bigint as "count",
        COALESCE(SUM(r."costUsd"), 0)::double precision as "costUsd"
      FROM "OcrJob" j
      LEFT JOIN "OcrResult" r ON r."jobId" = j."id"
      WHERE j."createdAt" >= NOW() - INTERVAL '${intervalSql}'
      GROUP BY DATE(j."createdAt" AT TIME ZONE 'Asia/Seoul')
      ORDER BY "day"
    `)) as PerDayRow[];

    // (3) status breakdown — OcrJob.status count
    const statusRows = (await db.$queryRawUnsafe(`
      SELECT
        j."status",
        COUNT(*)::bigint as "count"
      FROM "OcrJob" j
      WHERE j."createdAt" >= NOW() - INTERVAL '${intervalSql}'
      GROUP BY j."status"
      ORDER BY j."status"
    `)) as StatusRow[];

    // (4) totals — jobs count + unique imageHash count + total costUsd
    //     cacheReuseRatio = (jobs - uniqueHashes) / jobs (cache eligible proxy)
    const totalsRows = (await db.$queryRawUnsafe(`
      SELECT
        COUNT(*)::bigint as "jobs",
        COUNT(DISTINCT j."imageHash")::bigint as "uniqueHashes",
        COALESCE((
          SELECT SUM(r."costUsd")
          FROM "OcrResult" r
          INNER JOIN "OcrJob" j2 ON j2."id" = r."jobId"
          WHERE j2."createdAt" >= NOW() - INTERVAL '${intervalSql}'
        ), 0)::double precision as "costUsd"
      FROM "OcrJob" j
      WHERE j."createdAt" >= NOW() - INTERVAL '${intervalSql}'
    `)) as TotalsRow[];

    const totalsRow = totalsRows[0];
    const totalJobs = Number(totalsRow?.jobs ?? 0);
    const uniqueHashes = Number(totalsRow?.uniqueHashes ?? 0);
    const cacheReuseRatio =
      totalJobs > 0 ? Math.round(((totalJobs - uniqueHashes) / totalJobs) * 1000) / 10 : 0;

    return NextResponse.json(
      {
        period,
        totals: {
          jobs: totalJobs,
          uniqueHashes,
          costUsd: totalsRow?.costUsd != null ? Math.round(totalsRow.costUsd * 10000) / 10000 : 0,
        },
        perProvider: perProviderRows.map((r) => ({
          provider: r.provider,
          count: Number(r.count),
          costUsd: r.costUsd != null ? Math.round(r.costUsd * 10000) / 10000 : 0,
          avgLatencyMs: r.avgLatencyMs != null ? Math.round(r.avgLatencyMs) : null,
        })),
        perDay: perDayRows.map((r) => ({
          day: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10),
          count: Number(r.count),
          costUsd: r.costUsd != null ? Math.round(r.costUsd * 10000) / 10000 : 0,
        })),
        statusBreakdown: statusRows.map((r) => ({
          status: r.status,
          count: Number(r.count),
        })),
        cacheReuseRatio, // %
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[admin/ocr-monitoring] route error:", error);
    return NextResponse.json(
      { error: "Failed to fetch OCR monitoring aggregate" },
      { status: 500 },
    );
  }
}
