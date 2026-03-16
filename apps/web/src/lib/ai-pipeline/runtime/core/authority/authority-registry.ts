/**
 * S4 — Authority Registry + Transfer Coordinator
 *
 * authority source of truth 단일화.
 * explicit staged transfer protocol.
 * split-brain / orphan authority / concurrent transfer / direct override 차단.
 */

import { randomUUID } from "crypto";
import { emitStabilizationAuditEvent } from "../audit/audit-events";
import { getPersistenceAdapters } from "../persistence";
import { logBridgeFailure } from "../persistence/bridge-logger";
import { AuthorityOntologyAdapter } from "../ontology/authority-adapter";
import { emitDiagnostic } from "../ontology/diagnostics";
import {
  acquireLock,
  releaseLock,
  authorityLineLockKey,
} from "../persistence/lock-manager";

// ── Types ──

export type AuthorityState = "ACTIVE" | "FROZEN" | "REVOKED";

export type TransferState =
  | "TRANSFER_IDLE"
  | "TRANSFER_REQUESTED"
  | "TRANSFER_VALIDATED"
  | "TRANSFER_LOCKED"
  | "CURRENT_AUTHORITY_FROZEN"
  | "OLD_AUTHORITY_REVOKED"
  | "NEW_AUTHORITY_ACTIVATED"
  | "CONTINUITY_VALIDATED"
  | "TRANSFER_FINALIZED"
  | "TRANSFER_ROLLED_BACK"
  | "TRANSFER_ESCALATED";

const TRANSFER_STATE_ORDER: readonly TransferState[] = [
  "TRANSFER_IDLE",
  "TRANSFER_REQUESTED",
  "TRANSFER_VALIDATED",
  "TRANSFER_LOCKED",
  "CURRENT_AUTHORITY_FROZEN",
  "OLD_AUTHORITY_REVOKED",
  "NEW_AUTHORITY_ACTIVATED",
  "CONTINUITY_VALIDATED",
  "TRANSFER_FINALIZED",
];

export interface AuthorityLine {
  authorityLineId: string;
  currentAuthorityId: string;
  authorityState: AuthorityState;
  transferState: TransferState;
  pendingSuccessorId: string | null;
  revokedAuthorityIds: string[];
  registryVersion: number;
  baselineId: string;
  updatedAt: Date;
  updatedBy: string;
  correlationId: string;
}

export interface TransferRequest {
  authorityLineId: string;
  requestedSuccessorId: string;
  actor: string;
  reason: string;
  correlationId: string;
}

export interface TransferResult {
  success: boolean;
  reasonCode: string;
  detail: string;
  transferState: TransferState;
}

// ── Single Registry (Source of Truth) ──

const _registry = new Map<string, AuthorityLine>();
const _transferLocks = new Map<string, { lockOwner: string; acquiredAt: Date }>();

/** authority line 생성 */
export function createAuthorityLine(
  authorityLineId: string,
  initialAuthorityId: string,
  baselineId: string,
  actor: string,
  correlationId: string
): AuthorityLine {
  if (_registry.has(authorityLineId)) {
    throw new Error(`DUPLICATE_AUTHORITY_LINE: ${authorityLineId} already exists`);
  }

  const line: AuthorityLine = {
    authorityLineId,
    currentAuthorityId: initialAuthorityId,
    authorityState: "ACTIVE",
    transferState: "TRANSFER_IDLE",
    pendingSuccessorId: null,
    revokedAuthorityIds: [],
    registryVersion: 1,
    baselineId,
    updatedAt: new Date(),
    updatedBy: actor,
    correlationId,
  };

  _registry.set(authorityLineId, line);

  // Dual-write: persist to repository via ontology adapter (fire-and-forget)
  try {
    const adapters = getPersistenceAdapters();
    const canonical = AuthorityOntologyAdapter.fromLegacy(line);
    const input = AuthorityOntologyAdapter.toRepositoryInput(canonical);
    adapters.authority.saveAuthorityLine(input).catch(function (err: unknown) {
      logBridgeFailure("authority-registry", "saveAuthorityLine", err);
    });
  } catch (err) {
    logBridgeFailure("authority-registry", "saveAuthorityLine-bootstrap", err);
  }

  return line;
}

/** authority line 조회 */
export function getAuthorityLine(authorityLineId: string): AuthorityLine | null {
  return _registry.get(authorityLineId) ?? null;
}

/** active authority count 검증 */
export function countActiveAuthorities(): number {
  let count = 0;
  for (const [, line] of Array.from(_registry.entries())) {
    if (line.authorityState === "ACTIVE") count++;
  }
  return count;
}

