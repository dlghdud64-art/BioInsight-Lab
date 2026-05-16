import { NextRequest, NextResponse } from "next/server";
import { detectExpiredQuotes } from "@/lib/ai/quote-expiry-detector";

/**
 * GET /api/cron/quote-expiry-check
 *
 * §11.250e — Vercel Cron 으로 Quote.validUntil < now 인 quote 매일 검사하여
 * QUOTE_EXPIRED dispatch + push 발송 (중복 방지).
 *
 * Vercel cron 설정 (vercel.json):
 *   { "crons": [{ "path": "/api/cron/quote-expiry-check", "schedule": "0 10 * * *" }] }
 *
 * §11.250b inventory-check 패턴 정확 reuse — CRON_SECRET / x-vercel-cron-signature 인증.
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

    const result = await detectExpiredQuotes(null);

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Quote expiry check failed:", error);
    return NextResponse.json(
      { error: "Quote expiry check failed", details: String(error) },
      { status: 500 },
    );
  }
}

export const maxDuration = 30;
