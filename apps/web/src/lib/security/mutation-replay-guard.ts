/**
 * Mutation Replay Guard
 *
 * Security Readiness Hardening Batch 0 — Security Batch A
 *
 * irreversible mutation에 idempotency key / replay guard를 추가합니다.
 * duplicate click, stale snapshot, replay attack으로 같은 mutation이 두 번 실행되지 않게 합니다.
 *
 * 설계 원칙:
 * - optimistic unlock 금지
 * - ready_to_send ≠ sent 경계는 보안 계약으로 고정
 * - sent event 없이 UI가 sent처럼 보이는 구조 금지
 * - CSRF same-site token 전략
 */

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

export type MutationActionType =
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

/** Mutation 실행 요청 */
export interface MutationRequest {
  readonly idempotencyKey: string;
  readonly action: MutationActionType;
  readonly targetEntityId: string;
  readonly snapshotVersion: string;
  readonly actorId: string;
  readonly csrfToken: string;
  readonly requestedAt: string; // ISO
}

/** Mutation 실행 결과 */
export interface MutationGuardResult {
  readonly allowed: boolean;
  readonly reason: MutationGuardDenialReason | null;
  readonly governanceMessage: string;
  readonly idempotencyKey: string;
  readonly checkedAt: string;
}

export type MutationGuardDenialReason =
  | 'duplicate_mutation'
  | 'stale_snapshot'
  | 'csrf_invalid'
  | 'request_expired'
  | 'concurrent_mutation';

/** 기록된 mutation fingerprint */
interface MutationFingerprint {
  readonly idempotencyKey: string;
  readonly action: MutationActionType;
  readonly targetEntityId: string;
  readonly snapshotVersion: string;
  readonly actorId: string;
  readonly appliedAt: string;
  readonly resultStatus: 'applied' | 'rejected';
}

/** CSRF 토큰 레코드 */
interface CsrfTokenRecord {
  readonly token: string;
  readonly issuedAt: number;
  readonly consumed: boolean;
}

// ═══════════════════════════════════════════════════════
// Stores (in-memory, SSR-safe)
// ═══════════════════════════════════════════════════════

const MUTATION_FINGERPRINTS = new Map<string, MutationFingerprint>();
const MAX_FINGERPRINTS = 1000;
const FINGERPRINT_TTL_MS = 60 * 60 * 1000; // 1시간

const CSRF_TOKENS = new Map<string, CsrfTokenRecord>();
const CSRF_TOKEN_TTL_MS = 30 * 60 * 1000; // 30분
const MAX_CSRF_TOKENS = 100;

// targetEntityId 기준 동시 실행 방지
// Map<concurrencyKey, acquiredAtMs> — 프로세스 메모리 기반이므로 Vercel 람다 재사용 시
// 이전 실행에서 해제되지 못한(예: 람다 timeout) lock을 TTL로 강제 해제한다.
const ACTIVE_MUTATIONS = new Map<string, number>();
const ACTIVE_MUTATION_TTL_MS = 5 * 60 * 1000; // 5분

/**
 * TTL 초과한 lock은 stale로 간주하고 해제한다.
 * 반환값: 현재 유효한(stale이 아닌) lock 존재 여부.
 */
function hasActiveLock(concurrencyKey: string): boolean {
  const acquiredAt = ACTIVE_MUTATIONS.get(concurrencyKey);
  if (acquiredAt === undefined) return false;
  if (Date.now() - acquiredAt > ACTIVE_MUTATION_TTL_MS) {
    ACTIVE_MUTATIONS.delete(concurrencyKey);
    return false;
  }
  return true;
}

/** Stale snapshot 허용 최대 시간 */
const MAX_REQUEST_AGE_MS = 5 * 60 * 1000; // 5분

// ═══════════════════════════════════════════════════════
// Denial Messages (human-readable, internal key 미노출)
// ═══════════════════════════════════════════════════════