// ── Transfer Validation ──

function validateTransferRequest(req: TransferRequest): TransferResult {
  const line = _registry.get(req.authorityLineId);
  if (!line) {
    return { success: false, reasonCode: "AUTHORITY_LINEAGE_INVALID", detail: `line ${req.authorityLineId} not found`, transferState: "TRANSFER_IDLE" };
  }

  if (line.transferState !== "TRANSFER_IDLE") {
    return { success: false, reasonCode: "CONCURRENT_TRANSFER_BLOCKED", detail: `transfer already in state ${line.transferState}`, transferState: line.transferState };
  }

  if (line.authorityState !== "ACTIVE") {
    return { success: false, reasonCode: "AUTHORITY_LINEAGE_INVALID", detail: `authority state is ${line.authorityState}, not ACTIVE`, transferState: line.transferState };
  }

  if (req.requestedSuccessorId === line.currentAuthorityId) {
    return { success: false, reasonCode: "SUCCESSOR_NOT_ELIGIBLE", detail: "successor same as current authority", transferState: line.transferState };
  }

  if (!req.requestedSuccessorId) {
    return { success: false, reasonCode: "SUCCESSOR_NOT_ELIGIBLE", detail: "no successor specified", transferState: line.transferState };
  }

  return { success: true, reasonCode: "VALIDATION_PASSED", detail: "transfer request validated", transferState: "TRANSFER_REQUESTED" };
}

// ── Transfer State Machine ──

function advanceTransferState(line: AuthorityLine, targetState: TransferState, actor: string, correlationId: string): TransferResult {
  const currentIdx = TRANSFER_STATE_ORDER.indexOf(line.transferState);
  const targetIdx = TRANSFER_STATE_ORDER.indexOf(targetState);

  if (targetIdx < 0) {
    // special terminal states (ROLLED_BACK, ESCALATED)
    line.transferState = targetState;
    line.updatedAt = new Date();
    line.updatedBy = actor;
    line.registryVersion++;
    return { success: true, reasonCode: "STATE_ADVANCED", detail: `→ ${targetState}`, transferState: targetState };
  }

  if (targetIdx !== currentIdx + 1) {
    return {
      success: false,
      reasonCode: "INVALID_TRANSFER_STATE_TRANSITION",
      detail: `cannot go from ${line.transferState} to ${targetState} (must be sequential)`,
      transferState: line.transferState,
    };
  }

  line.transferState = targetState;
  line.updatedAt = new Date();
  line.updatedBy = actor;
  line.correlationId = correlationId;
  line.registryVersion++;

  return { success: true, reasonCode: "STATE_ADVANCED", detail: `→ ${targetState}`, transferState: targetState };
}

// ── Full Transfer Flow ──

export function requestTransfer(req: TransferRequest): TransferResult {
  const validation = validateTransferRequest(req);
  if (!validation.success) return validation;

  const line = _registry.get(req.authorityLineId)!;

  // TRANSFER_REQUESTED
  const s1 = advanceTransferState(line, "TRANSFER_REQUESTED", req.actor, req.correlationId);
  if (!s1.success) return s1;
  line.pendingSuccessorId = req.requestedSuccessorId;

  // TRANSFER_VALIDATED
  const s2 = advanceTransferState(line, "TRANSFER_VALIDATED", req.actor, req.correlationId);
  if (!s2.success) return s2;

  // TRANSFER_LOCKED (in-memory fallback — async distributed lock in requestTransferAsync)
  if (_transferLocks.has(req.authorityLineId)) {
    return { success: false, reasonCode: "CONCURRENT_TRANSFER_DETECTED", detail: "lock already held", transferState: line.transferState };
  }
  _transferLocks.set(req.authorityLineId, { lockOwner: req.actor, acquiredAt: new Date() });
  const s3 = advanceTransferState(line, "TRANSFER_LOCKED", req.actor, req.correlationId);
  if (!s3.success) return s3;

  // CURRENT_AUTHORITY_FROZEN
  line.authorityState = "FROZEN";
  const s4 = advanceTransferState(line, "CURRENT_AUTHORITY_FROZEN", req.actor, req.correlationId);
  if (!s4.success) return s4;

  // OLD_AUTHORITY_REVOKED
  const oldAuthorityId = line.currentAuthorityId;
  line.revokedAuthorityIds.push(oldAuthorityId);
  line.authorityState = "REVOKED";
  const s5 = advanceTransferState(line, "OLD_AUTHORITY_REVOKED", req.actor, req.correlationId);
  if (!s5.success) return s5;

  // NEW_AUTHORITY_ACTIVATED
  line.currentAuthorityId = req.requestedSuccessorId;
  line.authorityState = "ACTIVE";
  line.pendingSuccessorId = null;
  const s6 = advanceTransferState(line, "NEW_AUTHORITY_ACTIVATED", req.actor, req.correlationId);
  if (!s6.success) return s6;

  // CONTINUITY_VALIDATED
  const continuity = validateContinuity(line);
  if (!continuity.success) {
    // rollback on continuity failure
    return rollbackTransfer(line, req.actor, req.correlationId, oldAuthorityId, continuity.reasonCode);
  }
  const s7 = advanceTransferState(line, "CONTINUITY_VALIDATED", req.actor, req.correlationId);
  if (!s7.success) return s7;

  // TRANSFER_FINALIZED
  const s8 = advanceTransferState(line, "TRANSFER_FINALIZED", req.actor, req.correlationId);
  _transferLocks.delete(req.authorityLineId);

  emitStabilizationAuditEvent({
    eventType: "TRANSITION_ALLOWED",
    baselineId: line.baselineId,
    baselineVersion: String(line.registryVersion),
    baselineHash: "",
    snapshotId: "",
    correlationId: req.correlationId,
    documentType: "",
    performedBy: req.actor,
    detail: `authority transfer finalized: ${oldAuthorityId} → ${req.requestedSuccessorId}`,
  });

  return s8;
}

