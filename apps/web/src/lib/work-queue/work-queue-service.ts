/**
 * Work Queue Service — 트랜잭셔널 상태 동기화
 *
 * AiActionItem의 3-Layer 상태를 단일 트랜잭션으로 업데이트하며,
 * 동시에 ActivityLog를 append-only로 기록합니다.
 *
 * 모든 상태 변경은 이 서비스를 통해야 합니다.
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createActivityLog, getActorRole } from "@/lib/activity-log";
import { resolveState, resolveInitialState, type TaskStatus, type ApprovalStatus, type AiActionType } from "./state-mapper";
import { computeTotalScore } from "./scoring";

// ── Types ──

export interface TransitionParams {
  /** AiActionItem ID */
  itemId: string;
  /** 새 substatus (state-mapper로 taskStatus/approvalStatus 자동 해석) */
  substatus: string;
  /** 작업 수행자 ID */
  userId: string;
  /** 메타데이터 (활동 로그에 기록) */
  metadata?: Record<string, unknown>;
  /** HTTP 요청 정보 */
  ipAddress?: string | null;
  userAgent?: string | null;
  /** 선택적 legacy status 동기화 (기존 API 호환) */
  legacyStatus?: string;
  /** 결과 데이터 (승인 실행 결과 등) */
  result?: Record<string, unknown>;
  /** 1줄 요약 갱신 */
  summary?: string;
}

export interface CreateWorkItemParams {
  type: AiActionType;
  userId: string;
  organizationId?: string | null;
  title: string;
  summary?: string;
  description?: string;
  payload: Record<string, unknown>;
  relatedEntityType?: string;
  relatedEntityId?: string;
  priority?: "HIGH" | "MEDIUM" | "LOW";
  assigneeId?: string;
  aiModel?: string;
  promptTokens?: number;
  completionTokens?: number;
  expiresAt?: Date;
}

// ── 상태 전이 ──

/**
 * AiActionItem 상태 전이 — 단일 트랜잭션
 *
 * 1. substatus → resolveState()로 taskStatus/approvalStatus 계산
 * 2. AiActionItem UPDATE
 * 3. ActivityLog INSERT
 *
 * 동일 트랜잭션에서 처리되므로 부분 실패 없음.
 */
export async function transitionWorkItem(params: TransitionParams): Promise<void> {
  const { itemId, substatus, userId, metadata, ipAddress, userAgent, legacyStatus, result, summary } = params;

  const stateMapping = resolveState(substatus);

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. 현재 상태 조회 (before 기록용)
    const current = await tx.aiActionItem.findUniqueOrThrow({
      where: { id: itemId },
      select: {
        taskStatus: true,
        approvalStatus: true,
        substatus: true,
        status: true,
        type: true,
        organizationId: true,
        title: true,
      },
    });

    // 2. AiActionItem 업데이트
    const updateData: Record<string, unknown> = {
      taskStatus: stateMapping.taskStatus,
      approvalStatus: stateMapping.approvalStatus,
      substatus: stateMapping.substatus,
    };

    if (legacyStatus) updateData.status = legacyStatus;
    if (result) updateData.result = result as Prisma.JsonObject;
    if (summary) updateData.summary = summary;

    // 완료/실패 타임스탬프
    if (stateMapping.taskStatus === "COMPLETED") {
      updateData.completedAt = new Date();
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = userId;
    }
    if (stateMapping.taskStatus === "FAILED") {
      updateData.failedAt = new Date();
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = userId;
    }

    await tx.aiActionItem.update({
      where: { id: itemId },
      data: updateData,
    });

    // 3. ActivityLog — before/after 3-Layer 상태 동시 기록
    const actorRole = await getActorRole(userId, current.organizationId);

    await createActivityLog(
      {
        activityType: mapSubstatusToActivityType(substatus),
        entityType: "AI_ACTION",
        entityId: itemId,
        taskType: current.type,
        beforeStatus: current.taskStatus,
        afterStatus: stateMapping.taskStatus,
        userId,
        organizationId: current.organizationId,
        actorRole,
        metadata: {
          ...metadata,
          title: current.title,
          substatus_before: current.substatus,
          substatus_after: stateMapping.substatus,
          approval_before: current.approvalStatus,
          approval_after: stateMapping.approvalStatus,
        },
        ipAddress,
        userAgent,
      },
      tx
    );
  });
}

