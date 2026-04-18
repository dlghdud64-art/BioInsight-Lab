// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Batch 17 — Operational Readiness Final Gate Test
 *
 * OR1-OR33: 33 scenarios across 7 categories + verdict + snapshot + surface
 *
 * Part A: Category evaluators (OR1-OR14)
 * Part B: Verdict logic (OR15-OR21)
 * Part C: Scope recommendation (OR22-OR25)
 * Part D: Release candidate snapshot (OR26-OR28)
 * Part E: Surface builder (OR29-OR33)
 */
import { describe, it, expect } from "vitest";

import {
  evaluateStructureIntegrity,
  evaluateRuntimeHealth,
  evaluateMutationSafety,
  evaluatePilotSafety,
  evaluateObservability,
  evaluateOperationalContinuity,
  evaluateScopeControl,
  evaluateOperationalReadinessGate,
  buildReleaseCandidateSnapshot,
  buildOperationalReadinessSurface,
  buildActivationScopeRecommendation,
  GATE_CATEGORY_LABELS,
  type OperationalReadinessInput,
  type GateCategoryId,
} from "../operational-readiness-gate-engine";

import type { ReleaseReadinessResult } from "../release-readiness-engine";
import type { AppRuntimeSignalReport, SignalCheckResult } from "../app-runtime-signal-provider";
import type { PilotPlan } from "../pilot-activation-engine";
import type { ProductAcceptanceReport } from "../product-acceptance-engine";
import type { ComplianceSnapshot } from "../governance-audit-engine";
import type { RollbackEvaluationResult } from "../pilot-monitoring-engine";

// ══════════════════════════════════════════════════════
// Shared Fixtures
// ══════════════════════════════════════════════════════

const NOW = new Date().toISOString();

function makeSignal(id: string, name: string, passed: boolean, score: number, severity: "info" | "warning" | "critical" = "info"): SignalCheckResult {
  return { signalId: id, name, severity, severityLabel: severity, passed, score, detail: `${name} detail`, issues: passed ? [] : [`${name} issue`], remediation: null };
}

function makeHealthySignalReport(): AppRuntimeSignalReport {
  return {
    evaluatedAt: NOW,
    signals: [
      makeSignal("RS-1", "Grammar Coverage", true, 100),
      makeSignal("RS-2", "Hardening Pipeline", true, 95),
      makeSignal("RS-3", "Event Bus Health", true, 90),
      makeSignal("RS-4", "Audit Wiring", true, 85),
      makeSignal("RS-5", "Pilot Safety", true, 90),
    ],
    overallHealthy: true,
    overallScore: 92,
    criticalIssues: [],
    warningIssues: [],
  };
}

function makeReadyRelease(): ReleaseReadinessResult {
  return {
    resultId: "rr-001",
    evaluatedAt: NOW,
    verdict: "ready",
    totalChecks: 20,
    passed: 20,
    failed: 0,
    warnings: 0,
    checks: [],
    blockers: [],
    warningChecks: [],
  };
}

function makeAcceptedReport(): ProductAcceptanceReport {
  return {
    reportId: "pa-001",
    evaluatedAt: NOW,
    scenarios: [
      { scenarioId: "A", name: "정상 폐루프", description: "", steps: [], passed: true, failedSteps: [], totalSteps: 8, passedSteps: 8, evidence: [] },
      { scenarioId: "B", name: "변경 재개방", description: "", steps: [], passed: true, failedSteps: [], totalSteps: 5, passedSteps: 5, evidence: [] },
      { scenarioId: "C", name: "입고 이상", description: "", steps: [], passed: true, failedSteps: [], totalSteps: 6, passedSteps: 6, evidence: [] },
      { scenarioId: "D", name: "stale", description: "", steps: [], passed: true, failedSteps: [], totalSteps: 4, passedSteps: 4, evidence: [] },
      { scenarioId: "E", name: "multi-actor", description: "", steps: [], passed: true, failedSteps: [], totalSteps: 4, passedSteps: 4, evidence: [] },
      { scenarioId: "F", name: "pilot rollback", description: "", steps: [], passed: true, failedSteps: [], totalSteps: 6, passedSteps: 6, evidence: [] },
    ],
    verdict: "accepted",
    totalScenarios: 6,
    passedScenarios: 6,
    failedScenarios: 0,
    criticalFailures: [],
    overallEvidence: [],
  };
}

