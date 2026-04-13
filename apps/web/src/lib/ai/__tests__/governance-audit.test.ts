// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Governance Audit Engine Tests
 *
 * Decision log + compliance snapshot + chain audit summary 무결성 검증.
 *
 * AU1-AU25: 25 scenarios
 */
import { describe, it, expect } from "vitest";
import {
  createDecisionLogStore,
  eventToDecisionLogEntry,
  classifyEventIrreversibility,
  inferDecisionContext,
  attachAuditToEventBus,
  createComplianceSnapshot,
  createComplianceSnapshotStore,
  buildChainAuditSummary,
  type DecisionLogEntry,
  type BlockerSnapshot,
} from "../governance-audit-engine";
import { createGovernanceEventBus, createGovernanceEvent } from "../governance-event-bus";
import type { GovernanceEvent } from "../governance-event-bus";

// ── Helpers ──

function makeEvent(overrides: Partial<GovernanceEvent> = {}): GovernanceEvent {
  return createGovernanceEvent("dispatch_prep", "status_change", {
    caseId: "case-001",
    poNumber: "PO-2026-001",
    fromStatus: "needs_review",
    toStatus: "ready_to_send",
    actor: "operator-A",
    detail: "검토 완료",
    severity: "info",
    chainStage: "dispatch_prep",
    ...overrides,
  });
}

