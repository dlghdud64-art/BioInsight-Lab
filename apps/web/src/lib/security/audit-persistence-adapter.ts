/**
 * Audit Persistence Adapter
 *
 * Security Batch 2: Adapter boundary 정의
 * Security Batch 6: Supabase durable adapter 실제 구현
 *
 * audit-integrity-engine의 in-memory store를 외부 저장소로 영속화.
 * In-Memory (기본) → Prisma/Supabase (DB 연결 시) 자동 전환.
 *
 * 설계 원칙:
 * - audit evidence는 append-only — delete/update API 없음
 * - DB 연결 시 Prisma를 통해 GovernanceAuditLog 테이블에 persist
 * - DB 미연결 시 InMemoryAuditAdapter로 graceful fallback
 * - adapter boundary 계약은 동일 interface
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
// Prisma/Supabase Durable Adapter (Batch 6)
// ═══════════════════════════════════════════════════════

/**
 * Prisma 기반 GovernanceAuditLog 테이블 Adapter
 *
 * - Prisma client를 외부에서 주입 (DI)
 * - append-only: create + findMany 만 사용, update/delete 없음
 * - DB row ↔ AuditEnvelope 변환
 * - chain verification은 DB에서 순서대로 조회 후 검증
 * - DB 오류 시 에러 전파 (fail-closed)
 */

/** Prisma client의 최소 필요 interface (실제 PrismaClient에서 사용하는 부분만) */
interface PrismaGovernanceAuditLogDelegate {
  create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  createMany(args: { data: Record<string, unknown>[] }): Promise<{ count: number }>;
  findMany(args?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  count(args?: Record<string, unknown>): Promise<number>;
}

interface MinimalPrismaClient {
  governanceAuditLog: PrismaGovernanceAuditLogDelegate;
}

/** DB row → AuditEnvelope 변환 */
function rowToEnvelope(row: Record<string, unknown>): AuditEnvelope {
  return {
    eventId: row.eventId as string,
    correlationId: row.correlationId as string,
    actorUserId: row.actorUserId as string,
    actorRole: row.actorRole as string,
    actionType: row.actionType as string,
    targetEntityType: row.targetEntityType as string,
    targetEntityId: row.targetEntityId as string,
    occurredAt: row.occurredAt instanceof Date
      ? (row.occurredAt as Date).toISOString()
      : (row.occurredAt as string),
    snapshotVersion: (row.snapshotVersion as string) || 'v0',
    beforeHash: row.beforeHash as string,
    afterHash: row.afterHash as string,
    rationale: (row.rationale as string) || '',
    reasonCode: row.reasonCode as string,
    sourceSurface: row.sourceSurface as string,
    previousEnvelopeHash: row.previousEnvelopeHash as string,
    envelopeHash: row.envelopeHash as string,
    securityClassification: (row.securityClassification as AuditEnvelope['securityClassification']) || 'audit_evidence',
  };
}

/** AuditEnvelope → DB row data 변환 */
function envelopeToRow(env: AuditEnvelope): Record<string, unknown> {
  return {
    eventId: env.eventId,
    correlationId: env.correlationId,
    actorUserId: env.actorUserId,
    actorRole: env.actorRole,
    actionType: env.actionType,
    targetEntityType: env.targetEntityType,
    targetEntityId: env.targetEntityId,
    occurredAt: new Date(env.occurredAt),
    snapshotVersion: env.snapshotVersion,
    beforeHash: env.beforeHash,
    afterHash: env.afterHash,
    rationale: env.rationale || null,
    reasonCode: env.reasonCode,
    sourceSurface: env.sourceSurface,
    previousEnvelopeHash: env.previousEnvelopeHash,
    envelopeHash: env.envelopeHash,
    securityClassification: env.securityClassification,
  };
}

export class PrismaAuditAdapter implements AuditPersistenceAdapter {
  private readonly prisma: MinimalPrismaClient;
  private readonly createdAt: string = new Date().toISOString();

  constructor(prismaClient: MinimalPrismaClient) {
    this.prisma = prismaClient;
  }

  async append(envelope: AuditEnvelope): Promise<AuditEnvelope> {
    const row = await this.prisma.governanceAuditLog.create({
      data: envelopeToRow(envelope),
    });
    return rowToEnvelope(row);
  }

  async appendBatch(envelopes: readonly AuditEnvelope[]): Promise<readonly AuditEnvelope[]> {
    // createMany는 반환값이 count만 — 개별 create로 처리하여 결과 반환
    const results: AuditEnvelope[] = [];
    for (const env of envelopes) {
      results.push(await this.append(env));
    }
    return results;
  }

