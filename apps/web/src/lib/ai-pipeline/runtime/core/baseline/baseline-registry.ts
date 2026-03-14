/**
 * S0 — Canonical Baseline Registry
 *
 * 규칙:
 * - canonical baseline은 정확히 1개만 존재
 * - ACTIVE_100 + FULL_ACTIVE_STABILIZATION + FROZEN 조합만 canonical active로 인정
 * - 중복 canonical baseline 차단
 * - baselineSource는 PACKAGE1_COMPLETE_NEW_AI_INTEGRATED 고정
 */

import { createHash } from "crypto";
import type {
  BaselineRegistry,
  LifecycleState,
  ReleaseMode,
  BaselineStatus,
} from "../../types/stabilization";
import { getPersistenceAdapters } from "../persistence";
import { logBridgeFailure } from "../persistence/bridge-logger";
import { normalizeDate } from "../persistence/date-normalizer";

// ── In-memory store (legacy — kept for backward compatibility) ──
// TODO(Slice-1F): remove legacy store, read from repository directly

let _canonicalBaseline: BaselineRegistry | null = null;

// ── Hash ──

export function computeBaselineHash(registry: Omit<BaselineRegistry, "baselineHash" | "createdAt" | "updatedAt">): string {
  const payload = JSON.stringify({
    id: registry.canonicalBaselineId,
    version: registry.baselineVersion,
    source: registry.baselineSource,
    docType: registry.documentType,
    lifecycle: registry.lifecycleState,
    release: registry.releaseMode,
    status: registry.baselineStatus,
    activeSnapshot: registry.activeSnapshotId,
    rollbackSnapshot: registry.rollbackSnapshotId,
    manifest: registry.activePathManifestId,
    policy: registry.policySetVersion,
    routing: registry.routingRuleVersion,
    authority: registry.authorityRegistryVersion,
  });
  return createHash("sha256").update(payload).digest("hex");
}

// ── Validation ──

export function isCanonicalActiveCombination(
  lifecycle: LifecycleState,
  release: ReleaseMode,
  status: BaselineStatus
): boolean {
  return (
    lifecycle === "ACTIVE_100" &&
    release === "FULL_ACTIVE_STABILIZATION" &&
    status === "FROZEN"
  );
}

// ── Registry CRUD ──

export interface CreateBaselineInput {
  documentType: string;
  baselineVersion: string;
  activeSnapshotId: string;
  rollbackSnapshotId: string;
  activePathManifestId: string;
  policySetVersion: string;
  routingRuleVersion: string;
  authorityRegistryVersion: string;
  freezeReason: string;
  performedBy: string;
}

export function createCanonicalBaseline(input: CreateBaselineInput): BaselineRegistry {
  // 중복 차단
  if (_canonicalBaseline !== null) {
    throw new Error(
      `DUPLICATE_CANONICAL: canonical baseline already exists (${_canonicalBaseline.canonicalBaselineId}). ` +
      `Invalidate first before creating a new one.`
    );
  }

  const now = new Date();
  const id = `baseline-${input.documentType}-${now.getTime()}`;

  const partial: Omit<BaselineRegistry, "baselineHash" | "createdAt" | "updatedAt"> = {
    canonicalBaselineId: id,
    baselineVersion: input.baselineVersion,
    baselineSource: "PACKAGE1_COMPLETE_NEW_AI_INTEGRATED",
    baselineStatus: "FROZEN",
    lifecycleState: "ACTIVE_100",
    releaseMode: "FULL_ACTIVE_STABILIZATION",
    activeSnapshotId: input.activeSnapshotId,
    rollbackSnapshotId: input.rollbackSnapshotId,
    freezeReason: input.freezeReason,
    activePathManifestId: input.activePathManifestId,
    policySetVersion: input.policySetVersion,
    routingRuleVersion: input.routingRuleVersion,
    authorityRegistryVersion: input.authorityRegistryVersion,
    documentType: input.documentType,
  };

  const hash = computeBaselineHash(partial);

  const registry: BaselineRegistry = {
    ...partial,
    baselineHash: hash,
    createdAt: now,
    updatedAt: now,
  };

  _canonicalBaseline = registry;

  // Dual-write: persist to repository (fire-and-forget)
  try {
    const adapters = getPersistenceAdapters();
    adapters.baseline.saveBaseline({
      baselineSource: registry.baselineSource,
      baselineVersion: registry.baselineVersion,
      baselineHash: registry.baselineHash,
      lifecycleState: registry.lifecycleState,
      releaseMode: registry.releaseMode,
      baselineStatus: registry.baselineStatus,
      activeSnapshotId: registry.activeSnapshotId || null,
      rollbackSnapshotId: registry.rollbackSnapshotId || null,
      freezeReason: registry.freezeReason || null,
      activePathManifestId: registry.activePathManifestId || null,
      policySetVersion: registry.policySetVersion || null,
      routingRuleVersion: registry.routingRuleVersion || null,
      authorityRegistryVersion: registry.authorityRegistryVersion || null,
      stabilizationOnly: true,
      featureExpansionAllowed: false,
      experimentalPathAllowed: false,
      structuralRefactorAllowed: false,
      devOnlyPathAllowed: false,
      emergencyRollbackAllowed: true,
      containmentPriorityEnabled: true,
      auditStrictMode: true,
      mergeGateStrictMode: true,
    }).catch(function (err: unknown) {
      logBridgeFailure("baseline-registry", "saveBaseline", err);
    });
  } catch (err) {
    logBridgeFailure("baseline-registry", "saveBaseline-bootstrap", err);
  }

  return registry;
}

