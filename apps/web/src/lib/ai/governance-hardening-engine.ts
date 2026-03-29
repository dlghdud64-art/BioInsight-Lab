/**
 * Governance Hardening Engine — 운영 체인 제품 강화 5계층
 *
 * 순서:
 * 1. Concurrency Guard — 같은 governance object에 대한 동시 mutation 차단
 * 2. Reconnect / Replay — missed event 복구, event gap 감지
 * 3. Persistence — governance state snapshot 직렬화/복원
 * 4. Idempotent Mutation — 중복 mutation 방지, mutation fingerprint
 * 5. Error Boundary — governance engine 실행 오류 격리 및 복구
 *
 * IMMUTABLE RULES:
 * - optimistic unlock 금지 — guard가 열리기 전까지 모든 mutation 차단
 * - stale discard는 정상 경로 — error로 처리하지 않음
 * - consumed snapshot 소급 무효화 금지
 * - business logic은 throw 대신 structured result object로 반환
 * - broad global refresh 금지 — targeted invalidation만
 */

import type { GovernanceDomain, GovernanceEvent, GovernanceEventBus } from "./governance-event-bus";
import type { QuoteChainStage } from "./quote-approval-governance-engine";

// ══════════════════════════════════════════════════════
// Layer 1: Concurrency Guard
// ══════════════════════════════════════════════════════

/**
 * governance object 단위 mutation lock.
 * 같은 objectId에 대한 동시 mutation을 차단.
 * lock은 짧게 유지하고, timeout으로 안전 해제.
 */

export interface MutationLock {
  objectId: string;
  domain: GovernanceDomain;
  acquiredBy: string;
  acquiredAt: string;
  /** Auto-release timeout (ms) — 기본 30초 */
  timeoutMs: number;
  /** Lock purpose for audit */
  purpose: string;
}

export interface ConcurrencyGuardResult {
  acquired: boolean;
  lock: MutationLock | null;
  rejectedReason: string | null;
  /** 현재 lock holder 정보 (acquired=false일 때) */
  currentHolder: { acquiredBy: string; acquiredAt: string; purpose: string } | null;
}

const DEFAULT_LOCK_TIMEOUT_MS = 30_000;

export interface ConcurrencyGuard {
  acquire: (objectId: string, domain: GovernanceDomain, actor: string, purpose: string) => ConcurrencyGuardResult;
  release: (objectId: string, actor: string) => boolean;
  isLocked: (objectId: string) => boolean;
  forceRelease: (objectId: string, reason: string) => boolean;
  getActiveLocks: () => MutationLock[];
  /** Sweep expired locks */
  sweep: () => number;
}

export function createConcurrencyGuard(
  timeoutMs: number = DEFAULT_LOCK_TIMEOUT_MS,
): ConcurrencyGuard {
  const locks = new Map<string, MutationLock>();

  function isExpired(lock: MutationLock): boolean {
    return Date.now() - new Date(lock.acquiredAt).getTime() > lock.timeoutMs;
  }

  return {
    acquire(objectId, domain, actor, purpose) {
      const existing = locks.get(objectId);

      // Auto-sweep expired lock
      if (existing && isExpired(existing)) {
        locks.delete(objectId);
      }

      const current = locks.get(objectId);
      if (current) {
        return {
          acquired: false,
          lock: null,
          rejectedReason: `이미 ${current.acquiredBy}이(가) lock 보유 중 (${current.purpose})`,
          currentHolder: {
            acquiredBy: current.acquiredBy,
            acquiredAt: current.acquiredAt,
            purpose: current.purpose,
          },
        };
      }

      const lock: MutationLock = {
        objectId,
        domain,
        acquiredBy: actor,
        acquiredAt: new Date().toISOString(),
        timeoutMs,
        purpose,
      };
      locks.set(objectId, lock);

      return { acquired: true, lock, rejectedReason: null, currentHolder: null };
    },

    release(objectId, actor) {
      const lock = locks.get(objectId);
      if (!lock) return false;
      if (lock.acquiredBy !== actor) return false;
      locks.delete(objectId);
      return true;
    },

    isLocked(objectId) {
      const lock = locks.get(objectId);
      if (!lock) return false;
      if (isExpired(lock)) {
        locks.delete(objectId);
        return false;
      }
      return true;
    },

    forceRelease(objectId, _reason) {
      return locks.delete(objectId);
    },

    getActiveLocks() {
      // Sweep expired first
      for (const [id, lock] of locks) {
        if (isExpired(lock)) locks.delete(id);
      }
      return [...locks.values()];
    },

    sweep() {
      let swept = 0;
      for (const [id, lock] of locks) {
        if (isExpired(lock)) {
          locks.delete(id);
          swept++;
        }
      }
      return swept;
    },
  };
}