const GUARD_MESSAGES: Record<MutationGuardDenialReason, string> = {
  duplicate_mutation: '이 작업은 이미 처리되었습니다',
  stale_snapshot: '데이터가 변경되었습니다. 최신 상태를 확인한 후 다시 시도해주세요',
  csrf_invalid: '요청 검증에 실패했습니다. 페이지를 새로고침해주세요',
  request_expired: '요청이 만료되었습니다. 다시 시도해주세요',
  concurrent_mutation: '같은 항목에 대한 다른 작업이 진행 중입니다. 잠시 후 다시 시도해주세요',
};

// ═══════════════════════════════════════════════════════
// CSRF Token Management
// ═══════════════════════════════════════════════════════

let csrfCounter = 0;

/**
 * CSRF 토큰 생성 — 각 mutation form/action마다 발급
 * same-site token 전략
 */
export function generateCsrfToken(): string {
  csrfCounter += 1;
  const token = `csrf_${Date.now()}_${csrfCounter}_${Math.random().toString(36).slice(2, 10)}`;

  // 오래된 토큰 정리
  if (CSRF_TOKENS.size >= MAX_CSRF_TOKENS) {
    pruneExpiredCsrfTokens();
  }

  CSRF_TOKENS.set(token, {
    token,
    issuedAt: Date.now(),
    consumed: false,
  });

  return token;
}

/** CSRF 토큰 검증 — 1회 소비 후 재사용 불가 */
function validateAndConsumeCsrfToken(token: string): boolean {
  const record = CSRF_TOKENS.get(token);
  if (!record) return false;
  if (record.consumed) return false;
  if (Date.now() - record.issuedAt > CSRF_TOKEN_TTL_MS) {
    CSRF_TOKENS.delete(token);
    return false;
  }

  // 소비 처리 (1회용)
  CSRF_TOKENS.set(token, { ...record, consumed: true });
  return true;
}

function pruneExpiredCsrfTokens(): void {
  const now = Date.now();
  for (const [key, record] of CSRF_TOKENS) {
    if (now - record.issuedAt > CSRF_TOKEN_TTL_MS || record.consumed) {
      CSRF_TOKENS.delete(key);
    }
  }
}

// ═══════════════════════════════════════════════════════
// Idempotency / Replay Guard
// ═══════════════════════════════════════════════════════

/** stale fingerprint 정리 */
function pruneStaleMutationFingerprints(): void {
  const now = Date.now();
  for (const [key, fp] of MUTATION_FINGERPRINTS) {
    const appliedAt = new Date(fp.appliedAt).getTime();
    if (now - appliedAt > FINGERPRINT_TTL_MS) {
      MUTATION_FINGERPRINTS.delete(key);
    }
  }
}

/** Idempotency key 기반 중복 실행 검사 */
function isDuplicateMutation(idempotencyKey: string): boolean {
  const existing = MUTATION_FINGERPRINTS.get(idempotencyKey);
  if (!existing) return false;
  if (existing.resultStatus === 'applied') return true;
  return false;
}

/** 요청 만료 검사 */
function isRequestExpired(requestedAt: string): boolean {
  const requested = new Date(requestedAt).getTime();
  return isNaN(requested) || (Date.now() - requested) > MAX_REQUEST_AGE_MS;
}

/**
 * Mutation Replay Guard — 핵심 검증 함수
 *
 * 1. CSRF 토큰 검증 (same-site, 1회용)
 * 2. 요청 만료 검사 (5분)
 * 3. Idempotency key 중복 검사
 * 4. 동시 실행 방지 (같은 entity에 대한 concurrent mutation 차단)
 */
