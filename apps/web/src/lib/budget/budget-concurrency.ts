/**
 * budget-concurrency.ts
 *
 * SERIALIZABLE 트랜잭션 + bounded retry wrapper + telemetry.
 *
 * 동일 카테고리 예산 버킷에 대한 동시 승인 요청이 들어와도
 * 정확히 하나만 통과하거나, 규칙상 둘 다 차단되도록 보장한다.
 *
 * PostgreSQL SERIALIZABLE isolation에서 동시 write 충돌이 발생하면
 * P0001 (serialization_failure) 에러가 발생한다. 이때 최대 MAX_RETRIES까지
 * 재시도하며, 재시도 간격은 지수 백오프 + jitter.
 *
 * Telemetry:
 *   budget_tx_total          — SERIALIZABLE tx 총 시도 횟수
 *   budget_tx_retry_count    — serialization_failure 재시도 횟수
 *   budget_tx_conflict_count — serialization_failure 최초 발생 횟수 (tx 단위)
 *   budget_tx_exhausted      — 재시도 소진 후 실패 횟수
 *   budget_tx_success        — 성공 횟수
 *
 * 사용:
 *   const result = await withSerializableBudgetTx(db, async (tx) => { ... });
 *   console.log(getBudgetTxTelemetry()); // 운영 계측
 */

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 50;

// ── Telemetry counters ──

const telemetry = {
  budget_tx_total: 0,
  budget_tx_retry_count: 0,
  budget_tx_conflict_count: 0,
  budget_tx_exhausted: 0,
  budget_tx_success: 0,
};

/**
 * 현재 프로세스의 budget tx telemetry 스냅샷을 반환한다.
 * 운영 모니터링, /api/health, logger 등에서 호출.
 */
export function getBudgetTxTelemetry(): Readonly<typeof telemetry> {
  return { ...telemetry };
}

/** 테스트용: telemetry 리셋 */
export function resetBudgetTxTelemetry(): void {
  telemetry.budget_tx_total = 0;
  telemetry.budget_tx_retry_count = 0;
  telemetry.budget_tx_conflict_count = 0;
  telemetry.budget_tx_exhausted = 0;
  telemetry.budget_tx_success = 0;
}

// ── Serialization failure detection ──

/**
 * PostgreSQL serialization failure error code.
 * Prisma wraps this as P2034 or exposes the underlying code.
 */
function isSerializationFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, any>;

  // Prisma P2034: "Transaction failed due to a write conflict or a deadlock"
  if (e.code === "P2034") return true;

  // Raw PostgreSQL serialization_failure
  if (e.code === "40001") return true;

  // Nested meta
  if (e.meta?.code === "40001") return true;

  return false;
}

/**
 * 지수 백오프 + jitter delay.
 */
function retryDelay(attempt: number): number {
  const exponential = BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * BASE_DELAY_MS;
  return exponential + jitter;
}

export interface SerializableTxOptions {
  /** 최대 재시도 횟수 (기본 3) */
  maxRetries?: number;
  /** 트랜잭션 타임아웃 ms (기본 10000) */
  timeout?: number;
  /** telemetry label (로그 식별용) */
  label?: string;
}

/**
 * SERIALIZABLE isolation level로 트랜잭션을 실행한다.
 * serialization_failure 발생 시 bounded retry + telemetry 기록.
 *
 * @param db Prisma client (db)
 * @param fn 트랜잭션 콜백 — `tx`를 받아 비즈니스 로직 실행
 * @param options 재시도/타임아웃 옵션
 * @returns 트랜잭션 결과
 *
 * @throws 원래 에러를 그대로 throw (serialization_failure는 재시도 소진 후)
 */
