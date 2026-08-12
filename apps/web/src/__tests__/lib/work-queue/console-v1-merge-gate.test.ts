/**
 * Ops Console V1 — Merge Gate & Pilot Readiness 검증 테스트
 *
 * §1: 머지 게이트 분류 정합성
 * §2: 런타임 검증 체크리스트 정합성
 * §3: 파일럿 워크스루 결과 정합성
 * §4: 런타임 결함 분류 정합성
 * §5: 최종 머지 권고 정합성
 * §6: 편의 접근자 동작
 */

import {
  MERGE_GATE_ISSUES,
  RUNTIME_VALIDATION_CHECKLIST,
  PILOT_WALKTHROUGH_RESULTS,
  RUNTIME_DEFECTS,
  V1_MERGE_RECOMMENDATION,
  getMergeGateBlockers,
  getMergeGateNonBlockers,
  getMergeGateDeferred,
  getRuntimeValidationFailures,
  getPilotFailures,
  isMergeApproved,
  isPilotReady,
  type MergeGateIssue,
  type RuntimeValidationItem,
  type PilotWalkthroughResult,
  type RuntimeDefect,
} from "@/lib/work-queue/console-v1-merge-gate";

// ══════════════════════════════════════════════════════
// §1: Merge Gate Classification Integrity
// ══════════════════════════════════════════════════════

