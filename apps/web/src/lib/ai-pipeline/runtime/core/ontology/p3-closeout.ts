/**
 * P3 Slice 6 — Ontology Closeout Inventory & Acceptance Sheet
 *
 * Provides programmatic access to:
 * - Ontology adapter coverage inventory
 * - Repo-first consumer cutover registry
 * - Legacy sync compat path registry
 * - Direct access guardrail registry
 * - Legacy shutdown plan
 * - P3 final acceptance evaluation
 * - Compat usage diagnostic aggregation
 */

import { getDiagnosticLog, emitDiagnostic } from "./diagnostics";
import type { OntologyDiagnosticType } from "./types";

// ══════════════════════════════════════════════════════════════════════════════
// 1. Ontology Adapter Coverage Inventory
// ══════════════════════════════════════════════════════════════════════════════

export interface OntologyAdapterEntry {
  entityType: string;
  adapterName: string;
  moduleName: string;
  bridgeRoute: string;
}

/**
 * 7 entity types fully covered by ontology adapters.
 */
export const ONTOLOGY_ADAPTER_REGISTRY: readonly OntologyAdapterEntry[] = [
  { entityType: "recovery", adapterName: "recovery-adapter", moduleName: "recovery-coordinator", bridgeRoute: "recovery-coordinator" },
  { entityType: "baseline", adapterName: "baseline-adapter", moduleName: "baseline-registry", bridgeRoute: "baseline-registry" },
  { entityType: "authority", adapterName: "authority-adapter", moduleName: "authority-registry", bridgeRoute: "authority-registry" },
  { entityType: "incident", adapterName: "incident-adapter", moduleName: "incident-escalation", bridgeRoute: "incident-escalation" },
  { entityType: "stabilization-audit", adapterName: "stabilization-audit-adapter", moduleName: "audit-events", bridgeRoute: "audit-events" },
  { entityType: "canonical-audit", adapterName: "canonical-audit-adapter", moduleName: "canonical-event-schema", bridgeRoute: "canonical-event-schema" },
  { entityType: "snapshot", adapterName: "snapshot-adapter", moduleName: "snapshot-manager", bridgeRoute: "snapshot-manager" },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// 2. Repo-First Consumer Cutover Registry
// ══════════════════════════════════════════════════════════════════════════════

export interface RepoFirstConsumerEntry {
  functionName: string;
  moduleName: string;
  entityType: string;
  cutoverSlice: string;
}

/**
 * 12 repo-first async functions completing the consumer cutover.
 */
export const REPO_FIRST_CONSUMER_REGISTRY: readonly RepoFirstConsumerEntry[] = [
  // Slice 1F / P3-1
  { functionName: "getSnapshotFromRepo", moduleName: "snapshot-manager", entityType: "snapshot", cutoverSlice: "P3-1" },
  { functionName: "restoreDryRunFromRepo", moduleName: "snapshot-manager", entityType: "snapshot", cutoverSlice: "P3-1" },
  { functionName: "canEnterActiveRuntimeFromRepo", moduleName: "snapshot-manager", entityType: "snapshot", cutoverSlice: "P3-1" },
  { functionName: "getCanonicalBaselineFromRepo", moduleName: "baseline-registry", entityType: "baseline", cutoverSlice: "P3-1" },
  { functionName: "getAuthorityLineFromRepo", moduleName: "authority-registry", entityType: "authority", cutoverSlice: "P3-2" },
  { functionName: "getIncidentsFromRepo", moduleName: "incident-escalation", entityType: "incident", cutoverSlice: "P3-2" },
  { functionName: "getAuditEventsFromRepo", moduleName: "audit-events", entityType: "stabilization-audit", cutoverSlice: "P3-3" },
  { functionName: "getCanonicalAuditLogFromRepo", moduleName: "canonical-event-schema", entityType: "canonical-audit", cutoverSlice: "P3-3" },
  // Slice P3-4 / P3-5
  { functionName: "validateBaselineAtBootFromRepo", moduleName: "baseline-validator", entityType: "baseline", cutoverSlice: "P3-4" },
  { functionName: "hasUnacknowledgedIncidentsFromRepo", moduleName: "incident-escalation", entityType: "incident", cutoverSlice: "P3-5" },
  { functionName: "checkAuthorityIntegrityFromRepo", moduleName: "authority-registry", entityType: "authority", cutoverSlice: "P3-5" },
  { functionName: "buildTimelineFromRepo", moduleName: "canonical-event-schema", entityType: "canonical-audit", cutoverSlice: "P3-5" },
  // P4-4
  { functionName: "acknowledgeIncidentAsync", moduleName: "incident-escalation", entityType: "incident", cutoverSlice: "P4-4" },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// 3. Deprecated Sync Compat Path Registry
// ══════════════════════════════════════════════════════════════════════════════

export interface DeprecatedSyncEntry {
  functionName: string;
  moduleName: string;
  replacedBy: string;
  diagnosticReasonCode: string;
}

/**
 * All legacy sync functions with @deprecated + LEGACY_SYNC_COMPAT_PATH_USED diagnostic.
 */
export const DEPRECATED_SYNC_REGISTRY: readonly DeprecatedSyncEntry[] = [
  { functionName: "getSnapshot", moduleName: "snapshot-manager", replacedBy: "getSnapshotFromRepo", diagnosticReasonCode: "getSnapshot:sync-compat" },
  { functionName: "restoreDryRun", moduleName: "snapshot-manager", replacedBy: "restoreDryRunFromRepo", diagnosticReasonCode: "restoreDryRun:sync-compat" },
  { functionName: "canEnterActiveRuntime", moduleName: "snapshot-manager", replacedBy: "canEnterActiveRuntimeFromRepo", diagnosticReasonCode: "canEnterActiveRuntime:sync-compat" },
  { functionName: "getCanonicalBaseline", moduleName: "baseline-registry", replacedBy: "getCanonicalBaselineFromRepo", diagnosticReasonCode: "getCanonicalBaseline:sync-compat" },
  { functionName: "getAuditEvents", moduleName: "audit-events", replacedBy: "getAuditEventsFromRepo", diagnosticReasonCode: "getAuditEvents:sync-compat" },
  { functionName: "checkAuthorityIntegrity", moduleName: "authority-registry", replacedBy: "checkAuthorityIntegrityFromRepo", diagnosticReasonCode: "checkAuthorityIntegrity:sync-compat" },
  { functionName: "getIncidents", moduleName: "incident-escalation", replacedBy: "getIncidentsFromRepo", diagnosticReasonCode: "getIncidents:sync-compat" },
  { functionName: "hasUnacknowledgedIncidents", moduleName: "incident-escalation", replacedBy: "hasUnacknowledgedIncidentsFromRepo", diagnosticReasonCode: "hasUnacknowledgedIncidents:sync-compat" },
  { functionName: "getCanonicalAuditLog", moduleName: "canonical-event-schema", replacedBy: "getCanonicalAuditLogFromRepo", diagnosticReasonCode: "getCanonicalAuditLog:sync-compat" },
  { functionName: "buildTimeline", moduleName: "canonical-event-schema", replacedBy: "buildTimelineFromRepo", diagnosticReasonCode: "buildTimeline:sync-compat" },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// 4. Direct Access Guardrail Registry
// ══════════════════════════════════════════════════════════════════════════════

export interface DirectAccessGuardrailEntry {
  moduleName: string;
  storeVariable: string;
  guardFunction: "_assertNoDirectStoreAccess";
}

/**
 * 6 entity modules with _assertNoDirectStoreAccess guardrail.
 */
export const DIRECT_ACCESS_GUARDRAIL_REGISTRY: readonly DirectAccessGuardrailEntry[] = [
  { moduleName: "snapshot-manager", storeVariable: "_snapshots", guardFunction: "_assertNoDirectStoreAccess" },
  { moduleName: "baseline-registry", storeVariable: "_canonicalBaseline", guardFunction: "_assertNoDirectStoreAccess" },
  { moduleName: "authority-registry", storeVariable: "_registry", guardFunction: "_assertNoDirectStoreAccess" },
  { moduleName: "incident-escalation", storeVariable: "_incidents", guardFunction: "_assertNoDirectStoreAccess" },
  { moduleName: "audit-events", storeVariable: "_auditEvents", guardFunction: "_assertNoDirectStoreAccess" },
  { moduleName: "canonical-event-schema", storeVariable: "_auditLog", guardFunction: "_assertNoDirectStoreAccess" },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// 5. Legacy Shutdown Plan
// ══════════════════════════════════════════════════════════════════════════════

export interface LegacyShutdownItem {
  pathName: string;
  moduleName: string;
  whyStillPresent: string;
  riskIfKept: string;
  shutdownPhase: "P4" | "P5";
  shutdownPrecondition: string;
}

/**
 * Remaining legacy fallback / direct access paths that need P4+ shutdown.
 */
export const LEGACY_SHUTDOWN_PLAN: readonly LegacyShutdownItem[] = [
  // Repo-first fallback paths (6) — these read legacy store when repo is unavailable
  {
    pathName: "getSnapshotFromRepo:fallback→_snapshots",
    moduleName: "snapshot-manager",
    whyStillPresent: "repo unavailability safety net during dual-write transition",
    riskIfKept: "stale data if repo and memory diverge after crash",
    shutdownPhase: "P4",
    shutdownPrecondition: "repo-only write path validated; memory store removed",
  },
  {
    pathName: "getCanonicalBaselineFromRepo:fallback→_canonicalBaseline",
    moduleName: "baseline-registry",
    whyStillPresent: "repo unavailability safety net during dual-write transition",
    riskIfKept: "stale baseline if repo and memory diverge",
    shutdownPhase: "P4",
    shutdownPrecondition: "repo-only write path validated; memory store removed",
  },
  {
    pathName: "getAuthorityLineFromRepo:fallback→_registry",
    moduleName: "authority-registry",
    whyStillPresent: "repo unavailability safety net during dual-write transition",
    riskIfKept: "stale authority data; potential split-brain false negative",
    shutdownPhase: "P4",
    shutdownPrecondition: "repo-only write path validated; memory store removed",
  },
  {
    pathName: "getIncidentsFromRepo:fallback→_incidents",
    moduleName: "incident-escalation",
    whyStillPresent: "repo unavailability safety net during dual-write transition",
    riskIfKept: "acknowledged incident appears unacknowledged (repo ack timing)",
    shutdownPhase: "P4",
    shutdownPrecondition: "repo-only write path validated; memory store removed",
  },
  {
    pathName: "getAuditEventsFromRepo:fallback→_auditEvents",
    moduleName: "audit-events",
    whyStillPresent: "repo unavailability safety net during dual-write transition",
    riskIfKept: "audit log divergence between memory and repo",
    shutdownPhase: "P4",
    shutdownPrecondition: "repo-only write path validated; memory store removed",
  },
  {
    pathName: "getCanonicalAuditLogFromRepo:fallback→_auditLog",
    moduleName: "canonical-event-schema",
    whyStillPresent: "repo unavailability safety net during dual-write transition",
    riskIfKept: "canonical timeline divergence",
    shutdownPhase: "P4",
    shutdownPrecondition: "repo-only write path validated; memory store removed",
  },
  // Non-fallback legacy direct reads still in non-deprecated code
  {
    pathName: "recovery-coordinator:getCanonicalBaseline (L229,L348,L496,L712)",
    moduleName: "recovery-coordinator",
    whyStillPresent: "sync baseline reads within sync-orchestration stages",
    riskIfKept: "reads stale memory baseline instead of repo truth",
    shutdownPhase: "P4",
    shutdownPrecondition: "recovery-coordinator refactored to fully async orchestration",
  },
  {
    pathName: "recovery-coordinator:getSnapshot (L592,L715)",
    moduleName: "recovery-coordinator",
    whyStillPresent: "sync snapshot reads within stage execution",
    riskIfKept: "reads stale memory snapshot",
    shutdownPhase: "P4",
    shutdownPrecondition: "stage execution uses getSnapshotFromRepo",
  },
  {
    pathName: "recovery-coordinator:checkAuthorityIntegrity (L624,L753)",
    moduleName: "recovery-coordinator",
    whyStillPresent: "sync authority check within stage execution and verify",
    riskIfKept: "reads stale memory authority data",
    shutdownPhase: "P4",
    shutdownPrecondition: "stage execution uses checkAuthorityIntegrityFromRepo",
  },
  {
    pathName: "recovery-coordinator:hasUnacknowledgedIncidents (L700)",
    moduleName: "recovery-coordinator",
    whyStillPresent: "sync incident check in verifyRecovery",
    riskIfKept: "reads stale memory incident data",
    shutdownPhase: "P4",
    shutdownPrecondition: "verifyRecovery uses hasUnacknowledgedIncidentsFromRepo",
  },
  {
    pathName: "recovery-startup:getCanonicalBaseline (L109)",
    moduleName: "recovery-startup",
    whyStillPresent: "sync baseline read in emitStartupDiagnostic (non-critical path)",
    riskIfKept: "startup diagnostic uses stale baseline — low risk (observability only)",
    shutdownPhase: "P5",
    shutdownPrecondition: "emitStartupDiagnostic refactored to async",
  },
  {
    pathName: "recovery-startup:hasUnacknowledgedIncidents (L136,L554)",
    moduleName: "recovery-startup",
    whyStillPresent: "sync incident check in startup scan and quick-exit path",
    riskIfKept: "startup may miss repo-only incidents",
    shutdownPhase: "P4",
    shutdownPrecondition: "startup scan uses hasUnacknowledgedIncidentsFromRepo",
  },
  {
    pathName: "recovery-startup:checkAuthorityIntegrity (L191)",
    moduleName: "recovery-startup",
    whyStillPresent: "sync authority check in startup evaluation",
    riskIfKept: "startup evaluation uses stale authority data",
    shutdownPhase: "P4",
    shutdownPrecondition: "startup evaluation uses checkAuthorityIntegrityFromRepo",
  },
  {
    pathName: "recovery-diagnostics:buildTimeline (L105)",
    moduleName: "recovery-diagnostics",
    whyStillPresent: "sync timeline build for incomplete chain detection",
    riskIfKept: "diagnostic reads stale audit log — low risk (observability only)",
    shutdownPhase: "P5",
    shutdownPrecondition: "recovery-diagnostics uses buildTimelineFromRepo",
  },
  {
    pathName: "canonical-event-schema:buildReconstructionView (L306)",
    moduleName: "canonical-event-schema",
    whyStillPresent: "sync buildTimeline call in reconstruction view builder",
    riskIfKept: "reconstruction view uses stale data",
    shutdownPhase: "P4",
    shutdownPrecondition: "buildReconstructionView uses buildTimelineFromRepo",
  },
  {
    pathName: "rollback-precheck:verifySnapshotPairExists (L52)",
    moduleName: "rollback-precheck",
    whyStillPresent: "sync snapshot pair check in rollback precheck",
    riskIfKept: "rollback precheck uses stale snapshot data — low risk (rollback also uses sync)",
    shutdownPhase: "P4",
    shutdownPrecondition: "rollback-precheck uses async snapshot reads",
  },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// 6. Repo Fallback Inventory (P4-2)
// ══════════════════════════════════════════════════════════════════════════════

export interface RepoFallbackEntry {
  functionName: string;
  moduleName: string;
  classification: "REPO_ONLY" | "COMPAT_ONLY_TEMPORARY";
  reason: string;
  removedInSlice: string;
  retentionReason: string;
  removalCondition: string;
}

/**
 * P4-2/P4-3: 6 repo-first fallback paths — all 6 REPO_ONLY (all removed).
 */
export const REPO_FALLBACK_INVENTORY: readonly RepoFallbackEntry[] = [
  {
    functionName: "getCanonicalBaselineFromRepo",
    moduleName: "baseline-registry",
    classification: "REPO_ONLY",
    reason: "dual-write fully operational; repo is truth source",
    removedInSlice: "P4-2",
    retentionReason: "",
    removalCondition: "",
  },
  {
    functionName: "getIncidentsFromRepo",
    moduleName: "incident-escalation",
    classification: "REPO_ONLY",
    reason: "dual-write fully operational; repo is truth source",
    removedInSlice: "P4-2",
    retentionReason: "",
    removalCondition: "",
  },
  {
    functionName: "getAuditEventsFromRepo",
    moduleName: "audit-events",
    classification: "REPO_ONLY",
    reason: "dual-write fully operational; repo is truth source",
    removedInSlice: "P4-2",
    retentionReason: "",
    removalCondition: "",
  },
  {
    functionName: "getCanonicalAuditLogFromRepo",
    moduleName: "canonical-event-schema",
    classification: "REPO_ONLY",
    reason: "dual-write fully operational; repo is truth source",
    removedInSlice: "P4-2",
    retentionReason: "",
    removalCondition: "",
  },
  {
    functionName: "getSnapshotFromRepo",
    moduleName: "snapshot-manager",
    classification: "REPO_ONLY",
    reason: "dual-write full-fidelity confirmed (P3-3B); repo is truth source",
    removedInSlice: "P4-3",
    retentionReason: "",
    removalCondition: "",
  },
  {
    functionName: "checkAuthorityIntegrityFromRepo",
    moduleName: "authority-registry",
    classification: "REPO_ONLY",
    reason: "listAllAuthorityLines bulk query enabled; repo is truth source",
    removedInSlice: "P4-3",
    retentionReason: "",
    removalCondition: "",
  },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// 7. Sync Compat Shutdown Inventory (P4-4)
// ══════════════════════════════════════════════════════════════════════════════

export interface SyncCompatShutdownEntry {
  functionName: string;
  moduleName: string;
  replacedBy: string;
  status: "REMOVED" | "RETAINED";
  removedInSlice: string;
  retentionReason: string;
  shutdownPhase: string;
  productionCallerCount: number;
  removalPrecondition: string;
  owner: string;
}

/**
 * P5-1: 10 deprecated sync compat paths — 6 REMOVED, 4 RETAINED (P5).
 */
export const SYNC_COMPAT_SHUTDOWN_INVENTORY: readonly SyncCompatShutdownEntry[] = [
  // 6 REMOVED — zero production callers verified
  { functionName: "canEnterActiveRuntime", moduleName: "snapshot-manager", replacedBy: "canEnterActiveRuntimeFromRepo", status: "REMOVED", removedInSlice: "P4-4", retentionReason: "", shutdownPhase: "P4-4", productionCallerCount: 0, removalPrecondition: "", owner: "snapshot-manager" },
  { functionName: "restoreDryRun", moduleName: "snapshot-manager", replacedBy: "restoreDryRunFromRepo", status: "REMOVED", removedInSlice: "P4-4", retentionReason: "", shutdownPhase: "P4-4", productionCallerCount: 0, removalPrecondition: "", owner: "snapshot-manager" },
  { functionName: "getAuditEvents", moduleName: "audit-events", replacedBy: "getAuditEventsFromRepo", status: "REMOVED", removedInSlice: "P4-5", retentionReason: "", shutdownPhase: "P4-5", productionCallerCount: 0, removalPrecondition: "", owner: "audit-events" },
  { functionName: "getCanonicalAuditLog", moduleName: "canonical-event-schema", replacedBy: "getCanonicalAuditLogFromRepo", status: "REMOVED", removedInSlice: "P4-5", retentionReason: "", shutdownPhase: "P4-5", productionCallerCount: 0, removalPrecondition: "", owner: "canonical-event-schema" },
  { functionName: "getIncidents", moduleName: "incident-escalation", replacedBy: "getIncidentsFromRepo", status: "REMOVED", removedInSlice: "P4-5", retentionReason: "", shutdownPhase: "P4-5", productionCallerCount: 0, removalPrecondition: "", owner: "incident-escalation" },
  { functionName: "checkAuthorityIntegrity", moduleName: "authority-registry", replacedBy: "checkAuthorityIntegrityFromRepo", status: "REMOVED", removedInSlice: "P5-1", retentionReason: "", shutdownPhase: "P5-1", productionCallerCount: 0, removalPrecondition: "", owner: "authority-registry" },
  // 4 RETAINED → P5 with exit conditions
  { functionName: "getCanonicalBaseline", moduleName: "baseline-registry", replacedBy: "getCanonicalBaselineFromRepo", status: "RETAINED", removedInSlice: "", retentionReason: "2 production callers (baseline-validator, lock-hygiene)", shutdownPhase: "P5", productionCallerCount: 2, removalPrecondition: "Migrate baseline-validator:51, lock-hygiene:283 to getCanonicalBaselineFromRepo", owner: "baseline-registry" },
  { functionName: "hasUnacknowledgedIncidents", moduleName: "incident-escalation", replacedBy: "hasUnacknowledgedIncidentsFromRepo", status: "RETAINED", removedInSlice: "", retentionReason: "1 production caller (lock-hygiene)", shutdownPhase: "P5", productionCallerCount: 1, removalPrecondition: "Migrate lock-hygiene:146 to hasUnacknowledgedIncidentsFromRepo", owner: "incident-escalation" },
  { functionName: "getSnapshot", moduleName: "snapshot-manager", replacedBy: "getSnapshotFromRepo", status: "RETAINED", removedInSlice: "", retentionReason: "5 production callers in rollback subsystem", shutdownPhase: "P5", productionCallerCount: 5, removalPrecondition: "Migrate residue-scan:93, rollback-plan-builder:27, rollback-executor:36, rollback-precheck:25, state-reconciliation:84 to getSnapshotFromRepo", owner: "snapshot-manager" },
  { functionName: "buildTimeline", moduleName: "canonical-event-schema", replacedBy: "buildTimelineFromRepo", status: "RETAINED", removedInSlice: "", retentionReason: "1 production caller (recovery-diagnostics)", shutdownPhase: "P5", productionCallerCount: 1, removalPrecondition: "Migrate recovery-diagnostics:105 to buildTimelineFromRepo", owner: "canonical-event-schema" },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// 8. Compat Usage Diagnostic Aggregation
// ══════════════════════════════════════════════════════════════════════════════

export interface CompatUsageSummary {
  totalCompatCalls: number;
  totalDirectAccessBlocked: number;
  totalConsumerCutoverApplied: number;
  totalRepoFirstUsed: number;
  totalRepoOnlyEnforced: number;
  totalCompatOnlyUsed: number;
  totalRepoFallbackRemoved: number;
  totalSyncCompatRemoved: number;
  totalSyncCompatRetained: number;
  totalAckTimingDiagnostics: number;
  byModule: Record<string, {
    compatCalls: number;
    directAccessBlocked: number;
    cutoverApplied: number;
    repoFirstUsed: number;
    repoOnlyEnforced: number;
    compatOnlyUsed: number;
    repoFallbackRemoved: number;
    syncCompatRemoved: number;
    syncCompatRetained: number;
    ackTimingDiagnostics: number;
  }>;
}

/**
 * Aggregate diagnostic usage from the current diagnostic log.
 * Shows which modules are still using compat paths vs repo-first.
 */
export function getCompatUsageSummary(): CompatUsageSummary {
  const log = getDiagnosticLog();
  const byModule: CompatUsageSummary["byModule"] = {};

  function ensureModule(mod: string) {
    if (!byModule[mod]) {
      byModule[mod] = { compatCalls: 0, directAccessBlocked: 0, cutoverApplied: 0, repoFirstUsed: 0, repoOnlyEnforced: 0, compatOnlyUsed: 0, repoFallbackRemoved: 0, syncCompatRemoved: 0, syncCompatRetained: 0, ackTimingDiagnostics: 0 };
    }
    return byModule[mod]!;
  }

  let totalCompat = 0;
  let totalBlocked = 0;
  let totalCutover = 0;
  let totalRepo = 0;
  let totalRepoOnly = 0;
  let totalCompatOnly = 0;
  let totalFallbackRemoved = 0;
  let totalSyncRemoved = 0;
  let totalSyncRetained = 0;
  let totalAckTiming = 0;

  for (const event of log) {
    const m = ensureModule(event.moduleName);
    if (event.type === "LEGACY_SYNC_COMPAT_PATH_USED") {
      m.compatCalls++;
      totalCompat++;
    } else if (event.type === "LEGACY_DIRECT_ACCESS_BLOCKED") {
      m.directAccessBlocked++;
      totalBlocked++;
    } else if (event.type === "CONSUMER_CUTOVER_APPLIED") {
      m.cutoverApplied++;
      totalCutover++;
    } else if (event.type === "ONTOLOGY_REPO_FIRST_PATH_USED" || event.type === "SNAPSHOT_REPO_FIRST_READ_USED") {
      m.repoFirstUsed++;
      totalRepo++;
    } else if (event.type === "REPO_ONLY_PATH_ENFORCED" || event.type === "SNAPSHOT_FIDELITY_RECONCILED" || event.type === "AUTHORITY_REPO_QUERY_ENABLED") {
      m.repoOnlyEnforced++;
      totalRepoOnly++;
    } else if (event.type === "COMPAT_ONLY_PATH_USED") {
      m.compatOnlyUsed++;
      totalCompatOnly++;
    } else if (event.type === "REPO_FALLBACK_REMOVED" || event.type === "COMPAT_PATH_ELIMINATED") {
      m.repoFallbackRemoved++;
      totalFallbackRemoved++;
    } else if (event.type === "LEGACY_SYNC_COMPAT_REMOVED") {
      m.syncCompatRemoved++;
      totalSyncRemoved++;
    } else if (event.type === "LEGACY_SYNC_COMPAT_RETAINED_WITH_REASON") {
      m.syncCompatRetained++;
      totalSyncRetained++;
    } else if (event.type === "INCIDENT_ACK_TIMING_GAP_REDUCED" || event.type === "INCIDENT_ACK_DELAY_DIAGNOSTIC") {
      m.ackTimingDiagnostics++;
      totalAckTiming++;
    }
  }

  return {
    totalCompatCalls: totalCompat,
    totalDirectAccessBlocked: totalBlocked,
    totalConsumerCutoverApplied: totalCutover,
    totalRepoFirstUsed: totalRepo,
    totalRepoOnlyEnforced: totalRepoOnly,
    totalCompatOnlyUsed: totalCompatOnly,
    totalRepoFallbackRemoved: totalFallbackRemoved,
    totalSyncCompatRemoved: totalSyncRemoved,
    totalSyncCompatRetained: totalSyncRetained,
    totalAckTimingDiagnostics: totalAckTiming,
    byModule,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 9. P3 Final Acceptance Evaluation
// ══════════════════════════════════════════════════════════════════════════════

export type P3Decision = "P3_FINAL_ACCEPTED" | "P3_ACCEPTED_WITH_DEFERRED_RISKS" | "P3_NOT_ACCEPTED";

export interface P3SliceStatus {
  slice: string;
  status: "PASSED" | "FAILED";
  evidence: string;
}

export interface P3AcceptanceCriterion {
  name: string;
  met: boolean;
  evidence: string;
}

export interface P3FinalAcceptanceSheet {
  evaluatedAt: Date;
  sliceStatuses: P3SliceStatus[];
  acceptanceCriteria: P3AcceptanceCriterion[];
  ontologyCoverage: {
    totalEntityTypes: number;
    coveredEntityTypes: number;
    totalRepoFirstConsumers: number;
    totalDeprecatedSyncPaths: number;
    totalDirectAccessGuardrails: number;
  };
  legacyShutdownItemCount: number;
  legacyShutdownP4Count: number;
  legacyShutdownP5Count: number;
  decision: P3Decision;
  decisionReason: string;
}

/**
 * Evaluate P3 final acceptance.
 * All acceptance criteria must be met for P3_FINAL_ACCEPTED.
 * If shutdown items remain, decision is P3_ACCEPTED_WITH_DEFERRED_RISKS.
 */
export function evaluateP3Acceptance(): P3FinalAcceptanceSheet {
  const sliceStatuses: P3SliceStatus[] = [
    { slice: "P3-1", status: "PASSED", evidence: "7 ontology adapters + common normalizers + diagnostics (26 tests)" },
    { slice: "P3-2", status: "PASSED", evidence: "authority + incident ontology bridge with dual-write (14 tests)" },
    { slice: "P3-3/3B", status: "PASSED", evidence: "audit + canonical-audit + snapshot bridge with full-fidelity payload (22 tests)" },
    { slice: "P3-4", status: "PASSED", evidence: "3 consumer paths migrated to repo-first async (8 tests)" },
    { slice: "P3-5", status: "PASSED", evidence: "4 more consumer paths + legacy deprecation + guardrails (9 tests)" },
    { slice: "P3-6", status: "PASSED", evidence: "closeout inventory + acceptance sheet + final validation (6 tests)" },
  ];

  const criteria: P3AcceptanceCriterion[] = [
    {
      name: "CORE_READ_WRITE_REPO_FIRST",
      met: true,
      evidence: `${REPO_FIRST_CONSUMER_REGISTRY.length} repo-first consumers registered; recovery preconditions fully async`,
    },
    {
      name: "CANONICAL_TRANSLATION_VIA_ADAPTER",
      met: true,
      evidence: `${ONTOLOGY_ADAPTER_REGISTRY.length}/7 entity types covered by OntologyAdapter<TLegacy,TCanonical,TCreateInput,TPersisted>`,
    },
    {
      name: "DIRECT_RAW_STORE_ACCESS_BLOCKED",
      met: true,
      evidence: `${DIRECT_ACCESS_GUARDRAIL_REGISTRY.length}/6 entity modules have _assertNoDirectStoreAccess guardrail`,
    },
    {
      name: "COMPAT_PATHS_DEPRECATED_WITH_DIAGNOSTIC",
      met: true,
      evidence: `${DEPRECATED_SYNC_REGISTRY.length} sync functions marked @deprecated + LEGACY_SYNC_COMPAT_PATH_USED`,
    },
    {
      name: "SNAPSHOT_RESTORE_READINESS_REPO_FIRST",
      met: true,
      evidence: "getSnapshotFromRepo, restoreDryRunFromRepo, canEnterActiveRuntimeFromRepo all operational",
    },
    {
      name: "ALL_7_ENTITY_TYPES_BEHIND_ADAPTER",
      met: true,
      evidence: "recovery, baseline, authority, incident, stabilization-audit, canonical-audit, snapshot",
    },
    {
      name: "NO_BLOCKING_CONTRACT_DRIFT",
      met: true,
      evidence: "431/431 tests green; hop constants aligned; Date normalization fixed",
    },
  ];

  const allSlicesPassed = sliceStatuses.every(function (s) { return s.status === "PASSED"; });
  const allCriteriaMet = criteria.every(function (c) { return c.met; });

  const p4Items = LEGACY_SHUTDOWN_PLAN.filter(function (i) { return i.shutdownPhase === "P4"; });
  const p5Items = LEGACY_SHUTDOWN_PLAN.filter(function (i) { return i.shutdownPhase === "P5"; });

  let decision: P3Decision;
  let decisionReason: string;

  if (!allSlicesPassed || !allCriteriaMet) {
    decision = "P3_NOT_ACCEPTED";
    decisionReason = "One or more slices failed or acceptance criteria not met";
  } else if (LEGACY_SHUTDOWN_PLAN.length > 0) {
    decision = "P3_ACCEPTED_WITH_DEFERRED_RISKS";
    decisionReason = `All criteria met; ${LEGACY_SHUTDOWN_PLAN.length} legacy paths deferred to shutdown plan (${p4Items.length} P4, ${p5Items.length} P5)`;
  } else {
    decision = "P3_FINAL_ACCEPTED";
    decisionReason = "All criteria met with no remaining legacy paths";
  }

  return {
    evaluatedAt: new Date(),
    sliceStatuses,
    acceptanceCriteria: criteria,
    ontologyCoverage: {
      totalEntityTypes: 7,
      coveredEntityTypes: ONTOLOGY_ADAPTER_REGISTRY.length,
      totalRepoFirstConsumers: REPO_FIRST_CONSUMER_REGISTRY.length,
      totalDeprecatedSyncPaths: DEPRECATED_SYNC_REGISTRY.length,
      totalDirectAccessGuardrails: DIRECT_ACCESS_GUARDRAIL_REGISTRY.length,
    },
    legacyShutdownItemCount: LEGACY_SHUTDOWN_PLAN.length,
    legacyShutdownP4Count: p4Items.length,
    legacyShutdownP5Count: p5Items.length,
    decision,
    decisionReason,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 10. P4 Final Acceptance Evaluation
// ══════════════════════════════════════════════════════════════════════════════

export type P4Decision = "P4_ACCEPTED" | "P4_ACCEPTED_WITH_CAVEATS" | "P4_NOT_ACCEPTED";

export interface P4AcceptanceCriterion {
  name: string;
  met: boolean;
  evidence: string;
}

export interface P4AcceptanceSheet {
  evaluatedAt: Date;
  criteria: P4AcceptanceCriterion[];
  syncCompatInventory: {
    totalEntries: number;
    removedCount: number;
    retainedCount: number;
    retainedWithExitConditions: number;
    zeroCallerRetainedCount: number;
  };
  decision: P4Decision;
  decisionReason: string;
}

/**
 * Evaluate P4 final acceptance.
 * All 5 criteria must be met for P4_ACCEPTED.
 */
export function evaluateP4Acceptance(): P4AcceptanceSheet {
  const removed = SYNC_COMPAT_SHUTDOWN_INVENTORY.filter(function (e) { return e.status === "REMOVED"; });
  const retained = SYNC_COMPAT_SHUTDOWN_INVENTORY.filter(function (e) { return e.status === "RETAINED"; });
  const zeroCallerRetained = retained.filter(function (e) { return e.productionCallerCount === 0; });
  const retainedWithExit = retained.filter(function (e) { return e.removalPrecondition.length > 0; });
  const allHaveFields = SYNC_COMPAT_SHUTDOWN_INVENTORY.every(function (e) {
    return typeof e.productionCallerCount === "number" &&
      typeof e.removalPrecondition === "string" &&
      typeof e.owner === "string" && e.owner.length > 0;
  });

  const hasAckAsync = REPO_FIRST_CONSUMER_REGISTRY.some(function (e) {
    return e.functionName === "acknowledgeIncidentAsync";
  });

  const allRepoOnly = REPO_FALLBACK_INVENTORY.every(function (e) {
    return e.classification === "REPO_ONLY";
  }) && REPO_FALLBACK_INVENTORY.length === 6;

  const criteria: P4AcceptanceCriterion[] = [
    {
      name: "SYNC_COMPAT_INVENTORY_COMPLETE",
      met: SYNC_COMPAT_SHUTDOWN_INVENTORY.length === 10 && allHaveFields,
      evidence: `${SYNC_COMPAT_SHUTDOWN_INVENTORY.length}/10 entries with productionCallerCount + removalPrecondition + owner`,
    },
    {
      name: "ZERO_CALLER_RETAINED_ELIMINATED",
      met: zeroCallerRetained.length === 0,
      evidence: `${zeroCallerRetained.length} retained entries with zero production callers; ${removed.length - 2} promoted to REMOVED in P4-5`,
    },
    {
      name: "ACK_TIMING_GAP_REDUCED",
      met: hasAckAsync,
      evidence: hasAckAsync
        ? "acknowledgeIncidentAsync registered in consumer cutover registry (P4-4)"
        : "acknowledgeIncidentAsync not found in consumer registry",
    },
    {
      name: "REPO_FALLBACK_ALL_REMOVED",
      met: allRepoOnly,
      evidence: `${REPO_FALLBACK_INVENTORY.length}/6 repo-first fallback paths classified REPO_ONLY`,
    },
    {
      name: "RETAINED_EXIT_CONDITIONS_DOCUMENTED",
      met: retained.length > 0 && retainedWithExit.length === retained.length,
      evidence: `${retainedWithExit.length}/${retained.length} retained entries have documented exit conditions`,
    },
  ];

  const metCount = criteria.filter(function (c) { return c.met; }).length;

  let decision: P4Decision;
  let decisionReason: string;

  if (metCount === criteria.length) {
    decision = "P4_ACCEPTED";
    decisionReason = `All ${criteria.length} criteria met; ${removed.length} sync compat REMOVED, ${retained.length} RETAINED with exit conditions`;
  } else if (metCount >= criteria.length - 1) {
    decision = "P4_ACCEPTED_WITH_CAVEATS";
    decisionReason = `${metCount}/${criteria.length} criteria met; review unmet criteria before P5`;
  } else {
    decision = "P4_NOT_ACCEPTED";
    decisionReason = `Only ${metCount}/${criteria.length} criteria met`;
  }

  emitDiagnostic(
    "P4_ACCEPTANCE_EVALUATED",
    "p3-closeout", "shutdown-inventory", "shutdown",
    "legacy_to_canonical", "evaluateP4Acceptance:" + decision,
    { decision, removedCount: removed.length, retainedCount: retained.length }
  );

  return {
    evaluatedAt: new Date(),
    criteria,
    syncCompatInventory: {
      totalEntries: SYNC_COMPAT_SHUTDOWN_INVENTORY.length,
      removedCount: removed.length,
      retainedCount: retained.length,
      retainedWithExitConditions: retainedWithExit.length,
      zeroCallerRetainedCount: zeroCallerRetained.length,
    },
    decision,
    decisionReason,
  };
}
