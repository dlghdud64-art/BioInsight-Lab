// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Governance Reporting Engine Tests
 *
 * PO chain report + period report + risk assessment + report surface 검증.
 *
 * RP1-RP20: 20 scenarios
 */
import { describe, it, expect } from "vitest";
import {
  buildPOChainReport,
  buildPeriodReport,
  buildAuditReportSurface,
  type POChainReport,
  type PeriodReport,
} from "../governance-reporting-engine";
import {
  createDecisionLogStore,
  createComplianceSnapshotStore,
  eventToDecisionLogEntry,
  createComplianceSnapshot,
  type BlockerSnapshot,
} from "../governance-audit-engine";
import { createGovernanceEvent } from "../governance-event-bus";
import type { GovernanceEvent } from "../governance-event-bus";

// ── Helpers ──

function makeEvent(overrides: Partial<GovernanceEvent> & { delayMs?: number } = {}): GovernanceEvent {
  const { delayMs, ...eventOverrides } = overrides;
  return createGovernanceEvent("dispatch_prep", "status_change", {
    caseId: "case-001",
    poNumber: "PO-2026-001",
    fromStatus: "needs_review",
    toStatus: "ready_to_send",
    actor: "operator-A",
    detail: "테스트 이벤트",
    severity: "info",
    chainStage: "dispatch_prep",
    ...eventOverrides,
  });
}

function makeBlocker(): BlockerSnapshot {
  return {
    blockerType: "snapshot_invalidated",
    severity: "hard",
    severityLabel: "차단",
    detail: "Approval snapshot 무효화됨",
    resolvedAt: null,
  };
}

function seedStores(options?: { decisions?: number; nonCompliantSnapshots?: number; reopens?: number }) {
  const decisionStore = createDecisionLogStore();
  const complianceStore = createComplianceSnapshotStore();
  const decisions = options?.decisions ?? 5;
  const nonCompliantCount = options?.nonCompliantSnapshots ?? 0;
  const reopens = options?.reopens ?? 0;

  const stages = ["dispatch_prep", "sent", "supplier_confirmed", "receiving_prep", "stock_release"] as const;

  for (let i = 0; i < decisions; i++) {
    const stage = stages[i % stages.length];
    const event = makeEvent({ chainStage: stage } as any);
    const decisionType = i < reopens ? "reopen" : "status_transition";
    decisionStore.append(eventToDecisionLogEntry(event, {
      decisionType: decisionType as any,
      blockersActiveAtDecision: [],
      complianceGatePassed: true,
      complianceGateDetail: null,
    }));
  }

  // Compliant snapshots
  complianceStore.save(createComplianceSnapshot({
    trigger: "stage_transition", triggeredBy: "system",
    poNumber: "PO-2026-001", caseId: "case-001", currentStage: "dispatch_prep",
    domainStatuses: [], activeBlockers: [], recentDecisions: [],
  }));

  // Non-compliant snapshots
  for (let i = 0; i < nonCompliantCount; i++) {
    complianceStore.save(createComplianceSnapshot({
      trigger: "irreversible_action_pre", triggeredBy: "op",
      poNumber: "PO-2026-001", caseId: "case-001", currentStage: "dispatch_prep",
      domainStatuses: [], activeBlockers: [makeBlocker()], recentDecisions: [],
    }));
  }

  return { decisionStore, complianceStore };
}

// ══════════════════════════════════════════════════════
// Section 1: PO Chain Report
// ══════════════════════════════════════════════════════

