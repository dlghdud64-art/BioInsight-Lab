import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
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
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    // §enforcement-handle-close-sweep — 핸들은 **대상 id 확정 후** 생성(검증 400 은 lock 이전).
    //   targetEntityId 를 실제 itemId 로 넘겨야 lock 키가 per-resource 가 된다
    //   (deriveConcurrencyKey: 'unknown' 이면 userId fallback → 같은 사용자의 다른 대상이 서로를 막는다).
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

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'ai_action',
      targetEntityId: itemId,
      sourceSurface: 'web_app',
      routePath: '/api/work-queue/daily-review',
    });
    if (!enforcement.allowed) return enforcement.deny();

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

    enforcement.complete({
      beforeState: { itemId, actionType, actionId },
      afterState: { itemId, actionType, actionId, status: 'executed' },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    enforcement?.fail();
    console.error("[daily-review] POST error:", error);
    const message = error instanceof Error ? error.message : "일일 검토 액션 실행 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
