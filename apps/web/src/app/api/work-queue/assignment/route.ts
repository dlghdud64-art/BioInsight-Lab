import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { executeAssignmentAction } from "@/lib/work-queue/work-queue-service";
import type { AssignmentAction } from "@/lib/work-queue/console-assignment";

const VALID_ACTIONS = new Set<AssignmentAction>([
  "claim", "assign", "reassign", "mark_in_progress", "mark_blocked", "hand_off",
]);

/**
 * POST /api/work-queue/assignment — 배정 액션 실행
 *
 * Body:
 *   - itemId: string (required)
 *   - action: AssignmentAction (required)
 *   - targetUserId?: string
 *   - note?: string
 *   - nextAction?: string
 */
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    // §enforcement-handle-close-sweep — 핸들은 **대상 id 확정 후** 생성한다.
    //   body 검증(400)이 핸들보다 앞서므로 실패 경로에서 lock 을 아예 잡지 않는다.
    //   targetEntityId 를 실제 itemId 로 넘겨야 lock 키가 per-item 이 된다
    //   (deriveConcurrencyKey: 'unknown' 이면 userId fallback → 같은 사용자의 서로 다른 항목이 서로를 막는다).
    const body = await request.json();
    const { itemId, action, targetUserId, note, nextAction } = body;

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json({ error: "itemId is required" }, { status: 400 });
    }

    if (!action || !VALID_ACTIONS.has(action as AssignmentAction)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'ai_action',
      targetEntityId: itemId,
      sourceSurface: 'web_app',
      routePath: '/api/work-queue/assignment',
    });
    if (!enforcement.allowed) return enforcement.deny();

    await executeAssignmentAction({
      itemId,
      action: action as AssignmentAction,
      actorUserId: session.user.id,
      targetUserId,
      note,
      nextAction,
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });

    enforcement.complete({
      beforeState: { itemId, action },
      afterState: { itemId, action, status: 'executed' },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    enforcement?.fail();
    console.error("[Assignment] Action failed:", error);
    const message = error instanceof Error ? error.message : "Assignment action failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
