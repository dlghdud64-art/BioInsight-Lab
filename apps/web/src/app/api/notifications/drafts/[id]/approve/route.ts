import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { approveEmailDraft } from "@/lib/notifications";
import { db } from "@/lib/db";

/**
 * POST /api/notifications/drafts/:id/approve
 *
 * 이메일 초안을 승인한다.
 * REVIEWED 상태의 EMAIL_DRAFT만 승인 가능.
 * 관리자 권한 필요.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 관리자 권한 확인
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "관리자만 이메일 초안을 승인할 수 있습니다" },
        { status: 403 }
      );
    }

    const { id: actionId } = await params;

    // 액션 존재 여부 확인
    const action = await db.notificationAction.findUnique({
      where: { id: actionId },
      select: { id: true, actionType: true, status: true },
    });

    if (!action) {
      return NextResponse.json(
        { error: "이메일 초안을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    if (action.actionType !== "EMAIL_DRAFT") {
      return NextResponse.json(
        { error: "EMAIL_DRAFT 타입만 승인 가능합니다" },
        { status: 400 }
      );
    }

    if (action.status !== "REVIEWED") {
      return NextResponse.json(
        { error: `REVIEWED 상태만 승인 가능합니다 (현재: ${action.status})` },
        { status: 400 }
      );
    }

    await approveEmailDraft(actionId, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "[API] POST /api/notifications/drafts/:id/approve 오류:",
      error
    );
    return NextResponse.json(
      { error: "이메일 초안 승인 실패" },
      { status: 500 }
    );
  }
}
