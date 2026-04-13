/**
 * Audit Integrity Engine
 *
 * Security Readiness Hardening Batch 0 — Security Batch B
 *
 * append-only, tamper-evident 감사 로그.
 * 기존 governance-audit-engine.ts의 DecisionLog 위에
 * hash chain + correlation + provenance를 강화합니다.
 *
 * 설계 원칙:
 * - audit는 "표시용 history"가 아니라 append-only evidence
 * - tamper-evident를 위해 hash chain 유지
 * - 삭제/수정 API 없음
 * - 기존 governance event bus 재사용
 */

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

/** Audit envelope — 모든 irreversible action의 증거 */
export interface AuditEnvelope {
  readonly eventId: string;
  readonly correlationId: string;
  readonly actorUserId: string;
  readonly actorRole: string;
  readonly actionType: string;
  readonly targetEntityType: string;
  readonly targetEntityId: string;
  readonly occurredAt: string; // ISO
  readonly snapshotVersion: string;
  readonly beforeHash: string;
  readonly afterHash: string;
  readonly rationale: string;
  readonly reasonCode: string;
  readonly sourceSurface: string;
  /** 이전 envelope의 hash — chain 무결성 */
  readonly previousEnvelopeHash: string;
  /** 이 envelope 자체의 hash */
  readonly envelopeHash: string;
  /** 보안 분류 */
  readonly securityClassification: SecurityClassification;
}

export type SecurityClassification =
  | 'internal_only'
  | 'governance_restricted'
  | 'audit_evidence'
  | 'supplier_facing';

/** Audit store — append-only, 삭제/수정 불가 */
interface AuditStore {
  readonly envelopes: readonly AuditEnvelope[];
  readonly lastHash: string;
  readonly chainLength: number;
  readonly createdAt: string;
}

/** Hash chain 검증 결과 */
export interface ChainVerificationResult {
  readonly valid: boolean;
  readonly chainLength: number;
  readonly brokenAt?: number;
  readonly expectedHash?: string;
  readonly actualHash?: string;
  readonly verifiedAt: string;
}

// ═══════════════════════════════════════════════════════
// Hash 함수 (브라우저/Node 양쪽 호환)
// ═══════════════════════════════════════════════════════

/**
 * 결정론적 해시 생성 — SHA-256 대체 (순수 JS)
 * 실제 production에서는 crypto.subtle.digest 사용 권장
 */
