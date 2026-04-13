/**
 * Audit Persistence Adapter
 *
 * Security Batch 2: Audit Persistence (adapter boundary)
 *
 * audit-integrity-engine의 in-memory store를 외부 저장소로 영속화하기 위한
 * adapter boundary. 현재는 in-memory + sessionStorage fallback이며,
 * 추후 Supabase/DB adapter로 교체 가능.
 *
 * 설계 원칙:
 * - fake table/schema 생성 금지 (CLAUDE.md 원칙)
 * - adapter boundary까지만, 실제 DB 연결은 Supabase migration 이후
 * - audit evidence는 append-only — delete/update API 없음
 * - 기존 audit-integrity-engine과 동일 interface
 */

import type { AuditEnvelope, AppendAuditInput, ChainVerificationResult } from './audit-integrity-engine';

// ═══════════════════════════════════════════════════════
// Adapter Interface
// ═══════════════════════════════════════════════════════

/**
 * Audit Persistence Adapter
 *
 * append-only storage adapter. delete/update 메서드 없음.
 * 구현체는 In-Memory, SessionStorage, Supabase 등.
 */
export interface AuditPersistenceAdapter {
  /** Append envelope — 반환값은 저장된 envelope (서버 생성 ID 포함 가능) */
  append(envelope: AuditEnvelope): Promise<AuditEnvelope>;

  /** Batch append — 다건 일괄 저장 */
  appendBatch(envelopes: readonly AuditEnvelope[]): Promise<readonly AuditEnvelope[]>;

  /** 조회 — 필터 기반 */
  query(filter: AuditQueryFilter): Promise<readonly AuditEnvelope[]>;

  /** Chain 무결성 검증 */
  verifyChain(): Promise<ChainVerificationResult>;

  /** 전체 통계 */
  getStats(): Promise<AuditStoreStats>;

  /** 마지막 hash 조회 — 새 envelope 생성 시 chain 연결용 */
  getLastHash(): Promise<string>;

  /** 총 envelope 수 */
  getChainLength(): Promise<number>;
}

export interface AuditQueryFilter {
  readonly correlationId?: string;
  readonly actorUserId?: string;
  readonly actionType?: string;
  readonly targetEntityId?: string;
  readonly targetEntityType?: string;
  readonly since?: string;
  readonly until?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface AuditStoreStats {
  readonly chainLength: number;
  readonly currentStoreSize: number;
  readonly lastHash: string;
  readonly createdAt: string;
  readonly adapterType: string;
  readonly chainValid: boolean;
}

// ═══════════════════════════════════════════════════════
// In-Memory Adapter (기본 구현)
// ═══════════════════════════════════════════════════════

const GENESIS_HASH = '0000000000000000';

/**
 * In-Memory Audit Adapter
 *
 * 세션 동안 메모리에 유지. 페이지 새로고침 시 유실.
 * 개발/테스트 및 backend 미연결 시 기본 adapter.
 */
export class InMemoryAuditAdapter implements AuditPersistenceAdapter {
  private envelopes: AuditEnvelope[] = [];
  private lastHash: string = GENESIS_HASH;
  private readonly createdAt: string = new Date().toISOString();

  async append(envelope: AuditEnvelope): Promise<AuditEnvelope> {
    this.envelopes.push(envelope);
    this.lastHash = envelope.envelopeHash;
    return envelope;
  }

  async appendBatch(envelopes: readonly AuditEnvelope[]): Promise<readonly AuditEnvelope[]> {
    for (const env of envelopes) {
      await this.append(env);
    }
    return envelopes;
  }

  async query(filter: AuditQueryFilter): Promise<readonly AuditEnvelope[]> {
    let results = this.envelopes.filter(env => {
      if (filter.correlationId && env.correlationId !== filter.correlationId) return false;
      if (filter.actorUserId && env.actorUserId !== filter.actorUserId) return false;
      if (filter.actionType && env.actionType !== filter.actionType) return false;
      if (filter.targetEntityId && env.targetEntityId !== filter.targetEntityId) return false;
      if (filter.targetEntityType && env.targetEntityType !== filter.targetEntityType) return false;
      if (filter.since && env.occurredAt < filter.since) return false;
      if (filter.until && env.occurredAt > filter.until) return false;
      return true;
    });

    if (filter.offset) results = results.slice(filter.offset);
    if (filter.limit) results = results.slice(0, filter.limit);

    return results;
  }

