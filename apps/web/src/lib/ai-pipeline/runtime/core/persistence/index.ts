/**
 * P1-1 — Persistence Layer Barrel Exports
 */

// Common types
export type {
  StorageMode,
  RepositoryResult,
  RepositoryError,
  RepositoryErrorCode,
  ListQuery,
  ListResult,
  OptimisticUpdate,
  TimestampContract,
  EventTimestampContract,
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
  IncidentSeverity,
} from "./types";

export { ok, fail, INCIDENT_STATUS_LIFECYCLE, INCIDENT_SEVERITIES } from "./types";

// Repository interfaces
export type {
  BaselineRepository,
  SnapshotRepository,
  AuthorityRepository,
  IncidentRepository,
  StabilizationAuditRepository,
  CanonicalAuditRepository,
} from "./repositories";

// Factory contract + concrete registry
export type {
  PersistenceAdapters,
  PersistenceAdapterFactory,
  PersistenceProviderConfig,
  AdapterRegistry,
} from "./factory";

export {
  DEFAULT_PERSISTENCE_CONFIG,
  registerAdapterFactory,
  resolveAdapters,
  isAdapterRegistered,
  _resetAdapterRegistry,
} from "./factory";

// Prisma adapters (Slice-1C)
export { createPrismaAdapters } from "./prisma";

// Memory adapters (Slice-1D)
export { createMemoryAdapters } from "./memory";

// Bootstrap + Provider Selection (Slice-1E)
export {
  bootstrapPersistence,
  getPersistenceAdapters,
  isPersistenceBootstrapped,
  _resetPersistenceBootstrap,
} from "./bootstrap";

// Date normalization (Slice-1E)
export { normalizeDate, normalizeDateOptional } from "./date-normalizer";

// Bridge logger + Truth Source Contract (Slice-1F)
export { logBridgeFailure, TRUTH_SOURCE_CONTRACT } from "./bridge-logger";

// Snapshot adapter (Slice-1F)
export { baselineSnapshotToCreateInput } from "./snapshot-adapter";

// Migration validation
export {
  SCHEMA_VALIDATION_COMMANDS,
  MIGRATION_DRY_RUN_CHECKLIST,
  REPOSITORY_IMPL_PREREQUISITES,
  evaluateMigrationReadiness,
} from "./migration-validation";

export type {
  ValidationStatus,
  MigrationValidationResult,
} from "./migration-validation";