// ── P1-2: Async Transfer with Distributed Lock ──

/** Lock token storage for distributed lock cleanup on finalize/rollback */
const _distributedLockTokens = new Map<string, string>();

/**
 * Async version of requestTransfer that uses distributed lock.
 * Multi-instance safe — acquires DB-backed lock before proceeding.
 */
export async function requestTransferAsync(req: TransferRequest): Promise<TransferResult> {
  // Acquire distributed lock first
  const lockResult = await acquireLock({
    lockKey: authorityLineLockKey(req.authorityLineId),
    lockOwner: req.actor,
    targetType: "AUTHORITY_LINE",
    reason: req.reason,
    correlationId: req.correlationId,
    ttlMs: 30_000, // 30s TTL
  });

  if (!lockResult.acquired) {
    return {
      success: false,
      reasonCode: "CONCURRENT_TRANSFER_DETECTED",
      detail: `distributed lock conflict: ${lockResult.message}`,
      transferState: "TRANSFER_IDLE",
    };
  }

  // Store token for cleanup
  _distributedLockTokens.set(req.authorityLineId, lockResult.data.lockToken);

  // Execute sync transfer logic
  const result = requestTransfer(req);

  // If failed, release distributed lock
  if (!result.success) {
    const token = _distributedLockTokens.get(req.authorityLineId);
    if (token) {
      await releaseLock(authorityLineLockKey(req.authorityLineId), token, req.correlationId);
      _distributedLockTokens.delete(req.authorityLineId);
    }
  } else if (result.transferState === "TRANSFER_FINALIZED") {
    // Transfer succeeded — release lock
    const token = _distributedLockTokens.get(req.authorityLineId);
    if (token) {
      await releaseLock(authorityLineLockKey(req.authorityLineId), token, req.correlationId);
      _distributedLockTokens.delete(req.authorityLineId);
    }
  }

  return result;
}

// ── Continuity Validation ──

function validateContinuity(line: AuthorityLine): { success: boolean; reasonCode: string; detail: string } {
  // active authority line count == 1 (for this line)
  if (line.authorityState !== "ACTIVE") {
    return { success: false, reasonCode: "AUTHORITY_NOT_ACTIVE_AFTER_TRANSFER", detail: `state=${line.authorityState}` };
  }

  // no orphan: currentAuthorityId must exist
  if (!line.currentAuthorityId) {
    return { success: false, reasonCode: "ORPHAN_AUTHORITY_DETECTED", detail: "no current authority" };
  }

  // pending successor residue
  if (line.pendingSuccessorId !== null) {
    return { success: false, reasonCode: "PENDING_SUCCESSOR_RESIDUE", detail: `pending=${line.pendingSuccessorId}` };
  }

  // revoked authority not same as current
  if (line.revokedAuthorityIds.includes(line.currentAuthorityId)) {
    return { success: false, reasonCode: "REVOKED_AUTHORITY_STILL_EFFECTIVE", detail: "current authority is in revoked list" };
  }

  return { success: true, reasonCode: "CONTINUITY_VALID", detail: "continuity validated" };
}