export function checkMutationReplayGuard(
  request: MutationRequest,
): MutationGuardResult {
  const checkedAt = new Date().toISOString();
  const { idempotencyKey, action, targetEntityId, csrfToken, requestedAt } = request;

  // 1. CSRF
  if (!validateAndConsumeCsrfToken(csrfToken)) {
    return {
      allowed: false,
      reason: 'csrf_invalid',
      governanceMessage: GUARD_MESSAGES.csrf_invalid,
      idempotencyKey,
      checkedAt,
    };
  }

  // 2. 요청 만료
  if (isRequestExpired(requestedAt)) {
    return {
      allowed: false,
      reason: 'request_expired',
      governanceMessage: GUARD_MESSAGES.request_expired,
      idempotencyKey,
      checkedAt,
    };
  }

  // 3. Idempotency (중복 실행)
  if (isDuplicateMutation(idempotencyKey)) {
    return {
      allowed: false,
      reason: 'duplicate_mutation',
      governanceMessage: GUARD_MESSAGES.duplicate_mutation,
      idempotencyKey,
      checkedAt,
    };
  }

  // 4. Concurrent mutation
  const concurrencyKey = `${action}:${targetEntityId}`;
  if (hasActiveLock(concurrencyKey)) {
    return {
      allowed: false,
      reason: 'concurrent_mutation',
      governanceMessage: GUARD_MESSAGES.concurrent_mutation,
      idempotencyKey,
      checkedAt,
    };
  }

  return {
    allowed: true,
    reason: null,
    governanceMessage: '실행이 허가되었습니다',
    idempotencyKey,
    checkedAt,
  };
}

/**
 * Mutation 실행 시작 — concurrency lock 획득
 * 반드시 completeMutation / failMutation으로 해제해야 함
 */
export function beginMutation(
  action: MutationActionType,
  targetEntityId: string,
): boolean {
  const concurrencyKey = `${action}:${targetEntityId}`;
  // stale lock은 hasActiveLock 내부에서 자동 해제됨
  if (hasActiveLock(concurrencyKey)) return false;
  ACTIVE_MUTATIONS.set(concurrencyKey, Date.now());
  return true;
}

/**
 * Mutation 성공 완료 — fingerprint 기록 + lock 해제
 */
export function completeMutation(request: MutationRequest): void {
  const concurrencyKey = `${request.action}:${request.targetEntityId}`;
  ACTIVE_MUTATIONS.delete(concurrencyKey);

  // Fingerprint 기록
  if (MUTATION_FINGERPRINTS.size >= MAX_FINGERPRINTS) {
    pruneStaleMutationFingerprints();
  }

  MUTATION_FINGERPRINTS.set(request.idempotencyKey, {
    idempotencyKey: request.idempotencyKey,
    action: request.action,
    targetEntityId: request.targetEntityId,
    snapshotVersion: request.snapshotVersion,
    actorId: request.actorId,
    appliedAt: new Date().toISOString(),
    resultStatus: 'applied',
  });
}

/**
 * Mutation 실패 — lock 해제 (fingerprint는 기록하지 않아 재시도 가능)
 */
export function failMutation(
  action: MutationActionType,
  targetEntityId: string,
): void {
  const concurrencyKey = `${action}:${targetEntityId}`;
  ACTIVE_MUTATIONS.delete(concurrencyKey);
}

/**
 * ready_to_send ≠ sent 경계 검증
 *
 * ready_to_send는 capability 가능 상태, sent는 실제 outbound execution state.
 * sent event 없이 UI가 sent처럼 보이는 구조를 방지하는 보안 계약.
 */
export function validateReadyToSendBoundary(
  currentStatus: string,
  requestedAction: 'send_now' | 'schedule_send',
): { valid: boolean; governanceMessage: string } {
  if (currentStatus === 'sent' || currentStatus === 'dispatched') {
    return {
      valid: false,
      governanceMessage: '이미 발송된 항목입니다',
    };
  }

  if (currentStatus !== 'ready_to_send' && currentStatus !== 'scheduled') {
    return {
      valid: false,
      governanceMessage: '발송 준비가 완료되지 않았습니다. 모든 필수 조건을 확인해주세요',
    };
  }

  if (requestedAction === 'send_now' && currentStatus === 'scheduled') {
    // scheduled → send_now 전환은 허용 (cancel 후 재실행)
    return { valid: true, governanceMessage: '' };
  }

  return { valid: true, governanceMessage: '' };
}

// ═══════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════

/** 테스트용 상태 초기화 */
export function __resetMutationGuardState(): void {
  MUTATION_FINGERPRINTS.clear();
  CSRF_TOKENS.clear();
  ACTIVE_MUTATIONS.clear();
  csrfCounter = 0;
}

export { GUARD_MESSAGES, MAX_REQUEST_AGE_MS };