  async query(filter: AuditQueryFilter): Promise<readonly AuditEnvelope[]> {
    const where: Record<string, unknown> = {};

    if (filter.correlationId) where.correlationId = filter.correlationId;
    if (filter.actorUserId) where.actorUserId = filter.actorUserId;
    if (filter.actionType) where.actionType = filter.actionType;
    if (filter.targetEntityId) where.targetEntityId = filter.targetEntityId;
    if (filter.targetEntityType) where.targetEntityType = filter.targetEntityType;

    if (filter.since || filter.until) {
      const occurredAt: Record<string, unknown> = {};
      if (filter.since) occurredAt.gte = new Date(filter.since);
      if (filter.until) occurredAt.lte = new Date(filter.until);
      where.occurredAt = occurredAt;
    }

    const rows = await this.prisma.governanceAuditLog.findMany({
      where,
      orderBy: { occurredAt: 'asc' },
      skip: filter.offset || 0,
      take: filter.limit || 1000,
    });

    return rows.map(rowToEnvelope);
  }

  async verifyChain(): Promise<ChainVerificationResult> {
    const verifiedAt = new Date().toISOString();

    const rows = await this.prisma.governanceAuditLog.findMany({
      orderBy: { occurredAt: 'asc' },
    });

    const envelopes = rows.map(rowToEnvelope);

    if (envelopes.length === 0) {
      return { valid: true, chainLength: 0, verifiedAt };
    }

    for (let i = 1; i < envelopes.length; i++) {
      if (envelopes[i].previousEnvelopeHash !== envelopes[i - 1].envelopeHash) {
        return {
          valid: false,
          chainLength: envelopes.length,
          brokenAt: i,
          expectedHash: envelopes[i - 1].envelopeHash,
          actualHash: envelopes[i].previousEnvelopeHash,
          verifiedAt,
        };
      }
    }

    return { valid: true, chainLength: envelopes.length, verifiedAt };
  }

  async getStats(): Promise<AuditStoreStats> {
    const count = await this.prisma.governanceAuditLog.count();
    const chain = await this.verifyChain();
    const lastHash = await this.getLastHash();

    return {
      chainLength: count,
      currentStoreSize: count,
      lastHash,
      createdAt: this.createdAt,
      adapterType: 'prisma-supabase',
      chainValid: chain.valid,
    };
  }

  async getLastHash(): Promise<string> {
    const rows = await this.prisma.governanceAuditLog.findMany({
      orderBy: { occurredAt: 'desc' },
      take: 1,
    });

    if (rows.length === 0) return GENESIS_HASH;
    return rows[0].envelopeHash as string;
  }

  async getChainLength(): Promise<number> {
    return this.prisma.governanceAuditLog.count();
  }
}

/**
 * Supabase Audit Adapter — backward compat alias
 * PrismaAuditAdapter을 직접 사용하되, 기존 import 호환 유지
 */
export const SupabaseAuditAdapterStub = PrismaAuditAdapter;

// ═══════════════════════════════════════════════════════
// Singleton Factory (auto-detect)
// ═══════════════════════════════════════════════════════

let currentAdapter: AuditPersistenceAdapter | null = null;

/**
 * Prisma client가 사용 가능한지 확인하고 PrismaAuditAdapter 생성 시도
 * 실패 시 null 반환 (InMemoryAuditAdapter로 fallback)
 */
function tryCreatePrismaAdapter(): AuditPersistenceAdapter | null {
  try {
    // Dynamic import를 피하고 require로 시도 (서버 환경)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { prisma } = require('@/lib/prisma');
    if (prisma && prisma.governanceAuditLog) {
      return new PrismaAuditAdapter(prisma);
    }
  } catch {
    // Prisma 미설정 또는 브라우저 환경 — fallback
  }
  return null;
}

/**
 * Audit persistence adapter 가져오기
 *
 * 우선순위:
 * 1. 명시적으로 set된 adapter (DI)
 * 2. Prisma client 사용 가능 시 → PrismaAuditAdapter (durable)
 * 3. Fallback → InMemoryAuditAdapter
 */
export function getAuditPersistenceAdapter(): AuditPersistenceAdapter {
  if (!currentAdapter) {
    const prismaAdapter = tryCreatePrismaAdapter();
    currentAdapter = prismaAdapter || new InMemoryAuditAdapter();
  }
  return currentAdapter;
}

/**
 * Adapter 교체 (DI)
 *
 * 테스트 또는 명시적 교체 시 호출
 */
export function setAuditPersistenceAdapter(adapter: AuditPersistenceAdapter): void {
  currentAdapter = adapter;
}

/** 테스트용 초기화 */
export function __resetAuditPersistenceAdapter(): void {
  currentAdapter = null;
}

/**
 * 현재 adapter 타입 조회 (observability용)
 */
export async function getAuditAdapterType(): Promise<string> {
  const adapter = getAuditPersistenceAdapter();
  const stats = await adapter.getStats();
  return stats.adapterType;
}