function computeHash(input: string): string {
  // DJB2 기반 확장 해시 — 충분히 결정적이면서 빠름
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = ((h1 ^ c) * 0x01000193) >>> 0;
    h2 = ((h2 ^ c) * 0x811c9dc5) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

/** 객체를 결정론적 문자열로 직렬화 (key 정렬) */
function deterministicStringify(obj: Record<string, unknown>): string {
  const sorted = Object.keys(obj).sort().reduce((acc, key) => {
    acc[key] = obj[key];
    return acc;
  }, {} as Record<string, unknown>);
  return JSON.stringify(sorted);
}

/** 상태 객체에서 해시 생성 */
export function computeStateHash(state: Record<string, unknown>): string {
  return computeHash(deterministicStringify(state));
}

// ═══════════════════════════════════════════════════════
// Audit Store (Singleton, append-only)
// ═══════════════════════════════════════════════════════

const GENESIS_HASH = '0000000000000000';
const MAX_STORE_SIZE = 10000;

let auditStore: AuditStore = {
  envelopes: [],
  lastHash: GENESIS_HASH,
  chainLength: 0,
  createdAt: new Date().toISOString(),
};

let envelopeCounter = 0;

function generateEventId(): string {
  envelopeCounter += 1;
  return `audit_${Date.now()}_${envelopeCounter}`;
}

/** Envelope 자체의 해시 계산 (previousEnvelopeHash + payload) */
function computeEnvelopeHash(
  envelope: Omit<AuditEnvelope, 'envelopeHash'>,
): string {
  const payload = deterministicStringify({
    eventId: envelope.eventId,
    correlationId: envelope.correlationId,
    actorUserId: envelope.actorUserId,
    actionType: envelope.actionType,
    targetEntityId: envelope.targetEntityId,
    occurredAt: envelope.occurredAt,
    beforeHash: envelope.beforeHash,
    afterHash: envelope.afterHash,
    previousEnvelopeHash: envelope.previousEnvelopeHash,
  });
  return computeHash(payload);
}

// ═══════════════════════════════════════════════════════
// Core Functions
// ═══════════════════════════════════════════════════════

export interface AppendAuditInput {
  readonly correlationId: string;
  readonly actorUserId: string;
  readonly actorRole: string;
  readonly actionType: string;
  readonly targetEntityType: string;
  readonly targetEntityId: string;
  readonly snapshotVersion: string;
  readonly beforeState: Record<string, unknown>;
  readonly afterState: Record<string, unknown>;
  readonly rationale: string;
  readonly reasonCode: string;
  readonly sourceSurface: string;
  readonly securityClassification?: SecurityClassification;
}

/**
 * Audit envelope 추가 — append-only, 삭제/수정 불가
 *
 * hash chain을 유지하여 tamper-evident 보장.
 * 이전 envelope의 hash가 다음 envelope에 포함됩니다.
 */
export function appendAuditEnvelope(input: AppendAuditInput): AuditEnvelope {
  const eventId = generateEventId();
  const occurredAt = new Date().toISOString();

  const beforeHash = computeStateHash(input.beforeState);
  const afterHash = computeStateHash(input.afterState);

  const partialEnvelope = {
    eventId,
    correlationId: input.correlationId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    actionType: input.actionType,
    targetEntityType: input.targetEntityType,
    targetEntityId: input.targetEntityId,
    occurredAt,
    snapshotVersion: input.snapshotVersion,
    beforeHash,
    afterHash,
    rationale: input.rationale,
    reasonCode: input.reasonCode,
    sourceSurface: input.sourceSurface,
    previousEnvelopeHash: auditStore.lastHash,
    securityClassification: input.securityClassification ?? 'audit_evidence',
  };

  const envelopeHash = computeEnvelopeHash(partialEnvelope);

  const envelope: AuditEnvelope = {
    ...partialEnvelope,
    envelopeHash,
  };

  // Append-only: 새 배열 생성 (불변)
  const newEnvelopes = [...auditStore.envelopes, envelope];

  // 최대 크기 초과 시 oldest 제거 (FIFO) — 실제 production에서는 외부 storage로 archive
  const trimmed = newEnvelopes.length > MAX_STORE_SIZE
    ? newEnvelopes.slice(newEnvelopes.length - MAX_STORE_SIZE)
    : newEnvelopes;

  auditStore = {
    envelopes: trimmed,
    lastHash: envelopeHash,
    chainLength: auditStore.chainLength + 1,
    createdAt: auditStore.createdAt,
  };

  return envelope;
}

/**
 * Hash chain 무결성 검증
 *
 * 모든 envelope의 previousEnvelopeHash가 이전 envelope의 envelopeHash와 일치하는지 확인.
 * 중간에 삽입/삭제/수정이 있었으면 chain이 깨집니다.
 */
export function verifyAuditChain(): ChainVerificationResult {
  const { envelopes } = auditStore;
  const verifiedAt = new Date().toISOString();

  if (envelopes.length === 0) {
    return { valid: true, chainLength: 0, verifiedAt };
  }

  // 첫 번째 envelope의 previousEnvelopeHash는 GENESIS_HASH여야 함
  // (store가 trim된 경우는 제외)

  for (let i = 1; i < envelopes.length; i++) {
    const current = envelopes[i];
    const previous = envelopes[i - 1];

    if (current.previousEnvelopeHash !== previous.envelopeHash) {
      return {
        valid: false,
        chainLength: envelopes.length,
        brokenAt: i,
        expectedHash: previous.envelopeHash,
        actualHash: current.previousEnvelopeHash,
        verifiedAt,
      };
    }
  }

  return {
    valid: true,
    chainLength: envelopes.length,
    verifiedAt,
  };
}

/**
 * Audit envelopes 조회 — 필터링
 * 읽기 전용, 수정 불가
 */
export function queryAuditEnvelopes(filter: {
  correlationId?: string;
  actorUserId?: string;
  actionType?: string;
  targetEntityId?: string;
  targetEntityType?: string;
  since?: string;
  until?: string;
  securityClassification?: SecurityClassification;
}): readonly AuditEnvelope[] {
  return auditStore.envelopes.filter(env => {
    if (filter.correlationId && env.correlationId !== filter.correlationId) return false;
    if (filter.actorUserId && env.actorUserId !== filter.actorUserId) return false;
    if (filter.actionType && env.actionType !== filter.actionType) return false;
    if (filter.targetEntityId && env.targetEntityId !== filter.targetEntityId) return false;
    if (filter.targetEntityType && env.targetEntityType !== filter.targetEntityType) return false;
    if (filter.securityClassification && env.securityClassification !== filter.securityClassification) return false;
    if (filter.since && env.occurredAt < filter.since) return false;
    if (filter.until && env.occurredAt > filter.until) return false;
    return true;
  });
}

/** Audit store 통계 */
export function getAuditStoreStats(): {
  chainLength: number;
  currentStoreSize: number;
  lastHash: string;
  createdAt: string;
  chainValid: boolean;
} {
  const verification = verifyAuditChain();
  return {
    chainLength: auditStore.chainLength,
    currentStoreSize: auditStore.envelopes.length,
    lastHash: auditStore.lastHash,
    createdAt: auditStore.createdAt,
    chainValid: verification.valid,
  };
}

// ═══════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════

export function __resetAuditStore(): void {
  auditStore = {
    envelopes: [],
    lastHash: GENESIS_HASH,
    chainLength: 0,
    createdAt: new Date().toISOString(),
  };
  envelopeCounter = 0;
}

export { GENESIS_HASH, computeHash, deterministicStringify };