// ══════════════════════════════════════════════════════
// Layer 2: Reconnect / Replay — missed event 복구
// ══════════════════════════════════════════════════════

/**
 * 브라우저 재진입, 탭 전환, 네트워크 끊김 후 event gap 감지 및 복구.
 * event bus history에서 마지막 처리 이벤트 이후의 missed events를 재생.
 */

export interface ReplayCheckpoint {
  /** 마지막으로 처리한 eventId */
  lastProcessedEventId: string | null;
  /** 마지막 처리 시각 */
  lastProcessedAt: string | null;
  /** 현재 구독 중인 domains */
  subscribedDomains: GovernanceDomain[];
  /** checkpoint 생성 시각 */
  checkpointAt: string;
}

export interface EventGapAnalysis {
  /** Missed event count */
  missedCount: number;
  /** Missed events (in order) */
  missedEvents: GovernanceEvent[];
  /** Time gap */
  gapDurationMs: number;
  /** 재생 필요 여부 */
  needsReplay: boolean;
  /** 재생이 불가능한 경우 이유 */
  replayBlockedReason: string | null;
}

export interface ReplayResult {
  /** 재생된 이벤트 수 */
  replayedCount: number;
  /** 재생 실패한 이벤트 수 */
  failedCount: number;
  /** 새로운 checkpoint */
  updatedCheckpoint: ReplayCheckpoint;
  /** 재생 중 발생한 오류 목록 */
  errors: ReplayError[];
}

export interface ReplayError {
  eventId: string;
  error: string;
  timestamp: string;
}

/** Max age for replay (10 minutes) — 이보다 오래된 gap은 full refresh 권장 */
const MAX_REPLAY_AGE_MS = 10 * 60 * 1000;
/** Max events to replay in one batch */
const MAX_REPLAY_BATCH = 100;

export function createReplayCheckpoint(
  domains: GovernanceDomain[],
  lastEventId?: string | null,
): ReplayCheckpoint {
  return {
    lastProcessedEventId: lastEventId ?? null,
    lastProcessedAt: lastEventId ? new Date().toISOString() : null,
    subscribedDomains: [...domains],
    checkpointAt: new Date().toISOString(),
  };
}

export function analyzeEventGap(
  bus: GovernanceEventBus,
  checkpoint: ReplayCheckpoint,
): EventGapAnalysis {
  const allHistory = bus.getHistory();

  // Find events after the last processed one
  let missedEvents: GovernanceEvent[];
  if (!checkpoint.lastProcessedEventId) {
    // Never processed — all history is "missed"
    missedEvents = allHistory;
  } else {
    const lastIdx = allHistory.findIndex(e => e.eventId === checkpoint.lastProcessedEventId);
    if (lastIdx === -1) {
      // Last processed event not in history (history rolled over)
      missedEvents = allHistory;
    } else {
      missedEvents = allHistory.slice(lastIdx + 1);
    }
  }

  // Filter by subscribed domains
  if (checkpoint.subscribedDomains.length > 0) {
    missedEvents = missedEvents.filter(e =>
      checkpoint.subscribedDomains.includes(e.domain),
    );
  }

  const gapDurationMs = checkpoint.lastProcessedAt
    ? Date.now() - new Date(checkpoint.lastProcessedAt).getTime()
    : 0;

  let replayBlockedReason: string | null = null;
  if (gapDurationMs > MAX_REPLAY_AGE_MS) {
    replayBlockedReason = `gap이 ${Math.floor(gapDurationMs / 60000)}분으로 최대 허용(10분) 초과 — full refresh 필요`;
  } else if (missedEvents.length > MAX_REPLAY_BATCH) {
    replayBlockedReason = `missed event가 ${missedEvents.length}건으로 최대 batch(${MAX_REPLAY_BATCH}) 초과 — full refresh 필요`;
  }

  return {
    missedCount: missedEvents.length,
    missedEvents: replayBlockedReason ? [] : missedEvents,
    gapDurationMs,
    needsReplay: missedEvents.length > 0 && !replayBlockedReason,
    replayBlockedReason,
  };
}