  async verifyChain(): Promise<ChainVerificationResult> {
    const verifiedAt = new Date().toISOString();
    for (let i = 1; i < this.envelopes.length; i++) {
      if (this.envelopes[i].previousEnvelopeHash !== this.envelopes[i - 1].envelopeHash) {
        return { valid: false, chainLength: this.envelopes.length, brokenAt: i, verifiedAt };
      }
    }
    return { valid: true, chainLength: this.envelopes.length, verifiedAt };
  }

  async getStats(): Promise<AuditStoreStats> {
    const chain = await this.verifyChain();
    return {
      chainLength: this.envelopes.length,
      currentStoreSize: this.envelopes.length,
      lastHash: this.lastHash,
      createdAt: this.createdAt,
      adapterType: 'in-memory',
      chainValid: chain.valid,
    };
  }

  async getLastHash(): Promise<string> {
    return this.lastHash;
  }

  async getChainLength(): Promise<number> {
    return this.envelopes.length;
  }
}

// ═══════════════════════════════════════════════════════
// Supabase Adapter Stub (adapter boundary만)
// ═══════════════════════════════════════════════════════

/**
 * Supabase Audit Adapter — boundary stub
 *
 * 실제 구현은 Supabase migration 이후.
 * 현재는 InMemoryAuditAdapter로 fallback.
 *
 * 예상 테이블:
 * ```sql
 * CREATE TABLE governance_audit_log (
 *   event_id TEXT PRIMARY KEY,
 *   correlation_id TEXT NOT NULL,
 *   actor_user_id TEXT NOT NULL,
 *   actor_role TEXT NOT NULL,
 *   action_type TEXT NOT NULL,
 *   target_entity_type TEXT NOT NULL,
 *   target_entity_id TEXT NOT NULL,
 *   occurred_at TIMESTAMPTZ NOT NULL,
 *   snapshot_version TEXT,
 *   before_hash TEXT NOT NULL,
 *   after_hash TEXT NOT NULL,
 *   rationale TEXT,
 *   reason_code TEXT,
 *   source_surface TEXT,
 *   previous_envelope_hash TEXT NOT NULL,
 *   envelope_hash TEXT NOT NULL,
 *   security_classification TEXT NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 *
 * -- Append-only: no UPDATE/DELETE grants
 * -- Hash chain index for verification
 * CREATE INDEX idx_audit_chain ON governance_audit_log (envelope_hash);
 * CREATE INDEX idx_audit_correlation ON governance_audit_log (correlation_id);
 * CREATE INDEX idx_audit_entity ON governance_audit_log (target_entity_type, target_entity_id);
 * ```
 */
export class SupabaseAuditAdapterStub extends InMemoryAuditAdapter {
  constructor() {
    super();
    // Supabase 연결 시 여기에 client 주입
    // const supabase = createClient(url, key);
  }

  override async getStats(): Promise<AuditStoreStats> {
    const stats = await super.getStats();
    return { ...stats, adapterType: 'supabase-stub (in-memory fallback)' };
  }
}

// ═══════════════════════════════════════════════════════
// Singleton Factory
// ═══════════════════════════════════════════════════════

let currentAdapter: AuditPersistenceAdapter | null = null;

/**
 * Audit persistence adapter 가져오기
 *
 * 기본: InMemoryAuditAdapter
 * Supabase 연결 후: SupabaseAuditAdapter로 교체
 */
export function getAuditPersistenceAdapter(): AuditPersistenceAdapter {
  if (!currentAdapter) {
    currentAdapter = new InMemoryAuditAdapter();
  }
  return currentAdapter;
}

/**
 * Adapter 교체 (DI)
 *
 * 테스트 또는 Supabase 연결 시 호출
 */
export function setAuditPersistenceAdapter(adapter: AuditPersistenceAdapter): void {
  currentAdapter = adapter;
}

/** 테스트용 초기화 */
export function __resetAuditPersistenceAdapter(): void {
  currentAdapter = null;
}
