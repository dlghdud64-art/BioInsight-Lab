/**
 * S0+P3-3B — Snapshot Manager
 *
 * - activeSnapshotId / rollbackSnapshotId pair 동시 생성
 * - scope별 checksum 저장
 * - restore dry-run 검증
 * - snapshot pair 없으면 active runtime 진입 차단
 * - repository-first read with legacy fallback (P3-3B)
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
import { emitDiagnostic } from "../ontology/diagnostics";

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
  emitDiagnostic(
    "LEGACY_SYNC_COMPAT_PATH_USED",
    "snapshot-manager", "snapshot-adapter", "snapshot",
    "legacy_to_canonical", "getSnapshot:sync-compat",
    { entityId: snapshotId }
  );
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
  emitDiagnostic(
    "LEGACY_SYNC_COMPAT_PATH_USED",
    "snapshot-manager", "snapshot-adapter", "snapshot",
    "legacy_to_canonical", "restoreDryRun:sync-compat",
    { entityId: snapshotId }
  );
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
  emitDiagnostic(
    "LEGACY_SYNC_COMPAT_PATH_USED",
    "snapshot-manager", "snapshot-adapter", "snapshot",
    "legacy_to_canonical", "canEnterActiveRuntime:sync-compat",
    { entityId: activeSnapshotId }
  );
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

// ── Repository-First Async Read (P3-3B) ──

/**
 * Repository-first snapshot read with legacy fallback.
 * When repo has full-fidelity payload, that is the truth source.
 */
export async function getSnapshotFromRepo(snapshotId: string): Promise<BaselineSnapshot | null> {
  try {
    const adapters = getPersistenceAdapters();
    const result = await adapters.snapshot.findSnapshotBySnapshotId(snapshotId);
    if (result.ok) {
      const canonical = SnapshotOntologyAdapter.fromPersisted(result.data);
      const legacy = SnapshotOntologyAdapter.toLegacy(canonical);
      emitDiagnostic(
        "SNAPSHOT_REPO_FIRST_READ_USED",
        "snapshot-manager", "snapshot-adapter", "snapshot",
        "repository_to_canonical", "getSnapshotFromRepo:hit",
        { entityId: snapshotId }
      );
      return legacy;
    }
  } catch (err) {
    logBridgeFailure("snapshot-manager", "getSnapshotFromRepo", err);
  }
  // COMPAT_ONLY_TEMPORARY (P4-2): snapshot payload fidelity — keep memory fallback
  const memSnapshot = _snapshots.get(snapshotId) ?? null;
  if (memSnapshot) {
    emitDiagnostic(
      "COMPAT_ONLY_PATH_USED",
      "snapshot-manager", "snapshot-adapter", "snapshot",
      "repository_to_canonical", "getSnapshotFromRepo:compat-fallback",
      { entityId: snapshotId, fallbackUsed: true }
    );
  }
  return memSnapshot;
}

/**
 * Repository-first restore dry-run.
 * Same logic as restoreDryRun but uses repo-first read.
 */
export async function restoreDryRunFromRepo(snapshotId: string): Promise<RestoreDryRunResult> {
  const snapshot = await getSnapshotFromRepo(snapshotId);
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

/**
 * Repository-first active runtime entry check.
 * Same logic as canEnterActiveRuntime but uses repo-first reads.
 */
export async function canEnterActiveRuntimeFromRepo(
  activeSnapshotId: string,
  rollbackSnapshotId: string
): Promise<{ allowed: boolean; reason: string }> {
  // Pair verification via repo-first reads
  const active = await getSnapshotFromRepo(activeSnapshotId);
  const rollback = await getSnapshotFromRepo(rollbackSnapshotId);

  if (!active && !rollback) {
    return { allowed: false, reason: `BLOCKED: snapshot pair missing — BOTH_MISSING: active(${activeSnapshotId}), rollback(${rollbackSnapshotId})` };
  }
  if (!active) {
    return { allowed: false, reason: `BLOCKED: snapshot pair missing — ACTIVE_MISSING: ${activeSnapshotId}` };
  }
  if (!rollback) {
    return { allowed: false, reason: `BLOCKED: snapshot pair missing — ROLLBACK_MISSING: ${rollbackSnapshotId}` };
  }
  if (active.tag !== "ACTIVE") {
    return { allowed: false, reason: `BLOCKED: snapshot pair missing — ACTIVE_TAG_MISMATCH: expected ACTIVE, got ${active.tag}` };
  }
  if (rollback.tag !== "ROLLBACK") {
    return { allowed: false, reason: `BLOCKED: snapshot pair missing — ROLLBACK_TAG_MISMATCH: expected ROLLBACK, got ${rollback.tag}` };
  }
  if (active.baselineId !== rollback.baselineId) {
    return { allowed: false, reason: `BLOCKED: snapshot pair missing — BASELINE_ID_MISMATCH: active=${active.baselineId}, rollback=${rollback.baselineId}` };
  }

  // Dry-run the rollback using repo-first snapshot
  const dryRun = await restoreDryRunFromRepo(rollbackSnapshotId);
  if (!dryRun.success) {
    return { allowed: false, reason: `BLOCKED: rollback restore dry-run failed — ${dryRun.reason}` };
  }

  return { allowed: true, reason: "snapshot pair valid + rollback restorable (repo-first)" };
}

// ── Direct Access Shutdown Guardrail (P3-4) ──

/**
 * Sentinel guard — blocks direct store access from new consumers.
 * Not wired into existing paths; used by tests to enforce repo-first policy.
 */
export function _assertNoDirectStoreAccess(caller: string): void {
  emitDiagnostic(
    "LEGACY_DIRECT_ACCESS_BLOCKED",
    "snapshot-manager", "snapshot-adapter", "snapshot",
    "legacy_to_canonical", "_assertNoDirectStoreAccess:" + caller,
    { entityId: caller }
  );
  throw new Error(`DIRECT_STORE_ACCESS_BLOCKED: ${caller} must use repo-first API`);
}

/** 테스트용 — 상태 리셋 */
export function _resetSnapshotStore(): void {
  _snapshots.clear();
}
