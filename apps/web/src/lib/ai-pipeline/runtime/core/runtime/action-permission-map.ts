/**
 * S1 — Action Permission Map
 *
 * ACTIVE_100 + FULL_ACTIVE_STABILIZATION: allowlist only.
 * 나머지 전부 deny.
 */

import type {
  S1LifecycleState,
  S1ReleaseMode,
  AllowedAction,
  BlockedAction,
  RuntimeAction,
  ActionPermissionResult,
} from "../../types/stabilization";

// ── Allowlist ──

const STABILIZATION_ALLOWED_ACTIONS: ReadonlySet<AllowedAction> = new Set([
  "EMERGENCY_ROLLBACK_START",
  "EMERGENCY_ROLLBACK_EXECUTE",
  "EMERGENCY_ROLLBACK_FINALIZE",
  "FINAL_CONTAINMENT_START",
  "FINAL_CONTAINMENT_EXECUTE",
  "FINAL_CONTAINMENT_FINALIZE",
  "AUDIT_FLUSH",
  "AUDIT_RECONCILE",
  "OBSERVABILITY_SYNC",
  "STABILIZATION_VALIDATION_RUN",
  "INCIDENT_ESCALATE",
  "INCIDENT_ACK",
  "READ_ONLY_STATUS_REFRESH",
]);

// ── Explicit Block List ──

const STABILIZATION_BLOCKED_ACTIONS: ReadonlySet<BlockedAction> = new Set([
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

// ── Dev/Test/Experimental Paths ──

const DEV_TEST_PATHS: ReadonlySet<string> = new Set([
  "DEV_PATH_EXECUTE",
  "EXPERIMENTAL_PATH_ENABLE",
  "TEST_HELPER_RUNTIME",
  "EXPERIMENTAL_BRANCH_TOGGLE",
]);

// ── Privileged Paths (명시적 action id로만 통과) ──

const PRIVILEGED_ACTIONS: ReadonlySet<string> = new Set([
  "EMERGENCY_ROLLBACK_START",
  "EMERGENCY_ROLLBACK_EXECUTE",
  "EMERGENCY_ROLLBACK_FINALIZE",
  "FINAL_CONTAINMENT_START",
  "FINAL_CONTAINMENT_EXECUTE",
  "FINAL_CONTAINMENT_FINALIZE",
  "AUDIT_FLUSH",
  "INCIDENT_ESCALATE",
]);

/** action permission 검사 */
export function checkActionPermission(
  lifecycle: S1LifecycleState,
  release: S1ReleaseMode,
  action: RuntimeAction
): ActionPermissionResult {
  // Dev/test/experimental path — always blocked in active runtime
  if (DEV_TEST_PATHS.has(action)) {
    return {
      allowed: false,
      action,
      reasonCode: "DEV_ONLY_PATH_BLOCKED",
      detail: `${action} is a dev/test/experimental path — blocked in active runtime`,
    };
  }

  // Only enforce stabilization rules for ACTIVE_100 + FULL_ACTIVE_STABILIZATION
  if (lifecycle === "ACTIVE_100" && release === "FULL_ACTIVE_STABILIZATION") {
    // Explicit block
    if (STABILIZATION_BLOCKED_ACTIONS.has(action as BlockedAction)) {
      return {
        allowed: false,
        action,
        reasonCode: "EXPANSION_BLOCKED_BY_STABILIZATION_MODE",
        detail: `${action} blocked in FULL_ACTIVE_STABILIZATION`,
      };
    }

    // Allowlist check
    if (STABILIZATION_ALLOWED_ACTIONS.has(action as AllowedAction)) {
      return {
        allowed: true,
        action,
        reasonCode: "ACTION_ALLOWED_IN_STABILIZATION",
        detail: `${action} allowed in ACTIVE_100 + FULL_ACTIVE_STABILIZATION`,
      };
    }

    // Not in allowlist → deny
    return {
      allowed: false,
      action,
      reasonCode: "ACTION_NOT_ALLOWED_IN_FULL_ACTIVE_STABILIZATION",
      detail: `${action} not in stabilization allowlist — default deny`,
    };
  }

  // INCIDENT_LOCKDOWN — only incident-related + read-only
  if (lifecycle === "INCIDENT_LOCKDOWN") {
    const lockdownAllowed: ReadonlySet<string> = new Set([
      "INCIDENT_ESCALATE",
      "INCIDENT_ACK",
      "AUDIT_FLUSH",
      "AUDIT_RECONCILE",
      "READ_ONLY_STATUS_REFRESH",
      "EMERGENCY_ROLLBACK_START",
      "EMERGENCY_ROLLBACK_EXECUTE",
      "EMERGENCY_ROLLBACK_FINALIZE",
    ]);
    if (lockdownAllowed.has(action)) {
      return {
        allowed: true,
        action,
        reasonCode: "ACTION_ALLOWED_IN_LOCKDOWN",
        detail: `${action} allowed in INCIDENT_LOCKDOWN`,
      };
    }
    return {
      allowed: false,
      action,
      reasonCode: "ACTION_NOT_ALLOWED_IN_FULL_ACTIVE_STABILIZATION",
      detail: `${action} blocked in INCIDENT_LOCKDOWN`,
    };
  }

  // Non-stabilization modes — allow by default (normal operations)
  return {
    allowed: true,
    action,
    reasonCode: "ACTION_ALLOWED_NORMAL_MODE",
    detail: `${action} allowed in ${lifecycle}/${release}`,
  };
}

/** privileged path 여부 확인 */
export function isPrivilegedAction(action: string): boolean {
  return PRIVILEGED_ACTIONS.has(action);
}
