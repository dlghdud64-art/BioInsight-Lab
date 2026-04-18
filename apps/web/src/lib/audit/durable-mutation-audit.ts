/**
 * durable-mutation-audit.ts
 *
 * Batch 6: Durable Audit Sink
 *
 * 모든 irreversible mutation의 durable audit trail.
 * 같은 DB 트랜잭션 안에서 mutation과 함께 기록한다 (transactional outbox 패턴).
 *
 * 설계 원칙:
 * 1. mutation이 성공한 같은 DB 트랜잭션 안에서 append-only audit row를 기록.
 *    "변경은 성공했는데 audit는 빠짐" 또는 "audit는 남았는데 변경은 롤백됨"이 불가능.
 * 2. auditEventKey unique 제약으로 replay/duplicate retry 시 중복 증식 방지.
 *    P2002 (unique violation) → idempotent skip.
 * 3. adapter boundary: 현재는 Prisma tx.mutationAuditEvent.create()를 사용하되,
 *    추후 별도 outbox consumer로 외부 전송/검색 인덱싱 가능.
 * 4. raw internal key를 UI에 노출하지 않음.
 *
 * 사용:
 *   import { recordMutationAudit, buildAuditEventKey } from '@/lib/audit/durable-mutation-audit';
 *
 *   await withSerializableBudgetTx(db, async (tx) => {
 *     // ... business logic ...
 *     await recordMutationAudit(tx, { ... });
 *   });
 */

// ═══════════════════════════════════════════════════════
// Event Contract
// ═══════════════════════════════════════════════════════

/**
 * Durable Mutation Audit Event — Batch 6 canonical shape.
 *
 * 운영자가 이 row를 기준으로 "누가 / 무엇을 / 언제 / 어떤 근거로 / 얼마를"
 * 재구성할 수 있어야 한다.
 */
export interface DurableMutationAuditInput {
  /** idempotency key (unique) */
  readonly auditEventKey: string;
  /** 조직 ID */
  readonly orgId: string;
  /** 행위자 userId 또는 "system" */
  readonly actorId: string;
  /** API route path (e.g. /api/request/[id]/approve) */
  readonly route: string;
  /** action type (e.g. purchase_request_approve) */
  readonly action: string;
  /** 대상 entity type */
  readonly entityType: string;
  /** 대상 entity ID */
  readonly entityId: string;
  /** 결과: success | blocked | error */
  readonly result: 'success' | 'blocked' | 'error';
  /** enforcement correlationId */
  readonly correlationId: string;

  // ── Domain-specific context (route에 따라 optional) ──
  readonly requestId?: string;
  readonly orderId?: string;
  readonly purchaseRecordId?: string;
  readonly periodKey?: string;
  readonly normalizedCategoryId?: string;
  readonly amount?: number;
  readonly thresholds?: {
    warningPercent: number;
    softLimitPercent: number;
    hardStopPercent: number;
  };
  readonly decisionBasis?: unknown;
  readonly budgetEventKey?: string;
  readonly compensatingForEventId?: string;
}

// ═══════════════════════════════════════════════════════
// Audit Event Key Builder
// ═══════════════════════════════════════════════════════

/**
 * Durable audit event idempotency key를 생성한다.
 *
 * 형식: `{orgId}:{route_short}:{entityId}:{action}:{suffix}`
 *
 * 이 키는 MutationAuditEvent.auditEventKey에 unique 제약으로 걸려 있어,
 * 동일 mutation이 두 번 실행되면 DB 레벨에서 거부된다.
 */
export function buildAuditEventKey(
  orgId: string,
  entityId: string,
  action: string,
  suffix: string | number = '1',
): string {
  return `${orgId}:${entityId}:${action}:${suffix}`;
}

// ═══════════════════════════════════════════════════════
// Transactional Audit Writer
// ═══════════════════════════════════════════════════════

/**
 * Prisma 트랜잭션 클라이언트의 최소 필요 interface.
 * 실제 PrismaClient.$transaction(fn) 안에서 전달되는 tx 객체에서
 * mutationAuditEvent.create()만 사용.
 */