function makePilotPlan(): PilotPlan {
  return {
    planId: "pilot-001",
    createdAt: NOW,
    readinessResultId: "rr-001",
    readinessScore: 92,
    includedStages: [
      { stage: "quote_review", stageLabel: "견적 검토" },
      { stage: "approval", stageLabel: "승인" },
      { stage: "po_conversion", stageLabel: "PO 변환" },
    ],
    activeDomains: ["quote_chain", "dispatch_prep"],
    poCountLimit: 20,
    durationDays: 30,
    checklist: [
      { itemId: "chk-1", category: "technical", description: "role gating 설정", checked: true, checkedBy: "admin", checkedAt: NOW, required: true },
      { itemId: "chk-2", category: "operational", description: "모니터링 구성", checked: true, checkedBy: "admin", checkedAt: NOW, required: true },
      { itemId: "chk-3", category: "compliance", description: "rollback 절차 확인", checked: true, checkedBy: "admin", checkedAt: NOW, required: true },
    ],
    rollbackPlan: {
      triggers: [
        { triggerId: "t1", severity: "critical", severityLabel: "심각", condition: "signal breach", description: "critical signal 2건 이상" },
        { triggerId: "t2", severity: "warning", severityLabel: "경고", condition: "non-compliant surge", description: "미준수 50% 초과" },
        { triggerId: "t3", severity: "critical", severityLabel: "심각", condition: "blocked chain", description: "체인 30분 이상 블록" },
      ],
      steps: [
        { stepId: "rs-1", description: "파일럿 비활성화", order: 1 },
        { stepId: "rs-2", description: "감사 스냅샷 캡처", order: 2 },
      ],
      authorizedRoles: ["release_manager", "ops_lead"],
      maxRollbackHours: 4,
    },
    monitoringConfig: {
      dashboardEnabled: true,
      signalCheckIntervalMin: 5,
      complianceSnapshotIntervalMin: 30,
      alertChannels: ["slack"],
    },
    status: "ready_to_activate",
  } as any; // PilotPlan interface might have slight variations
}

function makeComplianceSnapshots(): ComplianceSnapshot[] {
  return [
    {
      snapshotId: "cs-001",
      capturedAt: new Date(Date.now() - 3600000).toISOString(), // 1시간 전
      trigger: "periodic",
      triggeredBy: "system",
      poNumber: "PO-001",
      caseId: "case-001",
      currentStage: "dispatch_prep",
      currentStageLabel: "발송 준비",
      currentStatus: "ready_to_send",
      currentStatusLabel: "발송 가능",
      verdict: "compliant",
      verdictLabel: "준수",
      issues: [],
      fieldSnapshots: [],
    } as any,
  ];
}

function makeRollbackEvaluation(): RollbackEvaluationResult {
  return {
    recommendation: "none",
    triggersHit: [],
    triggerCount: 0,
    maxSeverity: null,
    evaluatedAt: NOW,
    signalAge: { calculatedAt: NOW, ageMs: 1000, stale: false },
  };
}