export function replayMissedEvents(
  missedEvents: GovernanceEvent[],
  handler: (event: GovernanceEvent) => void,
  checkpoint: ReplayCheckpoint,
): ReplayResult {
  const errors: ReplayError[] = [];
  let replayedCount = 0;
  let lastProcessedId = checkpoint.lastProcessedEventId;

  for (const event of missedEvents) {
    try {
      handler(event);
      replayedCount++;
      lastProcessedId = event.eventId;
    } catch (err) {
      errors.push({
        eventId: event.eventId,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      });
    }
  }

  return {
    replayedCount,
    failedCount: errors.length,
    updatedCheckpoint: {
      ...checkpoint,
      lastProcessedEventId: lastProcessedId,
      lastProcessedAt: new Date().toISOString(),
      checkpointAt: new Date().toISOString(),
    },
    errors,
  };
}

// ══════════════════════════════════════════════════════
// Layer 3: Persistence — governance state 직렬화/복원
// ══════════════════════════════════════════════════════

/**
 * governance state를 직렬화하여 저장하고, 복원 시 무결성 검증.
 * 저장소 추상화 — 실제 저장은 consumer가 결정 (memory, IndexedDB, server).
 */

export interface PersistenceEnvelope<T = unknown> {
  /** Envelope version for migration */
  version: number;
  /** What kind of state this is */
  stateType: string;
  /** Governance domain */
  domain: GovernanceDomain;
  /** Object ID */
  objectId: string;
  /** Serialized state */
  payload: T;
  /** Content hash for integrity check */
  contentHash: string;
  /** When was this persisted */
  persistedAt: string;
  /** Which event was the latest at persist time */
  lastEventId: string | null;
}

export interface PersistenceStore {
  save: <T>(envelope: PersistenceEnvelope<T>) => boolean;
  load: <T>(domain: GovernanceDomain, objectId: string) => PersistenceEnvelope<T> | null;
  remove: (domain: GovernanceDomain, objectId: string) => boolean;
  list: (domain?: GovernanceDomain) => PersistenceEnvelope[];
  clear: () => void;
}

/** Current envelope version */
const PERSISTENCE_VERSION = 1;

export function computeContentHash(payload: unknown): string {
  // Deterministic JSON → simple hash
  const json = JSON.stringify(payload, Object.keys(payload as Record<string, unknown>).sort());
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `h_${Math.abs(hash).toString(36)}`;
}

export function createPersistenceEnvelope<T>(
  stateType: string,
  domain: GovernanceDomain,
  objectId: string,
  payload: T,
  lastEventId: string | null,
): PersistenceEnvelope<T> {
  return {
    version: PERSISTENCE_VERSION,
    stateType,
    domain,
    objectId,
    payload,
    contentHash: computeContentHash(payload),
    persistedAt: new Date().toISOString(),
    lastEventId,
  };
}

export interface RestoreValidation {
  valid: boolean;
  reason: string | null;
  versionMatch: boolean;
  integrityMatch: boolean;
  stale: boolean;
}

export function validateEnvelope<T>(
  envelope: PersistenceEnvelope<T>,
  currentEventId: string | null,
): RestoreValidation {
  const versionMatch = envelope.version === PERSISTENCE_VERSION;
  const integrityMatch = computeContentHash(envelope.payload) === envelope.contentHash;
  const stale = currentEventId !== null
    && envelope.lastEventId !== null
    && envelope.lastEventId !== currentEventId;

  let reason: string | null = null;
  if (!versionMatch) reason = `버전 불일치: envelope=${envelope.version}, current=${PERSISTENCE_VERSION}`;
  if (!integrityMatch) reason = "content hash 무결성 검증 실패";

  return {
    valid: versionMatch && integrityMatch,
    reason,
    versionMatch,
    integrityMatch,
    stale,
  };
}

/**
 * In-memory persistence store — 테스트 및 기본 구현.
 * Production에서는 IndexedDB 또는 server-side store로 교체.
 */
