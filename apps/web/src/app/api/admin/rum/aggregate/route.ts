import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/api/admin";
import { db } from "@/lib/db";

/**
 * §11.246d-4-cont-2 #rum-aggregate-admin-dashboard — 호영님 §11.246d-4-cont 자연 후속.
 *
 * GET /api/admin/rum/aggregate?period=7d|30d
 *
 * Strategy:
 *   - §11.246d-4-cont RumMetric raw row → pathname 별 grouping + p75/p95
 *     percentile (PostgreSQL native percentile_cont) 집계.
 *   - admin gate 2 layer: auth() session + isAdmin(userId).
 *   - period 7d (default) 또는 30d 분기 — interval 으로 createdAt 필터.
 *
 * canonical truth lock:
 *   - RumMetric 시그니처 보존 (4 metric Float? + pathname + createdAt).
 *   - read-only — mutation 0. derived view = stateless aggregate.
 *   - $queryRawUnsafe — period 만 literal 분기 (SQL injection 차단: enum 화).
 */

interface RumAggregateRow {
  pathname: string | null;
  count: bigint;
  lcp_p75: number | null;
  lcp_p95: number | null;
  cls_p75: number | null;
  cls_p95: number | null;
  inp_p75: number | null;
  inp_p95: number | null;
}

export async function GET(request: NextRequest) {
  try {
    // §11.246d-4-cont-2 — admin gate 2 layer.
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // period: '7d' (default) | '30d'. enum 분기 — SQL injection 차단.
    const periodParam = request.nextUrl.searchParams.get("period");
    const period: "7d" | "30d" = periodParam === "30d" ? "30d" : "7d";
    const intervalDays = period === "30d" ? 30 : 7;

    // §11.246d-4-cont-2 — percentile_cont PostgreSQL native.
    //   pathname 별 grouping + 4 metric 중 3 metric (LCP/CLS/INP) p75/p95.
    //   FID 는 INP 로 대체 권장 (web.dev 2024+) — 본 view 에서 제외.
    //   intervalDays 는 number 로 안전 (Number cast).
    const sql = `
      SELECT
        "pathname",
        COUNT(*)::bigint as "count",
        percentile_cont(0.75) WITHIN GROUP (ORDER BY "lcp") FILTER (WHERE "lcp" IS NOT NULL) as "lcp_p75",
        percentile_cont(0.95) WITHIN GROUP (ORDER BY "lcp") FILTER (WHERE "lcp" IS NOT NULL) as "lcp_p95",
        percentile_cont(0.75) WITHIN GROUP (ORDER BY "cls") FILTER (WHERE "cls" IS NOT NULL) as "cls_p75",
        percentile_cont(0.95) WITHIN GROUP (ORDER BY "cls") FILTER (WHERE "cls" IS NOT NULL) as "cls_p95",
        percentile_cont(0.75) WITHIN GROUP (ORDER BY "inp") FILTER (WHERE "inp" IS NOT NULL) as "inp_p75",
        percentile_cont(0.95) WITHIN GROUP (ORDER BY "inp") FILTER (WHERE "inp" IS NOT NULL) as "inp_p95"
      FROM "RumMetric"
      WHERE "createdAt" >= NOW() - INTERVAL '${Number(intervalDays)} days'
      GROUP BY "pathname"
      ORDER BY COUNT(*) DESC
      LIMIT 100
    `;

    // db (@/lib/db) 가 any-typed proxy 이므로 generic type arg 0 + 명시적 cast.
    const rows = (await db.$queryRawUnsafe(sql)) as RumAggregateRow[];

    // BigInt JSON 직렬화 불가 — Number 변환.
    const safeRows = rows.map((r: RumAggregateRow) => ({
      pathname: r.pathname,
      count: Number(r.count),
      lcp_p75: r.lcp_p75,
      lcp_p95: r.lcp_p95,
      cls_p75: r.cls_p75,
      cls_p95: r.cls_p95,
      inp_p75: r.inp_p75,
      inp_p95: r.inp_p95,
    }));

    return NextResponse.json({ period, rows: safeRows }, { status: 200 });
  } catch (error) {
    console.error("[admin/rum/aggregate] route error:", error);
    return NextResponse.json(
      { error: "Failed to fetch RUM aggregate" },
      { status: 500 },
    );
  }
}
