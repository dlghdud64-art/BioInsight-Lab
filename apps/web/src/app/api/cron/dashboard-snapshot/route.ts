import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { captureDashboardSnapshot } from "@/lib/dashboard/snapshot-helper";
// #cron-monitoring-admin-dashboard — Vercel cron 실행 history wrapper.
import { logCronExecution } from "@/lib/cron/execution-logger";

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

    // #cron-monitoring — handler wrap (organization scan 통째 wrap).
    const result = await logCronExecution(
      "/api/cron/dashboard-snapshot",
      async () => {
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
        return { orgSuccessCount, orgFailures };
      },
    );

    return NextResponse.json({
      success: true,
      orgSuccessCount: result.orgSuccessCount,
      orgFailureCount: result.orgFailures.length,
      failures: result.orgFailures.slice(0, 10),
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
