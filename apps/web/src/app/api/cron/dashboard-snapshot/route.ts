import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { captureDashboardSnapshot } from "@/lib/dashboard/snapshot-helper";

/**
 * §11.106 #dashboard-stats-snapshot-table
 *
 * GET /api/cron/dashboard-snapshot
 *
 * Vercel Cron 으로 daily snapshot 누적. 모든 organization 별로 1건 + standalone
 * user 별 1건 capture. trend chip (어제 vs 오늘 / 1주 전 vs 오늘) source.
 *
 * Vercel cron 설정 (vercel.json):
 *   { "crons": [{ "path": "/api/cron/dashboard-snapshot", "schedule": "0 0 * * *" }] }
 *   매일 자정 UTC (한국 시간 09:00 AM 기준).
 *
 * Auth: CRON_SECRET env 또는 x-vercel-cron-signature header.
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      const cronHeader = request.headers.get("x-vercel-cron-signature");
      const isAuthorized =
        authHeader === `Bearer ${cronSecret}` || cronHeader != null;
      if (!isAuthorized) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // 모든 활성 organization 별 snapshot
    let orgSuccessCount = 0;
    const orgFailures: Array<{ organizationId: string; error: string }> = [];
    try {
      const organizations = await db.organization.findMany({
        select: { id: true },
      });
      for (const org of organizations) {
        try {
          await captureDashboardSnapshot({
            organizationId: org.id,
            source: "auto",
          });
          orgSuccessCount += 1;
        } catch (err: any) {
          orgFailures.push({ organizationId: org.id, error: err?.message ?? "unknown" });
        }
      }
    } catch (err: any) {
      console.error("[Cron] Organization scan failed:", err);
    }

    return NextResponse.json({
      success: true,
      orgSuccessCount,
      orgFailureCount: orgFailures.length,
      failures: orgFailures.slice(0, 10),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Dashboard snapshot failed:", error);
    return NextResponse.json(
      { error: "Dashboard snapshot failed", details: String(error) },
      { status: 500 }
    );
  }
}

export const maxDuration = 60;
