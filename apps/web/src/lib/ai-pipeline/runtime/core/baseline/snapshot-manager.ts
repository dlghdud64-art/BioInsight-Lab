/**
 * S0 — Snapshot Manager
 *
 * - activeSnapshotId / rollbackSnapshotId pair 동시 생성
 * - scope별 checksum 저장
 * - restore dry-run 검증
 * - snapshot pair 없으면 active runtime 진입 차단
 */

import { createHash } from "crypto";
import type {
  BaselineSnapshot,
  SnapshotScope,
  SnapshotScopeEntry,
  ALL_SNAPSHOT_SCOPES,
} from "../../types/stabilization";
import { getPersistenceAdapters } from "../persistence";
import { logBridgeFailure } from "../persistence/bridge-logger";
import { SnapshotOntologyAdapter } from "../ontology/snapshot-adapter";

// ── In-memory store ──

const _snapshots = new Map<string, BaselineSnapshot>();

// ── Checksum ──

export function computeScopeChecksum(scope: SnapshotScope, data: Record<string, unknown>): string {
  const payload = JSON.stringify({ scope, data });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

// ── Snapshot Pair Creation ──

export interface CreateSnapshotPairInput {
  baselineId: string;
  capturedBy: string;
  scopeData: Record<SnapshotScope, Record<string, unknown>>;
}

export interface SnapshotPair {
  active: BaselineSnapshot;
  rollback: BaselineSnapshot;
}

export function createSnapshotPair(input: CreateSnapshotPairInput): SnapshotPair {
  const now = new Date();
  const ts = now.getTime();

  const requiredScopes: SnapshotScope[] = ["CONFIG", "FLAGS", "ROUTING", "AUTHORITY", "POLICY", "QUEUE_TOPOLOGY"];

  // scope 누락 검증
  for (const scope of requiredScopes) {
    if (!(scope in input.scopeData)) {
      throw new Error(`MISSING_SCOPE: snapshot scope '${scope}' data is required`);
    }
  }

  const scopes: SnapshotScopeEntry[] = requiredScopes.map((scope: SnapshotScope) => ({
    scope,
    data: input.scopeData[scope],
    checksum: computeScopeChecksum(scope, input.scopeData[scope]),
  }));

  const activeId = `snap-active-${input.baselineId}-${ts}`;
  const rollbackId = `snap-rollback-${input.baselineId}-${ts}`;

  const baseConfig: Record<string, unknown> = {};
  for (const entry of scopes) {
    baseConfig[entry.scope] = entry.data;
  }

  const active: BaselineSnapshot = {
    snapshotId: activeId,
    baselineId: input.baselineId,
    tag: "ACTIVE",
    scopes,
    capturedAt: now,
    capturedBy: input.capturedBy,
    config: { ...baseConfig },
  };

  const rollback: BaselineSnapshot = {
    snapshotId: rollbackId,
    baselineId: input.baselineId,
    tag: "ROLLBACK",
    scopes: scopes.map((s: SnapshotScopeEntry) => ({ ...s })),
    capturedAt: now,
    capturedBy: input.capturedBy,
    config: { ...baseConfig },
  };

  _snapshots.set(activeId, active);
  _snapshots.set(rollbackId, rollback);

  // Dual-write: persist via ontology adapter (fire-and-forget)
  try {
    const adapters = getPersistenceAdapters();
    const canonicalActive = SnapshotOntologyAdapter.fromLegacy(active);
    const inputActive = SnapshotOntologyAdapter.toRepositoryInput(canonicalActive);
    adapters.snapshot.saveSnapshot(inputActive)
      .catch((err: unknown) => logBridgeFailure("snapshot-manager", "saveSnapshot(active)", err));
    const canonicalRollback = SnapshotOntologyAdapter.fromLegacy(rollback);
    const inputRollback = SnapshotOntologyAdapter.toRepositoryInput(canonicalRollback);
    adapters.snapshot.saveSnapshot(inputRollback)
      .catch((err: unknown) => logBridgeFailure("snapshot-manager", "saveSnapshot(rollback)", err));
  } catch (err) {
    logBridgeFailure("snapshot-manager", "createSnapshotPair-bridge", err);
  }

  return { active, rollback };
}

// ── Snapshot Lookup ──

export function getSnapshot(snapshotId: string): BaselineSnapshot | null {
  return _snapshots.get(snapshotId) ?? null;
}

/** snapshot pair 존재 여부 검증 */
export function verifySnapshotPairExists(
  activeSnapshotId: string,
  rollbackSnapshotId: string
): { exists: boolean; reason: string } {
  const active = _snapshots.get(activeSnapshotId);
  const rollback = _snapshots.get(rollbackSnapshotId);

  if (!active && !rollback) {
    return { exists: false, reason: `BOTH_MISSING: active(${activeSnapshotId}), rollback(${rollbackSnapshotId})` };
  }
  if (!active) {
    return { exists: false, reason: `ACTIVE_MISSING: ${activeSnapshotId}` };
  }
  if (!rollback) {
    return { exists: false, reason: `ROLLBACK_MISSING: ${rollbackSnapshotId}` };
  }
  if (active.tag !== "ACTIVE") {
    return { exists: false, reason: `ACTIVE_TAG_MISMATCH: expected ACTIVE, got ${active.tag}` };
  }
  if (rollback.tag !== "ROLLBACK") {
    return { exists: false, reason: `ROLLBACK_TAG_MISMATCH: expected ROLLBACK, got ${rollback.tag}` };
  }
  if (active.baselineId !== rollback.baselineId) {
    return { exists: false, reason: `BASELINE_ID_MISMATCH: active=${active.baselineId}, rollback=${rollback.baselineId}` };
  }
  return { exists: true, reason: "snapshot pair valid" };
}

// ── Restore Dry-Run ──

export interface RestoreDryRunResult {
  success: boolean;
  snapshotId: string;
  scopeResults: { scope: SnapshotScope; checksumMatch: boolean; restorable: boolean }[];
  reason: string;
}

export function restoreDryRun(snapshotId: string): RestoreDryRunResult {
  const snapshot = _snapshots.get(snapshotId);
  if (!snapshot) {
    return {
      success: false,
      snapshotId,
      scopeResults: [],
      reason: `SNAPSHOT_NOT_FOUND: ${snapshotId}`,
    };
  }

  const scopeResults = snapshot.scopes.map((entry: SnapshotScopeEntry) => {
    const recomputed = computeScopeChecksum(entry.scope, entry.data);
    const match = recomputed === entry.checksum;
    return {
      scope: entry.scope,
      checksumMatch: match,
      restorable: match && Object.keys(entry.data).length > 0,
    };
  });

  const allRestorable = scopeResults.every((r) => r.restorable);

  return {
    success: allRestorable,
    snapshotId,
    scopeResults,
    reason: allRestorable
      ? "all scopes restorable"
      : `${scopeResults.filter((r) => !r.restorable).length} scope(s) not restorable`,
  };
}

/** active runtime 진입 가능 여부 (snapshot pair 필수) */
export function canEnterActiveRuntime(
  activeSnapshotId: string,
  rollbackSnapshotId: string
): { allowed: boolean; reason: string } {
  const pairCheck = verifySnapshotPairExists(activeSnapshotId, rollbackSnapshotId);
  if (!pairCheck.exists) {
    return { allowed: false, reason: `BLOCKED: snapshot pair missing — ${pairCheck.reason}` };
  }

  const dryRun = restoreDryRun(rollbackSnapshotId);
  if (!dryRun.success) {
    return { allowed: false, reason: `BLOCKED: rollback restore dry-run failed — ${dryRun.reason}` };
  }

  return { allowed: true, reason: "snapshot pair valid + rollback restorable" };
}

/** 테스트용 — 상태 리셋 */
export function _resetSnapshotStore(): void {
  _snapshots.clear();
}
