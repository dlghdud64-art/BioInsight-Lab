/**
 * Mutation Rate Limiter
 *
 * Security Batch 4: Rate Limiting
 *
 * 기존 lib/api/rate-limit.ts (IP 기반 범용 rate limiter)를 확장하여,
 * irreversible mutation에 특화된 actor + action 기반 rate limiting을 추가합니다.
 *
 * 설계 원칙:
 * - actor 단위 제한 (같은 사용자가 단시간에 여러 irreversible action 남발 방지)
 * - action 유형별 차등 제한 (send_now는 더 엄격, correction은 상대적으로 완화)
 * - entity 단위 제한 (같은 PO에 대한 반복 mutation 방지)
 * - 기존 rate-limit.ts 재사용, security 계층만 추가
 * - Redis 미연결 시 in-memory 동작
 */

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

export type RateLimitedAction =
  // ── Dispatch ──
  | 'send_now'
  | 'schedule_send'
  | 'schedule_cancel'
  | 'po_conversion_finalize'
  | 'po_conversion_reopen'
  | 'request_correction'
  // ── Quote ──
  | 'quote_request_submit'
  | 'quote_status_change'
  // ── Approval / Purchase ──
  | 'approval_decision'
  | 'purchase_request_approve'
  | 'purchase_request_reject'
  | 'order_create'
  | 'order_status_change'
  // ── AI action ──
  | 'ai_action_approve'
  | 'compare_decision'
  | 'email_draft_approve'
  // ── Inventory ──
  | 'inventory_restock'
  | 'inventory_use'
  | 'inventory_import'
  // ── Receiving ──
  | 'receiving_status_change'
  // ── Organization ──
  | 'member_role_change';

