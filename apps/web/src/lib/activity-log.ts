/**
 * ActivityLog 공통 유틸리티 — AI 파이프라인 Closed-Loop 이벤트 기록
 *
 * DataAuditLog(CRUD 추적)와 분리된 **비즈니스 활동 로그**.
 * 상태 전이(before→after), AI 작업 타입, 행위자 역할을 기록한다.
 *
 * 사용 방법:
 *   await createActivityLog({
 *     activityType: "AI_TASK_CREATED",
 *     entityType: "AI_ACTION",
 *     entityId: actionItem.id,
 *     taskType: "QUOTE_DRAFT",
 *     afterStatus: "PENDING",
 *     userId: session.user.id,
 *     organizationId: org?.id,
 *   });
 *
 * 로그 실패는 절대 메인 로직을 막지 않음 (catch + warn).
 */

import { ActivityType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export { ActivityType };

// ── 이벤트 계약 ──

export interface ActivityLogParams {
  /** action_type: 이벤트 종류 */
  activityType: ActivityType;
  /** entity_type: 대상 도메인 (AI_ACTION, QUOTE, INVENTORY 등) */
  entityType: string;
  /** entity_id: 대상 레코드 ID */
  entityId?: string | null;
  /** task_type: AI 작업 타입 (QUOTE_DRAFT, VENDOR_EMAIL_DRAFT 등) */
  taskType?: string | null;
  /** before_status: 상태 전이 전 */
  beforeStatus?: string | null;
  /** after_status: 상태 전이 후 */
  afterStatus?: string | null;
  /** actor_id: 행위 수행자 (null = 시스템) */
  userId?: string | null;
  /** actor_role: 행위자 조직 역할 */
  actorRole?: string | null;
  /** org_id: 조직 격리 키 */
  organizationId?: string | null;
  /** 추가 메타데이터 */
  metadata?: Record<string, unknown> | null;
  /** 요청자 IP */
  ipAddress?: string | null;
  /** 요청자 UA */
  userAgent?: string | null;
}

type TxClient = Prisma.TransactionClient;

// 중복 방지 윈도우 (초)
const DEDUP_WINDOW_SEC = 60;

/**
 * ActivityLog 레코드를 생성합니다.
 *
 * 동일 entityId + activityType + afterStatus 조합이 최근 DEDUP_WINDOW_SEC 이내에
 * 이미 기록되어 있으면 중복 insert를 건너뜁니다.
 *
 * @param params   - 이벤트 계약 필드
 * @param txClient - (선택) Prisma 트랜잭션 클라이언트
 */
export async function createActivityLog(
  params: ActivityLogParams,
  txClient?: TxClient
): Promise<void> {
  const client: any = txClient ?? db;

  try {
    // 중복 방지: 동일 이벤트가 최근 윈도우 내 존재하면 스킵
    if (params.entityId) {
      const since = new Date(Date.now() - DEDUP_WINDOW_SEC * 1000);
      const existing = await client.activityLog.findFirst({
        where: {
          entityId: params.entityId,
          activityType: params.activityType,
          ...(params.afterStatus ? { afterStatus: params.afterStatus } : {}),
          createdAt: { gte: since },
        },
        select: { id: true },
      });
      if (existing) {
        return; // 중복 — 스킵
      }
    }

    await client.activityLog.create({
      data: {
        userId:         params.userId         ?? null,
        organizationId: params.organizationId ?? null,
        activityType:   params.activityType,
        entityType:     params.entityType,
        entityId:       params.entityId       ?? null,
        taskType:       params.taskType       ?? null,
        beforeStatus:   params.beforeStatus   ?? null,
        afterStatus:    params.afterStatus    ?? null,
        actorRole:      params.actorRole      ?? null,
        metadata:       params.metadata       ?? undefined,
        ipAddress:      params.ipAddress      ?? null,
        userAgent:      params.userAgent      ?? null,
      },
    });
  } catch (err) {
    // 로그 실패가 메인 로직을 막아선 안 됨
    console.warn("[ActivityLog] 기록 실패 (메인 로직 계속 진행):", err);
  }
}

/**
 * 특정 엔티티의 최근 활동 로그 조회
 */
export async function getRecentActivityLogs(params: {
  entityType: string;
  entityId: string;
  limit?: number;
  organizationId?: string;
}) {
  try {
    return await db.activityLog.findMany({
      where: {
        entityType: params.entityType,
        entityId: params.entityId,
        ...(params.organizationId ? { organizationId: params.organizationId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: params.limit ?? 10,
      select: {
        id: true,
        activityType: true,
        entityType: true,
        entityId: true,
        taskType: true,
        beforeStatus: true,
        afterStatus: true,
        actorRole: true,
        metadata: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, image: true },
        },
      },
    });
  } catch (err) {
    console.warn("[ActivityLog] 조회 실패:", err);
    return [];
  }
}

/**
 * 조직의 AI 파이프라인 최근 활동 요약 조회
 */
export async function getOrgActivitySummary(params: {
  organizationId: string;
  limit?: number;
}) {
  try {
    return await db.activityLog.findMany({
      where: {
        organizationId: params.organizationId,
        activityType: {
          in: [
            "AI_TASK_CREATED",
            "AI_TASK_COMPLETED",
            "AI_TASK_FAILED",
            "QUOTE_DRAFT_GENERATED",
            "QUOTE_DRAFT_REVIEWED",
            "EMAIL_DRAFT_GENERATED",
            "EMAIL_SENT",
            "INVENTORY_RESTOCK_SUGGESTED",
            "INVENTORY_RESTOCK_REVIEWED",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: params.limit ?? 5,
      select: {
        id: true,
        activityType: true,
        entityType: true,
        entityId: true,
        taskType: true,
        beforeStatus: true,
        afterStatus: true,
        metadata: true,
        createdAt: true,
        user: {
          select: { id: true, name: true },
        },
      },
    });
  } catch (err) {
    console.warn("[ActivityLog] 요약 조회 실패:", err);
    return [];
  }
}

/**
 * 행위자 역할 조회 헬퍼 — OrganizationMember에서 role을 가져온다
 */
export async function getActorRole(
  userId: string,
  organizationId?: string | null
): Promise<string | null> {
  if (!organizationId) return null;
  try {
    const member = await db.organizationMember.findFirst({
      where: { userId, organizationId },
      select: { role: true },
    });
    return member?.role ?? null;
  } catch {
    return null;
  }
}