// ── Transfer Rollback ──

function rollbackTransfer(
  line: AuthorityLine,
  actor: string,
  correlationId: string,
  originalAuthorityId: string,
  reason: string
): TransferResult {
  // restore original state
  line.currentAuthorityId = originalAuthorityId;
  line.authorityState = "ACTIVE";
  line.pendingSuccessorId = null;
  line.revokedAuthorityIds = line.revokedAuthorityIds.filter((id: string) => id !== originalAuthorityId);

  advanceTransferState(line, "TRANSFER_ROLLED_BACK", actor, correlationId);
  _transferLocks.delete(line.authorityLineId);

  return {
    success: false,
    reasonCode: "TRANSFER_ROLLED_BACK",
    detail: `rollback: ${reason}`,
    transferState: "TRANSFER_ROLLED_BACK",
  };
}

// ── Direct Override Guard ──

export function guardDirectOverride(authorityLineId: string, operation: string): { allowed: boolean; reasonCode: string } {
  const line = _registry.get(authorityLineId);
  if (!line) {
    return { allowed: false, reasonCode: "AUTHORITY_LINEAGE_INVALID" };
  }

  // only transfer coordinator may modify
  if (line.transferState !== "TRANSFER_IDLE" && line.transferState !== "TRANSFER_FINALIZED") {
    return { allowed: false, reasonCode: "AUTHORITY_MUTATION_BLOCKED_DURING_LOCK" };
  }

  // block direct patches
  if (operation === "DIRECT_REGISTRY_PATCH" || operation === "SIDE_CHANNEL_MUTATION" || operation === "CACHE_ONLY_PROMOTION") {
    return { allowed: false, reasonCode: `${operation}_BLOCKED` };
  }

  return { allowed: true, reasonCode: "ALLOWED" };
}

// ── Split-Brain / Orphan Detection ──

export interface IntegrityReport {
  splitBrain: boolean;
  orphanCount: number;
  revokedStillEffective: boolean;
  pendingResidue: boolean;
  detail: string;
}

/** @deprecated REMOVED in P5-1 — use checkAuthorityIntegrityFromRepo. Soft removal: impl kept for test compat */
export function checkAuthorityIntegrity(): IntegrityReport {
  emitDiagnostic(
    "LEGACY_SYNC_COMPAT_REMOVED",
    "authority-registry", "authority-adapter", "authority",
    "legacy_to_canonical", "checkAuthorityIntegrity:removed",
    { removalStatus: "REMOVED", shutdownPhase: "P5-1" }
  );
  const lines = Array.from(_registry.values());
  const activeByEntity = new Map<string, number>();

  let orphanCount = 0;
  let revokedStillEffective = false;
  let pendingResidue = false;

  for (const line of lines) {
    if (line.authorityState === "ACTIVE") {
      activeByEntity.set(line.authorityLineId, (activeByEntity.get(line.authorityLineId) || 0) + 1);
    }

    if (!line.currentAuthorityId && line.authorityState === "ACTIVE") {
      orphanCount++;
    }

    if (line.revokedAuthorityIds.includes(line.currentAuthorityId)) {
      revokedStillEffective = true;
    }

    if (line.pendingSuccessorId !== null && line.transferState === "TRANSFER_FINALIZED") {
      pendingResidue = true;
    }
  }

  const splitBrain = Array.from(activeByEntity.values()).some((count: number) => count > 1);

  return {
    splitBrain,
    orphanCount,
    revokedStillEffective,
    pendingResidue,
    detail: splitBrain ? "SPLIT_BRAIN_DETECTED" : orphanCount > 0 ? "ORPHAN_DETECTED" : "INTEGRITY_OK",
  };
}

// ── Repository-First Async Read ──

/**
 * Repository-first read with legacy fallback.
 * Maps PersistedAuthorityLine → AuthorityLine with Date normalization.
 */
export async function getAuthorityLineFromRepo(authorityLineId: string): Promise<AuthorityLine | null> {
  try {
    const adapters = getPersistenceAdapters();
    const result = await adapters.authority.findAuthorityLineByLineId(authorityLineId);
    if (result.ok) {
      const canonical = AuthorityOntologyAdapter.fromPersisted(result.data);
      return AuthorityOntologyAdapter.toLegacy(canonical);
    }
  } catch (err) {
    logBridgeFailure("authority-registry", "getAuthorityLineFromRepo", err);
  }
  // Fallback to legacy store
  emitDiagnostic(
    "LEGACY_DIRECT_ACCESS_FALLBACK_USED",
    "authority-registry", "authority-adapter", "authority",
    "legacy_to_canonical", "getAuthorityLineFromRepo:fallback",
    { entityId: authorityLineId, fallbackUsed: true }
  );
  return _registry.get(authorityLineId) ?? null;
}

