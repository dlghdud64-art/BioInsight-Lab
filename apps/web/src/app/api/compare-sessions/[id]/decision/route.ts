/**
 * PATCH /api/compare-sessions/[id]/decision — 비교 세션 판정 기록
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createActivityLog } from "@/lib/activity-log";
import { handleApiError } from "@/lib/api-error-handler";

const VALID_DECISION_STATES = ["UNDECIDED", "APPROVED", "HELD", "REJECTED"] as const;
const TERMINAL_STATES = ["APPROVED", "HELD", "REJECTED"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const userId = session?.user?.id ?? null;

    if (!userId) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { decisionState, decisionNote } = body;

    if (!decisionState || !VALID_DECISION_STATES.includes(decisionState)) {
      return NextResponse.json(
        { error: `decisionState는 ${VALID_DECISION_STATES.join(", ")} 중 하나여야 합니다.` },
        { status: 400 }
      );
    }

    const existing = await db.compareSession.findUnique({
      where: { id },
      select: { decisionState: true, organizationId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "비교 세션을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const updated = await db.compareSession.update({
      where: { id },
      data: {
        decisionState,
        decisionNote: decisionNote ?? null,
        decidedBy: userId,
        decidedAt: new Date(),
      },
    });

    // 재개(reopen) 여부 판단: 터미널 상태 → UNDECIDED
    const isReopen =
      TERMINAL_STATES.includes(existing.decisionState ?? "") &&
      decisionState === "UNDECIDED";

    // Complete associated work queue item when decision is terminal
    if (TERMINAL_STATES.includes(decisionState)) {
      db.aiActionItem.updateMany({
        where: {
          relatedEntityType: "COMPARE_SESSION",
          relatedEntityId: id,
          taskStatus: { not: "COMPLETED" },
        },
        data: {
          taskStatus: "COMPLETED",
          substatus: "compare_decided",
          completedAt: new Date(),
        },
      }).catch(() => {});
    }

    await createActivityLog({
      activityType: isReopen
        ? "COMPARE_SESSION_REOPENED"
        : "QUOTE_STATUS_CHANGED",
      entityType: "COMPARE_SESSION",
      entityId: id,
      beforeStatus: existing.decisionState ?? null,
      afterStatus: decisionState,
      userId,
      organizationId: existing.organizationId,
      metadata: {
        decisionNote: decisionNote ?? null,
        isReopen,
      },
    });

    return NextResponse.json({ session: updated });
  } catch (error) {
    return handleApiError(error, "PATCH /api/compare-sessions/[id]/decision");
  }
}
