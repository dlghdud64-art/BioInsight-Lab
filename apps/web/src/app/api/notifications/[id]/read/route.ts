import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthUser } from "@/lib/auth/mobile-jwt";
import { markNotificationRead } from "@/lib/notifications/notification-query";

/**
 * POST /api/notifications/:id/read — §notifications-route (2026-09-22)
 *
 * 본인 알림만 읽음 처리한다. 소유 확인은 markNotificationRead 가 조건부 갱신으로 한다
 * (recipientId = 로그인 사용자). 남의 알림과 없는 알림은 같은 404 — 존재 여부를 흘리지 않는다.
 * 계약: __tests__/regression/notifications-route.test.ts
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const user = await getAuthUser(session as Parameters<typeof getAuthUser>[0], request);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const result = await markNotificationRead(id, user.id);
    if (result === "not_found") {
      return NextResponse.json({ error: "알림을 찾을 수 없습니다" }, { status: 404 });
    }
    return NextResponse.json({ success: true, alreadyRead: result === "already_read" });
  } catch (error) {
    console.error("[API] POST /api/notifications/:id/read 오류:", error);
    return NextResponse.json({ error: "읽음 처리 실패" }, { status: 500 });
  }
}
