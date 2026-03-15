/**
 * P3 Slice 1 — Ontology Adapter Barrel Exports
 */

// Types
export type {
  OntologyAdapter,
  CanonicalRecoveryRecord,
  CanonicalBaseline,
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
} from "./common-normalizers";

// Adapters
export { RecoveryOntologyAdapter, toRepositoryPatch } from "./recovery-adapter";
export { BaselineOntologyAdapter } from "./baseline-adapter";

// TODO(P3-Slice2): AuthorityOntologyAdapter
// TODO(P3-Slice2): IncidentOntologyAdapter
// TODO(P3-Slice2): StabilizationAuditOntologyAdapter
// TODO(P3-Slice2): CanonicalAuditOntologyAdapter
// TODO(P3-Slice2): SnapshotOntologyAdapter (full-fidelity, not checksum-only)