interface MutationAuditTx {
  mutationAuditEvent: {
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
}

/**
 * 같은 DB 트랜잭션 안에서 mutation audit event를 기록한다.
 *
 * auditEventKey unique 제약에 의해 중복 실행 시 P2002 에러 발생 → catch 후 skip.
 * 이렇게 하면 retry/replay가 들어와도 audit이 중복 증식하지 않는다.
 *
 * ⚠️ 반드시 mutation이 성공한 같은 트랜잭션 안에서 호출해야 한다.
 *
 * @param tx Prisma 트랜잭션 클라이언트
 * @param input audit event 입력
 * @returns true: 신규 기록, false: 이미 존재 (idempotent skip)
 */
export async function recordMutationAudit(
  tx: MutationAuditTx,
  input: DurableMutationAuditInput,
): Promise<boolean> {
  try {
    await tx.mutationAuditEvent.create({
      data: {
        auditEventKey: input.auditEventKey,
        occurredAt: new Date(),
        orgId: input.orgId,
        actorId: input.actorId,
        route: input.route,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        result: input.result,
        correlationId: input.correlationId,
        requestId: input.requestId ?? null,
        orderId: input.orderId ?? null,
        purchaseRecordId: input.purchaseRecordId ?? null,
        periodKey: input.periodKey ?? null,
        normalizedCategoryId: input.normalizedCategoryId ?? null,
        amount: input.amount ?? null,
        thresholds: input.thresholds ?? null,
        decisionBasis: input.decisionBasis ?? null,
        budgetEventKey: input.budgetEventKey ?? null,
        compensatingForEventId: input.compensatingForEventId ?? null,
      },
    });
    return true;
  } catch (error: any) {
    // P2002: Unique constraint violation → idempotent skip
    if (error?.code === 'P2002') {
      console.info(
        `[mutation_audit] Idempotent skip: ${input.auditEventKey}`,
      );
      return false;
    }
    // 다른 에러는 전파하지 않고 로그만 남긴다 (audit 실패가 mutation을 rollback시키면 안 됨)
    // ⚠️ 단, 같은 tx 안이므로 실제로는 tx 전체가 rollback된다.
    // 따라서 이 함수는 DB 연결 문제 등 치명적 에러만 throw한다.
    throw error;
  }
}

// ═══════════════════════════════════════════════════════
// Query (Read-Only)
// ═══════════════════════════════════════════════════════

/**
 * Prisma client의 최소 조회 interface.
 */
interface MutationAuditQueryClient {
  mutationAuditEvent: {
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    count(args?: Record<string, unknown>): Promise<number>;
  };
}

export interface MutationAuditQueryFilter {
  readonly orgId?: string;
  readonly actorId?: string;
  readonly action?: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly route?: string;
  readonly correlationId?: string;
  readonly since?: string;
  readonly until?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Mutation audit event 조회 — 운영/감사 뷰용.
 */
export async function queryMutationAuditEvents(
  db: MutationAuditQueryClient,
  filter: MutationAuditQueryFilter,
): Promise<readonly Record<string, unknown>[]> {
  const where: Record<string, unknown> = {};

  if (filter.orgId) where.orgId = filter.orgId;
  if (filter.actorId) where.actorId = filter.actorId;
  if (filter.action) where.action = filter.action;
  if (filter.entityType) where.entityType = filter.entityType;
  if (filter.entityId) where.entityId = filter.entityId;
  if (filter.route) where.route = filter.route;
  if (filter.correlationId) where.correlationId = filter.correlationId;

  if (filter.since || filter.until) {
    const occurredAt: Record<string, unknown> = {};
    if (filter.since) occurredAt.gte = new Date(filter.since);
    if (filter.until) occurredAt.lte = new Date(filter.until);
    where.occurredAt = occurredAt;
  }

  return db.mutationAuditEvent.findMany({
    where,
    orderBy: { occurredAt: 'desc' },
    skip: filter.offset ?? 0,
    take: filter.limit ?? 100,
  });
}

/**
 * 특정 route/entity 조합의 audit event 존재 여부 확인.
 * route coverage matrix 갱신에 사용.
 */
export async function hasAuditForRoute(
  db: MutationAuditQueryClient,
  route: string,
): Promise<boolean> {
  const count = await db.mutationAuditEvent.count({
    where: { route },
  });
  return count > 0;
}
