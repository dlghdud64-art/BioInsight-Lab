/**
 * S0 — Stabilization Policy (Freeze Gate)
 *
 * 허용 change class: allowlist 방식
 * 차단 대상: new feature, experimental flag, large refactor, ux scope expansion, naming-only, layout churn
 * stabilizationTag 없으면 merge 불가
 */

import type {
  AllowedChangeClass,
  BlockedChangeClass,
  ChangeRequestMetadata,
  StabilizationChangePolicy,
  DEFAULT_STABILIZATION_POLICY,
} from "../../types/stabilization";

const ALLOWED_CHANGE_CLASSES: ReadonlySet<string> = new Set<AllowedChangeClass>([
  "ROLLBACK_RELIABILITY_FIX",
  "CONTAINMENT_HARDENING",
  "ROUTING_INTEGRITY_FIX",
  "AUTHORITY_CONSISTENCY_FIX",
  "AUDIT_COMPLETENESS_FIX",
  "OBSERVABILITY_FIX",
]);

const BLOCKED_CHANGE_CLASSES: ReadonlySet<string> = new Set<BlockedChangeClass>([
  "NEW_FEATURE",
  "EXPERIMENTAL_FLAG",
  "LARGE_REFACTOR",
  "UX_SCOPE_EXPANSION",
  "NAMING_ONLY_CHANGE",
  "LAYOUT_CHURN",
]);

export interface FreezeGateResult {
  allowed: boolean;
  reason: string;
  missingFields: string[];
}

/** freeze gate: stabilization mode에서의 change request 검증 */
export function evaluateFreezeGate(
  metadata: Partial<ChangeRequestMetadata>,
  stabilizationActive: boolean
): FreezeGateResult {
  if (!stabilizationActive) {
    return { allowed: true, reason: "stabilization not active", missingFields: [] };
  }

  const missingFields: string[] = [];

  // stabilizationTag 필수
  if (!metadata.stabilizationTag) {
    missingFields.push("stabilizationTag");
  }

  // changeClass 필수
  if (!metadata.changeClass) {
    missingFields.push("changeClass");
  }

  // justification 필수
  if (!metadata.justification) {
    missingFields.push("justification");
  }

  // rollbackImpact 필수
  if (!metadata.rollbackImpact) {
    missingFields.push("rollbackImpact");
  }

  // auditLink 필수
  if (!metadata.auditLink) {
    missingFields.push("auditLink");
  }

  if (missingFields.length > 0) {
    return {
      allowed: false,
      reason: `MISSING_METADATA: ${missingFields.join(", ")}`,
      missingFields,
    };
  }

  // stabilizationTag prefix 검사
  if (!metadata.stabilizationTag!.startsWith("STABILIZATION_")) {
    return {
      allowed: false,
      reason: `INVALID_TAG: stabilizationTag must start with 'STABILIZATION_', got '${metadata.stabilizationTag}'`,
      missingFields: [],
    };
  }

  // change class allowlist 검사
  if (BLOCKED_CHANGE_CLASSES.has(metadata.changeClass!)) {
    return {
      allowed: false,
      reason: `BLOCKED_CHANGE_CLASS: '${metadata.changeClass}' is blocked during stabilization`,
      missingFields: [],
    };
  }

  if (!ALLOWED_CHANGE_CLASSES.has(metadata.changeClass!)) {
    return {
      allowed: false,
      reason: `UNKNOWN_CHANGE_CLASS: '${metadata.changeClass}' is not in the allowlist`,
      missingFields: [],
    };
  }

  return { allowed: true, reason: "freeze gate passed", missingFields: [] };
}
