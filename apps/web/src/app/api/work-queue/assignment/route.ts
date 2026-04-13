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
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'ai_action',
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/work-queue/assignment',
    });
    if (!enforcement.allowed) return enforcement.deny();

        if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { itemId, action, targetUserId, note, nextAction } = body;

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json({ error: "itemId is required" }, { status: 400 });
    }

    if (!action || !VALID_ACTIONS.has(action as AssignmentAction)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Assignment] Action failed:", error);
    const message = error instanceof Error ? error.message : "Assignment action failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
