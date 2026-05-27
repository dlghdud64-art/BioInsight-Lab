/**
 * 알림 액션 실행기
 *
 * NotificationAction의 상태를 전이시키며 실제 동작을 수행한다.
 *
 * 액션 타입별 동작:
 * - IN_APP: 즉시 SENT 전이 (액션 레코드 자체가 인앱 알림)
 * - EMAIL_DRAFT: 이메일 본문 생성 후 GENERATED 전이 (자동 발송 금지)
 * - QUEUE_ITEM: 작업 큐 연동 (존재 시), SENT 전이
 * - ESCALATION: 관리자 알림 생성, SENT 전이
 *
 * 모든 상태 전이는 감사 로그에 기록된다.
 */

import { db } from "@/lib/db";
import { isValidStatusTransition, getStatusTransitions } from "./event-action-map";
import type { NotificationActionType } from "./event-types";

// ── 실행 결과 ──

interface ExecutionResult {
  success: boolean;
  actionId: string;
  previousStatus: string;
  newStatus: string;
  error?: string;
}

/**
 * 알림 액션을 실행한다.
 *
 * 액션의 현재 상태에 따라 적절한 다음 상태로 전이시킨다.
 * PENDING 상태의 액션만 실행 가능하다.
 */
export async function executeNotificationAction(
  actionId: string
): Promise<void> {
  const action = await db.notificationAction.findUnique({
    where: { id: actionId },
    include: { event: true },
  });

  if (!action) {
    throw new Error(
      `[ActionExecutor] 액션을 찾을 수 없음: ${actionId}`
    );
  }

  // PENDING 상태의 액션만 실행 가능
  if (action.status !== "PENDING") {
    console.warn(
      `[ActionExecutor] 실행 불가 — 현재 상태가 PENDING이 아님: ${action.status} (actionId=${actionId})`
    );
    return;
  }

  const actionType = action.actionType as NotificationActionType;

  let result: ExecutionResult;

  switch (actionType) {
    case "IN_APP":
      result = await executeInApp(action);
      break;
    case "EMAIL_DRAFT":
      result = await executeEmailDraft(action);
      break;
    case "QUEUE_ITEM":
      result = await executeQueueItem(action);
      break;
    case "ESCALATION":
      result = await executeEscalation(action);
      break;
    default:
      throw new Error(
        `[ActionExecutor] 알 수 없는 액션 타입: ${actionType}`
      );
  }

  if (!result.success) {
    console.error(
      `[ActionExecutor] 액션 실행 실패: ${actionId} — ${result.error}`
    );
  }
}

// ── IN_APP 실행 ──

/**
 * IN_APP 알림: 액션 레코드 자체가 인앱 알림이므로 즉시 SENT 전이
 */