/**
 * Work Item 생성 — 초기 3-Layer 상태 자동 설정
 *
 * resolveInitialState()로 type 기반 초기 상태 계산 후 INSERT.
 * Legacy status도 동기화.
 */
export async function createWorkItem(params: CreateWorkItemParams): Promise<string> {
  const { type, userId, organizationId, title, summary, description, payload, relatedEntityType, relatedEntityId, priority, assigneeId, aiModel, promptTokens, completionTokens, expiresAt } = params;

  const initialState = resolveInitialState(type);

  const item = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.aiActionItem.create({
      data: {
        type,
        status: "PENDING",
        priority: priority || "MEDIUM",
        taskStatus: initialState.taskStatus,
        approvalStatus: initialState.approvalStatus,
        substatus: initialState.substatus,
        userId,
        organizationId: organizationId || undefined,
        assigneeId: assigneeId || undefined,
        title,
        summary: summary || undefined,
        description: description || undefined,
        payload: payload as Prisma.JsonObject,
        relatedEntityType: relatedEntityType || undefined,
        relatedEntityId: relatedEntityId || undefined,
        aiModel: aiModel || undefined,
        promptTokens: promptTokens || undefined,
        completionTokens: completionTokens || undefined,
        expiresAt: expiresAt || undefined,
      },
    });

    // ActivityLog: 작업 생성
    const actorRole = await getActorRole(userId, organizationId || null);
    await createActivityLog(
      {
        activityType: "AI_TASK_CREATED",
        entityType: "AI_ACTION",
        entityId: created.id,
        taskType: type,
        afterStatus: initialState.taskStatus,
        userId,
        organizationId: organizationId || undefined,
        actorRole,
        metadata: {
          title,
          substatus: initialState.substatus,
          approvalStatus: initialState.approvalStatus,
          priority: priority || "MEDIUM",
        },
      },
      tx
    );

    return created;
  });

  return item.id;
}

// ── Work Queue 조회 ──

export interface WorkQueueFilters {
  organizationId?: string;
  userId?: string;
  taskStatus?: TaskStatus | TaskStatus[];
  approvalStatus?: ApprovalStatus;
  type?: string;
  limit?: number;
  includeCompleted?: boolean;
  completedSince?: Date; // completed 항목을 이 시각 이후만 포함
  relatedEntityType?: string;
  relatedEntityId?: string;
  // ── Assignment filters ──
  assigneeId?: string;
  unassignedOnly?: boolean;
}

export interface WorkQueueItem {
  id: string;
  type: string;
  taskStatus: string;
  approvalStatus: string;
  substatus: string | null;
  priority: string;
  title: string;
  summary: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  // ── 다차원 스코어링 ──
  impactScore: number;
  urgencyScore: number;
  totalScore: number;
  urgencyReason: string | null;
  // ── Assignment ──
  assigneeId: string | null;
}

/**
 * 대시보드 Work Queue 목록 조회
 *
 * 정렬: taskStatus 우선순위(BLOCKED→FAILED→ACTION_NEEDED→...) → totalScore DESC → updatedAt DESC
 * completed는 기본 제외, includeCompleted=true 시 completedSince 이후만 포함.
 */
