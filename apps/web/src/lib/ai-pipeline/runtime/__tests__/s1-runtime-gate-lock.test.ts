/**
 * S1 — Runtime Gate Lock 테스트
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  guardLifecycleTransition,
  guardReleaseModeTransition,
  guardCanonicalCombination,
} from "../core/runtime/transition-guard";
import { checkActionPermission, isPrivilegedAction } from "../core/runtime/action-permission-map";
import { requestTransition, requestAction, _resetRejectEvents, getRejectEvents } from "../core/runtime/runtime-gate";
import { _resetAuditEvents, getAuditEvents } from "../core/audit/audit-events";

describe("S1: Runtime Gate Lock", () => {
  beforeEach(() => {
    _resetRejectEvents();
    _resetAuditEvents();
  });

  // 1. ACTIVE_100 FULL_ACTIVE_STABILIZATION valid transition allow test
  it("should allow ACTIVE_100 → INCIDENT_LOCKDOWN in FULL_ACTIVE_STABILIZATION", () => {
    const result = guardLifecycleTransition({
      currentState: "ACTIVE_100",
      targetState: "INCIDENT_LOCKDOWN",
      releaseMode: "FULL_ACTIVE_STABILIZATION",
      baselineStatus: "FROZEN",
      actor: "ops",
      reason: "incident",
      correlationId: "c1",
    });
    expect(result.allowed).toBe(true);
  });

  // 2. invalid lifecycle transition reject test
  it("should reject ACTIVE_100 → ACTIVE_25 in FULL_ACTIVE_STABILIZATION", () => {
    const result = guardLifecycleTransition({
      currentState: "ACTIVE_100",
      targetState: "ACTIVE_25",
      releaseMode: "FULL_ACTIVE_STABILIZATION",
      baselineStatus: "FROZEN",
      actor: "ops",
      reason: "test",
      correlationId: "c2",
    });
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("INVALID_LIFECYCLE_TRANSITION");
  });

  // 3. invalid release mode transition reject test
  it("should reject FULL_ACTIVE_STABILIZATION → NORMAL", () => {
    const result = guardReleaseModeTransition("FULL_ACTIVE_STABILIZATION", "NORMAL");
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("INVALID_RELEASE_MODE_TRANSITION");
  });

  // 4. invalid canonical combination reject test
  it("should reject ACTIVE_100 + NORMAL + FROZEN", () => {
    const result = guardCanonicalCombination("ACTIVE_100", "NORMAL", "FROZEN", {
      stabilizationOnly: true,
      featureExpansionAllowed: false,
      devOnlyPathAllowed: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("INVALID_CANONICAL_ACTIVE_COMBINATION");
  });

  // 5. non-allowlisted action deny test
  it("should deny unknown action in ACTIVE_100 + FULL_ACTIVE_STABILIZATION", () => {
    const result = checkActionPermission("ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "SOME_RANDOM_ACTION");
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("ACTION_NOT_ALLOWED_IN_FULL_ACTIVE_STABILIZATION");
  });

  // 6. emergency rollback privileged path allow test
  it("should allow EMERGENCY_ROLLBACK_START in ACTIVE_100 + FULL_ACTIVE_STABILIZATION", () => {
    const result = checkActionPermission("ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "EMERGENCY_ROLLBACK_START");
    expect(result.allowed).toBe(true);
    expect(isPrivilegedAction("EMERGENCY_ROLLBACK_START")).toBe(true);
  });

  // 7. final containment privileged path allow test
  it("should allow FINAL_CONTAINMENT_EXECUTE in ACTIVE_100 + FULL_ACTIVE_STABILIZATION", () => {
    const result = checkActionPermission("ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "FINAL_CONTAINMENT_EXECUTE");
    expect(result.allowed).toBe(true);
    expect(isPrivilegedAction("FINAL_CONTAINMENT_EXECUTE")).toBe(true);
  });

  // 8. dev-only path blocked test
  it("should block DEV_PATH_EXECUTE in any active runtime", () => {
    const result = checkActionPermission("ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "DEV_PATH_EXECUTE");
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("DEV_ONLY_PATH_BLOCKED");
  });

  // 9. feature expansion blocked in stabilization mode test
  it("should block FEATURE_ENABLE in FULL_ACTIVE_STABILIZATION", () => {
    const result = checkActionPermission("ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "FEATURE_ENABLE");
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("EXPANSION_BLOCKED_BY_STABILIZATION_MODE");
  });

  // 10. reject event audit written test
  it("should write audit event on reject", () => {
    requestAction("ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "FROZEN", "FEATURE_EXPAND", "user1", "cor-1");
    const rejects = getRejectEvents();
    expect(rejects.length).toBeGreaterThan(0);
    expect(rejects[0]!.reasonCode).toBe("EXPANSION_BLOCKED_BY_STABILIZATION_MODE");

    const audits = getAuditEvents();
    const denyAudits = audits.filter((a) => a.eventType === "ACTION_DENIED");
    expect(denyAudits.length).toBeGreaterThan(0);
  });

  // Extra: ACTIVE_100 + FULL_ACTIVE_STABILIZATION + UNFROZEN invalid
  it("should reject ACTIVE_100 + FULL_ACTIVE_STABILIZATION + UNFROZEN combination", () => {
    const result = guardCanonicalCombination("ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "UNFROZEN", {
      stabilizationOnly: true,
      featureExpansionAllowed: false,
      devOnlyPathAllowed: false,
    });
    expect(result.allowed).toBe(false);
  });

  // Extra: requestTransition writes audit on allow
  it("should write audit on allowed transition", () => {
    requestTransition({
      currentState: "ACTIVE_100",
      targetState: "INCIDENT_LOCKDOWN",
      releaseMode: "FULL_ACTIVE_STABILIZATION",
      baselineStatus: "FROZEN",
      actor: "ops",
      reason: "incident detected",
      correlationId: "cor-2",
    });
    const audits = getAuditEvents();
    const allowed = audits.filter((a) => a.eventType === "TRANSITION_ALLOWED");
    expect(allowed.length).toBeGreaterThan(0);
  });
});