export function createInMemoryPersistenceStore(): PersistenceStore {
  const store = new Map<string, PersistenceEnvelope>();

  function key(domain: GovernanceDomain, objectId: string): string {
    return `${domain}:${objectId}`;
  }

  return {
    save<T>(envelope: PersistenceEnvelope<T>) {
      store.set(key(envelope.domain, envelope.objectId), envelope as PersistenceEnvelope);
      return true;
    },

    load<T>(domain: GovernanceDomain, objectId: string) {
      return (store.get(key(domain, objectId)) as PersistenceEnvelope<T>) ?? null;
    },

    remove(domain: GovernanceDomain, objectId: string) {
      return store.delete(key(domain, objectId));
    },

    list(domain?: GovernanceDomain) {
      const all = [...store.values()];
      if (domain) return all.filter(e => e.domain === domain);
      return all;
    },

    clear() {
      store.clear();
    },
  };
}

// ══════════════════════════════════════════════════════
// Layer 4: Idempotent Mutation Guard
// ══════════════════════════════════════════════════════

/**
 * mutation fingerprint로 중복 mutation 방지.
 * fingerprint = domain + objectId + mutationType + contentHash.
 * 같은 fingerprint의 mutation은 silently skip (not error).
 */

export interface MutationFingerprint {
  domain: GovernanceDomain;
  objectId: string;
  mutationType: string;
  contentHash: string;
  /** When was this mutation first applied */
  appliedAt: string;
  /** Result of the first application */
  resultSummary: string;
}

export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  existingFingerprint: MutationFingerprint | null;
  /** If duplicate, how long ago was the original applied */
  ageMs: number | null;
}

export interface IdempotencyGuard {
  check: (domain: GovernanceDomain, objectId: string, mutationType: string, contentHash: string) => IdempotencyCheckResult;
  record: (domain: GovernanceDomain, objectId: string, mutationType: string, contentHash: string, resultSummary: string) => void;
  /** Clear fingerprints older than maxAgeMs */
  prune: (maxAgeMs: number) => number;
  getFingerprints: () => MutationFingerprint[];
}

/** Default fingerprint TTL: 5 minutes */
const DEFAULT_FINGERPRINT_TTL_MS = 5 * 60 * 1000;

export function createIdempotencyGuard(): IdempotencyGuard {
  const fingerprints = new Map<string, MutationFingerprint>();

  function fpKey(domain: GovernanceDomain, objectId: string, mutationType: string, contentHash: string): string {
    return `${domain}:${objectId}:${mutationType}:${contentHash}`;
  }

  return {
    check(domain, objectId, mutationType, contentHash) {
      const k = fpKey(domain, objectId, mutationType, contentHash);
      const existing = fingerprints.get(k);

      if (!existing) {
        return { isDuplicate: false, existingFingerprint: null, ageMs: null };
      }

      const ageMs = Date.now() - new Date(existing.appliedAt).getTime();
      return { isDuplicate: true, existingFingerprint: existing, ageMs };
    },

    record(domain, objectId, mutationType, contentHash, resultSummary) {
      const k = fpKey(domain, objectId, mutationType, contentHash);
      fingerprints.set(k, {
        domain,
        objectId,
        mutationType,
        contentHash,
        appliedAt: new Date().toISOString(),
        resultSummary,
      });
    },

    prune(maxAgeMs = DEFAULT_FINGERPRINT_TTL_MS) {
      let pruned = 0;
      const now = Date.now();
      for (const [k, fp] of fingerprints) {
        if (now - new Date(fp.appliedAt).getTime() > maxAgeMs) {
          fingerprints.delete(k);
          pruned++;
        }
      }
      return pruned;
    },

    getFingerprints() {
      return [...fingerprints.values()];
    },
  };
}

// ══════════════════════════════════════════════════════
// Layer 5: Error Boundary — governance 실행 오류 격리
// ══════════════════════════════════════════════════════

/**
 * governance engine 함수 실행을 감싸는 boundary.
 * business logic 오류는 structured result로, 시스템 오류는 격리 후 복구 경로 제시.
 */

export type ErrorSeverity = "recoverable" | "degraded" | "fatal";

export interface GovernanceError {
  errorId: string;
  domain: GovernanceDomain;
  operation: string;
  objectId: string;
  severity: ErrorSeverity;
  message: string;
  /** Stack trace (only in development) */
  stack: string | null;
  timestamp: string;
  /** Suggested recovery action */
  recovery: ErrorRecoveryAction;
}

