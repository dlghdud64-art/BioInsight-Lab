import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthUser } from "@/lib/auth/mobile-jwt";
import { getUserNotifications, getUnreadCount } from "@/lib/notifications/notification-query";

/**
 * GET /api/notifications — §notifications-route (2026-09-22 · 호영님 P1)
 *
 * 헤더 종 · 알림 센터(`useInAppNotifications`) · 모바일(`useNotifications`) 세 곳이 이미 부르고 있었는데
 * 라우트가 없었다(§11.90 f87aa9a2 에서 삭제된 뒤 소비자만 다시 배선됨) → 세 화면 모두 0건이었다.
 *
 * 출처는 **이미 쌓이는 알림 원장**(NotificationAction · IN_APP · 수신자 = 본인) 하나다.
 * 여기서 새 알림 종류를 파생하지 않는다 — 보이는 종류는 dispatchNotificationEvent 를 실제로 부르는
 * 경로가 정한다(호영님: 없는 종류를 미리 만들지 않는다).
 * 이벤트 생성용 POST 는 두지 않는다(이전 판본에 있던 것 · 소비자 0).
 *
 * 응답: { notifications, unreadCount, limit, offset } — 웹 훅·모바일 훅이 기대하는 모양 그대로.
 * 계약: __tests__/regression/notifications-route.test.ts
 */
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function toInt(raw: string | null, fallback: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const user = await getAuthUser(session as Parameters<typeof getAuthUser>[0], request);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(toInt(searchParams.get("limit"), DEFAULT_LIMIT), 1), MAX_LIMIT);
    const offset = Math.max(toInt(searchParams.get("offset"), 0), 0);

    // 이 라우트는 인앱 알림만 낸다. 이메일 초안·큐 항목은 각자의 화면이 있다.
    const [notifications, unreadCount] = await Promise.all([
      getUserNotifications(user.id, { actionType: "IN_APP", limit, offset }),
      getUnreadCount(user.id),
    ]);

    return NextResponse.json({ notifications, unreadCount, limit, offset });
  } catch (error) {
    console.error("[API] GET /api/notifications 오류:", error);
    return NextResponse.json({ error: "알림 조회 실패" }, { status: 500 });
  }
}
