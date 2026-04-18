/**
 * DataAuditLog 공통 유틸리티
 *
 * 사용 방법:
 * - 트랜잭션 내부: `createAuditLog(params, tx)`  → 원자성 보장
 * - 트랜잭션 외부: `createAuditLog(params)`       → 독립 best-effort 기록
 *
 * 로그 실패는 절대 메인 비즈니스 로직을 막지 않음 (에러 catch + warn).
 */

import { AuditAction, AuditEntityType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export { AuditAction, AuditEntityType };

export interface AuditLogParams {
  /** 행위 수행자 (null = 시스템 자동) */
  userId?: string | null;
  /** 조직 격리 키 (RLS) */
  organizationId?: string | null;
  /** CREATE | UPDATE | DELETE */
  action: AuditAction;
  /** 대상 도메인 */
  entityType: AuditEntityType;
  /** 변경 대상 레코드 PK */
  entityId: string;
  /** UPDATE·DELETE 시 변경 전 스냅샷 */
  previousData?: Record<string, unknown> | null;
  /** CREATE·UPDATE 시 변경 후 스냅샷 */
  newData?: Record<string, unknown> | null;
  /** 요청자 IP */
  ipAddress?: string | null;
  /** 요청자 UA */
  userAgent?: string | null;
}

type TxClient = Prisma.TransactionClient;

/**
 * DataAuditLog 레코드를 생성합니다.
 *
 * @param params  - 필수 감사 정보
 * @param txClient - (선택) Prisma 트랜잭션 클라이언트.
 *                   제공 시 해당 트랜잭션 안에서 원자적으로 기록.
 *                   미제공 시 전역 db 인스턴스로 독립 기록(best-effort).
 */
export async function createAuditLog(
  params: AuditLogParams,
  txClient?: TxClient
): Promise<void> {
  const client: any = txClient ?? db;

  try {
    await client.dataAuditLog.create({
      data: {
        userId:         params.userId         ?? null,
        organizationId: params.organizationId ?? null,
        action:         params.action,
        entityType:     params.entityType,
        entityId:       params.entityId,
        previousData:   params.previousData   ?? undefined,
        newData:        params.newData         ?? undefined,
        ipAddress:      params.ipAddress       ?? null,
        userAgent:      params.userAgent       ?? null,
      },
    });
  } catch (err) {
    // 로그 실패가 메인 로직을 막아선 안 됨 → 경고만 출력
    console.warn("[DataAuditLog] 기록 실패 (메인 로직 계속 진행):", err);
  }
}

/**
 * NextRequest 헤더에서 IP·UA를 추출하는 헬퍼
 */
export function extractRequestMeta(request: { headers: { get: (k: string) => string | null } }) {
  return {
    ipAddress: request.headers.get("x-forwarded-for") ||
               request.headers.get("x-real-ip") ||
               null,
    userAgent: request.headers.get("user-agent") || null,
  };
}