describe("§1: Merge Gate Classification", () => {
  it("should have exactly 10 classified issues", () => {
    expect(MERGE_GATE_ISSUES).toHaveLength(10);
  });

  it("should have zero blockers", () => {
    const blockers = MERGE_GATE_ISSUES.filter(
      (i: MergeGateIssue) => i.severity === "blocker",
    );
    expect(blockers).toHaveLength(0);
  });

  it("should have 6 non-blockers", () => {
    const nonBlockers = MERGE_GATE_ISSUES.filter(
      (i: MergeGateIssue) => i.severity === "non_blocker",
    );
    expect(nonBlockers).toHaveLength(6);
  });

  it("should have 4 deferred issues", () => {
    const deferred = MERGE_GATE_ISSUES.filter(
      (i: MergeGateIssue) => i.severity === "defer",
    );
    expect(deferred).toHaveLength(4);
  });

  it("should have unique issue IDs", () => {
    const ids = MERGE_GATE_ISSUES.map((i: MergeGateIssue) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should have all required fields for each issue", () => {
    MERGE_GATE_ISSUES.forEach((issue: MergeGateIssue) => {
      expect(issue.id).toBeTruthy();
      expect(issue.title).toBeTruthy();
      expect(["blocker", "non_blocker", "defer"]).toContain(issue.severity);
      expect(issue.affectedSurface).toBeTruthy();
      expect(issue.operatorImpact).toBeTruthy();
      expect(issue.pilotImpact).toBeTruthy();
      expect(issue.mergeDecision).toBeTruthy();
    });
  });
});

// ══════════════════════════════════════════════════════
// §2: Runtime Validation Checklist Integrity
// ══════════════════════════════════════════════════════

describe("§2: Runtime Validation Checklist", () => {
  it("should have 10 validation items", () => {
    expect(RUNTIME_VALIDATION_CHECKLIST).toHaveLength(10);
  });

  it("should have zero failures", () => {
    const failures = RUNTIME_VALIDATION_CHECKLIST.filter(
      (i: RuntimeValidationItem) => i.status === "fail",
    );
    expect(failures).toHaveLength(0);
  });

  it("should cover all console modes", () => {
    const areas = RUNTIME_VALIDATION_CHECKLIST.map(
      (i: RuntimeValidationItem) => i.area,
    );
    expect(areas).toContain("콘솔 모드 전환");
    expect(areas).toContain("일일 검토 모드");
    expect(areas).toContain("거버넌스 모드");
    expect(areas).toContain("개선 모드");
  });

  it("should have evidence for every item", () => {
    RUNTIME_VALIDATION_CHECKLIST.forEach((item: RuntimeValidationItem) => {
      expect(item.evidence.length).toBeGreaterThan(10);
    });
  });

  it("should annotate pass_with_note items with notes", () => {
    const noted = RUNTIME_VALIDATION_CHECKLIST.filter(
      (i: RuntimeValidationItem) => i.status === "pass_with_note",
    );
    expect(noted.length).toBeGreaterThan(0);
    noted.forEach((item: RuntimeValidationItem) => {
      expect(item.note).toBeTruthy();
    });
  });

  it("should have unique validation IDs", () => {
    const ids = RUNTIME_VALIDATION_CHECKLIST.map(
      (i: RuntimeValidationItem) => i.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ══════════════════════════════════════════════════════
// §3: Pilot Walkthrough Results Integrity
// ══════════════════════════════════════════════════════

describe("§3: Pilot Walkthrough Results", () => {
  it("should have 5 scenario results", () => {
    expect(PILOT_WALKTHROUGH_RESULTS).toHaveLength(5);
  });

  it("should have zero failures", () => {
    const fails = PILOT_WALKTHROUGH_RESULTS.filter(
      (r: PilotWalkthroughResult) => r.result === "fail",
    );
    expect(fails).toHaveLength(0);
  });

  it("should have all steps completed for every scenario", () => {
    PILOT_WALKTHROUGH_RESULTS.forEach((r: PilotWalkthroughResult) => {
      expect(r.completedSteps).toBe(r.totalSteps);
    });
  });

  it("should have no broken interactions in any scenario", () => {
    PILOT_WALKTHROUGH_RESULTS.forEach((r: PilotWalkthroughResult) => {
      expect(r.brokenInteractions).toHaveLength(0);
    });
  });

  it("should have no missing labels in any scenario", () => {
    PILOT_WALKTHROUGH_RESULTS.forEach((r: PilotWalkthroughResult) => {
      expect(r.missingLabels).toHaveLength(0);
    });
  });

  it("should classify all verdicts as non_blocker", () => {
    PILOT_WALKTHROUGH_RESULTS.forEach((r: PilotWalkthroughResult) => {
      expect(r.verdict).toBe("non_blocker");
    });
  });

  it("should cover the 5 canonical scenarios", () => {
    const ids = PILOT_WALKTHROUGH_RESULTS.map(
      (r: PilotWalkthroughResult) => r.scenarioId,
    );
    expect(ids).toContain("pilot_urgent_triage");
    expect(ids).toContain("pilot_approval_handling");
    expect(ids).toContain("pilot_handoff_escalation");
    expect(ids).toContain("pilot_blocked_review");
    expect(ids).toContain("pilot_remediation_lifecycle");
  });

  it("should document confusion points for pass_with_friction results", () => {
    const frictions = PILOT_WALKTHROUGH_RESULTS.filter(
      (r: PilotWalkthroughResult) => r.result === "pass_with_friction",
    );
    expect(frictions.length).toBeGreaterThan(0);
    frictions.forEach((r: PilotWalkthroughResult) => {
      expect(r.confusionPoints.length).toBeGreaterThan(0);
    });
  });
});

// ══════════════════════════════════════════════════════
// §4: Runtime Defect Classification Integrity
// ══════════════════════════════════════════════════════

describe("§4: Runtime Defect Capture", () => {
  it("should have 6 captured defects", () => {
    expect(RUNTIME_DEFECTS).toHaveLength(6);
  });

  it("should have zero critical defects", () => {
    const criticals = RUNTIME_DEFECTS.filter(
      (d: RuntimeDefect) => d.severity === "critical",
    );
    expect(criticals).toHaveLength(0);
  });

  it("should have zero blocker merge impacts", () => {
    const blockers = RUNTIME_DEFECTS.filter(
      (d: RuntimeDefect) => d.mergeImpact === "blocker",
    );
    expect(blockers).toHaveLength(0);
  });

  it("should have unique defect IDs", () => {
    const ids = RUNTIME_DEFECTS.map((d: RuntimeDefect) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should classify defects into valid severity levels", () => {
    RUNTIME_DEFECTS.forEach((d: RuntimeDefect) => {
      expect(["critical", "major", "minor", "cosmetic"]).toContain(d.severity);
    });
  });

  it("should have affected mode for each defect", () => {
    RUNTIME_DEFECTS.forEach((d: RuntimeDefect) => {
      expect(d.affectedMode).toBeTruthy();
    });
  });
});

// ══════════════════════════════════════════════════════
// §5: Final Merge Recommendation Integrity
// ══════════════════════════════════════════════════════

describe("§5: Final Merge Recommendation", () => {
  it("should recommend merge approval", () => {
    expect(V1_MERGE_RECOMMENDATION.mergeRecommendation).toBe("approve");
  });

  it("should recommend pilot ready", () => {
    expect(V1_MERGE_RECOMMENDATION.pilotRecommendation).toBe("ready");
  });

  it("should have zero blockers in list", () => {
    expect(V1_MERGE_RECOMMENDATION.blockerList).toHaveLength(0);
  });

  it("should have consistent non-blocker count", () => {
    expect(V1_MERGE_RECOMMENDATION.nonBlockerCount).toBe(
      V1_MERGE_RECOMMENDATION.nonBlockerList.length,
    );
  });

  it("should have consistent defer count", () => {
    expect(V1_MERGE_RECOMMENDATION.deferCount).toBe(
      V1_MERGE_RECOMMENDATION.deferList.length,
    );
  });

  it("should match blocker count with MERGE_GATE_ISSUES", () => {
    const actualBlockers = MERGE_GATE_ISSUES.filter(
      (i: MergeGateIssue) => i.severity === "blocker",
    ).length;
    expect(V1_MERGE_RECOMMENDATION.blockerCount).toBe(actualBlockers);
  });

  it("should have post-merge watchlist items", () => {
    expect(V1_MERGE_RECOMMENDATION.postMergeWatchlist.length).toBeGreaterThan(0);
  });

  it("should reference correct baseline", () => {
    expect(V1_MERGE_RECOMMENDATION.baseline).toBe("ce2475d");
  });

  it("should report total test count >= 100", () => {
    expect(V1_MERGE_RECOMMENDATION.totalTests).toBeGreaterThanOrEqual(100);
  });
});

// ══════════════════════════════════════════════════════
// §6: Convenience Accessors
// ══════════════════════════════════════════════════════

describe("§6: Convenience Accessors", () => {
  it("getMergeGateBlockers returns empty array", () => {
    expect(getMergeGateBlockers()).toHaveLength(0);
  });

  it("getMergeGateNonBlockers returns 6 items", () => {
    expect(getMergeGateNonBlockers()).toHaveLength(6);
  });

  it("getMergeGateDeferred returns 4 items", () => {
    expect(getMergeGateDeferred()).toHaveLength(4);
  });

  it("getRuntimeValidationFailures returns empty array", () => {
    expect(getRuntimeValidationFailures()).toHaveLength(0);
  });

  it("getPilotFailures returns empty array", () => {
    expect(getPilotFailures()).toHaveLength(0);
  });

  it("isMergeApproved returns true", () => {
    expect(isMergeApproved()).toBe(true);
  });

  it("isPilotReady returns true", () => {
    expect(isPilotReady()).toBe(true);
  });
});
