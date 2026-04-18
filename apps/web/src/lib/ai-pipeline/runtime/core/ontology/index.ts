/**
 * P3 Slice 1+2+3 — Ontology Adapter Barrel Exports
 */

// Types
export type {
  OntologyAdapter,
  CanonicalRecoveryRecord,
  CanonicalBaseline,
  CanonicalAuthorityLine,
  CanonicalIncident,
  CanonicalStabilizationAudit,
  CanonicalAuditRecord,
  CanonicalSnapshot,
  CanonicalSnapshotScope,
  OntologyDiagnosticEvent,
  OntologyDiagnosticType,
  AdapterDirection,
} from "./types";

// Diagnostics
export {
  emitOntologyDiagnostic,
  emitDiagnostic,
  getDiagnosticLog,
  _resetDiagnostics,
  assertBridgeRoute,
} from "./diagnostics";

// Date normalizer (ontology-aware)
export {
  normalizeDateWithDiagnostic,
  requireDateWithDiagnostic,
} from "./date-normalizer";

// Common normalizers
export {
  toNullable,
  normalizeId,
  requireId,
  normalizeEnum,
  normalizeArray,
  normalizeJson,
  emptyToNull,
  nullToEmpty,
  RECOVERY_ALIASES,
  BASELINE_ALIASES,
  AUTHORITY_ALIASES,
  INCIDENT_ALIASES,
  STABILIZATION_AUDIT_ALIASES,
  CANONICAL_AUDIT_ALIASES,
  SNAPSHOT_ALIASES,
} from "./common-normalizers";

// Adapters
export { RecoveryOntologyAdapter, toRepositoryPatch } from "./recovery-adapter";
export { BaselineOntologyAdapter } from "./baseline-adapter";
export { AuthorityOntologyAdapter, toAuthorityPatch } from "./authority-adapter";
export { IncidentOntologyAdapter } from "./incident-adapter";
export { StabilizationAuditOntologyAdapter } from "./stabilization-audit-adapter";
export { CanonicalAuditOntologyAdapter } from "./canonical-audit-adapter";
export { SnapshotOntologyAdapter } from "./snapshot-adapter";