export interface MutationRateLimitResult {
  readonly allowed: boolean;
  readonly action: RateLimitedAction;
  readonly remaining: number;
  readonly resetAt: number; // epoch ms
  readonly governanceMessage: string;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

/** Action별 rate limit 정책 */
interface ActionRatePolicy {
  /** actor당 시간 윈도우 (ms) */
  readonly actorInterval: number;
  /** actor당 최대 요청 수 */
  readonly actorMaxRequests: number;
  /** entity당 시간 윈도우 (ms) */
  readonly entityInterval: number;
  /** entity당 최대 요청 수 */
  readonly entityMaxRequests: number;
}

// ═══════════════════════════════════════════════════════
// Rate Limit Policies
// ═══════════════════════════════════════════════════════

/**
 * Action별 rate limit 정책
 *
 * Irreversible action (send_now, finalize)은 더 엄격.
 * Reversible action (cancel, reopen, correction)은 상대적 완화.
 */
const ACTION_RATE_POLICIES: Record<RateLimitedAction, ActionRatePolicy> = {
  // ── Irreversible (엄격) ──
  send_now: {
    actorInterval: 60_000,      // 1분
    actorMaxRequests: 5,        // 1분에 최대 5건
    entityInterval: 300_000,     // 5분
    entityMaxRequests: 1,        // 같은 entity에 5분에 1건
  },
  schedule_send: {
    actorInterval: 60_000,
    actorMaxRequests: 10,
    entityInterval: 60_000,
    entityMaxRequests: 3,
  },
  po_conversion_finalize: {
    actorInterval: 60_000,
    actorMaxRequests: 5,
    entityInterval: 300_000,
    entityMaxRequests: 1,
  },
  approval_decision: {
    actorInterval: 60_000,
    actorMaxRequests: 20,       // bulk approval 고려
    entityInterval: 60_000,
    entityMaxRequests: 2,
  },
  quote_request_submit: {
    actorInterval: 60_000,
    actorMaxRequests: 10,
    entityInterval: 300_000,
    entityMaxRequests: 1,
  },

  quote_status_change: {
    actorInterval: 60_000,
    actorMaxRequests: 10,
    entityInterval: 60_000,
    entityMaxRequests: 2,
  },
  // ── Purchase / Order (엄격) ──
  purchase_request_approve: {
    actorInterval: 60_000,
    actorMaxRequests: 20,       // bulk approval 고려
    entityInterval: 300_000,
    entityMaxRequests: 1,        // 같은 요청은 5분에 1번
  },
  purchase_request_reject: {
    actorInterval: 60_000,
    actorMaxRequests: 20,
    entityInterval: 300_000,
    entityMaxRequests: 1,
  },
  order_create: {
    actorInterval: 60_000,
    actorMaxRequests: 10,
    entityInterval: 300_000,
    entityMaxRequests: 1,
  },
  order_status_change: {
    actorInterval: 60_000,
    actorMaxRequests: 10,
    entityInterval: 60_000,
    entityMaxRequests: 2,
  },
  // ── AI action (중간) ──
  ai_action_approve: {
    actorInterval: 60_000,
    actorMaxRequests: 30,        // AI 작업 bulk 승인 고려
    entityInterval: 60_000,
    entityMaxRequests: 1,
  },
  compare_decision: {
    actorInterval: 60_000,
    actorMaxRequests: 20,
    entityInterval: 30_000,
    entityMaxRequests: 2,        // 재개 가능
  },
  email_draft_approve: {
    actorInterval: 60_000,
    actorMaxRequests: 10,
    entityInterval: 300_000,
    entityMaxRequests: 1,
  },
  // ── Inventory (중간) ──
  inventory_restock: {
    actorInterval: 60_000,
    actorMaxRequests: 30,
    entityInterval: 60_000,
    entityMaxRequests: 5,
  },
  inventory_use: {
    actorInterval: 60_000,
    actorMaxRequests: 30,
    entityInterval: 60_000,
    entityMaxRequests: 5,
  },
  inventory_import: {
    actorInterval: 300_000,
    actorMaxRequests: 5,         // bulk import는 엄격
    entityInterval: 300_000,
    entityMaxRequests: 1,
  },
  // ── Receiving (중간) ──
  receiving_status_change: {
    actorInterval: 60_000,
    actorMaxRequests: 20,
    entityInterval: 60_000,
    entityMaxRequests: 3,
  },
  // ── Organization (엄격) ──
  member_role_change: {
    actorInterval: 60_000,
    actorMaxRequests: 10,
    entityInterval: 60_000,
    entityMaxRequests: 2,
  },

  // ── Reversible (완화) ──
  schedule_cancel: {
    actorInterval: 60_000,
    actorMaxRequests: 20,
    entityInterval: 30_000,
    entityMaxRequests: 3,
  },
  po_conversion_reopen: {
    actorInterval: 60_000,
    actorMaxRequests: 10,
    entityInterval: 60_000,
    entityMaxRequests: 2,
  },
  request_correction: {
    actorInterval: 60_000,
    actorMaxRequests: 15,
    entityInterval: 60_000,
    entityMaxRequests: 3,
  },
};

// ═══════════════════════════════════════════════════════
// In-Memory Store
// ═══════════════════════════════════════════════════════

/** actor 기준 rate bucket: key = `actor:{actorId}:{action}` */
const actorBuckets = new Map<string, RateBucket>();

/** entity 기준 rate bucket: key = `entity:{entityId}:{action}` */
const entityBuckets = new Map<string, RateBucket>();

const MAX_BUCKETS = 5000;

/** Global rate limit (전체 mutation 합계): 분당 최대 */
const GLOBAL_ACTOR_LIMIT = { interval: 60_000, maxRequests: 50 };
const globalBuckets = new Map<string, RateBucket>();

// ═══════════════════════════════════════════════════════
// Core Functions
// ═══════════════════════════════════════════════════════

function checkBucket(
  store: Map<string, RateBucket>,
  key: string,
  interval: number,
  maxRequests: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now >= bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + interval });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + interval };
  }

  if (bucket.count < maxRequests) {
    bucket.count++;
    store.set(key, bucket);
    return { allowed: true, remaining: maxRequests - bucket.count, resetAt: bucket.resetAt };
  }

  return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
}