function makeFullInput(overrides?: Partial<OperationalReadinessInput>): OperationalReadinessInput {
  return {
    releaseReadiness: makeReadyRelease(),
    runtimeSignalReport: makeHealthySignalReport(),
    pilotPlan: makePilotPlan(),
    acceptanceReport: makeAcceptedReport(),
    complianceSnapshots: makeComplianceSnapshots(),
    rollbackEvaluation: makeRollbackEvaluation(),
    auditLogAvailable: true,
    complianceSnapshotStoreAvailable: true,
    reportingAvailable: true,
    reconnectMechanismExists: true,
    replayMechanismExists: true,
    persistenceLayerHealthy: true,
    recoveryTestedRecently: true,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════
// Part A: Category Evaluators (OR1–OR14)
// ══════════════════════════════════════════════════════

describe("A. Category Evaluators", () => {
  // ── Structure Integrity ──
  it("OR1: 전체 통과 → structure integrity passed", () => {
    const input = makeFullInput();
    const result = evaluateStructureIntegrity(input);
    expect(result.categoryId).toBe("structure_integrity");
    expect(result.passed).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.score).toBe(100);
  });

  it("OR2: release blocked → structure integrity blocker", () => {
    const input = makeFullInput({ releaseReadiness: { ...makeReadyRelease(), verdict: "blocked", failed: 3 } });
    const result = evaluateStructureIntegrity(input);
    expect(result.passed).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.blockers[0].impact).toBe("blocker");
  });

  it("OR3: acceptance rejected → structure integrity blocker", () => {
    const report = makeAcceptedReport();
    report.verdict = "rejected";
    report.failedScenarios = 2;
    report.criticalFailures = ["A. 정상 폐루프 실패"];
    const input = makeFullInput({ acceptanceReport: report });
    const result = evaluateStructureIntegrity(input);
    expect(result.passed).toBe(false);
    expect(result.blockers.some(b => b.issueId === "SI-3")).toBe(true);
  });

  // ── Runtime Health ──
  it("OR4: healthy runtime → runtime health passed", () => {
    const input = makeFullInput();
    const result = evaluateRuntimeHealth(input);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(92);
  });

  it("OR5: critical signal 실패 → runtime health blocker", () => {
    const report = makeHealthySignalReport();
    report.overallHealthy = false;
    report.signals[1] = makeSignal("RS-2", "Hardening Pipeline", false, 20, "critical");
    report.criticalIssues = ["Hardening Pipeline issue"];
    const input = makeFullInput({ runtimeSignalReport: report });
    const result = evaluateRuntimeHealth(input);
    expect(result.passed).toBe(false);
    expect(result.blockers.some(b => b.issueId === "RH-RS-2")).toBe(true);
  });

  // ── Mutation Safety ──
  it("OR6: hardening + protection 통과 → mutation safety passed", () => {
    const input = makeFullInput();
    const result = evaluateMutationSafety(input);
    expect(result.passed).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it("OR7: scenario E 실패 → mutation safety blocker", () => {
    const report = makeAcceptedReport();
    report.scenarios[4] = { ...report.scenarios[4], passed: false, failedSteps: ["E-IAP"] };
    const input = makeFullInput({ acceptanceReport: report });
    const result = evaluateMutationSafety(input);
    expect(result.passed).toBe(false);
    expect(result.blockers.some(b => b.issueId === "MS-3")).toBe(true);
  });

  // ── Pilot Safety ──
  it("OR8: 완전한 pilot plan → pilot safety passed", () => {
    const input = makeFullInput();
    const result = evaluatePilotSafety(input);
    expect(result.passed).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it("OR9: pilot plan 없음 → pilot safety blocker", () => {
    const input = makeFullInput({ pilotPlan: null });
    const result = evaluatePilotSafety(input);
    expect(result.passed).toBe(false);
    expect(result.blockers.some(b => b.issueId === "PS-1")).toBe(true);
  });

  it("OR10: 체크리스트 미완료 → pilot safety blocker", () => {
    const plan = makePilotPlan();
    plan.checklist[2].checked = false;
    const input = makeFullInput({ pilotPlan: plan });
    const result = evaluatePilotSafety(input);
    expect(result.passed).toBe(false);
    expect(result.blockers.some(b => b.issueId === "PS-2")).toBe(true);
  });

  it("OR11: rollback_required → pilot safety blocker", () => {
    const rollback = makeRollbackEvaluation();
    rollback.recommendation = "rollback_required";
    rollback.triggerCount = 3;
    const input = makeFullInput({ rollbackEvaluation: rollback });
    const result = evaluatePilotSafety(input);
    expect(result.passed).toBe(false);
    expect(result.blockers.some(b => b.issueId === "PS-4")).toBe(true);
  });

  // ── Observability ──
  it("OR12: 전체 가용 → observability passed", () => {
    const input = makeFullInput();
    const result = evaluateObservability(input);
    expect(result.passed).toBe(true);
  });

  it("OR13: audit log 불가 → observability blocker", () => {
    const input = makeFullInput({ auditLogAvailable: false });
    const result = evaluateObservability(input);
    expect(result.passed).toBe(false);
    expect(result.blockers.some(b => b.issueId === "OB-1")).toBe(true);
  });

  // ── Operational Continuity ──
  it("OR14: 전체 연속성 확보 → continuity passed", () => {
    const input = makeFullInput();
    const result = evaluateOperationalContinuity(input);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });
});

// ══════════════════════════════════════════════════════
// Part B: Verdict Logic (OR15–OR21)
// ══════════════════════════════════════════════════════

describe("B. Verdict Logic", () => {
  it("OR15: 전체 통과 → go", () => {
    const input = makeFullInput();
    const verdict = evaluateOperationalReadinessGate(input);
    expect(verdict.verdict).toBe("go");
    expect(verdict.totalBlockers).toBe(0);
    expect(verdict.totalConditionals).toBe(0);
    expect(verdict.passedCategories).toBe(7);
  });

  it("OR16: blocker 1건 → no_go", () => {
    const input = makeFullInput({ auditLogAvailable: false });
    const verdict = evaluateOperationalReadinessGate(input);
    expect(verdict.verdict).toBe("no_go");
    expect(verdict.totalBlockers).toBeGreaterThan(0);
  });

  it("OR17: conditional만 → conditional_go", () => {
    const input = makeFullInput({ reportingAvailable: false, recoveryTestedRecently: false });
    const verdict = evaluateOperationalReadinessGate(input);
    expect(verdict.verdict).toBe("conditional_go");
    expect(verdict.totalBlockers).toBe(0);
    expect(verdict.totalConditionals).toBeGreaterThan(0);
  });

  it("OR18: blocker + conditional 혼합 → no_go (blocker 우선)", () => {
    const input = makeFullInput({ auditLogAvailable: false, reportingAvailable: false });
    const verdict = evaluateOperationalReadinessGate(input);
    expect(verdict.verdict).toBe("no_go");
  });

  it("OR19: 7개 category 전량 평가", () => {
    const input = makeFullInput();
    const verdict = evaluateOperationalReadinessGate(input);
    expect(verdict.categoryCount).toBe(7);
    expect(verdict.categories.length).toBe(7);
    const ids = verdict.categories.map(c => c.categoryId);
    expect(ids).toContain("structure_integrity");
    expect(ids).toContain("runtime_health");
    expect(ids).toContain("mutation_safety");
    expect(ids).toContain("pilot_safety");
    expect(ids).toContain("observability");
    expect(ids).toContain("operational_continuity");
    expect(ids).toContain("scope_control");
  });

  it("OR20: overall score는 category 평균", () => {
    const input = makeFullInput();
    const verdict = evaluateOperationalReadinessGate(input);
    const expectedAvg = Math.round(verdict.categories.reduce((s, c) => s + c.score, 0) / 7);
    expect(verdict.overallScore).toBe(expectedAvg);
  });

  it("OR21: critical blocker가 score 높아도 go 차단", () => {
    // High runtime score but missing audit → blocker
    const input = makeFullInput({ auditLogAvailable: false });
    const verdict = evaluateOperationalReadinessGate(input);
    // Runtime is still healthy
    const runtime = verdict.categories.find(c => c.categoryId === "runtime_health");
    expect(runtime!.score).toBeGreaterThan(80);
    // But verdict is still no_go
    expect(verdict.verdict).toBe("no_go");
  });
});

// ══════════════════════════════════════════════════════
// Part C: Scope Recommendation (OR22–OR25)
// ══════════════════════════════════════════════════════

describe("C. Scope Recommendation", () => {
  it("OR22: go + high score → pilot_expanded", () => {
    const input = makeFullInput();
    const verdict = evaluateOperationalReadinessGate(input);
    expect(verdict.verdict).toBe("go");
    expect(verdict.scopeRecommendation.scope).toBe("pilot_expanded");
  });

  it("OR23: conditional_go → pilot_limited", () => {
    const input = makeFullInput({ reportingAvailable: false });
    const verdict = evaluateOperationalReadinessGate(input);
    expect(verdict.verdict).toBe("conditional_go");
    expect(verdict.scopeRecommendation.scope).toBe("pilot_limited");
    expect(verdict.scopeRecommendation.suggestedPoLimit).toBeLessThanOrEqual(10);
  });

  it("OR24: no_go → hold", () => {
    const input = makeFullInput({ pilotPlan: null });
    const verdict = evaluateOperationalReadinessGate(input);
    expect(verdict.verdict).toBe("no_go");
    expect(verdict.scopeRecommendation.scope).toBe("hold");
    expect(verdict.scopeRecommendation.suggestedPoLimit).toBe(0);
  });

  it("OR25: scope에 suggestedDomains / duration 포함", () => {
    const input = makeFullInput();
    const verdict = evaluateOperationalReadinessGate(input);
    expect(verdict.scopeRecommendation.suggestedDomains.length).toBeGreaterThan(0);
    expect(verdict.scopeRecommendation.suggestedDurationDays).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════
// Part D: Release Candidate Snapshot (OR26–OR28)
// ══════════════════════════════════════════════════════

describe("D. Release Candidate Snapshot", () => {
  it("OR26: snapshot에 모든 필수 필드 존재", () => {
    const input = makeFullInput();
    const verdict = evaluateOperationalReadinessGate(input);
    const snapshot = buildReleaseCandidateSnapshot(input, verdict, "admin-001");
    expect(snapshot.snapshotId).toBeDefined();
    expect(snapshot.capturedAt).toBeDefined();
    expect(snapshot.grammarVersion).toBeDefined();
    expect(snapshot.runtimeSignalSummary).toBeDefined();
    expect(snapshot.acceptanceVerdict).toBe("accepted");
    expect(snapshot.pilotPlanId).toBe("pilot-001");
    expect(snapshot.gateVerdict).toBe("go");
    expect(snapshot.approver).toBe("admin-001");
    expect(snapshot.recommendedScope).toBeDefined();
  });

  it("OR27: compliance summary 포함", () => {
    const input = makeFullInput();
    const verdict = evaluateOperationalReadinessGate(input);
    const snapshot = buildReleaseCandidateSnapshot(input, verdict, null);
    expect(snapshot.complianceSummary.totalSnapshots).toBe(1);
    expect(snapshot.complianceSummary.nonCompliantCount).toBe(0);
  });

  it("OR28: runtime signal summary 반영", () => {
    const input = makeFullInput();
    const verdict = evaluateOperationalReadinessGate(input);
    const snapshot = buildReleaseCandidateSnapshot(input, verdict, null);
    expect(snapshot.runtimeSignalSummary.overallScore).toBe(92);
    expect(snapshot.runtimeSignalSummary.overallHealthy).toBe(true);
    expect(snapshot.runtimeSignalSummary.criticalCount).toBe(0);
  });
});

// ══════════════════════════════════════════════════════
// Part E: Surface Builder (OR29–OR33)
// ══════════════════════════════════════════════════════

describe("E. Surface Builder", () => {
  it("OR29: surface center에 verdict + category breakdown 포함", () => {
    const input = makeFullInput();
    const verdict = evaluateOperationalReadinessGate(input);
    const snapshot = buildReleaseCandidateSnapshot(input, verdict, null);
    const surface = buildOperationalReadinessSurface(verdict, input, snapshot);
    expect(surface.center.verdict).toBe("go");
    expect(surface.center.categoryBreakdown.length).toBe(7);
    expect(surface.center.overallScore).toBeGreaterThan(0);
  });

  it("OR30: surface rail에 runtime signals + compliance + pilot scope 포함", () => {
    const input = makeFullInput();
    const verdict = evaluateOperationalReadinessGate(input);
    const snapshot = buildReleaseCandidateSnapshot(input, verdict, null);
    const surface = buildOperationalReadinessSurface(verdict, input, snapshot);
    expect(surface.rail.runtimeSignals.length).toBe(5);
    expect(surface.rail.complianceSummary).toBeDefined();
    expect(surface.rail.pilotScope).toBeDefined();
    expect(surface.rail.rollbackReadiness).toBeDefined();
    expect(surface.rail.acceptanceSummary).toBeDefined();
  });

  it("OR31: surface dock에 6개 action 포함", () => {
    const input = makeFullInput();
    const verdict = evaluateOperationalReadinessGate(input);
    const snapshot = buildReleaseCandidateSnapshot(input, verdict, null);
    const surface = buildOperationalReadinessSurface(verdict, input, snapshot);
    expect(surface.dock.actions.length).toBe(6);
    const keys = surface.dock.actions.map(a => a.actionKey);
    expect(keys).toContain("approve_go");
    expect(keys).toContain("approve_conditional_go");
    expect(keys).toContain("reject_hold");
    expect(keys).toContain("open_pilot_workbench");
    expect(keys).toContain("open_audit_review");
    expect(keys).toContain("export_gate_snapshot");
  });

  it("OR32: no_go verdict → approve_go disabled", () => {
    const input = makeFullInput({ pilotPlan: null });
    const verdict = evaluateOperationalReadinessGate(input);
    const snapshot = buildReleaseCandidateSnapshot(input, verdict, null);
    const surface = buildOperationalReadinessSurface(verdict, input, snapshot);
    const goAction = surface.dock.actions.find(a => a.actionKey === "approve_go");
    expect(goAction!.enabled).toBe(false);
    expect(goAction!.disabledReason).toBeDefined();
  });

  it("OR33: go verdict → approve_go + approve_conditional_go 모두 enabled", () => {
    const input = makeFullInput();
    const verdict = evaluateOperationalReadinessGate(input);
    const snapshot = buildReleaseCandidateSnapshot(input, verdict, null);
    const surface = buildOperationalReadinessSurface(verdict, input, snapshot);
    const goAction = surface.dock.actions.find(a => a.actionKey === "approve_go");
    const condAction = surface.dock.actions.find(a => a.actionKey === "approve_conditional_go");
    expect(goAction!.enabled).toBe(true);
    expect(condAction!.enabled).toBe(true);
  });
});
