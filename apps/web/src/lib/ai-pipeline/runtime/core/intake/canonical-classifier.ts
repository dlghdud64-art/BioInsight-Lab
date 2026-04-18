/**
 * S3 — Canonical Classifier
 *
 * 단일 classifier → 정확히 1개 classification.
 * ACTIVE_100 + FULL_ACTIVE_STABILIZATION에서 확장/실험/우회 → REJECTED_INTAKE.
 */

import type { CanonicalIntake, IntakeClassification } from "../../types/stabilization";

// ── Classification Map: requestedAction → classification ──

const STABILIZATION_CLASSIFICATION_MAP: ReadonlyMap<string, IntakeClassification> = new Map([
  ["STABILIZATION_VALIDATION_RUN", "STABILIZATION_VALIDATION"],
  ["FINAL_CONTAINMENT_START", "FINAL_CONTAINMENT"],
  ["FINAL_CONTAINMENT_EXECUTE", "FINAL_CONTAINMENT"],
  ["FINAL_CONTAINMENT_FINALIZE", "FINAL_CONTAINMENT"],
  ["EMERGENCY_ROLLBACK_START", "EMERGENCY_ROLLBACK"],
  ["EMERGENCY_ROLLBACK_EXECUTE", "EMERGENCY_ROLLBACK"],
  ["EMERGENCY_ROLLBACK_FINALIZE", "EMERGENCY_ROLLBACK"],
  ["AUDIT_FLUSH", "AUDIT_RECONCILIATION"],
  ["AUDIT_RECONCILE", "AUDIT_RECONCILIATION"],
  ["OBSERVABILITY_SYNC", "OBSERVABILITY_SYNC"],
  ["INCIDENT_ESCALATE", "INCIDENT_WORKFLOW"],
  ["INCIDENT_ACK", "INCIDENT_WORKFLOW"],
  ["READ_ONLY_STATUS_REFRESH", "READ_ONLY_STATUS"],
]);

// ── Reject actions in stabilization ──

const REJECTED_ACTIONS: ReadonlySet<string> = new Set([
  "FEATURE_ENABLE",
  "FEATURE_EXPAND",
  "EXPERIMENTAL_PATH_ENABLE",
  "STRUCTURAL_REFACTOR_APPLY",
  "UX_SCOPE_EXPAND",
  "ROUTING_OVERRIDE_UNVERIFIED",
  "AUTHORITY_OVERRIDE_DIRECT",
  "DEV_PATH_EXECUTE",
  "HOTPATCH_WITHOUT_STABILIZATION_TAG",
  "SILENT_RECOVERY",
]);

export interface ClassificationResult {
  classification: IntakeClassification;
  reasonCode: string;
}

export function classifyIntake(
  intake: CanonicalIntake,
  lifecycleState: string,
  releaseMode: string
): ClassificationResult {
  const isStabilization = lifecycleState === "ACTIVE_100" && releaseMode === "FULL_ACTIVE_STABILIZATION";

  // Rejected actions in stabilization
  if (isStabilization && REJECTED_ACTIONS.has(intake.requestedAction)) {
    return {
      classification: "REJECTED_INTAKE",
      reasonCode: "EXPANSION_BLOCKED_BY_STABILIZATION_MODE",
    };
  }

  // Known stabilization actions
  if (isStabilization) {
    const mapped = STABILIZATION_CLASSIFICATION_MAP.get(intake.requestedAction);
    if (mapped) {
      return { classification: mapped, reasonCode: "CLASSIFIED_BY_STABILIZATION_MAP" };
    }
    // unknown action → dead letter candidate
    return {
      classification: "DEAD_LETTER_CANDIDATE",
      reasonCode: "UNKNOWN_ACTION_IN_STABILIZATION",
    };
  }

  // Non-stabilization: map or dead-letter
  const mapped = STABILIZATION_CLASSIFICATION_MAP.get(intake.requestedAction);
  if (mapped) {
    return { classification: mapped, reasonCode: "CLASSIFIED_BY_MAP" };
  }

  return { classification: "DEAD_LETTER_CANDIDATE", reasonCode: "UNKNOWN_ACTION" };
}
