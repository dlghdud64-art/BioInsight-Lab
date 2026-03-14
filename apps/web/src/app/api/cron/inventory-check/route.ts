import { NextRequest, NextResponse } from "next/server";
import { detectInventoryIssues } from "@/lib/ai/inventory-restock-detector";

/**
 * GET /api/cron/inventory-check
 *
 * Vercel Cron으로 재고 부족 및 유효기한 위험을 배치 감지합니다.
 *
 * Vercel cron 설정 (vercel.json):
 *   { "crons": [{ "path": "/api/cron/inventory-check", "schedule": "0 8 * * *" }] }
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

    const result = await detectInventoryIssues(null, null);

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Inventory check failed:", error);
    return NextResponse.json(
      { error: "Inventory check failed", details: String(error) },
      { status: 500 }
    );
  }
}

export const maxDuration = 30;
