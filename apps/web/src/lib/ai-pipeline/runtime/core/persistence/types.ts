/**
 * P1-1 Slice-1B — Persistence Common Types
 *
 * Repository result types, error contracts, pagination,
 * timestamp handling, optimistic versioning.
 *
 * Constraints:
 * - No Prisma imports (interface-only)
 * - No runtime wiring
 * - No DB enum dependencies
 *
 * ═══════════════════════════════════════════════════════════════
 * Truth Layer Contract — registry / persisted / derived view
 * ═══════════════════════════════════════════════════════════════
 *
 * AI pipeline persistence 는 세 가지 진실 계층으로 분리된다.
 * 이 구분은 lock-hygiene, snapshot-adapter, recovery-startup 등
 * 모든 consumer 가 지켜야 하는 읽기/쓰기 계약이다.
 *
 * 1. Registry Truth (types/stabilization.ts → BaselineRegistry)
 *    - In-memory canonical baseline. runtime coordinator 가 직접 읽는 진실.
 *    - 필드: canonicalBaselineId, baselineVersion, baselineHash,
 *      lifecycleState, releaseMode, baselineStatus 등.
 *    - 생산자: createCanonicalBaseline() / getCanonicalBaselineFromRepo().
 *    - 소비자: lock-hygiene (audit emit), recovery-startup (audit emit),
 *      assertSingleCanonical(), invalidateCanonicalBaseline().
 *    - 절대 규칙: registry truth 를 직접 쓰는 건 baseline-registry.ts 만 허용.
 *      다른 모듈은 read-only.
 *
 * 2. Persisted Truth (이 파일 → PersistedBaseline, PersistedSnapshot 등)
 *    - DB-aligned 영속 모델. Prisma schema 와 1:1 매핑.
 *    - repository (repositories.ts) 가 CRUD 하는 유일한 대상.
 *    - Registry ↔ Persisted 변환은 BaselineOntologyAdapter 가 담당.
 *      (runtime/core/ontology/baseline-adapter.ts)
 *    - 절대 규칙: consumer 가 PersistedBaseline 을 직접 참조하지 않는다.
 *      항상 adapter 를 거쳐 registry truth 로 변환해야 한다.
 *
 * 3. Derived View (lock-hygiene sweep result, snapshot diff, audit event payload)
 *    - Registry 또는 Persisted 에서 계산된 읽기 전용 projection.
 *    - canonical truth 를 변경하지 않는다.
 *    - 예: emitStabilizationAuditEvent 의 payload, lock sweep diagnostics.
 *
 * 위반 시나리오 (금지):
 * - lock-hygiene 가 PersistedBaseline.id 를 직접 사용 → registry.canonicalBaselineId 경유해야.
 * - snapshot-adapter 가 CreateSnapshotInput 필드를 누락 → 타입 에러로 차단.
 * - recovery-startup 가 BaselineRegistry 에 없는 필드(baselineId, timelineId) 접근
 *   → PersistedBaseline 과 혼동한 것. registry 필드만 사용.
 *
 * 이 계약은 코드 타입으로 강제된다 (@ts-nocheck 제거 완료).
 */

// ══════════════════════════════════════════════════════════════════════════════
// 1. Storage Mode
// ══════════════════════════════════════════════════════════════════════════════

export type StorageMode = "MEMORY" | "PRISMA";

// ══════════════════════════════════════════════════════════════════════════════
// 2. Repository Result Contract
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Discriminated union for repository operation results.
 * Every repository method returns RepositoryResult<T>.
 */
export type RepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: RepositoryError };

export interface RepositoryError {
  code: RepositoryErrorCode;
  message: string;
  /** Source entity or operation that caused the error */
  source?: string;
  /** Original error (e.g. Prisma error) for debugging — never exposed to callers */
  cause?: unknown;
}

export type RepositoryErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE"
  | "VALIDATION_FAILED"
  | "OPTIMISTIC_LOCK_CONFLICT"
  | "STORAGE_UNAVAILABLE"
  | "UNKNOWN";

// ── Result Constructors ──

export function ok<T>(data: T): RepositoryResult<T> {
  return { ok: true, data };
}

