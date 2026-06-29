import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildRealQuoteInbox } from "@/lib/operational-brief/real-quote-inbox";

/**
 * GET /api/operational-brief/inbox
 *
 * §brief-realdata-quotes (호영님 2026-06-29) — 운영 브리핑 실데이터 inbox.
 *   현재 노출 = quote_response_pending 1종(SENT 견적 = 공급사 응답 대기).
 *   auth + userId 스코프. 읽기 전용(신규 mutation 0). PO/receiving/stock_risk·비교 카드는 0(미조회).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const items = await buildRealQuoteInbox(session.user.id);
    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("[operational-brief/inbox] error:", error);
    return NextResponse.json(
      { error: "운영 브리핑 데이터를 불러오지 못했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
