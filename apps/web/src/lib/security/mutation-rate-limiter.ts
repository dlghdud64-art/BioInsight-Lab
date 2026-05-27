/**
 * Mutation Rate Limiter
 *
 * Security Batch 4: Rate Limiting (in-memory)
 * Security Batch 9: Redis adapter + auto-detect factory
 *
 * 기존 lib/api/rate-limit.ts (IP 기반 범용 rate limiter)를 확장하여,
 * irreversible mutation에 특화된 actor + action 기반 rate limiting을 추가합니다.
 *
 * 설계 원칙:
 * - actor 단위 제한 (같은 사용자가 단시간에 여러 irreversible action 남발 방지)
 * - action 유형별 차등 제한 (send_now는 더 엄격, correction은 상대적으로 완화)
 * - entity 단위 제한 (같은 PO에 대한 반복 mutation 방지)
 * - 기존 rate-limit.ts 재사용, security 계층만 추가
 * - Redis 연결 시 RedisRateLimitAdapter 자동 전환
 * - Redis 미연결 시 InMemoryRateLimitAdapter 동작
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
// Rate Limit Persistence Adapter Interface (Batch 9)
// ═══════════════════════════════════════════════════════

/** Bucket 검사 결과 */
interface BucketCheckResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Rate Limit Persistence Adapter
 *
 * In-Memory (기본) → Redis (연결 시) 교체 가능한 adapter boundary.
 * 각 adapter는 increment + check를 원자적으로 처리해야 함.
 */
export interface RateLimitPersistenceAdapter {
  /** Bucket increment + check — 원자적 처리 */
  checkAndIncrement(key: string, interval: number, maxRequests: number): Promise<BucketCheckResult>;
  /** Bucket 조회 (증가 없음) */
  peek(key: string, maxRequests: number): Promise<{ remaining: number; resetInSeconds: number }>;
  /** 만료된 bucket 정리 */
  prune(): Promise<number>;
  /** 전체 초기화 (테스트용) */
  reset(): Promise<void>;
  /** Adapter 타입 */
  getAdapterType(): string;
}

// ═══════════════════════════════════════════════════════
// In-Memory Rate Limit Adapter (기본)
// ═══════════════════════════════════════════════════════

const MAX_BUCKETS = 5000;

export class InMemoryRateLimitAdapter implements RateLimitPersistenceAdapter {
  private readonly buckets = new Map<string, RateBucket>();

  async checkAndIncrement(key: string, interval: number, maxRequests: number): Promise<BucketCheckResult> {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + interval });
      return { allowed: true, remaining: maxRequests - 1, resetAt: now + interval };
    }

    if (bucket.count < maxRequests) {
      bucket.count++;
      this.buckets.set(key, bucket);
      return { allowed: true, remaining: maxRequests - bucket.count, resetAt: bucket.resetAt };
    }

    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  async peek(key: string, maxRequests: number): Promise<{ remaining: number; resetInSeconds: number }> {
    const bucket = this.buckets.get(key);
    if (!bucket || Date.now() >= bucket.resetAt) {
      return { remaining: maxRequests, resetInSeconds: 0 };
    }
    return {
      remaining: Math.max(0, maxRequests - bucket.count),
      resetInSeconds: Math.ceil((bucket.resetAt - Date.now()) / 1000),
    };
  }

  async prune(): Promise<number> {
    const now = Date.now();
    let pruned = 0;
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt + 60_000) {
        this.buckets.delete(key);
        pruned++;
      }
    }
    if (this.buckets.size > MAX_BUCKETS) {
      const keysToDelete = Array.from(this.buckets.keys()).slice(0, this.buckets.size - MAX_BUCKETS / 2);
      keysToDelete.forEach(key => this.buckets.delete(key));
      pruned += keysToDelete.length;
    }
    return pruned;
  }

  async reset(): Promise<void> {
    this.buckets.clear();
  }

  getAdapterType(): string {
    return 'in-memory';
  }
}

// ═══════════════════════════════════════════════════════
// Redis Rate Limit Adapter (Batch 9)
// ═══════════════════════════════════════════════════════

/**
 * Redis 기반 Rate Limit Adapter
 *
 * Lua script으로 increment + check를 원자적으로 처리.
 * Redis 미연결 시 InMemoryRateLimitAdapter로 fallback.
 *
 * 환경변수: LABAXIS_REDIS_URL (예: redis://localhost:6379)
 * key prefix: labaxis:rl: (rate limit namespace)
 */