export function fail<T>(
  code: RepositoryErrorCode,
  message: string,
  source?: string,
  cause?: unknown
): RepositoryResult<T> {
  return { ok: false, error: { code, message, source, cause } };
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. Pagination / List Query Contract
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Minimal cursor-based pagination input.
 * Both Memory and Prisma adapters must support this contract.
 */
export interface ListQuery {
  /** Maximum items to return. Default: 100, Max: 1000 */
  limit?: number;
  /** Opaque cursor for next page (implementation-specific) */
  cursor?: string;
  /** Sort direction on primary timestamp field */
  order?: "ASC" | "DESC";
}

export interface ListResult<T> {
  items: T[];
  /** Total count (if available). Omitted when too expensive to compute. */
  totalCount?: number;
  /** Cursor for next page. null if no more pages. */
  nextCursor: string | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. Timestamp Handling Contract
// ══════════════════════════════════════════════════════════════════════════════

/**
 * All Date fields in domain objects are JavaScript Date instances.
 * Prisma adapter: relies on Prisma's native Date↔DateTime mapping.
 * Memory adapter: stores Date objects as-is in Map/Array.
 *
 * Contract:
 * - Repositories always accept and return Date objects (never strings or numbers).
 * - createdAt is set by the repository on creation (not by the caller).
 * - updatedAt is set by the repository on every mutation.
 * - occurredAt / recordedAt for events: occurredAt is caller-provided, recordedAt is repo-set.
 */
export interface TimestampContract {
  /** Repository sets on creation */
  createdAt: Date;
  /** Repository sets on every mutation */
  updatedAt: Date;
}

export interface EventTimestampContract {
  /** Caller-provided: when the event actually occurred */
  occurredAt: Date;
  /** Repository-set: when the event was persisted */
  recordedAt: Date;
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. Optimistic Versioning Contract
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Entities that require optimistic concurrency control.
 *
 * Target entities:
 * - StabilizationBaseline (multi-field mutation: lifecycleState, baselineStatus, etc.)
 * - StabilizationAuthorityLine (9-state transfer machine — state transitions must be atomic)
 * - StabilizationIncident (status lifecycle transitions)
 *
 * Entities that do NOT need optimistic versioning:
 * - Snapshots (immutable after creation)
 * - Audit events (append-only, no update)
 * - Canonical audit events (append-only, no update)
 *
 * Strategy:
 * - updatedAt-based: compare updatedAt on read vs write.
 *   If mismatched, return OPTIMISTIC_LOCK_CONFLICT error.
 * - Memory adapter: in-memory updatedAt comparison.
 * - Prisma adapter: WHERE updatedAt = $expectedUpdatedAt in UPDATE.
 */
export interface OptimisticUpdate<T> {
  /** The entity ID to update */
  id: string;
  /** Expected updatedAt from the last read */
  expectedUpdatedAt: Date;
  /** Partial fields to update */
  patch: Partial<T>;
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. Persistence Entity Types (DB-aligned, decoupled from runtime domain types)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * These mirror the Prisma schema models from Slice-1A.
 * Runtime domain types (stabilization.ts) remain unchanged.
 * Repository implementations map between these and domain types.
 */

export interface PersistedBaseline {
  id: string;
  baselineSource: string;
  baselineVersion: string;
  baselineHash: string;
  lifecycleState: string;
  releaseMode: string;
  baselineStatus: string;
  activeSnapshotId: string | null;
  rollbackSnapshotId: string | null;
  freezeReason: string | null;
  activePathManifestId: string | null;
  policySetVersion: string | null;
  routingRuleVersion: string | null;
  authorityRegistryVersion: string | null;
  stabilizationOnly: boolean;
  featureExpansionAllowed: boolean;
  experimentalPathAllowed: boolean;
  structuralRefactorAllowed: boolean;
  devOnlyPathAllowed: boolean;
  emergencyRollbackAllowed: boolean;
  containmentPriorityEnabled: boolean;
  auditStrictMode: boolean;
  mergeGateStrictMode: boolean;
  /** P1-2: "CANONICAL" when active canonical, null otherwise. DB-enforced unique. */
  canonicalSlot: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersistedSnapshot {
  id: string;
  baselineId: string;
  snapshotType: string;
  configChecksum: string | null;
  flagChecksum: string | null;
  routingChecksum: string | null;
  authorityChecksum: string | null;
  policyChecksum: string | null;
  queueTopologyChecksum: string | null;
  includedScopes: string[];
  restoreVerificationStatus: string | null;
  /** P3-3B: full scopes array [{scope, data, checksum}] */
  scopePayload: unknown;
  /** P3-3B: full config object */
  configPayload: unknown;
  /** P3-3B: operator identifier */
  capturedBy: string | null;
  /** P3-3B: legacy snapshotId for repo-first lookup */
  snapshotId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersistedAuthorityLine {
  id: string;
  authorityLineId: string;
  currentAuthorityId: string;
  authorityState: string;
  transferState: string;
  pendingSuccessorId: string | null;
  revokedAuthorityIds: string[];
  registryVersion: string;
  baselineId: string | null;
  correlationId: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersistedIncident {
  id: string;
  incidentId: string;
  reasonCode: string;
  severity: string;
  status: string;
  correlationId: string;
  baselineId: string | null;
  snapshotId: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Valid incident status lifecycle: OPEN → ACKNOWLEDGED → ESCALATED → RESOLVED → CLOSED */
export const INCIDENT_STATUS_LIFECYCLE = [
  "OPEN",
  "ACKNOWLEDGED",
  "ESCALATED",
  "RESOLVED",
  "CLOSED",
] as const;

export type IncidentStatus = (typeof INCIDENT_STATUS_LIFECYCLE)[number];

/** Valid incident severities */
export const INCIDENT_SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export interface PersistedStabilizationAuditEvent {
  id: string;
  eventId: string;
  eventType: string;
  correlationId: string;
  incidentId: string | null;
  baselineId: string | null;
  snapshotId: string | null;
  actor: string | null;
  reasonCode: string | null;
  severity: string | null;
  sourceModule: string | null;
  entityType: string | null;
  entityId: string | null;
  resultStatus: string | null;
  occurredAt: Date;
  recordedAt: Date;
}

export interface PersistedCanonicalAuditEvent {
  id: string;
  eventId: string;
  eventType: string;
  eventStage: string | null;
  correlationId: string;
  incidentId: string | null;
  timelineId: string;
  baselineId: string | null;
  baselineVersion: string | null;
  baselineHash: string | null;
  lifecycleState: string | null;
  releaseMode: string | null;
  actor: string | null;
  sourceModule: string;
  entityType: string;
  entityId: string;
  reasonCode: string;
  severity: string;
  occurredAt: Date;
  recordedAt: Date;
  snapshotBeforeId: string | null;
  snapshotAfterId: string | null;
  affectedScopes: string[];
  resultStatus: string;
  parentEventId: string | null;
}

export interface PersistedRecoveryRecord {
  id: string;
  recoveryId: string;
  correlationId: string;
  incidentId: string | null;
  baselineId: string;
  lifecycleState: string;
  releaseMode: string;
  recoveryState: string;
  recoveryStage: string | null;
  lockKey: string | null;
  lockToken: string | null;
  operatorId: string;
  overrideUsed: boolean;
  overrideReason: string | null;
  signOffMetadata: unknown;
  startedAt: Date;
  completedAt: Date | null;
  lastHeartbeatAt: Date | null;
  failureReasonCode: string | null;
  stageResults: unknown;
  preconditionResults: unknown;
  createdAt: Date;
  updatedAt: Date;
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. Create Input Types (omit auto-generated fields)
// ══════════════════════════════════════════════════════════════════════════════

export type CreateBaselineInput = Omit<PersistedBaseline, "id" | "createdAt" | "updatedAt">;
export type CreateSnapshotInput = Omit<PersistedSnapshot, "id" | "createdAt" | "updatedAt">;
export type CreateAuthorityLineInput = Omit<PersistedAuthorityLine, "id" | "createdAt" | "updatedAt">;
export type CreateIncidentInput = Omit<PersistedIncident, "id" | "createdAt" | "updatedAt" | "acknowledgedBy" | "acknowledgedAt">;
export type CreateStabilizationAuditEventInput = Omit<PersistedStabilizationAuditEvent, "id" | "recordedAt">;
export type CreateCanonicalAuditEventInput = Omit<PersistedCanonicalAuditEvent, "id" | "recordedAt">;
export type CreateRecoveryRecordInput = Omit<PersistedRecoveryRecord, "id" | "createdAt" | "updatedAt">;
