/**
 * P1-1 Slice-1F — Snapshot Type Adapter
 *
 * BaselineSnapshot (legacy) → CreateSnapshotInput (repository) lossy mapping.
 * PersistedSnapshot는 checksum만 저장하므로 scope data는 유실됨.
 * scope data가 필요한 caller는 legacy Map에서 직접 읽어야 함.
 */

import type {
  BaselineSnapshot,
  SnapshotScopeEntry,
} from "../../types/stabilization";
import type { CreateSnapshotInput } from "./types";

/**
 * Extract the checksum for a given scope name from the snapshot's scopes array.
 * Returns null if the scope is not present.
 */
function findScopeChecksum(
  scopes: SnapshotScopeEntry[],
  scopeName: string
): string | null {
  const entry = scopes.find(
    (s: SnapshotScopeEntry) => s.scope === scopeName
  );
  return entry ? entry.checksum : null;
}

/**
 * Convert a legacy BaselineSnapshot to a CreateSnapshotInput for repository persistence.
 *
 * This is a LOSSY mapping by design:
 * - scope data (scopes[].data, config) is NOT persisted
 * - only checksums and metadata are stored
 */
export function baselineSnapshotToCreateInput(
  snap: BaselineSnapshot
): CreateSnapshotInput {
  return {
    snapshotType: snap.tag,
    baselineId: snap.baselineId,
    configChecksum: findScopeChecksum(snap.scopes, "CONFIG"),
    flagChecksum: findScopeChecksum(snap.scopes, "FLAGS"),
    routingChecksum: findScopeChecksum(snap.scopes, "ROUTING"),
    authorityChecksum: findScopeChecksum(snap.scopes, "AUTHORITY"),
    policyChecksum: findScopeChecksum(snap.scopes, "POLICY"),
    queueTopologyChecksum: findScopeChecksum(snap.scopes, "QUEUE_TOPOLOGY"),
    includedScopes: snap.scopes.map((s: SnapshotScopeEntry) => s.scope),
    restoreVerificationStatus: null,
    // P3-3B fields — adapter is lossy, but the repository contract still
    // requires them. Provide canonical full payload + capturedBy + legacy id.
    scopePayload: snap.scopes,
    configPayload: snap.config ?? null,
    capturedBy: snap.capturedBy ?? null,
    snapshotId: snap.snapshotId ?? null,
  };
}