/** 현재 canonical baseline 조회. 없으면 null. */
export function getCanonicalBaseline(): BaselineRegistry | null {
  return _canonicalBaseline;
}

/** canonical baseline이 정확히 1개인지 검증 */
export function assertSingleCanonical(): { valid: boolean; reason: string } {
  if (_canonicalBaseline === null) {
    return { valid: false, reason: "NO_CANONICAL: canonical baseline not found" };
  }
  // valid combination check
  if (
    !isCanonicalActiveCombination(
      _canonicalBaseline.lifecycleState,
      _canonicalBaseline.releaseMode,
      _canonicalBaseline.baselineStatus
    )
  ) {
    return {
      valid: false,
      reason: `INVALID_COMBINATION: lifecycle=${_canonicalBaseline.lifecycleState}, ` +
        `release=${_canonicalBaseline.releaseMode}, status=${_canonicalBaseline.baselineStatus}`,
    };
  }
  return { valid: true, reason: "canonical baseline valid" };
}

/** canonical baseline 무효화 (rollback 또는 재설정 시) */
export function invalidateCanonicalBaseline(): void {
  if (_canonicalBaseline) {
    // Dual-write: persist invalidation to repository (fire-and-forget)
    try {
      const adapters = getPersistenceAdapters();
      // Note: updateBaseline requires optimistic lock, so we fetch first
      adapters.baseline.getCanonicalBaseline().then(function (result) {
        if (result.ok) {
          adapters.baseline.updateBaseline({
            id: result.data.id,
            expectedUpdatedAt: result.data.updatedAt,
            patch: { baselineStatus: "INVALIDATED" },
          }).catch(function (err: unknown) {
            logBridgeFailure("baseline-registry", "updateBaseline", err);
          });
        }
      }).catch(function (err: unknown) {
        logBridgeFailure("baseline-registry", "getCanonicalBaseline-for-invalidate", err);
      });
    } catch (err) {
      logBridgeFailure("baseline-registry", "invalidateCanonicalBaseline-bootstrap", err);
    }

    _canonicalBaseline = {
      ..._canonicalBaseline,
      baselineStatus: "INVALIDATED",
      updatedAt: new Date(),
    };
  }
  _canonicalBaseline = null;
}

// ── Repository-First Async Read ──

/**
 * Repository-first read with legacy fallback.
 * Maps PersistedBaseline → BaselineRegistry with Date normalization.
 */
export async function getCanonicalBaselineFromRepo(): Promise<BaselineRegistry | null> {
  try {
    const adapters = getPersistenceAdapters();
    const result = await adapters.baseline.getCanonicalBaseline();
    if (result.ok) {
      const d = result.data;
      return {
        canonicalBaselineId: d.id,
        baselineVersion: d.baselineVersion,
        baselineHash: d.baselineHash,
        baselineSource: "PACKAGE1_COMPLETE_NEW_AI_INTEGRATED",
        baselineStatus: d.baselineStatus as BaselineStatus,
        lifecycleState: d.lifecycleState as LifecycleState,
        releaseMode: d.releaseMode as ReleaseMode,
        activeSnapshotId: d.activeSnapshotId || "",
        rollbackSnapshotId: d.rollbackSnapshotId || "",
        freezeReason: d.freezeReason || "",
        activePathManifestId: d.activePathManifestId || "",
        policySetVersion: d.policySetVersion || "",
        routingRuleVersion: d.routingRuleVersion || "",
        authorityRegistryVersion: d.authorityRegistryVersion || "",
        documentType: "",
        createdAt: normalizeDate(d.createdAt),
        updatedAt: normalizeDate(d.updatedAt),
      };
    }
  } catch (err) {
    logBridgeFailure("baseline-registry", "getCanonicalBaselineFromRepo", err);
  }
  // Fallback to legacy store
  return _canonicalBaseline;
}

/** 테스트용 — 상태 리셋 */
export function _resetBaselineRegistry(): void {
  _canonicalBaseline = null;
}
