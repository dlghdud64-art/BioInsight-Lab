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
 * 미읽음으로 세는 IN_APP 상태 — §notifications-route (2026-09-22)
 *
 * IN_APP 액션은 PENDING 으로 생성되고(event-action-map), PENDING → SENT 를 옮기는
 * `executeNotificationAction` 은 호출자가 0 이다. 그래서 SENT 만 세면 미읽음이 **항상 0** 이고
 * 읽음 처리도 **항상 무시**됐다(prod 2026-09-22: IN_APP 6행 전량 PENDING).
 * IN_APP 은 행이 생기는 순간 수신자가 볼 수 있으므로(이 라우트가 곧 전달) PENDING 도 도착한 것이다.
 */
export const IN_APP_UNREAD_STATUSES = ["PENDING", "SENT"] as const;

export type MarkReadResult = "read" | "already_read" | "not_found";

/**
 * 알림을 읽음 처리한다 — **수신자 본인 것만.**
 *
 * 소유 확인을 이 함수 안에 둔다(id 만으로 갱신하던 이전 판본은 호출자가 확인을 빠뜨리면
 * 남의 알림을 읽음 처리할 수 있었다). 조건부 updateMany 한 번이라 확인과 갱신 사이 틈이 없다.
 * 남의 알림과 없는 알림을 구분하지 않는다(둘 다 not_found · 존재 여부를 흘리지 않는다).
 */
export async function markNotificationRead(
  actionId: string,
  userId: string
): Promise<MarkReadResult> {
  const updated = await db.notificationAction.updateMany({
    where: {
      id: actionId,
      recipientId: userId,
      actionType: "IN_APP",
      status: { in: [...IN_APP_UNREAD_STATUSES] },
      readAt: null,
    },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });
  if (updated.count > 0) return "read";

  const own = await db.notificationAction.findFirst({
    where: { id: actionId, recipientId: userId, actionType: "IN_APP" },
    select: { id: true },
  });
  return own ? "already_read" : "not_found";
}

/**
 * 사용자의 미읽음 알림 수를 조회한다.
 *
 * IN_APP 타입 + 미읽음 상태(PENDING·SENT) + readAt 없음.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return db.notificationAction.count({
    where: {
      recipientId: userId,
      actionType: "IN_APP",
      status: { in: [...IN_APP_UNREAD_STATUSES] },
      readAt: null,
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
