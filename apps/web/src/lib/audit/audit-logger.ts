import { db } from "@/lib/db";
import { AuditEventType } from "@prisma/client";

/**
 * 감사 로그 생성 파라미터
 */
export interface AuditLogParams {
  organizationId?: string;
  userId?: string;
  eventType: AuditEventType;
  entityType: string;
  entityId?: string;
  action: string;
  changes?: {
    before?: any;
    after?: any;
  };
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
  errorMessage?: string;
}

/**
 * 감사 로그 생성
 */
export async function createAuditLog(params: AuditLogParams) {
  try {
    const auditLog = await db.auditLog.create({
      data: {
        organizationId: params.organizationId || null,
        userId: params.userId || null,
        eventType: params.eventType,
        entityType: params.entityType,
        entityId: params.entityId || null,
        action: params.action,
        changes: params.changes || null,
        metadata: params.metadata || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        success: params.success !== undefined ? params.success : true,
        errorMessage: params.errorMessage || null,
      },
    });

    return auditLog;
  } catch (error) {
    console.error("Error creating audit log:", error);
    // 감사 로그 생성 실패는 앱 동작에 영향을 주지 않도록 함
    return null;
  }
}

/**
 * 감사 로그 조회
 */
export async function getAuditLogs(params: {
  organizationId?: string;
  userId?: string;
  eventType?: AuditEventType;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const {
    organizationId,
    userId,
    eventType,
    entityType,
    entityId,
    startDate,
    endDate,
    search,
    limit = 100,
    offset = 0,
  } = params;

  const where: any = {};

  if (organizationId) {
    where.organizationId = organizationId;
  }

  if (userId) {
    where.userId = userId;
  }

  if (eventType) {
    where.eventType = eventType;
  }

  if (entityType) {
    where.entityType = entityType;
  }

  if (entityId) {
    where.entityId = entityId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = startDate;
    }
    if (endDate) {
      where.createdAt.lte = endDate;
    }
  }

  // 검색 기능: 사용자 이름, 이메일, 액션, 엔티티 타입 검색
  if (search && search.trim()) {
    const searchTerm = search.trim().toLowerCase();
    where.OR = [
      { action: { contains: searchTerm, mode: "insensitive" } },
      { entityType: { contains: searchTerm, mode: "insensitive" } },
      { entityId: { contains: searchTerm, mode: "insensitive" } },
      {
        user: {
          OR: [
            { name: { contains: searchTerm, mode: "insensitive" } },
            { email: { contains: searchTerm, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
    }),
    db.auditLog.count({ where }),
  ]);

  return { logs, total, limit, offset };
}

/**
 * 특정 엔티티의 변경 이력 조회
 */
export async function getEntityAuditHistory(
  entityType: string,
  entityId: string,
  limit = 50
) {
  return getAuditLogs({
    entityType,
    entityId,
    limit,
  });
}



