/**
 * P1-1 Slice-1B — Repository Interface Definitions
 *
 * 6 repository contracts for stabilization persistence.
 * Memory and Prisma adapters must implement these interfaces identically.
 *
 * Constraints:
 * - No Prisma imports
 * - No concrete implementations
 * - No runtime store references
 */

import type {
  RepositoryResult,
  ListQuery,
  ListResult,
  OptimisticUpdate,
  PersistedBaseline,
  PersistedSnapshot,
  PersistedAuthorityLine,
  PersistedIncident,
  PersistedStabilizationAuditEvent,
  PersistedCanonicalAuditEvent,
  CreateBaselineInput,
  CreateSnapshotInput,
  CreateAuthorityLineInput,
  CreateIncidentInput,
  CreateStabilizationAuditEventInput,
  CreateCanonicalAuditEventInput,
  IncidentStatus,
} from "./types";

// ══════════════════════════════════════════════════════════════════════════════
// 1. BaselineRepository
// ══════════════════════════════════════════════════════════════════════════════

export interface BaselineRepository {
  /**
   * Get the single canonical baseline.
   * Returns NOT_FOUND if no baseline exists.
   */
  getCanonicalBaseline(): Promise<RepositoryResult<PersistedBaseline>>;

  /**
   * Save a new baseline. Fails with DUPLICATE if one already exists
   * (singleton constraint — only one canonical baseline allowed).
   */
  saveBaseline(input: CreateBaselineInput): Promise<RepositoryResult<PersistedBaseline>>;

  /**
   * Update an existing baseline with optimistic locking.
   * Fails with OPTIMISTIC_LOCK_CONFLICT if updatedAt doesn't match.
   * Fails with NOT_FOUND if baseline doesn't exist.
   */
  updateBaseline(update: OptimisticUpdate<PersistedBaseline>): Promise<RepositoryResult<PersistedBaseline>>;

  /**
   * Find a baseline by its internal ID.
   */
  findBaselineById(id: string): Promise<RepositoryResult<PersistedBaseline>>;

  /**
   * Find a baseline by baselineVersion.
   */
  findBaselineByVersion(version: string): Promise<RepositoryResult<PersistedBaseline>>;
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. SnapshotRepository
// ══════════════════════════════════════════════════════════════════════════════

export interface SnapshotRepository {
  /**
   * Save a new snapshot. Snapshots are immutable after creation.
   */
  saveSnapshot(input: CreateSnapshotInput): Promise<RepositoryResult<PersistedSnapshot>>;

  /**
   * Find a snapshot by its internal ID.
   */
  findSnapshotById(id: string): Promise<RepositoryResult<PersistedSnapshot>>;

  /**
   * List all snapshots for a given baseline ID, ordered by createdAt.
   */
  findSnapshotsByBaselineId(baselineId: string, query?: ListQuery): Promise<RepositoryResult<ListResult<PersistedSnapshot>>>;

  /**
   * Update only the restoreVerificationStatus field.
   * This is the only mutable field on a snapshot.
   */
  updateSnapshotRestoreVerification(
    id: string,
    status: string
  ): Promise<RepositoryResult<PersistedSnapshot>>;
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. AuthorityRepository
// ══════════════════════════════════════════════════════════════════════════════

export interface AuthorityRepository {
  /**
   * Save a new authority line.
   * Fails with DUPLICATE if authorityLineId already exists.
   */
  saveAuthorityLine(input: CreateAuthorityLineInput): Promise<RepositoryResult<PersistedAuthorityLine>>;

  /**
   * Find by internal ID (cuid).
   */
  findAuthorityLineById(id: string): Promise<RepositoryResult<PersistedAuthorityLine>>;

  /**
   * Find by business key (authorityLineId — unique).
   */
  findAuthorityLineByLineId(authorityLineId: string): Promise<RepositoryResult<PersistedAuthorityLine>>;

  /**
   * Update authority line with optimistic locking.
   * Critical for 9-state transfer machine consistency.
   */
  updateAuthorityLine(update: OptimisticUpdate<PersistedAuthorityLine>): Promise<RepositoryResult<PersistedAuthorityLine>>;

  /**
   * Find all authority lines linked to a correlationId.
   */
  findByCorrelationId(correlationId: string, query?: ListQuery): Promise<RepositoryResult<ListResult<PersistedAuthorityLine>>>;

  /**
   * List all authority lines for a baseline.
   */
  findByBaselineId(baselineId: string, query?: ListQuery): Promise<RepositoryResult<ListResult<PersistedAuthorityLine>>>;
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. IncidentRepository
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Incident status lifecycle:
 *   OPEN → ACKNOWLEDGED → ESCALATED → RESOLVED → CLOSED
 *
 * Valid transitions:
 *   OPEN → ACKNOWLEDGED  (acknowledgeIncident)
 *   OPEN → ESCALATED     (updateIncidentStatus)
 *   ACKNOWLEDGED → ESCALATED  (updateIncidentStatus)
 *   ACKNOWLEDGED → RESOLVED   (updateIncidentStatus)
 *   ESCALATED → RESOLVED      (updateIncidentStatus)
 *   RESOLVED → CLOSED         (updateIncidentStatus)
 *
 * Invalid transitions (repository must reject):
 *   CLOSED → any
 *   RESOLVED → OPEN
 *   backward transitions (lower ordinal)
 */
export interface IncidentRepository {
  /**
   * Create a new incident with status=OPEN.
   * Fails with DUPLICATE if incidentId already exists.
   * Severity must be one of: INFO, WARNING, CRITICAL.
   */
  createIncident(input: CreateIncidentInput): Promise<RepositoryResult<PersistedIncident>>;