export async function queryWorkQueue(filters: WorkQueueFilters): Promise<{
  items: WorkQueueItem[];
  activeCount: number;
  completedCount: number;
}> {
  const where: Prisma.AiActionItemWhereInput = {};

  if (filters.organizationId) where.organizationId = filters.organizationId;
  if (filters.userId) where.userId = filters.userId;
  if (filters.type) where.type = filters.type as any;

  if (filters.taskStatus) {
    if (Array.isArray(filters.taskStatus)) {
      where.taskStatus = { in: filters.taskStatus as any[] };
    } else {
      where.taskStatus = filters.taskStatus as any;
    }
  } else if (!filters.includeCompleted) {
    where.taskStatus = { not: "COMPLETED" as any };
  }

  if (filters.approvalStatus) {
    where.approvalStatus = filters.approvalStatus as any;
  }

  if (filters.relatedEntityType) {
    where.relatedEntityType = filters.relatedEntityType;
  }
  if (filters.relatedEntityId) {
    where.relatedEntityId = filters.relatedEntityId;
  }

  // Assignment filters
  if (filters.assigneeId) {
    where.assigneeId = filters.assigneeId;
  }
  if (filters.unassignedOnly) {
    where.assigneeId = null;
  }

  if (filters.includeCompleted && filters.completedSince) {
    where.OR = [
      { taskStatus: { not: "COMPLETED" as any } },
      { taskStatus: "COMPLETED" as any, completedAt: { gte: filters.completedSince } },
    ];
  }

  const [items, activeCount, completedCount] = await Promise.all([
    db.aiActionItem.findMany({
      where,
      select: {
        id: true,
        type: true,
        taskStatus: true,
        approvalStatus: true,
        substatus: true,
        priority: true,
        title: true,
        summary: true,
        relatedEntityType: true,
        relatedEntityId: true,
        assigneeId: true,
        payload: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { priority: "desc" },
        { updatedAt: "desc" },
      ],
      take: filters.limit || 50,
    }),
    db.aiActionItem.count({
      where: {
        ...where,
        taskStatus: { notIn: ["COMPLETED", "FAILED"] as any[] },
      },
    }),
    db.aiActionItem.count({
      where: {
        ...where,
        taskStatus: "COMPLETED" as any,
        ...(filters.completedSince ? { completedAt: { gte: filters.completedSince } } : {}),
      },
    }),
  ]);

  // 다차원 스코어링 + TaskStatus 우선순위 정렬
  const { TASK_STATUS_SORT_ORDER } = await import("./state-mapper");

  const scored = items.map((item) => {
    const metadata = (item.payload || {}) as Record<string, unknown>;
    const scoredItem = {
      type: item.type,
      substatus: item.substatus,
      approvalStatus: item.approvalStatus,
      priority: item.priority,
      metadata,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
    const scores = computeTotalScore(scoredItem);

    return {
      ...item,
      metadata,
      impactScore: scores.impactScore,
      urgencyScore: scores.urgencyScore,
      totalScore: scores.totalScore,
      urgencyReason: scores.urgencyReason,
      assigneeId: item.assigneeId ?? null,
    };
  });

  // 1차: taskStatus 우선순위 → 2차: totalScore DESC → 3차: updatedAt DESC
  const sorted = scored.sort((a, b) => {
    const statusDiff =
      (TASK_STATUS_SORT_ORDER[a.taskStatus as TaskStatus] ?? 50) -
      (TASK_STATUS_SORT_ORDER[b.taskStatus as TaskStatus] ?? 50);
    if (statusDiff !== 0) return statusDiff;

    // 동일 taskStatus 내에서 totalScore DESC
    const scoreDiff = b.totalScore - a.totalScore;
    if (scoreDiff !== 0) return scoreDiff;

    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  return { items: sorted, activeCount, completedCount };
}

// ── Grouped Query (Console) ──

/**
 * 콘솔용 그룹화된 Work Queue 조회
 *
 * queryWorkQueue 결과를 groupForConsole로 그룹화하여 반환합니다.
 */
export async function queryWorkQueueGrouped(filters: WorkQueueFilters & {
  view?: import("./console-assignment").ConsoleView;
  viewUserId?: string;
} = {}): Promise<{
  groups: import("./console-grouping").ConsoleGroup[];
  summary: import("./console-grouping").ConsoleSummary;
  activeCount: number;
  completedCount: number;
}> {
  const { groupForConsole, groupForConsoleWithView, computeConsoleSummary } = await import("./console-grouping");

  const result = await queryWorkQueue({
    ...filters,
    includeCompleted: true,
    limit: filters.limit || 100,
  });

  const view = filters.view || "all";
  const userId = filters.viewUserId;

  const groups = view !== "all" && userId
    ? groupForConsoleWithView(result.items, view, userId)
    : groupForConsole(result.items, userId);
  const summary = computeConsoleSummary(groups, userId);

  return {
    groups,
    summary,
    activeCount: result.activeCount,
    completedCount: result.completedCount,
  };
}

// ── Assignment Action Execution ──

export interface AssignmentActionParams {
  itemId: string;
  action: import("./console-assignment").AssignmentAction;
  actorUserId: string;
  targetUserId?: string;
  note?: string;
  nextAction?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * 배정 액션 실행 — 단일 트랜잭션
 *
 * 1. 현재 상태 조회 + canTransition 확인
 * 2. validateAction 검증
 * 3. assigneeId + payload 업데이트
 * 4. ActivityLog 기록
 */
export async function executeAssignmentAction(params: AssignmentActionParams): Promise<void> {
  const {
    resolveAssignmentState,
    canTransition,
    validateAction,
    buildHandoffPayload,
    ASSIGNMENT_ACTION_DEFS,
  } = await import("./console-assignment");

  const { itemId, action, actorUserId, targetUserId, note, nextAction, ipAddress, userAgent } = params;

  // Pre-validate action params
  const validation = validateAction(action, {
    actorUserId,
    targetUserId,
    note,
  });
  if (!validation.valid) {
    throw new Error(validation.error || "유효하지 않은 액션입니다.");
  }

  const actionDef = ASSIGNMENT_ACTION_DEFS[action];

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. 현재 상태 조회
    const current = await tx.aiActionItem.findUniqueOrThrow({
      where: { id: itemId },
      select: {
        assigneeId: true,
        payload: true,
        taskStatus: true,
        organizationId: true,
        title: true,
        type: true,
      },
    });

    const metadata = (current.payload || {}) as Record<string, unknown>;
    const currentState = resolveAssignmentState({
      assigneeId: current.assigneeId,
      metadata,
      taskStatus: current.taskStatus,
    });

    // 2. 전이 가능 여부 확인
    if (!canTransition(currentState, action)) {
      throw new Error(
        `현재 상태(${currentState})에서 ${action} 액션은 수행할 수 없습니다.`
      );
    }

    // 3. 업데이트 데이터 구성
    const newPayload = { ...metadata };
    newPayload.assignmentState = actionDef.toState;

    let newAssigneeId: string | null = current.assigneeId;

    switch (action) {
      case "claim":
        newAssigneeId = actorUserId;
        break;
      case "assign":
      case "reassign":
        newAssigneeId = targetUserId ?? null;
        break;
      case "hand_off": {
        newAssigneeId = targetUserId ?? null;
        const handoffPayload = buildHandoffPayload({
          fromUserId: actorUserId,
          toUserId: targetUserId!,
          note: note!,
          nextAction: nextAction ?? "",
        });
        newPayload.handoff = handoffPayload.handoff;
        // Append to handoff history
        const history = Array.isArray(metadata.handoffHistory)
          ? [...(metadata.handoffHistory as unknown[])]
          : [];
        history.push(handoffPayload.handoff);
        newPayload.handoffHistory = history;
        break;
      }
      // mark_in_progress, mark_blocked: assignee stays the same
    }

    // 4. DB UPDATE
    await tx.aiActionItem.update({
      where: { id: itemId },
      data: {
        assigneeId: newAssigneeId,
        payload: newPayload as Prisma.JsonObject,
      },
    });

    // 5. ActivityLog
    const actorRole = await getActorRole(actorUserId, current.organizationId);
    await createActivityLog(
      {
        activityType: actionDef.activityLogEvent as any,
        entityType: "AI_ACTION",
        entityId: itemId,
        taskType: current.type,
        beforeStatus: current.taskStatus,
        afterStatus: current.taskStatus,
        userId: actorUserId,
        organizationId: current.organizationId,
        actorRole,
        metadata: {
          title: current.title,
          action,
          assignmentState_before: currentState,
          assignmentState_after: actionDef.toState,
          assigneeId_before: current.assigneeId,
          assigneeId_after: newAssigneeId,
          targetUserId,
          note,
          nextAction,
        },
        ipAddress,
        userAgent,
      },
      tx
    );
  });
}

// ── Accountability Data Query ──

const ASSIGNMENT_ACTIVITY_TYPES = [
  "ITEM_CLAIMED",
  "ITEM_ASSIGNED",
  "ITEM_REASSIGNED",
  "ITEM_STARTED",
  "ITEM_BLOCKED",
  "ITEM_HANDED_OFF",
  "AI_TASK_COMPLETED",
  "AI_TASK_FAILED",
];

/**
 * 책임성 분석용 데이터 조회 — 활성 항목 + 배정 관련 활동 로그
 */
export async function queryAccountabilityData(filters: {
  organizationId?: string;
  since?: Date;
} = {}): Promise<{
  items: WorkQueueItem[];
  logs: import("./console-accountability").ActivityLogEntry[];
}> {
  const since = filters.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await queryWorkQueue({
    organizationId: filters.organizationId,
    includeCompleted: true,
    completedSince: since,
    limit: 200,
  });

  const logs = await db.activityLog.findMany({
    where: {
      activityType: { in: ASSIGNMENT_ACTIVITY_TYPES as any[] },
      createdAt: { gte: since },
      ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
    },
    select: {
      id: true,
      activityType: true,
      entityId: true,
      userId: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: 1000,
  });

  return {
    items: result.items,
    logs: logs.map((l: { id: string; activityType: string; entityId: string | null; userId: string | null; metadata: unknown; createdAt: Date }) => ({
      id: l.id,
      activityType: l.activityType,
      entityId: l.entityId,
      userId: l.userId,
      metadata: (l.metadata ?? {}) as Record<string, unknown>,
      createdAt: l.createdAt,
    })),
  };
}

// ── Helpers ──

/**
 * Substatus → ActivityType 매핑
 * 가장 적합한 ActivityType을 반환합니다.
 */
function mapSubstatusToActivityType(substatus: string): string {
  const map: Record<string, string> = {
    quote_draft_generated: "QUOTE_DRAFT_GENERATED",
    quote_draft_approved: "QUOTE_DRAFT_REVIEWED",
    quote_draft_dismissed: "QUOTE_DRAFT_REVIEWED",
    vendor_email_generated: "EMAIL_DRAFT_GENERATED",
    vendor_email_approved: "EMAIL_DRAFT_GENERATED",
    email_sent: "EMAIL_SENT",
    vendor_reply_received: "VENDOR_REPLY_LOGGED",
    followup_draft_generated: "ORDER_FOLLOWUP_GENERATED",
    followup_approved: "ORDER_FOLLOWUP_REVIEWED",
    followup_sent: "ORDER_FOLLOWUP_SENT",
    status_change_proposed: "ORDER_STATUS_CHANGE_PROPOSED",
    status_change_approved: "ORDER_STATUS_CHANGE_APPROVED",
    vendor_response_parsed: "VENDOR_REPLY_LOGGED",
    restock_suggested: "INVENTORY_RESTOCK_SUGGESTED",
    restock_approved: "INVENTORY_RESTOCK_REVIEWED",
    restock_ordered: "PURCHASE_REQUEST_CREATED",
    restock_completed: "AI_TASK_COMPLETED",
    expiry_alert_created: "INVENTORY_RESTOCK_SUGGESTED",
    expiry_acknowledged: "INVENTORY_RESTOCK_REVIEWED",
    purchase_request_created: "PURCHASE_REQUEST_CREATED",
    execution_failed: "AI_TASK_FAILED",
    budget_insufficient: "AI_TASK_FAILED",
    permission_denied: "AI_TASK_FAILED",
    // ═══ 비교 도메인 ═══
    compare_decision_pending: "AI_TASK_CREATED",
    compare_inquiry_followup: "COMPARE_INQUIRY_DRAFT_STATUS_CHANGED",
    compare_quote_in_progress: "QUOTE_DRAFT_STARTED_FROM_COMPARE",
    compare_decided: "AI_TASK_COMPLETED",
    compare_reopened: "COMPARE_SESSION_REOPENED",
  };

  return map[substatus] || "AI_TASK_CREATED";
}
