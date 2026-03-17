import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { queryDailyReviewData, executeDailyReviewAction } from "@/lib/work-queue/work-queue-service";
import { selectDailyReviewItems } from "@/lib/work-queue/console-daily-review";

/**
 * GET /api/work-queue/daily-review — 일일 검토 서피스 조회
 *
 * Query params:
 *   - organizationId?: string
 *
 * Returns: DailyReviewSurface
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId") || undefined;

    const { items, logs } = await queryDailyReviewData({ organizationId });
    const surface = selectDailyReviewItems(items, logs, session.user.id);

    return NextResponse.json(surface);
  } catch (error) {
    console.error("[daily-review] GET error:", error);
    return NextResponse.json(
      { error: "일일 검토 데이터 조회 실패" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/work-queue/daily-review — 일일 검토 액션 실행
 *
 * Body:
 *   - itemId: string (required)
 *   - actionType: "escalation" | "review_outcome" (required)
 *   - actionId: string (required)
 *   - targetUserId?: string
 *   - note?: string
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { itemId, actionType, actionId, targetUserId, note } = body;

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json({ error: "itemId 필수" }, { status: 400 });
    }
    if (!actionType || !["escalation", "review_outcome"].includes(actionType)) {
      return NextResponse.json({ error: "actionType은 escalation 또는 review_outcome이어야 합니다" }, { status: 400 });
    }
    if (!actionId || typeof actionId !== "string") {
      return NextResponse.json({ error: "actionId 필수" }, { status: 400 });
    }

    await executeDailyReviewAction({
      itemId,
      actionType,
      actionId,
      actorUserId: session.user.id,
      targetUserId,
      note,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[daily-review] POST error:", error);
    const message = error instanceof Error ? error.message : "일일 검토 액션 실행 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
