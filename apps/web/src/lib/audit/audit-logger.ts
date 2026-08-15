import { db } from "@/lib/db";
import { AuditEventType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

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
 * §11.345-B — 요청 헤더에서 감사용 IP/UA 추출 헬퍼.
 *   route handler 에서 `createAuditLog({ ...auditRequestMeta(request), ... })` 로 사용.
 *   x-forwarded-for(프록시 체인 첫 IP)·x-real-ip 우선. 값 없으면 undefined → "기록 없음".
 *   시스템/cron 등 request 없는 호출은 호출하지 않음(= IP null = 시스템, 정상).
 */
export function auditRequestMeta(request: {
  headers: { get: (k: string) => string | null };
}): { ipAddress?: string; userAgent?: string } {
  const fwd = request.headers.get("x-forwarded-for");
  const ipAddress =
    (fwd ? fwd.split(",")[0]?.trim() : null) ||
    request.headers.get("x-real-ip") ||
    undefined;
  const userAgent = request.headers.get("user-agent") || undefined;
  return { ipAddress: ipAddress || undefined, userAgent };
}

/**
 * 감사 로그 생성
 */
/**
 * §audit-integrity-fix 커밋 1a — 트랜잭션 클라이언트 주입 지점 신설 (optional).
 *
 * 🛑 이 커밋은 **호출부를 바꾸지 않는다.** `txClient` 를 안 넘기면 지금과 완전히 동일하게
 *    전역 `db` 로 실행된다(기본값 보존). 회귀면 0 · tsc 파급 0 이 이 커밋의 조건이다.
 *
 * 왜 먼저인가 — 실측(§audit-integrity-fix §4.5): 감사 쓰기의 트랜잭션 편입률이
 * **5/102** 다. 편입 없이 정의부를 rethrow 로 바꾸면
 *   업무 쓰기 커밋 → 감사 실패 → 5xx → 클라 재시도 → **중복 생성**
 * 이 열린다. 지금은 200 이라 안 보일 뿐이다.
 * 그래서 편입(1a·1b·1c) 이 rethrow(커밋 2) 보다 앞선다.
 *
 * `createActivityLog`·`logStateTransition` 은 이미 `txClient` 를 받는다.
 * `createActivityLogServer` 는 `db` 파라미터로 받는다.
 * **주입 지점이 없던 것은 이 함수뿐**이었다(46 호출).
 */
export async function createAuditLog(
  params: AuditLogParams,
  txClient?: Prisma.TransactionClient,
) {
  const client = txClient ?? db;
  try {
    const auditLog = await client.auditLog.create({
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