// ── Repository-First Async Integrity Check (P3-5) ──

/**
 * Repository-first authority integrity check.
 * Reads authority lines from repo, performs same split-brain/orphan analysis.
 * Falls back to sync checkAuthorityIntegrity on repo failure.
 */
export async function checkAuthorityIntegrityFromRepo(): Promise<IntegrityReport> {
  emitDiagnostic(
    "CONSUMER_CUTOVER_APPLIED",
    "authority-registry", "authority-adapter", "authority",
    "repository_to_canonical", "checkAuthorityIntegrityFromRepo:entry",
    {}
  );

  try {
    const adapters = getPersistenceAdapters();
    const result = await adapters.authority.listAllAuthorityLines({ limit: 1000 });
    if (!result.ok) {
      emitDiagnostic(
        "REPO_ONLY_PATH_ENFORCED",
        "authority-registry", "authority-adapter", "authority",
        "repository_to_canonical", "checkAuthorityIntegrityFromRepo:repo-only-error",
        { fallbackUsed: false }
      );
      return {
        splitBrain: false,
        orphanCount: 0,
        revokedStillEffective: false,
        pendingResidue: false,
        detail: "REPO_UNAVAILABLE",
      };
    }

    emitDiagnostic(
      "AUTHORITY_REPO_QUERY_ENABLED",
      "authority-registry", "authority-adapter", "authority",
      "repository_to_canonical", "checkAuthorityIntegrityFromRepo:bulk-query",
      {}
    );

    const lines: AuthorityLine[] = [];
    for (const persisted of result.data.items) {
      const canonical = AuthorityOntologyAdapter.fromPersisted(persisted);
      lines.push(AuthorityOntologyAdapter.toLegacy(canonical));
    }

    // Same integrity analysis as sync version
    const activeByEntity = new Map<string, number>();
    let orphanCount = 0;
    let revokedStillEffective = false;
    let pendingResidue = false;

    for (const line of lines) {
      if (line.authorityState === "ACTIVE") {
        activeByEntity.set(line.authorityLineId, (activeByEntity.get(line.authorityLineId) || 0) + 1);
      }
      if (!line.currentAuthorityId && line.authorityState === "ACTIVE") {
        orphanCount++;
      }
      if (line.revokedAuthorityIds.includes(line.currentAuthorityId)) {
        revokedStillEffective = true;
      }
      if (line.pendingSuccessorId !== null && line.transferState === "TRANSFER_FINALIZED") {
        pendingResidue = true;
      }
    }

    const splitBrain = Array.from(activeByEntity.values()).some((count: number) => count > 1);

    return {
      splitBrain,
      orphanCount,
      revokedStillEffective,
      pendingResidue,
      detail: splitBrain ? "SPLIT_BRAIN_DETECTED" : orphanCount > 0 ? "ORPHAN_DETECTED" : "INTEGRITY_OK",
    };
  } catch (err) {
    logBridgeFailure("authority-registry", "checkAuthorityIntegrityFromRepo", err);
    // P4-3: REPO_ONLY — no fallback to sync checkAuthorityIntegrity()
    emitDiagnostic(
      "REPO_ONLY_PATH_ENFORCED",
      "authority-registry", "authority-adapter", "authority",
      "repository_to_canonical", "checkAuthorityIntegrityFromRepo:repo-only-error",
      { fallbackUsed: false }
    );
    return {
      splitBrain: false,
      orphanCount: 0,
      revokedStillEffective: false,
      pendingResidue: false,
      detail: "REPO_UNAVAILABLE",
    };
  }
}

// ── Direct Access Shutdown Guardrail (P3-5) ──

export function _assertNoDirectStoreAccess(caller: string): void {
  emitDiagnostic(
    "LEGACY_DIRECT_ACCESS_BLOCKED",
    "authority-registry", "authority-adapter", "authority",
    "legacy_to_canonical", "_assertNoDirectStoreAccess:" + caller,
    { entityId: caller }
  );
  throw new Error(`DIRECT_STORE_ACCESS_BLOCKED: ${caller} must use repo-first API`);
}

/** 테스트용 */
export function _resetAuthorityRegistry(): void {
  _registry.clear();
  _transferLocks.clear();
  _distributedLockTokens.clear();
}
