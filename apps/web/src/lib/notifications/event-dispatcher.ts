/**
 * 알림 이벤트 디스패처
 *
 * 비즈니스 이벤트 발생 시 NotificationEvent를 생성하고,
 * 이벤트-액션 맵에 따라 NotificationAction 레코드를 자동 생성한다.
 *
 * 사용 예:
 *   const eventId = await dispatchNotificationEvent({
 *     eventType: "QUOTE_RECEIVED",
 *     entityType: "QUOTE",
 *     entityId: quote.id,
 *     triggeredBy: session.user.id,
 *     metadata: { quoteNumber: quote.number },
 *   });
 */

import { db } from "@/lib/db";
import {
  type NotificationEventType,
  type NotificationActionType,
  isValidEventType,
  getEventTypeMeta,
} from "./event-types";
import {
  getDefaultActionsForEvent,
  getActionTemplate,
} from "./event-action-map";

// ── 디스패치 파라미터 ──

export interface DispatchNotificationEventParams {
  /** 이벤트 타입 (정규 12종 중 하나) */
  eventType: string;
  /** 대상 엔티티 도메인 */
  entityType: string;
  /** 대상 엔티티 ID — 연결 없는 알림 금지 */
  entityId: string;
  /** 트리거한 사용자 ID (null = 시스템 자동) */
  triggeredBy?: string;
  /** 추가 메타데이터 (이벤트 컨텍스트) */
  metadata?: Record<string, unknown>;
  /** 수신자 목록 — 지정하지 않으면 액션만 생성하고 수신자는 비워둠 */
  recipients?: Array<{
    userId?: string;
    email?: string;
  }>;
}

/**
 * 알림 이벤트를 디스패치한다.
 *
 * 1. NotificationEvent 레코드 생성
 * 2. 이벤트-액션 맵에서 기본 액션 목록 조회
 * 3. 각 액션에 대해 NotificationAction 레코드 생성
 * 4. 이벤트 ID 반환
 *
 * 실패 시에도 메인 비즈니스 로직을 차단하지 않도록 try-catch 래핑 권장.
 *
 * @returns eventId — 생성된 NotificationEvent의 ID
 */
export async function dispatchNotificationEvent(
  params: DispatchNotificationEventParams
): Promise<string> {
  // 이벤트 타입 유효성 검증
  if (!isValidEventType(params.eventType)) {
    throw new Error(
      `[NotificationDispatcher] 유효하지 않은 이벤트 타입: ${params.eventType}`
    );
  }

  const eventType = params.eventType as NotificationEventType;
  const meta = getEventTypeMeta(eventType);
  if (!meta) {
    throw new Error(
      `[NotificationDispatcher] 이벤트 메타 정보를 찾을 수 없음: ${eventType}`
    );
  }

  // entityType 검증 — 이벤트 정의와 일치하는지 확인 (유연하게 허용하되 경고)
  if (params.entityType !== meta.entityType) {
    console.warn(
      `[NotificationDispatcher] entityType 불일치 경고: 이벤트(${eventType})의 기본 entityType은 "${meta.entityType}"이나 "${params.entityType}"이 전달됨`
    );
  }

  // 트랜잭션으로 이벤트 + 액션 원자적 생성
  const result = await db.$transaction(async (tx: any) => {
    // 1. NotificationEvent 생성
    const event = await tx.notificationEvent.create({
      data: {
        eventType: params.eventType,
        entityType: params.entityType,
        entityId: params.entityId,
        triggeredBy: params.triggeredBy ?? null,
        metadata: params.metadata ?? undefined,
      },
    });

    // 2. 기본 액션 목록 조회
    const defaultActions = getDefaultActionsForEvent(eventType);

    // 3. 수신자별 × 액션별 NotificationAction 생성
    const recipients = params.recipients?.length
      ? params.recipients
      : [{}]; // 수신자 미지정 시 빈 수신자로 액션만 생성

    const actionRecords: Array<{
      eventId: string;
      actionType: string;
      recipientId: string | null;
      recipientEmail: string | null;
      status: string;
      entityType: string;
      entityId: string;
      payload: Record<string, unknown> | undefined;
    }> = [];

    for (const recipient of recipients) {
      for (const actionType of defaultActions) {
        const template = getActionTemplate(actionType);

        // 이메일 액션은 이메일 주소가 필요, IN_APP/QUEUE_ITEM은 userId가 필요
        // 해당 정보가 없어도 레코드는 생성 (추후 배정 가능)
        actionRecords.push({
          eventId: event.id,
          actionType,
          recipientId: recipient.userId ?? null,
          recipientEmail: recipient.email ?? null,
          status: template.initialStatus,
          entityType: params.entityType,
          entityId: params.entityId,
          payload: buildInitialPayload(eventType, actionType, params.metadata),
        });
      }
    }

    // createMany로 일괄 생성
    if (actionRecords.length > 0) {
      await tx.notificationAction.createMany({
        data: actionRecords,
      });
    }

    return event;
  });

  console.log(
    `[NotificationDispatcher] 이벤트 디스패치 완료: ${eventType} → ${result.id}`
  );

  return result.id;
}

// ── 헬퍼 ──

/**
 * 액션의 초기 payload를 구성한다.
 * 이벤트 메타 + 액션 타입에 따라 필요한 기본 필드를 채운다.
 */
function buildInitialPayload(
  eventType: NotificationEventType,
  actionType: NotificationActionType,
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  const meta = getEventTypeMeta(eventType);
  if (!meta) return undefined;

  const base: Record<string, unknown> = {
    eventType,
    label: meta.label,
    actionType,
    ...(metadata ?? {}),
  };

  // 이메일 초안은 추후 action-executor에서 본문 생성
  if (actionType === "EMAIL_DRAFT") {
    base.emailSubject = `[BioCompare] ${meta.label}`;
    base.emailBody = null; // executor에서 생성
  }

  return base;
}