  /**
   * Find by business key (incidentId — unique).
   */
  findIncidentByIncidentId(incidentId: string): Promise<RepositoryResult<PersistedIncident>>;

  /**
   * Update incident status following the lifecycle rules.
   * Fails with VALIDATION_FAILED if transition is invalid.
   * Fails with NOT_FOUND if incident doesn't exist.
   */
  updateIncidentStatus(
    incidentId: string,
    newStatus: IncidentStatus,
    expectedUpdatedAt: Date
  ): Promise<RepositoryResult<PersistedIncident>>;

  /**
   * Acknowledge an incident: sets status=ACKNOWLEDGED, acknowledgedBy, acknowledgedAt.
   * Fails with VALIDATION_FAILED if current status is not OPEN.
   */
  acknowledgeIncident(
    incidentId: string,
    acknowledgedBy: string,
    expectedUpdatedAt: Date
  ): Promise<RepositoryResult<PersistedIncident>>;

  /**
   * List all incidents with status in [OPEN, ACKNOWLEDGED, ESCALATED].
   */
  listOpenIncidents(query?: ListQuery): Promise<RepositoryResult<ListResult<PersistedIncident>>>;

  /**
   * List incidents linked to a correlationId.
   */
  findByCorrelationId(correlationId: string, query?: ListQuery): Promise<RepositoryResult<ListResult<PersistedIncident>>>;

  /**
   * List incidents linked to a baselineId.
   */
  findByBaselineId(baselineId: string, query?: ListQuery): Promise<RepositoryResult<ListResult<PersistedIncident>>>;
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. StabilizationAuditRepository
// ══════════════════════════════════════════════════════════════════════════════

export interface StabilizationAuditRepository {
  /**
   * Append a new audit event. Append-only — no update or delete.
   * Fails with DUPLICATE if eventId already exists.
   * recordedAt is set by the repository.
   */
  appendAuditEvent(input: CreateStabilizationAuditEventInput): Promise<RepositoryResult<PersistedStabilizationAuditEvent>>;

  /**
   * Find by business key (eventId — unique).
   */
  findAuditEventByEventId(eventId: string): Promise<RepositoryResult<PersistedStabilizationAuditEvent>>;

  /**
   * List events by correlationId, ordered by occurredAt.
   */
  listAuditEventsByCorrelationId(correlationId: string, query?: ListQuery): Promise<RepositoryResult<ListResult<PersistedStabilizationAuditEvent>>>;

  /**
   * List events linked to an incidentId.
   */
  listAuditEventsByIncidentId(incidentId: string, query?: ListQuery): Promise<RepositoryResult<ListResult<PersistedStabilizationAuditEvent>>>;

  /**
   * List events linked to a baselineId.
   */
  listAuditEventsByBaselineId(baselineId: string, query?: ListQuery): Promise<RepositoryResult<ListResult<PersistedStabilizationAuditEvent>>>;

  /**
   * List events by eventType.
   */
  listAuditEventsByEventType(eventType: string, query?: ListQuery): Promise<RepositoryResult<ListResult<PersistedStabilizationAuditEvent>>>;
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. CanonicalAuditRepository
// ══════════════════════════════════════════════════════════════════════════════

export interface CanonicalAuditRepository {
  /**
   * Append a canonical audit event. Append-only — no update or delete.
   * Fails with DUPLICATE if eventId already exists.
   * recordedAt is set by the repository.
   */
  appendCanonicalEvent(input: CreateCanonicalAuditEventInput): Promise<RepositoryResult<PersistedCanonicalAuditEvent>>;

  /**
   * Find by business key (eventId — unique).
   */
  findCanonicalEventByEventId(eventId: string): Promise<RepositoryResult<PersistedCanonicalAuditEvent>>;

  /**
   * List events by correlationId, ordered by occurredAt.
   */
  listCanonicalEventsByCorrelationId(correlationId: string, query?: ListQuery): Promise<RepositoryResult<ListResult<PersistedCanonicalAuditEvent>>>;

  /**
   * List events by timelineId for audit reconstruction.
   */
  listCanonicalEventsByTimelineId(timelineId: string, query?: ListQuery): Promise<RepositoryResult<ListResult<PersistedCanonicalAuditEvent>>>;

  /**
   * List events linked to an incidentId.
   */
  listCanonicalEventsByIncidentId(incidentId: string, query?: ListQuery): Promise<RepositoryResult<ListResult<PersistedCanonicalAuditEvent>>>;

  /**
   * List child events of a parent event (for reconstruction chain).
   */
  listCanonicalEventsByParentEventId(parentEventId: string, query?: ListQuery): Promise<RepositoryResult<ListResult<PersistedCanonicalAuditEvent>>>;
}
