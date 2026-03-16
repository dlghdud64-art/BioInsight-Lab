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