/**
 * Mutation rate limit 검사
 *
 * 3단계 검사:
 * 1. Global actor limit (분당 전체 mutation 합계)
 * 2. Action-specific actor limit (action별 actor 제한)
 * 3. Action-specific entity limit (같은 entity 반복 제한)
 */
export function checkMutationRateLimit(
  actorId: string,
  action: RateLimitedAction,
  entityId: string,
): MutationRateLimitResult {
  const policy = ACTION_RATE_POLICIES[action];

  // 1. Global actor limit
  const globalKey = `global:${actorId}`;
  const globalCheck = checkBucket(
    globalBuckets, globalKey,
    GLOBAL_ACTOR_LIMIT.interval, GLOBAL_ACTOR_LIMIT.maxRequests,
  );
  if (!globalCheck.allowed) {
    return {
      allowed: false,
      action,
      remaining: 0,
      resetAt: globalCheck.resetAt,
      governanceMessage: '단시간에 너무 많은 작업을 실행했습니다. 잠시 후 다시 시도해주세요',
    };
  }

  // 2. Actor + action limit
  const actorKey = `actor:${actorId}:${action}`;
  const actorCheck = checkBucket(
    actorBuckets, actorKey,
    policy.actorInterval, policy.actorMaxRequests,
  );
  if (!actorCheck.allowed) {
    return {
      allowed: false,
      action,
      remaining: 0,
      resetAt: actorCheck.resetAt,
      governanceMessage: '이 유형의 작업 실행 빈도가 제한을 초과했습니다. 잠시 후 다시 시도해주세요',
    };
  }

  // 3. Entity + action limit
  const entityKey = `entity:${entityId}:${action}`;
  const entityCheck = checkBucket(
    entityBuckets, entityKey,
    policy.entityInterval, policy.entityMaxRequests,
  );
  if (!entityCheck.allowed) {
    return {
      allowed: false,
      action,
      remaining: 0,
      resetAt: entityCheck.resetAt,
      governanceMessage: '같은 항목에 대해 너무 자주 작업을 실행했습니다. 잠시 후 다시 시도해주세요',
    };
  }

  return {
    allowed: true,
    action,
    remaining: Math.min(actorCheck.remaining, entityCheck.remaining),
    resetAt: Math.min(actorCheck.resetAt, entityCheck.resetAt),
    governanceMessage: '',
  };
}

/**
 * Rate limit 상태 조회 (UI 표시용)
 * 남은 횟수와 리셋 시간을 human-readable로 제공
 */
export function getRateLimitStatus(
  actorId: string,
  action: RateLimitedAction,
): { remaining: number; resetInSeconds: number } {
  const policy = ACTION_RATE_POLICIES[action];
  const actorKey = `actor:${actorId}:${action}`;
  const bucket = actorBuckets.get(actorKey);

  if (!bucket || Date.now() >= bucket.resetAt) {
    return { remaining: policy.actorMaxRequests, resetInSeconds: 0 };
  }

  return {
    remaining: Math.max(0, policy.actorMaxRequests - bucket.count),
    resetInSeconds: Math.ceil((bucket.resetAt - Date.now()) / 1000),
  };
}

// ═══════════════════════════════════════════════════════
// Cleanup
// ═══════════════════════════════════════════════════════

/** 만료된 bucket 정리 */
export function pruneExpiredBuckets(): number {
  const now = Date.now();
  let pruned = 0;

  for (const store of [actorBuckets, entityBuckets, globalBuckets]) {
    for (const [key, bucket] of store) {
      if (now >= bucket.resetAt + 60_000) {
        store.delete(key);
        pruned++;
      }
    }
    // 최대 크기 제한
    if (store.size > MAX_BUCKETS) {
      const keysToDelete = Array.from(store.keys()).slice(0, store.size - MAX_BUCKETS / 2);
      keysToDelete.forEach(key => store.delete(key));
      pruned += keysToDelete.length;
    }
  }

  return pruned;
}

// ═══════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════

export function __resetRateLimiterState(): void {
  actorBuckets.clear();
  entityBuckets.clear();
  globalBuckets.clear();
}

export { ACTION_RATE_POLICIES, GLOBAL_ACTOR_LIMIT };