function makeBlockerSnapshot(overrides: Partial<BlockerSnapshot> = {}): BlockerSnapshot {
  return {
    blockerType: "snapshot_invalidated",
    severity: "hard",
    severityLabel: "차단",
    detail: "Approval snapshot 무효화됨",
    resolvedAt: null,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════
// Section 1: Decision Log Store
// ══════════════════════════════════════════════════════

describe("Decision Log Store", () => {
  it("AU1: append and retrieve entries", () => {
    const store = createDecisionLogStore();
    const event = makeEvent();
    const entry = eventToDecisionLogEntry(event, {
      decisionType: "status_transition",
      blockersActiveAtDecision: [],
      complianceGatePassed: true,
      complianceGateDetail: null,
    });

    store.append(entry);
    expect(store.getEntryCount()).toBe(1);
    expect(store.getEntries()[0].sourceEventId).toBe(event.eventId);
  });

  it("AU2: filter by domain", () => {
    const store = createDecisionLogStore();
    const event1 = makeEvent({ domain: "dispatch_prep" } as any);
    const event2 = makeEvent({ domain: "stock_release" } as any);

    store.append(eventToDecisionLogEntry(event1, { decisionType: "status_transition", blockersActiveAtDecision: [], complianceGatePassed: true, complianceGateDetail: null }));
    store.append(eventToDecisionLogEntry(event2, { decisionType: "status_transition", blockersActiveAtDecision: [], complianceGatePassed: true, complianceGateDetail: null }));

    const filtered = store.getEntries({ domain: "dispatch_prep" });
    expect(filtered.length).toBe(1);
    expect(filtered[0].domain).toBe("dispatch_prep");
  });

  it("AU3: filter irreversible entries only", () => {
    const store = createDecisionLogStore();
    const irreversibleEvent = makeEvent({ eventType: "send_now" });
    const regularEvent = makeEvent({ eventType: "status_change" });

    store.append(eventToDecisionLogEntry(irreversibleEvent, { decisionType: "irreversible_action", blockersActiveAtDecision: [], complianceGatePassed: true, complianceGateDetail: null }));
    store.append(eventToDecisionLogEntry(regularEvent, { decisionType: "status_transition", blockersActiveAtDecision: [], complianceGatePassed: true, complianceGateDetail: null }));

    const irreversible = store.getIrreversibleEntries();
    expect(irreversible.length).toBe(1);
  });

  it("AU4: getEntriesByCaseId", () => {
    const store = createDecisionLogStore();
    store.append(eventToDecisionLogEntry(makeEvent(), { decisionType: "status_transition", blockersActiveAtDecision: [], complianceGatePassed: true, complianceGateDetail: null }));

    const entries = store.getEntriesByCaseId("case-001");
    expect(entries.length).toBe(1);
    expect(store.getEntriesByCaseId("nonexistent").length).toBe(0);
  });

  it("AU5: getEntriesByPONumber", () => {
    const store = createDecisionLogStore();
    store.append(eventToDecisionLogEntry(makeEvent(), { decisionType: "status_transition", blockersActiveAtDecision: [], complianceGatePassed: true, complianceGateDetail: null }));

    const entries = store.getEntriesByPONumber("PO-2026-001");
    expect(entries.length).toBe(1);
  });

  it("AU6: entries are bounded", () => {
    const store = createDecisionLogStore();
    for (let i = 0; i < 2100; i++) {
      store.append(eventToDecisionLogEntry(makeEvent(), { decisionType: "status_transition", blockersActiveAtDecision: [], complianceGatePassed: true, complianceGateDetail: null }));
    }
    expect(store.getEntryCount()).toBeLessThanOrEqual(2000);
  });
});

// ══════════════════════════════════════════════════════
// Section 2: Event → Decision Log Entry
// ══════════════════════════════════════════════════════

describe("Event to Decision Log Entry", () => {
  it("AU7: resolves labels from grammar registry", () => {
    const event = makeEvent();
    const entry = eventToDecisionLogEntry(event, {
      decisionType: "status_transition",
      blockersActiveAtDecision: [],
      complianceGatePassed: true,
      complianceGateDetail: null,
    });

    expect(entry.fromStatusLabel).toBe("검토 필요");
    expect(entry.toStatusLabel).toBe("발송 가능");
    expect(entry.severityLabel).toBe("정보");
  });

  it("AU8: classifyEventIrreversibility detects irreversible actions", () => {
    const sendEvent = makeEvent({ eventType: "send_now" });
    expect(classifyEventIrreversibility(sendEvent)).toBe(true);

    const regularEvent = makeEvent({ eventType: "request_correction" });
    expect(classifyEventIrreversibility(regularEvent)).toBe(false);
  });

  it("AU9: classifyEventIrreversibility detects terminal status transitions", () => {
    const event = makeEvent({ toStatus: "cancelled" });
    expect(classifyEventIrreversibility(event)).toBe(true);
  });

  it("AU10: inferDecisionContext classifies cancellation", () => {
    const event = makeEvent({ eventType: "cancel_dispatch_prep" });
    const context = inferDecisionContext(event);
    expect(context.decisionType).toBe("cancellation");
  });

  it("AU11: inferDecisionContext classifies reopen", () => {
    const event = makeEvent({ eventType: "reopen_po_conversion" });
    const context = inferDecisionContext(event);
    expect(context.decisionType).toBe("reopen");
  });

  it("AU12: inferDecisionContext classifies snapshot invalidation", () => {
    const event = makeEvent({ eventType: "approval_snapshot_invalidated" });
    const context = inferDecisionContext(event);
    expect(context.decisionType).toBe("snapshot_invalidation");
  });
});

// ══════════════════════════════════════════════════════
// Section 3: Event Bus → Audit Auto-attach
// ══════════════════════════════════════════════════════

describe("Audit Event Bus Attachment", () => {
  it("AU13: bus event → auto-appended to decision log", () => {
    const bus = createGovernanceEventBus();
    const store = createDecisionLogStore();
    attachAuditToEventBus(bus, store);

    const event = makeEvent();
    bus.publish(event);

    expect(store.getEntryCount()).toBe(1);
    expect(store.getEntries()[0].sourceEventId).toBe(event.eventId);
  });

  it("AU14: custom context resolver overrides default", () => {
    const bus = createGovernanceEventBus();
    const store = createDecisionLogStore();
    attachAuditToEventBus(bus, store, () => ({
      decisionType: "handoff",
      blockersActiveAtDecision: [makeBlockerSnapshot()],
      complianceGatePassed: false,
      complianceGateDetail: "Hard blocker active",
    }));

    bus.publish(makeEvent());

    const entry = store.getEntries()[0];
    expect(entry.decisionType).toBe("handoff");
    expect(entry.blockersActiveAtDecision.length).toBe(1);
    expect(entry.complianceGatePassed).toBe(false);
  });
});

// ══════════════════════════════════════════════════════
// Section 4: Compliance Snapshot
// ══════════════════════════════════════════════════════

describe("Compliance Snapshot", () => {
  it("AU15: compliant snapshot when no hard blockers", () => {
    const snapshot = createComplianceSnapshot({
      trigger: "stage_transition",
      triggeredBy: "system",
      poNumber: "PO-2026-001",
      caseId: "case-001",
      currentStage: "dispatch_prep",
      domainStatuses: [
        { domain: "dispatch_prep", status: "ready_to_send", category: "ready", isTerminal: false },
      ],
      activeBlockers: [],
      recentDecisions: [],
    });

    expect(snapshot.verdict).toBe("compliant");
    expect(snapshot.hardBlockerCount).toBe(0);
    expect(snapshot.currentStageLabel).toBe("발송 전 최종 검증");
  });

  it("AU16: non-compliant when irreversible action pre with hard blockers", () => {
    const snapshot = createComplianceSnapshot({
      trigger: "irreversible_action_pre",
      triggeredBy: "operator-A",
      poNumber: "PO-2026-001",
      caseId: "case-001",
      currentStage: "dispatch_prep",
      domainStatuses: [
        { domain: "dispatch_prep", status: "blocked", category: "blocked", isTerminal: false },
      ],
      activeBlockers: [makeBlockerSnapshot()],
      recentDecisions: [],
    });

    expect(snapshot.verdict).toBe("non_compliant");
    expect(snapshot.hardBlockerCount).toBe(1);
    expect(snapshot.complianceGateStatus).toBe("failed");
  });

  it("AU17: needs_review when hard blockers present (not irreversible)", () => {
    const snapshot = createComplianceSnapshot({
      trigger: "periodic_audit",
      triggeredBy: "system",
      poNumber: "PO-2026-001",
      caseId: "case-001",
      currentStage: "dispatch_prep",
      domainStatuses: [],
      activeBlockers: [makeBlockerSnapshot()],
      recentDecisions: [],
    });

    expect(snapshot.verdict).toBe("needs_review");
  });

  it("AU18: domain status labels resolved from grammar", () => {
    const snapshot = createComplianceSnapshot({
      trigger: "stage_transition",
      triggeredBy: "system",
      poNumber: "PO-2026-001",
      caseId: "case-001",
      currentStage: "dispatch_prep",
      domainStatuses: [
        { domain: "dispatch_prep", status: "ready_to_send", category: "ready", isTerminal: false },
      ],
      activeBlockers: [],
      recentDecisions: [],
    });

    expect(snapshot.domainStatuses[0].statusLabel).toBe("발송 가능");
  });
});

// ══════════════════════════════════════════════════════
// Section 5: Compliance Snapshot Store
// ══════════════════════════════════════════════════════

describe("Compliance Snapshot Store", () => {
  it("AU19: save and retrieve snapshots", () => {
    const store = createComplianceSnapshotStore();
    const snapshot = createComplianceSnapshot({
      trigger: "stage_transition",
      triggeredBy: "system",
      poNumber: "PO-2026-001",
      caseId: "case-001",
      currentStage: "dispatch_prep",
      domainStatuses: [],
      activeBlockers: [],
      recentDecisions: [],
    });

    store.save(snapshot);
    expect(store.getSnapshotCount()).toBe(1);
  });

  it("AU20: getLatestByPO returns latest", () => {
    const store = createComplianceSnapshotStore();
    store.save(createComplianceSnapshot({
      trigger: "stage_transition", triggeredBy: "system",
      poNumber: "PO-001", caseId: "c1", currentStage: "dispatch_prep",
      domainStatuses: [], activeBlockers: [], recentDecisions: [],
    }));
    store.save(createComplianceSnapshot({
      trigger: "periodic_audit", triggeredBy: "system",
      poNumber: "PO-001", caseId: "c1", currentStage: "sent",
      domainStatuses: [], activeBlockers: [], recentDecisions: [],
    }));

    const latest = store.getLatestByPO("PO-001");
    expect(latest).not.toBeNull();
    expect(latest!.trigger).toBe("periodic_audit");
  });

  it("AU21: getNonCompliant filters correctly", () => {
    const store = createComplianceSnapshotStore();
    store.save(createComplianceSnapshot({
      trigger: "stage_transition", triggeredBy: "system",
      poNumber: "PO-001", caseId: "c1", currentStage: "dispatch_prep",
      domainStatuses: [], activeBlockers: [], recentDecisions: [],
    }));
    store.save(createComplianceSnapshot({
      trigger: "irreversible_action_pre", triggeredBy: "op",
      poNumber: "PO-002", caseId: "c2", currentStage: "dispatch_prep",
      domainStatuses: [], activeBlockers: [makeBlockerSnapshot()], recentDecisions: [],
    }));

    const nonCompliant = store.getNonCompliant();
    expect(nonCompliant.length).toBe(1);
    expect(nonCompliant[0].poNumber).toBe("PO-002");
  });
});

// ══════════════════════════════════════════════════════
// Section 6: Chain Audit Summary
// ══════════════════════════════════════════════════════

describe("Chain Audit Summary", () => {
  it("AU22: builds summary from decision + compliance stores", () => {
    const decisionStore = createDecisionLogStore();
    const complianceStore = createComplianceSnapshotStore();

    // Add decisions
    const events = [
      makeEvent({ chainStage: "dispatch_prep" } as any),
      makeEvent({ chainStage: "sent", toStatus: "sent" } as any),
    ];
    for (const e of events) {
      decisionStore.append(eventToDecisionLogEntry(e, {
        decisionType: "status_transition",
        blockersActiveAtDecision: [],
        complianceGatePassed: true,
        complianceGateDetail: null,
      }));
    }

    // Add compliance snapshot
    complianceStore.save(createComplianceSnapshot({
      trigger: "stage_transition", triggeredBy: "system",
      poNumber: "PO-2026-001", caseId: "case-001", currentStage: "dispatch_prep",
      domainStatuses: [], activeBlockers: [], recentDecisions: [],
    }));

    const summary = buildChainAuditSummary("PO-2026-001", decisionStore, complianceStore);

    expect(summary.poNumber).toBe("PO-2026-001");
    expect(summary.totalDecisions).toBe(2);
    expect(summary.complianceSnapshotCount).toBe(1);
    expect(summary.latestVerdict).toBe("compliant");
    expect(summary.stagesVisited.length).toBeGreaterThan(0);
  });

  it("AU23: compliance score calculation", () => {
    const decisionStore = createDecisionLogStore();
    const complianceStore = createComplianceSnapshotStore();

    // 2 compliant, 1 non-compliant
    complianceStore.save(createComplianceSnapshot({
      trigger: "stage_transition", triggeredBy: "s", poNumber: "PO-001", caseId: "c1",
      currentStage: "dispatch_prep", domainStatuses: [], activeBlockers: [], recentDecisions: [],
    }));
    complianceStore.save(createComplianceSnapshot({
      trigger: "stage_transition", triggeredBy: "s", poNumber: "PO-001", caseId: "c1",
      currentStage: "sent", domainStatuses: [], activeBlockers: [], recentDecisions: [],
    }));
    complianceStore.save(createComplianceSnapshot({
      trigger: "irreversible_action_pre", triggeredBy: "op", poNumber: "PO-001", caseId: "c1",
      currentStage: "dispatch_prep", domainStatuses: [], activeBlockers: [makeBlockerSnapshot()], recentDecisions: [],
    }));

    const summary = buildChainAuditSummary("PO-001", decisionStore, complianceStore);
    // 2 compliant out of 3
    expect(summary.complianceScore).toBeCloseTo(2 / 3, 2);
    expect(summary.nonCompliantCount).toBe(1);
  });

  it("AU24: actor tracking", () => {
    const decisionStore = createDecisionLogStore();
    const complianceStore = createComplianceSnapshotStore();

    const event1 = makeEvent({ actor: "Alice" } as any);
    const event2 = makeEvent({ actor: "Bob" } as any);
    const event3 = makeEvent({ actor: "Alice" } as any);

    for (const e of [event1, event2, event3]) {
      decisionStore.append(eventToDecisionLogEntry(e, {
        decisionType: "status_transition", blockersActiveAtDecision: [],
        complianceGatePassed: true, complianceGateDetail: null,
      }));
    }

    const summary = buildChainAuditSummary("PO-2026-001", decisionStore, complianceStore);
    expect(summary.actors).toContain("Alice");
    expect(summary.actors).toContain("Bob");
    expect(summary.actorDecisionCounts["Alice"]).toBe(2);
    expect(summary.actorDecisionCounts["Bob"]).toBe(1);
  });

  it("AU25: empty stores produce valid summary", () => {
    const decisionStore = createDecisionLogStore();
    const complianceStore = createComplianceSnapshotStore();

    const summary = buildChainAuditSummary("PO-NONE", decisionStore, complianceStore);
    expect(summary.totalDecisions).toBe(0);
    expect(summary.complianceScore).toBeNull();
    expect(summary.latestVerdict).toBeNull();
    expect(summary.stagesVisited).toHaveLength(0);
  });
});
