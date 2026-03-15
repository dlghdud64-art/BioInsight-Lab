/**
 * P1-1 Slice-1D — Memory Adapter Factory
 *
 * Creates a PersistenceAdapters bundle backed by in-memory stores.
 * No external dependencies. All state lives in Map/Array within each repository.
 * Internal store types are not exposed outside this module.
 */

import type { PersistenceAdapters } from "../factory";
import { MemoryBaselineRepository } from "./baseline";
import { MemorySnapshotRepository } from "./snapshot";
import { MemoryAuthorityRepository } from "./authority";
import { MemoryIncidentRepository } from "./incident";
import { MemoryStabilizationAuditRepository } from "./stabilization-audit";
import { MemoryCanonicalAuditRepository } from "./canonical-audit";
import { MemoryLockRepository } from "./lock";

/**
 * Create Memory-backed persistence adapters.
 * Each call creates a fresh set of empty stores.
 *
 * @returns PersistenceAdapters with mode="MEMORY"
 */
export function createMemoryAdapters(): PersistenceAdapters {
  return {
    mode: "MEMORY",
    baseline: new MemoryBaselineRepository(),
    snapshot: new MemorySnapshotRepository(),
    authority: new MemoryAuthorityRepository(),
    incident: new MemoryIncidentRepository(),
    stabilizationAudit: new MemoryStabilizationAuditRepository(),
    canonicalAudit: new MemoryCanonicalAuditRepository(),
    lock: new MemoryLockRepository(),
  };
}

// Re-export individual repositories for direct usage if needed
export { MemoryBaselineRepository } from "./baseline";
export { MemorySnapshotRepository } from "./snapshot";
export { MemoryAuthorityRepository } from "./authority";
export { MemoryIncidentRepository } from "./incident";
export { MemoryStabilizationAuditRepository } from "./stabilization-audit";
export { MemoryCanonicalAuditRepository } from "./canonical-audit";
export { MemoryLockRepository } from "./lock";
