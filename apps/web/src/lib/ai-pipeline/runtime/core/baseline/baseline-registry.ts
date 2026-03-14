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

// ── In-memory store (production에서는 Prisma/DB로 교체) ──

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
    _canonicalBaseline = {
      ..._canonicalBaseline,
      baselineStatus: "INVALIDATED",
      updatedAt: new Date(),
    };
  }
  _canonicalBaseline = null;
}

/** 테스트용 — 상태 리셋 */
export function _resetBaselineRegistry(): void {
  _canonicalBaseline = null;
}