describe("PO Chain Report", () => {
  it("RP1: builds valid report with audit summary", () => {
    const { decisionStore, complianceStore } = seedStores();
    const report = buildPOChainReport("PO-2026-001", decisionStore, complianceStore);

    expect(report.reportType).toBe("po_chain");
    expect(report.auditSummary.poNumber).toBe("PO-2026-001");
    expect(report.auditSummary.totalDecisions).toBe(5);
    expect(report.reportId).toMatch(/^rpt_po_/);
  });

  it("RP2: counts blocker events", () => {
    const decisionStore = createDecisionLogStore();
    const complianceStore = createComplianceSnapshotStore();

    // Add blocker_added and blocker_resolved
    decisionStore.append(eventToDecisionLogEntry(makeEvent({ eventType: "blocker_added" }), {
      decisionType: "blocker_added", blockersActiveAtDecision: [makeBlocker()],
      complianceGatePassed: true, complianceGateDetail: null,
    }));
    decisionStore.append(eventToDecisionLogEntry(makeEvent({ eventType: "blocker_resolved" }), {
      decisionType: "blocker_resolved", blockersActiveAtDecision: [],
      complianceGatePassed: true, complianceGateDetail: null,
    }));

    const report = buildPOChainReport("PO-2026-001", decisionStore, complianceStore);
    expect(report.totalBlockerEvents).toBe(2);
  });

  it("RP3: counts reopens", () => {
    const { decisionStore, complianceStore } = seedStores({ decisions: 5, reopens: 2 });
    const report = buildPOChainReport("PO-2026-001", decisionStore, complianceStore);
    expect(report.reopenCount).toBe(2);
  });

  it("RP4: risk indicator for non-compliant snapshots", () => {
    const { decisionStore, complianceStore } = seedStores({ nonCompliantSnapshots: 2 });
    const report = buildPOChainReport("PO-2026-001", decisionStore, complianceStore);

    const complianceRisk = report.riskIndicators.find(r => r.category === "compliance");
    expect(complianceRisk).toBeDefined();
    expect(complianceRisk!.level).toBe("critical");
  });

  it("RP5: empty stores produce valid report", () => {
    const decisionStore = createDecisionLogStore();
    const complianceStore = createComplianceSnapshotStore();
    const report = buildPOChainReport("PO-NONE", decisionStore, complianceStore);

    expect(report.auditSummary.totalDecisions).toBe(0);
    expect(report.longestStage).toBeNull();
    expect(report.riskIndicators).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════
// Section 2: Period Report
// ══════════════════════════════════════════════════════

describe("Period Report", () => {
  it("RP6: builds valid period report", () => {
    const { decisionStore, complianceStore } = seedStores();
    const report = buildPeriodReport(
      "2026-01-01T00:00:00Z",
      "2026-12-31T23:59:59Z",
      decisionStore,
      complianceStore,
    );

    expect(report.reportType).toBe("period");
    expect(report.activePOCount).toBeGreaterThan(0);
    expect(report.totalDecisions).toBe(5);
    expect(report.reportId).toMatch(/^rpt_period_/);
  });

  it("RP7: calculates compliance rate", () => {
    const { decisionStore, complianceStore } = seedStores({ nonCompliantSnapshots: 1 });
    const report = buildPeriodReport(
      "2026-01-01T00:00:00Z", "2026-12-31T23:59:59Z",
      decisionStore, complianceStore,
    );

    // 1 compliant + 1 non-compliant = 50%
    expect(report.complianceRate).toBeCloseTo(0.5, 2);
    expect(report.nonCompliantCount).toBe(1);
  });

  it("RP8: identifies stage throughput", () => {
    const { decisionStore, complianceStore } = seedStores({ decisions: 10 });
    const report = buildPeriodReport(
      "2026-01-01T00:00:00Z", "2026-12-31T23:59:59Z",
      decisionStore, complianceStore,
    );

    expect(report.stagesThroughput.length).toBeGreaterThan(0);
    // Sorted by count descending
    for (let i = 1; i < report.stagesThroughput.length; i++) {
      expect(report.stagesThroughput[i - 1].count).toBeGreaterThanOrEqual(report.stagesThroughput[i].count);
    }
  });

  it("RP9: tracks most active actor", () => {
    const { decisionStore, complianceStore } = seedStores();
    const report = buildPeriodReport(
      "2026-01-01T00:00:00Z", "2026-12-31T23:59:59Z",
      decisionStore, complianceStore,
    );

    expect(report.mostActiveActor).not.toBeNull();
    expect(report.activeActorCount).toBeGreaterThan(0);
  });

  it("RP10: bottleneck stage identified", () => {
    const { decisionStore, complianceStore } = seedStores({ decisions: 10 });
    const report = buildPeriodReport(
      "2026-01-01T00:00:00Z", "2026-12-31T23:59:59Z",
      decisionStore, complianceStore,
    );

    expect(report.bottleneckStage).not.toBeNull();
    expect(report.bottleneckStage!.stageLabel).toBeDefined();
  });

  it("RP11: stage labels are grammar-resolved", () => {
    const { decisionStore, complianceStore } = seedStores();
    const report = buildPeriodReport(
      "2026-01-01T00:00:00Z", "2026-12-31T23:59:59Z",
      decisionStore, complianceStore,
    );

    for (const st of report.stagesThroughput) {
      expect(st.stageLabel).not.toBe(st.stage); // label ≠ code identifier
    }
  });

  it("RP12: empty period returns null metrics", () => {
    const decisionStore = createDecisionLogStore();
    const complianceStore = createComplianceSnapshotStore();
    const report = buildPeriodReport(
      "2099-01-01T00:00:00Z", "2099-12-31T23:59:59Z",
      decisionStore, complianceStore,
    );

    expect(report.activePOCount).toBe(0);
    expect(report.totalDecisions).toBe(0);
    expect(report.complianceRate).toBeNull();
    expect(report.bottleneckStage).toBeNull();
  });
});

// ══════════════════════════════════════════════════════
// Section 3: Risk Assessment
// ══════════════════════════════════════════════════════

describe("Risk Assessment", () => {
  it("RP13: high reopen count triggers warning", () => {
    const { decisionStore, complianceStore } = seedStores({ decisions: 10, reopens: 4 });
    const report = buildPOChainReport("PO-2026-001", decisionStore, complianceStore);

    const stabilityRisk = report.riskIndicators.find(r => r.category === "stability");
    expect(stabilityRisk).toBeDefined();
    expect(stabilityRisk!.level).toBe("warning");
  });

  it("RP14: period high non-compliant rate triggers critical", () => {
    const { decisionStore, complianceStore } = seedStores({ nonCompliantSnapshots: 5 });
    const report = buildPeriodReport(
      "2026-01-01T00:00:00Z", "2026-12-31T23:59:59Z",
      decisionStore, complianceStore,
    );

    // 5 non-compliant / 6 total > 10%
    const complianceRisk = report.riskIndicators.find(r => r.category === "compliance");
    expect(complianceRisk).toBeDefined();
    expect(complianceRisk!.level).toBe("critical");
  });

  it("RP15: risk indicator severity labels come from grammar", () => {
    const { decisionStore, complianceStore } = seedStores({ nonCompliantSnapshots: 2 });
    const report = buildPOChainReport("PO-2026-001", decisionStore, complianceStore);

    for (const ri of report.riskIndicators) {
      expect(["정보", "주의", "심각"]).toContain(ri.levelLabel);
    }
  });
});

// ══════════════════════════════════════════════════════
// Section 4: Report Surface Builder
// ══════════════════════════════════════════════════════

describe("Audit Report Surface", () => {
  it("RP16: builds center/rail/dock structure", () => {
    const { decisionStore, complianceStore } = seedStores();
    const report = buildPOChainReport("PO-2026-001", decisionStore, complianceStore);
    const surface = buildAuditReportSurface(report, complianceStore, { poNumber: "PO-2026-001" });

    expect(surface.center.reportType).toBe("po_chain");
    expect(surface.rail.complianceSummary.totalSnapshots).toBeGreaterThan(0);
    expect(surface.dock.actions.length).toBe(5);
  });

  it("RP17: dock has expected actions", () => {
    const { decisionStore, complianceStore } = seedStores();
    const report = buildPOChainReport("PO-2026-001", decisionStore, complianceStore);
    const surface = buildAuditReportSurface(report, complianceStore);

    const actionKeys = surface.dock.actions.map(a => a.actionKey);
    expect(actionKeys).toContain("export_report");
    expect(actionKeys).toContain("refresh_report");
    expect(actionKeys).toContain("view_decision_log");
    expect(actionKeys).toContain("view_compliance_snapshots");
  });

  it("RP18: rail includes stage labels from grammar", () => {
    const { decisionStore, complianceStore } = seedStores();
    const report = buildPOChainReport("PO-2026-001", decisionStore, complianceStore);
    const surface = buildAuditReportSurface(report, complianceStore);

    expect(surface.rail.stageLabels.length).toBe(13); // 13 stages
    const dispatchPrepLabel = surface.rail.stageLabels.find(s => s.stage === "dispatch_prep");
    expect(dispatchPrepLabel?.label).toBe("발송 전 최종 검증");
  });

  it("RP19: compliance summary counts match store", () => {
    const { decisionStore, complianceStore } = seedStores({ nonCompliantSnapshots: 1 });
    const report = buildPOChainReport("PO-2026-001", decisionStore, complianceStore);
    const surface = buildAuditReportSurface(report, complianceStore, { poNumber: "PO-2026-001" });

    const summary = surface.rail.complianceSummary;
    expect(summary.compliantCount + summary.nonCompliantCount + summary.needsReviewCount)
      .toBe(summary.totalSnapshots);
  });

  it("RP20: period report surface also works", () => {
    const { decisionStore, complianceStore } = seedStores();
    const report = buildPeriodReport(
      "2026-01-01T00:00:00Z", "2026-12-31T23:59:59Z",
      decisionStore, complianceStore,
    );
    const surface = buildAuditReportSurface(report, complianceStore);

    expect(surface.center.reportType).toBe("period");
    expect(surface.dock.actions.length).toBe(5);
  });
});
