import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/api/admin";
import { db } from "@/lib/db";

/**
 * §11.246d-4-cont-3 #rum-trend-line-chart — 호영님 §11.246d-4-cont-2 자연 후속.
 *
 * GET /api/admin/rum/timeseries
 *   30일 fixed window. day grouping. p75 only (p95 별도 cluster).
 *
 * Response: { rows: [{ date: 'YYYY-MM-DD', lcp_p75, cls_p75, inp_p75, count }] }
 *
 * Strategy:
 *   - date_trunc('day', "createdAt") 으로 일자별 grouping.
 *   - percentile_cont(0.75) WITHIN GROUP — 3 metric.
 *   - WHERE createdAt >= NOW() - INTERVAL '30 days'.
 *   - ORDER BY date ASC (시간 순서, line chart 정합).
 *   - LIMIT 31 (30일 + safety margin).
 *
 * canonical truth lock:
 *   - read-only aggregate. mutation 0.
 *   - 2-layer admin gate (auth + isAdmin) — §11.246d-4-cont-2 패턴 reuse.
 *   - RumMetric 시그니처 보존 (§11.246d-4-cont).
 */

interface RumTimeseriesRow {
  date: Date | string;
  count: bigint;
  lcp_p75: number | null;
  cls_p75: number | null;
  inp_p75: number | null;
}

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // §11.246d-4-cont-3 — 30일 fixed window (scope 최소, 호영님 결정).
    //   period 토글은 별도 백로그 (§11.246d-4-cont-4).
    const sql = `
      SELECT
        date_trunc('day', "createdAt")::date as "date",
        COUNT(*)::bigint as "count",
        percentile_cont(0.75) WITHIN GROUP (ORDER BY "lcp") FILTER (WHERE "lcp" IS NOT NULL) as "lcp_p75",
        percentile_cont(0.75) WITHIN GROUP (ORDER BY "cls") FILTER (WHERE "cls" IS NOT NULL) as "cls_p75",
        percentile_cont(0.75) WITHIN GROUP (ORDER BY "inp") FILTER (WHERE "inp" IS NOT NULL) as "inp_p75"
      FROM "RumMetric"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY date_trunc('day', "createdAt")
      ORDER BY "date" ASC
      LIMIT 31
    `;

    const rows = (await db.$queryRawUnsafe(sql)) as RumTimeseriesRow[];

    // BigInt + Date 직렬화 — JSON 호환 형태로 변환.
    const safeRows = rows.map((r: RumTimeseriesRow) => ({
      date:
        r.date instanceof Date
          ? r.date.toISOString().slice(0, 10) // YYYY-MM-DD
          : String(r.date).slice(0, 10),
      count: Number(r.count),
      lcp_p75: r.lcp_p75,
      cls_p75: r.cls_p75,
      inp_p75: r.inp_p75,
    }));

    return NextResponse.json({ rows: safeRows }, { status: 200 });
  } catch (error) {
    console.error("[admin/rum/timeseries] route error:", error);
    return NextResponse.json(
      { error: "Failed to fetch RUM timeseries" },
      { status: 500 },
    );
  }
}