export async function withSerializableBudgetTx<T>(
  db: any,
  fn: (tx: any) => Promise<T>,
  options?: SerializableTxOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? MAX_RETRIES;
  const timeout = options?.timeout ?? 10000;
  const label = options?.label ?? "budget_tx";

  telemetry.budget_tx_total++;
  let hadConflict = false;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await db.$transaction(fn, {
        isolationLevel: "Serializable",
        timeout,
      });

      telemetry.budget_tx_success++;

      // 충돌 후 성공한 경우 로그
      if (hadConflict) {
        console.info(
          `[${label}] SERIALIZABLE tx succeeded after ${attempt} retries`,
        );
      }

      return result;
    } catch (error: unknown) {
      lastError = error;

      if (isSerializationFailure(error)) {
        if (!hadConflict) {
          hadConflict = true;
          telemetry.budget_tx_conflict_count++;
        }

        if (attempt < maxRetries) {
          telemetry.budget_tx_retry_count++;
          const delay = retryDelay(attempt);
          console.warn(
            `[${label}] Serialization failure, retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Retries exhausted
        telemetry.budget_tx_exhausted++;
        console.error(
          `[${label}] SERIALIZABLE retries exhausted (${maxRetries} attempts)`,
        );
      }

      // Not a serialization failure, or retries exhausted → propagate
      throw error;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}

// ── Budget event idempotency key ──

/**
 * Budget event idempotency key를 생성한다.
 *
 * 형식: `{orgId}:{sourceEntityId}:{eventType}:{suffix}`
 *
 * 이 키는 BudgetEvent.budgetEventKey에 unique 제약으로 걸려 있어,
 * 동일 이벤트가 두 번 실행되면 DB 레벨에서 거부된다.
 *
 * @param orgId 조직 ID
 * @param sourceEntityId 원본 entity (requestId, orderId)
 * @param eventType reserve/release event type
 * @param suffix 카테고리 ID 또는 시퀀스 번호 (기본 "1")
 */
export function buildBudgetEventKey(
  orgId: string,
  sourceEntityId: string,
  eventType: string,
  suffix: string | number = 1,
): string {
  return `${orgId}:${sourceEntityId}:${eventType}:${suffix}`;
}

/**
 * BudgetEvent를 idempotent하게 기록한다.
 * budgetEventKey unique 제약에 의해 중복 실행 시 P2002 에러 발생 → catch 후 skip.
 *
 * SERIALIZABLE tx 안에서 호출해야 한다.
 *
 * @returns true: 신규 기록, false: 이미 존재 (idempotent skip)
 */
export async function recordBudgetEventIdempotent(
  tx: any,
  event: {
    organizationId: string;
    budgetEventKey: string;
    eventType: string;
    sourceEntityType: string;
    sourceEntityId: string;
    categoryId: string | null;
    yearMonth: string;
    amount: number;
    preCommitted: number;
    postCommitted: number;
    decisionPayload?: any;
    executedBy: string;
  },
): Promise<boolean> {
  try {
    await tx.budgetEvent.create({
      data: {
        organizationId: event.organizationId,
        budgetEventKey: event.budgetEventKey,
        eventType: event.eventType,
        sourceEntityType: event.sourceEntityType,
        sourceEntityId: event.sourceEntityId,
        categoryId: event.categoryId,
        yearMonth: event.yearMonth,
        amount: event.amount,
        preCommitted: event.preCommitted,
        postCommitted: event.postCommitted,
        decisionPayload: event.decisionPayload ?? null,
        executedBy: event.executedBy,
      },
    });
    return true;
  } catch (error: any) {
    // P2002: Unique constraint violation → idempotent skip
    if (error?.code === "P2002") {
      console.info(
        `[budget_event] Idempotent skip: ${event.budgetEventKey}`,
      );
      return false;
    }
    throw error;
  }
}

/**
 * Budget gate 차단 시 throw하는 전용 에러.
 * catch 블록에서 `instanceof BudgetBlockedError`로 구분 가능.
 */
export class BudgetBlockedError extends Error {
  public readonly __budgetBlocked = true;
  public readonly blockers: any[];
  public readonly warnings: any[];

  constructor(validation: { blockers: any[]; warnings: any[] }) {
    super("Category budget hard_stop exceeded");
    this.name = "BudgetBlockedError";
    this.blockers = validation.blockers;
    this.warnings = validation.warnings;
  }
}
