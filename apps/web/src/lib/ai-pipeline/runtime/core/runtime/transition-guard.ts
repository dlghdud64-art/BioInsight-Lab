/**
 * S1 — Transition Guard
 *
 * Table-driven lifecycle transition matrix.
 * ACTIVE_100 + FULL_ACTIVE_STABILIZATION: 허용 transition만 명시적 통과.
 * 정의되지 않은 transition은 전부 reject.
 */

import type {
  S1LifecycleState,
  S1ReleaseMode,
  BaselineStatus,
  TransitionRequest,
  TransitionResult,
} from "../../types/stabilization";
import { isCanonicalActiveCombination } from "../baseline/baseline-registry";

// ── Explicit Transition Table ──
// Key: `${from}|${releaseMode}` → Set of allowed target states

const TRANSITION_TABLE: ReadonlyMap<string, ReadonlySet<S1LifecycleState>> = new Map([
  // NORMAL mode transitions
  ["PRE_ACTIVE|NORMAL", new Set<S1LifecycleState>(["ACTIVE_25"])],
  ["ACTIVE_25|NORMAL", new Set<S1LifecycleState>(["ACTIVE_50", "PRE_ACTIVE"])],
  ["ACTIVE_50|NORMAL", new Set<S1LifecycleState>(["ACTIVE_75", "ACTIVE_25"])],
  ["ACTIVE_75|NORMAL", new Set<S1LifecycleState>(["ACTIVE_100", "ACTIVE_50"])],
  ["ACTIVE_100|NORMAL", new Set<S1LifecycleState>(["INCIDENT_LOCKDOWN"])],

  // FULL_ACTIVE_STABILIZATION — only rollback/lockdown allowed from ACTIVE_100
  ["ACTIVE_100|FULL_ACTIVE_STABILIZATION", new Set<S1LifecycleState>(["INCIDENT_LOCKDOWN"])],

  // EMERGENCY_ROLLBACK — from ACTIVE_100 or INCIDENT_LOCKDOWN
  ["ACTIVE_100|EMERGENCY_ROLLBACK", new Set<S1LifecycleState>(["ACTIVE_75", "ACTIVE_50", "ACTIVE_25", "PRE_ACTIVE", "INCIDENT_LOCKDOWN"])],
  ["INCIDENT_LOCKDOWN|EMERGENCY_ROLLBACK", new Set<S1LifecycleState>(["PRE_ACTIVE"])],

  // P1-3: Recovery path — INCIDENT_LOCKDOWN → ACTIVE_100 (recovery coordinator only)
  ["INCIDENT_LOCKDOWN|FULL_ACTIVE_STABILIZATION", new Set<S1LifecycleState>(["ACTIVE_100"])],
]);

/** lifecycle transition guard */
export function guardLifecycleTransition(req: TransitionRequest): TransitionResult {
  const key = `${req.currentState}|${req.releaseMode}`;
  const allowed = TRANSITION_TABLE.get(key);

  if (!allowed) {
    return {
      allowed: false,
      reasonCode: "INVALID_LIFECYCLE_TRANSITION",
      detail: `no transition defined for ${key}`,
    };
  }

  if (!allowed.has(req.targetState)) {
    return {
      allowed: false,
      reasonCode: "INVALID_LIFECYCLE_TRANSITION",
      detail: `${req.currentState} → ${req.targetState} not allowed in ${req.releaseMode}`,
    };
  }

  return {
    allowed: true,
    reasonCode: "TRANSITION_ALLOWED",
    detail: `${req.currentState} → ${req.targetState} in ${req.releaseMode}`,
  };
}

/** release mode transition guard */
export function guardReleaseModeTransition(
  currentMode: S1ReleaseMode,
  targetMode: S1ReleaseMode
): TransitionResult {
  const RELEASE_MODE_TABLE: ReadonlyMap<S1ReleaseMode, ReadonlySet<S1ReleaseMode>> = new Map([
    ["NORMAL", new Set<S1ReleaseMode>(["FULL_ACTIVE_STABILIZATION", "EMERGENCY_ROLLBACK"])],
    ["FULL_ACTIVE_STABILIZATION", new Set<S1ReleaseMode>(["EMERGENCY_ROLLBACK"])],
    ["EMERGENCY_ROLLBACK", new Set<S1ReleaseMode>(["NORMAL"])],
  ]);

  const allowed = RELEASE_MODE_TABLE.get(currentMode);
  if (!allowed || !allowed.has(targetMode)) {
    return {
      allowed: false,
      reasonCode: "INVALID_RELEASE_MODE_TRANSITION",
      detail: `${currentMode} → ${targetMode} not allowed`,
    };
  }

  return {
    allowed: true,
    reasonCode: "RELEASE_MODE_TRANSITION_ALLOWED",
    detail: `${currentMode} → ${targetMode}`,
  };
}

/** invalid combination guard */
export function guardCanonicalCombination(
  lifecycle: S1LifecycleState,
  release: S1ReleaseMode,
  baseline: BaselineStatus,
  flags: { stabilizationOnly: boolean; featureExpansionAllowed: boolean; devOnlyPathAllowed: boolean }
): TransitionResult {
  // Invalid combinations — explicit reject
  const INVALID_COMBOS: Array<{ l: S1LifecycleState; r: S1ReleaseMode; b: BaselineStatus | null; reason: string }> = [
    { l: "ACTIVE_100", r: "NORMAL", b: "FROZEN", reason: "ACTIVE_100 + NORMAL + FROZEN is invalid" },
  ];

  for (const combo of INVALID_COMBOS) {
    if (lifecycle === combo.l && release === combo.r && (combo.b === null || baseline === combo.b)) {
      return {
        allowed: false,
        reasonCode: "INVALID_CANONICAL_ACTIVE_COMBINATION",
        detail: combo.reason,
      };
    }
  }

  // ACTIVE_100 + FULL_ACTIVE_STABILIZATION requires FROZEN + correct flags
  if (lifecycle === "ACTIVE_100" && release === "FULL_ACTIVE_STABILIZATION") {
    if (baseline !== "FROZEN") {
      return {
        allowed: false,
        reasonCode: "INVALID_CANONICAL_ACTIVE_COMBINATION",
        detail: `ACTIVE_100 + FULL_ACTIVE_STABILIZATION requires FROZEN, got ${baseline}`,
      };
    }
    if (!flags.stabilizationOnly) {
      return {
        allowed: false,
        reasonCode: "INVALID_CANONICAL_ACTIVE_COMBINATION",
        detail: "ACTIVE_100 + FULL_ACTIVE_STABILIZATION requires stabilizationOnly=true",
      };
    }
    if (flags.featureExpansionAllowed) {
      return {
        allowed: false,
        reasonCode: "INVALID_CANONICAL_ACTIVE_COMBINATION",
        detail: "ACTIVE_100 + FULL_ACTIVE_STABILIZATION requires featureExpansionAllowed=false",
      };
    }
    if (flags.devOnlyPathAllowed) {
      return {
        allowed: false,
        reasonCode: "INVALID_CANONICAL_ACTIVE_COMBINATION",
        detail: "ACTIVE_100 + FULL_ACTIVE_STABILIZATION requires devOnlyPathAllowed=false",
      };
    }
  }

  return {
    allowed: true,
    reasonCode: "COMBINATION_VALID",
    detail: `${lifecycle}/${release}/${baseline} valid`,
  };
}
