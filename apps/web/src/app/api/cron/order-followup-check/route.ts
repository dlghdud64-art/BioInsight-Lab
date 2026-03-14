import { NextRequest, NextResponse } from "next/server";
import { detectAndCreateFollowups } from "@/lib/ai/order-followup-detector";

/**
 * GET /api/cron/order-followup-check
 *
 * Vercel Cron 또는 수동 호출로 회신 지연 주문을 탐지합니다.
 *
 * 보안:
 *   - CRON_SECRET 헤더 검증 (Vercel Cron)
 *   - 또는 Authorization: Bearer <secret> 형식
 *
 * Vercel cron 설정 (vercel.json):
 *   { "crons": [{ "path": "/api/cron/order-followup-check", "schedule": "0 9 * * *" }] }
 */
export async function GET(request: NextRequest) {
  try {
    // Vercel Cron 인증
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      const cronHeader = request.headers.get("x-vercel-cron-signature");

      const isAuthorized =
        authHeader === `Bearer ${cronSecret}` ||
        cronHeader != null; // Vercel이 설정한 서명

      if (!isAuthorized) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const result = await detectAndCreateFollowups(null, null);

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Order followup check failed:", error);
    return NextResponse.json(
      { error: "Follow-up check failed", details: String(error) },
      { status: 500 }
    );
  }
}

// Vercel Cron은 GET 요청을 보냄 — 10초 타임아웃 설정
export const maxDuration = 30;
