/**
 * 알림 조회 레이어
 *
 * 사용자별 알림 목록 조회, 읽음 처리, 미읽음 카운트 등
 * UI/API에서 직접 호출하는 쿼리 함수들.
 */

import { db } from "@/lib/db";

// ── 조회 옵션 ──

export interface GetUserNotificationsOptions {
  /** 상태 필터 (e.g. "SENT", "READ") */
  status?: string;
  /** 액션 타입 필터 (e.g. "IN_APP", "EMAIL_DRAFT") */
  actionType?: string;
  /** 엔티티 타입 필터 */
  entityType?: string;
  /** 페이지 크기 */
  limit?: number;
  /** 오프셋 */
  offset?: number;
}

// ── 반환 타입 ──

export interface NotificationItem {
  id: string;
  actionType: string;
  status: string;
  payload: unknown;
  entityType: string;
  entityId: string;
  recipientId: string | null;
  recipientEmail: string | null;
  createdAt: Date;
  readAt: Date | null;
  sentAt: Date | null;
  event: {
    id: string;
    eventType: string;
    triggeredBy: string | null;
    metadata: unknown;
    createdAt: Date;
  };
}

/**
 * 사용자의 알림 목록을 조회한다.
 *
 * IN_APP 알림 기준으로 recipientId로 필터링.
 * 최신순 정렬, 페이지네이션 지원.
 */
export async function getUserNotifications(
  userId: string,
  options?: GetUserNotificationsOptions
): Promise<NotificationItem[]> {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  const where: Record<string, unknown> = {
    recipientId: userId,
  };

  if (options?.status) {
    where.status = options.status;
  }

  if (options?.actionType) {
    where.actionType = options.actionType;
  } else {
    // 기본: IN_APP 알림만 조회 (이메일 초안/큐 항목은 별도 UI)
    where.actionType = "IN_APP";
  }

  if (options?.entityType) {
    where.entityType = options.entityType;
  }

  const actions = await db.notificationAction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    include: {
      event: {
        select: {
          id: true,
          eventType: true,
          triggeredBy: true,
          metadata: true,
          createdAt: true,
        },
      },
    },
  });

  return actions as NotificationItem[];
}

/**
 * 알림을 읽음 처리한다.
 *
 * SENT → READ 전이 + readAt 타임스탬프 기록.
 * 이미 READ 상태이면 무시.
 */
export async function markNotificationRead(actionId: string): Promise<void> {
  const action = await db.notificationAction.findUnique({
    where: { id: actionId },
    select: { id: true, status: true },
  });

  if (!action) {
    throw new Error(
      `[NotificationQuery] 알림을 찾을 수 없음: ${actionId}`
    );
  }

  // 이미 읽음 상태이면 무시
  if (action.status === "READ") {
    return;
  }

  // SENT 상태만 READ로 전이 가능
  if (action.status !== "SENT") {
    console.warn(
      `[NotificationQuery] READ 전이 불가 — 현재 상태: ${action.status} (actionId=${actionId})`
    );
    return;
  }

  await db.notificationAction.update({
    where: { id: actionId },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });
}

/**
 * 사용자의 미읽음 알림 수를 조회한다.
 *
 * IN_APP 타입 + SENT 상태(아직 읽지 않은) 기준.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return db.notificationAction.count({
    where: {
      recipientId: userId,
      actionType: "IN_APP",
      status: "SENT",
    },
  });
}

/**
 * 엔티티별 알림 액션 조회 — 특정 견적/주문/재고의 알림 이력
 */
export async function getEntityNotifications(
  entityType: string,
  entityId: string,
  options?: { limit?: number; offset?: number }
): Promise<NotificationItem[]> {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  const actions = await db.notificationAction.findMany({
    where: {
      entityType,
      entityId,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    include: {
      event: {
        select: {
          id: true,
          eventType: true,
          triggeredBy: true,
          metadata: true,
          createdAt: true,
        },
      },
    },
  });

  return actions as NotificationItem[];
}

/**
 * 검토 대기 중인 이메일 초안 목록 조회 (관리자용)
 */
export async function getPendingEmailDrafts(options?: {
  limit?: number;
  offset?: number;
}): Promise<NotificationItem[]> {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  const actions = await db.notificationAction.findMany({
    where: {
      actionType: "EMAIL_DRAFT",
      status: { in: ["GENERATED", "REVIEWED"] },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    include: {
      event: {
        select: {
          id: true,
          eventType: true,
          triggeredBy: true,
          metadata: true,
          createdAt: true,
        },
      },
    },
  });

  return actions as NotificationItem[];
}
