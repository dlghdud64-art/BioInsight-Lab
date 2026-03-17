import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { markNotificationRead } from "@/lib/notifications";
import { db } from "@/lib/db";

/**
 * POST /api/notifications/:id/read
 *
 * 알림을 읽음 처리한다.
 * 본인 소유의 알림만 읽음 처리 가능.
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

    const { id: actionId } = await params;

    // 본인 소유 알림인지 확인
    const action = await db.notificationAction.findUnique({
      where: { id: actionId },
      select: { id: true, recipientId: true, status: true },
    });

    if (!action) {
      return NextResponse.json(
        { error: "알림을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    if (action.recipientId !== session.user.id) {
      return NextResponse.json(
        { error: "본인의 알림만 읽음 처리할 수 있습니다" },
        { status: 403 }
      );
    }

    await markNotificationRead(actionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] POST /api/notifications/:id/read 오류:", error);
    return NextResponse.json(
      { error: "읽음 처리 실패" },
      { status: 500 }
    );
  }
}