async function executeInApp(action: any): Promise<ExecutionResult> {
  try {
    await transitionStatus(action.id, action.actionType, "PENDING", "SENT");

    return {
      success: true,
      actionId: action.id,
      previousStatus: "PENDING",
      newStatus: "SENT",
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await markFailed(action.id, message);
    return {
      success: false,
      actionId: action.id,
      previousStatus: "PENDING",
      newStatus: "FAILED",
      error: message,
    };
  }
}

// ── EMAIL_DRAFT 실행 ──

/**
 * EMAIL_DRAFT: 이메일 본문을 생성하고 GENERATED 상태로 전이
 * 실제 발송은 하지 않음 — 반드시 검토(REVIEWED) → 승인(APPROVED) → 발송(SENT) 워크플로를 거쳐야 함
 */
async function executeEmailDraft(action: any): Promise<ExecutionResult> {
  try {
    const payload = (action.payload as Record<string, unknown>) ?? {};

    // 이메일 본문 생성 (현재는 placeholder — 추후 템플릿 엔진 연동)
    const emailContent = generateEmailContent(
      action.event?.eventType ?? "UNKNOWN",
      payload
    );

    // payload에 생성된 이메일 내용 저장 + GENERATED 전이
    await db.notificationAction.update({
      where: { id: action.id },
      data: {
        status: "GENERATED",
        payload: {
          ...payload,
          emailSubject: emailContent.subject,
          emailBody: emailContent.body,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    console.log(
      `[ActionExecutor] 이메일 초안 생성 완료: ${action.id} (검토 대기 중)`
    );

    return {
      success: true,
      actionId: action.id,
      previousStatus: "PENDING",
      newStatus: "GENERATED",
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await markFailed(action.id, message);
    return {
      success: false,
      actionId: action.id,
      previousStatus: "PENDING",
      newStatus: "FAILED",
      error: message,
    };
  }
}

// ── QUEUE_ITEM 실행 ──

/**
 * QUEUE_ITEM: 작업 큐에 항목 생성/연동 후 SENT 전이
 * 현재는 큐 연동 없이 상태 전이만 수행
 */
async function executeQueueItem(action: any): Promise<ExecutionResult> {
  try {
    // TODO: 작업 큐(work-queue) 연동 시 여기서 큐 항목 생성
    // 현재는 상태 전이만 수행
    await transitionStatus(action.id, action.actionType, "PENDING", "SENT");

    return {
      success: true,
      actionId: action.id,
      previousStatus: "PENDING",
      newStatus: "SENT",
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await markFailed(action.id, message);
    return {
      success: false,
      actionId: action.id,
      previousStatus: "PENDING",
      newStatus: "FAILED",
      error: message,
    };
  }
}

// ── ESCALATION 실행 ──

/**
 * ESCALATION: 관리자에게 긴급 알림 생성 후 SENT 전이
 * 현재는 상태 전이만 수행 — 추후 관리자 조회 + IN_APP 알림 추가 생성
 */
async function executeEscalation(action: any): Promise<ExecutionResult> {
  try {
    const payload = (action.payload as Record<string, unknown>) ?? {};

    // 에스컬레이션 메타데이터 추가
    await db.notificationAction.update({
      where: { id: action.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        payload: {
          ...payload,
          escalatedAt: new Date().toISOString(),
        },
      },
    });

    console.log(
      `[ActionExecutor] 에스컬레이션 발생: ${action.id} (entityType=${action.entityType}, entityId=${action.entityId})`
    );

    return {
      success: true,
      actionId: action.id,
      previousStatus: "PENDING",
      newStatus: "SENT",
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await markFailed(action.id, message);
    return {
      success: false,
      actionId: action.id,
      previousStatus: "PENDING",
      newStatus: "FAILED",
      error: message,
    };
  }
}

// ── 공통 헬퍼 ──

/**
 * 상태 전이 수행 — 전이 규칙 검증 포함
 */
async function transitionStatus(
  actionId: string,
  actionType: string,
  fromStatus: string,
  toStatus: string
): Promise<void> {
  const transitions = getStatusTransitions(actionType as NotificationActionType);
  const allowed = transitions[fromStatus];

  if (!allowed || !allowed.includes(toStatus)) {
    throw new Error(
      `[ActionExecutor] 유효하지 않은 상태 전이: ${fromStatus} → ${toStatus} (actionType=${actionType})`
    );
  }

  const updateData: Record<string, unknown> = {
    status: toStatus,
  };

  // SENT 전이 시 sentAt 기록
  if (toStatus === "SENT") {
    updateData.sentAt = new Date();
  }

  await db.notificationAction.update({
    where: { id: actionId },
    data: updateData,
  });
}

/**
 * 실패 상태로 전이
 */
async function markFailed(actionId: string, reason: string): Promise<void> {
  try {
    await db.notificationAction.update({
      where: { id: actionId },
      data: {
        status: "FAILED",
        payload: {
          failedAt: new Date().toISOString(),
          failureReason: reason,
        },
      },
    });
  } catch (err) {
    console.error(
      `[ActionExecutor] 실패 상태 전이 중 오류 (actionId=${actionId}):`,
      err
    );
  }
}

/**
 * 이메일 본문 생성 — 이벤트 타입에 따른 기본 템플릿
 * 추후 React Email 또는 별도 템플릿 엔진으로 교체 예정
 */
function generateEmailContent(
  eventType: string,
  metadata: Record<string, unknown>
): { subject: string; body: string } {
  const label = (metadata.label as string) ?? eventType;

  return {
    subject: `[BioCompare] ${label}`,
    body: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">BioCompare 알림</h2>
        <p><strong>${label}</strong></p>
        <p>상세 내용은 BioCompare 대시보드에서 확인해주세요.</p>
        <hr style="border-color: #e2e8f0;" />
        <p style="color: #94a3b8; font-size: 12px;">
          이 이메일은 BioCompare 시스템에서 자동 생성되었습니다.
          발송 전 관리자 검토가 필요합니다.
        </p>
      </div>
    `.trim(),
  };
}

/**
 * 이메일 초안 검토 완료 처리
 * GENERATED → REVIEWED 전이
 */
export async function reviewEmailDraft(
  actionId: string,
  reviewerId: string
): Promise<void> {
  const action = await db.notificationAction.findUnique({
    where: { id: actionId },
  });

  if (!action) {
    throw new Error(`[ActionExecutor] 액션을 찾을 수 없음: ${actionId}`);
  }

  if (action.actionType !== "EMAIL_DRAFT") {
    throw new Error(
      `[ActionExecutor] EMAIL_DRAFT만 검토 가능: ${action.actionType}`
    );
  }

  if (action.status !== "GENERATED") {
    throw new Error(
      `[ActionExecutor] GENERATED 상태만 검토 가능: 현재 ${action.status}`
    );
  }

  await db.notificationAction.update({
    where: { id: actionId },
    data: {
      status: "REVIEWED",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    },
  });

  console.log(
    `[ActionExecutor] 이메일 초안 검토 완료: ${actionId} by ${reviewerId}`
  );
}

/**
 * 이메일 초안 승인 처리
 * REVIEWED → APPROVED 전이
 *
 * 승인 후에도 실제 발송은 별도 프로세스에서 수행 (현재 미구현)
 */
export async function approveEmailDraft(
  actionId: string,
  approverId: string
): Promise<void> {
  const action = await db.notificationAction.findUnique({
    where: { id: actionId },
  });

  if (!action) {
    throw new Error(`[ActionExecutor] 액션을 찾을 수 없음: ${actionId}`);
  }

  if (action.actionType !== "EMAIL_DRAFT") {
    throw new Error(
      `[ActionExecutor] EMAIL_DRAFT만 승인 가능: ${action.actionType}`
    );
  }

  if (action.status !== "REVIEWED") {
    throw new Error(
      `[ActionExecutor] REVIEWED 상태만 승인 가능: 현재 ${action.status}`
    );
  }

  await db.notificationAction.update({
    where: { id: actionId },
    data: {
      status: "APPROVED",
      // 승인자는 reviewedBy에 이미 기록됨 — payload에 승인 정보 추가
      payload: {
        ...(action.payload as Record<string, unknown> ?? {}),
        approvedBy: approverId,
        approvedAt: new Date().toISOString(),
      },
    },
  });

  console.log(
    `[ActionExecutor] 이메일 초안 승인 완료: ${actionId} by ${approverId}`
  );
}