export type ErrorRecoveryAction =
  | { type: "retry"; delayMs: number }
  | { type: "refresh_state"; domain: GovernanceDomain; objectId: string }
  | { type: "release_lock"; objectId: string }
  | { type: "force_checkpoint"; domain: GovernanceDomain }
  | { type: "escalate"; reason: string }
  | { type: "silent_discard"; reason: string };

export interface BoundaryExecutionResult<T> {
  success: boolean;
  result: T | null;
  error: GovernanceError | null;
}

export function createGovernanceError(
  domain: GovernanceDomain,
  operation: string,
  objectId: string,
  severity: ErrorSeverity,
  message: string,
  recovery: ErrorRecoveryAction,
  stack?: string | null,
): GovernanceError {
  return {
    errorId: `gerr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    domain,
    operation,
    objectId,
    severity,
    message,
    stack: stack ?? null,
    timestamp: new Date().toISOString(),
    recovery,
  };
}

/**
 * governance engine 함수를 error boundary로 감싸서 실행.
 * 시스템 오류 발생 시 structured error 반환, 절대 throw 안 함.
 */
export function executeWithBoundary<T>(
  domain: GovernanceDomain,
  operation: string,
  objectId: string,
  fn: () => T,
): BoundaryExecutionResult<T> {
  try {
    const result = fn();
    return { success: true, result, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack ?? null : null;

    // Classify severity
    const severity = classifyErrorSeverity(message);
    const recovery = suggestRecovery(severity, domain, objectId);

    return {
      success: false,
      result: null,
      error: createGovernanceError(domain, operation, objectId, severity, message, recovery, stack),
    };
  }
}

function classifyErrorSeverity(message: string): ErrorSeverity {
  const fatalPatterns = ["out of memory", "stack overflow", "maximum call stack"];
  const degradedPatterns = ["timeout", "network", "connection", "unavailable"];

  const lower = message.toLowerCase();
  if (fatalPatterns.some(p => lower.includes(p))) return "fatal";
  if (degradedPatterns.some(p => lower.includes(p))) return "degraded";
  return "recoverable";
}

function suggestRecovery(
  severity: ErrorSeverity,
  domain: GovernanceDomain,
  objectId: string,
): ErrorRecoveryAction {
  switch (severity) {
    case "fatal":
      return { type: "escalate", reason: "시스템 오류 — 운영팀 확인 필요" };
    case "degraded":
      return { type: "retry", delayMs: 3000 };
    case "recoverable":
      return { type: "refresh_state", domain, objectId };
  }
}

// ══════════════════════════════════════════════════════
// Error Tracker — 오류 이력 관리
// ══════════════════════════════════════════════════════

export interface ErrorTracker {
  record: (error: GovernanceError) => void;
  getErrors: (domain?: GovernanceDomain) => GovernanceError[];
  getRecentErrors: (windowMs: number) => GovernanceError[];
  /** 특정 objectId의 연속 오류 횟수 — circuit breaker 판단용 */
  getConsecutiveFailures: (objectId: string) => number;
  /** Circuit breaker: 연속 실패가 threshold 이상이면 true */
  isCircuitOpen: (objectId: string, threshold: number) => boolean;
  clearForObject: (objectId: string) => void;
  clear: () => void;
}

const MAX_ERROR_HISTORY = 200;

export function createErrorTracker(): ErrorTracker {
  let errors: GovernanceError[] = [];
  const consecutiveFailures = new Map<string, number>();

  return {
    record(error) {
      errors.push(error);
      if (errors.length > MAX_ERROR_HISTORY) {
        errors = errors.slice(-MAX_ERROR_HISTORY);
      }

      // Track consecutive failures
      const count = consecutiveFailures.get(error.objectId) ?? 0;
      consecutiveFailures.set(error.objectId, count + 1);
    },

    getErrors(domain) {
      if (domain) return errors.filter(e => e.domain === domain);
      return [...errors];
    },

    getRecentErrors(windowMs) {
      const cutoff = Date.now() - windowMs;
      return errors.filter(e => new Date(e.timestamp).getTime() >= cutoff);
    },

    getConsecutiveFailures(objectId) {
      return consecutiveFailures.get(objectId) ?? 0;
    },

    isCircuitOpen(objectId, threshold) {
      return (consecutiveFailures.get(objectId) ?? 0) >= threshold;
    },

    clearForObject(objectId) {
      errors = errors.filter(e => e.objectId !== objectId);
      consecutiveFailures.delete(objectId);
    },

    clear() {
      errors = [];
      consecutiveFailures.clear();
    },
  };
}

// ══════════════════════════════════════════════════════
// Hardened Mutation Pipeline — 5계층 통합 실행
// ══════════════════════════════════════════════════════

/**
 * 5계층을 순서대로 통과하는 통합 mutation 파이프라인.
 *
 * 1. Circuit breaker check
 * 2. Concurrency guard acquire
 * 3. Idempotency check
 * 4. Execute with error boundary
 * 5. Record fingerprint
 * 6. Release lock
 * 7. Persist state (optional)
 */

export interface HardenedMutationInput<T> {
  domain: GovernanceDomain;
  objectId: string;
  mutationType: string;
  contentHash: string;
  actor: string;
  /** The actual mutation function */
  execute: () => T;
  /** Optional: persist result after mutation */
  persistAfter?: boolean;
}

export type HardenedMutationResult<T> =
  | { status: "applied"; result: T; lockHeld: false }
  | { status: "duplicate"; existingFingerprint: MutationFingerprint; lockHeld: false }
  | { status: "lock_rejected"; reason: string; currentHolder: MutationLock["acquiredBy"]; lockHeld: false }
  | { status: "circuit_open"; consecutiveFailures: number; lockHeld: false }
  | { status: "error"; error: GovernanceError; lockHeld: false };

export interface HardenedMutationPipeline {
  execute: <T>(input: HardenedMutationInput<T>) => HardenedMutationResult<T>;
  getConcurrencyGuard: () => ConcurrencyGuard;
  getIdempotencyGuard: () => IdempotencyGuard;
  getErrorTracker: () => ErrorTracker;
}

/** Default circuit breaker threshold */
const CIRCUIT_BREAKER_THRESHOLD = 5;

export function createHardenedMutationPipeline(options?: {
  circuitBreakerThreshold?: number;
  lockTimeoutMs?: number;
}): HardenedMutationPipeline {
  const threshold = options?.circuitBreakerThreshold ?? CIRCUIT_BREAKER_THRESHOLD;
  const guard = createConcurrencyGuard(options?.lockTimeoutMs);
  const idempotency = createIdempotencyGuard();
  const tracker = createErrorTracker();

  return {
    execute<T>(input: HardenedMutationInput<T>): HardenedMutationResult<T> {
      // 1. Circuit breaker
      if (tracker.isCircuitOpen(input.objectId, threshold)) {
        return {
          status: "circuit_open",
          consecutiveFailures: tracker.getConsecutiveFailures(input.objectId),
          lockHeld: false,
        };
      }

      // 2. Idempotency check
      const dupCheck = idempotency.check(input.domain, input.objectId, input.mutationType, input.contentHash);
      if (dupCheck.isDuplicate) {
        return {
          status: "duplicate",
          existingFingerprint: dupCheck.existingFingerprint!,
          lockHeld: false,
        };
      }

      // 3. Concurrency guard
      const lockResult = guard.acquire(input.objectId, input.domain, input.actor, input.mutationType);
      if (!lockResult.acquired) {
        return {
          status: "lock_rejected",
          reason: lockResult.rejectedReason!,
          currentHolder: lockResult.currentHolder!.acquiredBy,
          lockHeld: false,
        };
      }

      // 4. Execute with error boundary
      const execResult = executeWithBoundary(
        input.domain,
        input.mutationType,
        input.objectId,
        input.execute,
      );

      // 5. Release lock (always, regardless of success)
      guard.release(input.objectId, input.actor);

      if (!execResult.success) {
        // Record error
        tracker.record(execResult.error!);
        return { status: "error", error: execResult.error!, lockHeld: false };
      }

      // 6. Record fingerprint on success
      idempotency.record(
        input.domain,
        input.objectId,
        input.mutationType,
        input.contentHash,
        "applied",
      );

      // Clear consecutive failures on success
      tracker.clearForObject(input.objectId);

      return { status: "applied", result: execResult.result!, lockHeld: false };
    },

    getConcurrencyGuard: () => guard,
    getIdempotencyGuard: () => idempotency,
    getErrorTracker: () => tracker,
  };
}
