import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getUserNotifications,
  getUnreadCount,
  dispatchNotificationEvent,
  isValidEventType,
} from "@/lib/notifications";

/**
 * GET /api/notifications
 *
 * 현재 사용자의 알림 목록 조회 (페이지네이션 지원).
 * 쿼리 파라미터:
 *   - status: 상태 필터 (SENT, READ 등)
 *   - actionType: 액션 타입 필터 (기본 IN_APP)
 *   - entityType: 엔티티 타입 필터
 *   - limit: 페이지 크기 (기본 20)
 *   - offset: 오프셋 (기본 0)
 *   - countOnly: "true"이면 미읽음 카운트만 반환
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // 미읽음 카운트만 요청한 경우
    if (searchParams.get("countOnly") === "true") {
      const count = await getUnreadCount(session.user.id);
      return NextResponse.json({ unreadCount: count });
    }

    const status = searchParams.get("status") ?? undefined;
    const actionType = searchParams.get("actionType") ?? undefined;
    const entityType = searchParams.get("entityType") ?? undefined;
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const notifications = await getUserNotifications(session.user.id, {
      status,
      actionType,
      entityType,
      limit: Math.min(limit, 100), // 최대 100건 제한
      offset,
    });

    const unreadCount = await getUnreadCount(session.user.id);

    return NextResponse.json({
      notifications,
      unreadCount,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[API] GET /api/notifications 오류:", error);
    return NextResponse.json(
      { error: "알림 조회 실패" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 *
 * 알림 이벤트 생성 (관리자/시스템 전용).
 * 요청 본문:
 *   - eventType: 이벤트 타입 (필수)
 *   - entityType: 엔티티 타입 (필수)
 *   - entityId: 엔티티 ID (필수)
 *   - metadata: 추가 메타데이터
 *   - recipients: 수신자 배열 [{ userId?, email? }]
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
      action: 'sensitive_data_export',
      targetEntityType: 'ai_action',
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/notifications',
    });
    if (!enforcement.allowed) return enforcement.deny();

        if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 관리자 권한 확인
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "관리자만 알림 이벤트를 생성할 수 있습니다" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { eventType, entityType, entityId, metadata, recipients } = body;

    // 필수 필드 검증
    if (!eventType || !entityType || !entityId) {
      return NextResponse.json(
        { error: "eventType, entityType, entityId는 필수입니다" },
        { status: 400 }
      );
    }

    // 이벤트 타입 유효성 검증
    if (!isValidEventType(eventType)) {
      return NextResponse.json(
        { error: `유효하지 않은 이벤트 타입: ${eventType}` },
        { status: 400 }
      );
    }

    const eventId = await dispatchNotificationEvent({
      eventType,
      entityType,
      entityId,
      triggeredBy: session.user.id,
      metadata,
      recipients,
    });

    return NextResponse.json({ eventId }, { status: 201 });
  } catch (error) {
    console.error("[API] POST /api/notifications 오류:", error);
    return NextResponse.json(
      { error: "알림 이벤트 생성 실패" },
      { status: 500 }
    );
  }
}