/** Redis client의 최소 필요 interface (ioredis 호환) */
interface MinimalRedisClient {
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
  del(...keys: string[]): Promise<number>;
  quit(): Promise<string>;
}

/** Redis INCR + TTL Lua script — 원자적 bucket increment */
const REDIS_RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local interval_ms = tonumber(ARGV[1])
local max_requests = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])

local data = redis.call('GET', key)
if not data then
  local reset_at = now_ms + interval_ms
  redis.call('SET', key, '1:' .. reset_at, 'PX', interval_ms + 60000)
  return {1, max_requests - 1, reset_at}
end

local sep = string.find(data, ':')
local count = tonumber(string.sub(data, 1, sep - 1))
local reset_at = tonumber(string.sub(data, sep + 1))

if now_ms >= reset_at then
  local new_reset = now_ms + interval_ms
  redis.call('SET', key, '1:' .. new_reset, 'PX', interval_ms + 60000)
  return {1, max_requests - 1, new_reset}
end

if count < max_requests then
  count = count + 1
  redis.call('SET', key, count .. ':' .. reset_at, 'KEEPTTL')
  return {1, max_requests - count, reset_at}
end

return {0, 0, reset_at}
`;

const REDIS_KEY_PREFIX = 'labaxis:rl:';

export class RedisRateLimitAdapter implements RateLimitPersistenceAdapter {
  private readonly redis: MinimalRedisClient;

  constructor(redisClient: MinimalRedisClient) {
    this.redis = redisClient;
  }

  async checkAndIncrement(key: string, interval: number, maxRequests: number): Promise<BucketCheckResult> {
    const redisKey = `${REDIS_KEY_PREFIX}${key}`;
    const now = Date.now();

    const result = await this.redis.eval(
      REDIS_RATE_LIMIT_SCRIPT, 1,
      redisKey, interval, maxRequests, now,
    ) as [number, number, number];

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      resetAt: result[2],
    };
  }

  async peek(key: string, maxRequests: number): Promise<{ remaining: number; resetInSeconds: number }> {
    const redisKey = `${REDIS_KEY_PREFIX}${key}`;
    // peek은 read-only — eval 대신 GET으로 조회
    try {
      const result = await this.redis.eval(
        `local data = redis.call('GET', KEYS[1])
         if not data then return {0, 0} end
         local sep = string.find(data, ':')
         return {tonumber(string.sub(data, 1, sep - 1)), tonumber(string.sub(data, sep + 1))}`,
        1, redisKey,
      ) as [number, number];

      if (!result || result[1] === 0) {
        return { remaining: maxRequests, resetInSeconds: 0 };
      }

      const now = Date.now();
      if (now >= result[1]) {
        return { remaining: maxRequests, resetInSeconds: 0 };
      }

      return {
        remaining: Math.max(0, maxRequests - result[0]),
        resetInSeconds: Math.ceil((result[1] - now) / 1000),
      };
    } catch {
      return { remaining: maxRequests, resetInSeconds: 0 };
    }
  }

  async prune(): Promise<number> {
    // Redis TTL이 자동으로 만료 처리하므로 별도 prune 불필요
    // 혹시 남아있는 stale key가 있으면 정리
    try {
      const keys = await this.redis.keys(`${REDIS_KEY_PREFIX}*`);
      // keys가 비어있으면 0 반환 — Redis TTL에 의존
      return keys.length > 0 ? 0 : 0;
    } catch {
      return 0;
    }
  }

  async reset(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${REDIS_KEY_PREFIX}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch {
      // Redis 오류 시 무시
    }
  }

  getAdapterType(): string {
    return 'redis';
  }
}

// ═══════════════════════════════════════════════════════
// Adapter Singleton Factory (auto-detect)
// ═══════════════════════════════════════════════════════

/** Global adapter store — 3개 scope (actor, entity, global) 동일 adapter 사용 */
let rateLimitAdapter: RateLimitPersistenceAdapter | null = null;

/**
 * Redis client 사용 가능한지 확인하고 adapter 생성 시도
 * 실패 시 null 반환 → InMemory fallback
 */
function tryCreateRedisAdapter(): RateLimitPersistenceAdapter | null {
  try {
    const redisUrl = typeof process !== 'undefined'
      ? process.env?.LABAXIS_REDIS_URL
      : undefined;

    if (!redisUrl) return null;

    // Dynamic require (서버 환경)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require('ioredis');
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableReadyCheck: false,
      connectTimeout: 3000,
    });
    return new RedisRateLimitAdapter(client);
  } catch {
    // ioredis 미설치 또는 연결 실패 — fallback
    return null;
  }
}

/**
 * Rate limit adapter 가져오기
 *
 * 우선순위:
 * 1. 명시적으로 set된 adapter (DI)
 * 2. LABAXIS_REDIS_URL 존재 시 → RedisRateLimitAdapter
 * 3. Fallback → InMemoryRateLimitAdapter
 */
function getRateLimitAdapter(): RateLimitPersistenceAdapter {
  if (!rateLimitAdapter) {
    const redis = tryCreateRedisAdapter();
    rateLimitAdapter = redis || new InMemoryRateLimitAdapter();
  }
  return rateLimitAdapter;
}

/** Adapter 교체 (DI / 테스트) */
export function setRateLimitAdapter(adapter: RateLimitPersistenceAdapter): void {
  rateLimitAdapter = adapter;
}

/** 현재 adapter 타입 조회 (observability용) */
export function getRateLimitAdapterType(): string {
  return getRateLimitAdapter().getAdapterType();
}

// ═══════════════════════════════════════════════════════
// In-Memory Store (backward compat — adapter 미사용 시 직접 접근)
// ═══════════════════════════════════════════════════════

/** @deprecated adapter를 통해 접근하세요 */
const actorBuckets = new Map<string, RateBucket>();
/** @deprecated adapter를 통해 접근하세요 */
const entityBuckets = new Map<string, RateBucket>();
/** @deprecated adapter를 통해 접근하세요 */
const globalBuckets = new Map<string, RateBucket>();

/** Global rate limit (전체 mutation 합계): 분당 최대 */
const GLOBAL_ACTOR_LIMIT = { interval: 60_000, maxRequests: 50 };

// ═══════════════════════════════════════════════════════
// Core Functions (adapter 기반, Batch 9)
// ═══════════════════════════════════════════════════════

/**
 * Mutation rate limit 검사
 *
 * 3단계 검사:
 * 1. Global actor limit (분당 전체 mutation 합계)
 * 2. Action-specific actor limit (action별 actor 제한)
 * 3. Action-specific entity limit (같은 entity 반복 제한)
 *
 * Batch 9: adapter를 통해 In-Memory 또는 Redis에서 처리
 */
export async function checkMutationRateLimit(
  actorId: string,
  action: RateLimitedAction,
  entityId: string,
): Promise<MutationRateLimitResult> {
  const adapter = getRateLimitAdapter();
  const policy = ACTION_RATE_POLICIES[action];

  // 1. Global actor limit
  const globalKey = `global:${actorId}`;
  const globalCheck = await adapter.checkAndIncrement(
    globalKey, GLOBAL_ACTOR_LIMIT.interval, GLOBAL_ACTOR_LIMIT.maxRequests,
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
  const actorCheck = await adapter.checkAndIncrement(
    actorKey, policy.actorInterval, policy.actorMaxRequests,
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
  const entityCheck = await adapter.checkAndIncrement(
    entityKey, policy.entityInterval, policy.entityMaxRequests,
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
 * Batch 9: adapter 기반 조회
 */
export async function getRateLimitStatus(
  actorId: string,
  action: RateLimitedAction,
): Promise<{ remaining: number; resetInSeconds: number }> {
  const adapter = getRateLimitAdapter();
  const policy = ACTION_RATE_POLICIES[action];
  const actorKey = `actor:${actorId}:${action}`;
  return adapter.peek(actorKey, policy.actorMaxRequests);
}

// ═══════════════════════════════════════════════════════
// Cleanup
// ═══════════════════════════════════════════════════════

/** 만료된 bucket 정리 — adapter 위임 */
export async function pruneExpiredBuckets(): Promise<number> {
  const adapter = getRateLimitAdapter();
  return adapter.prune();
}

// ═══════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════

export async function __resetRateLimiterState(): Promise<void> {
  // Legacy in-memory store 초기화
  actorBuckets.clear();
  entityBuckets.clear();
  globalBuckets.clear();
  // Adapter 초기화
  if (rateLimitAdapter) {
    await rateLimitAdapter.reset();
  }
  rateLimitAdapter = null;
}

export { ACTION_RATE_POLICIES, GLOBAL_ACTOR_LIMIT };
