// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Governance Event Bus — Tests
 *
 * EB1-EB22: event bus publish/subscribe, targeted invalidation rules,
 * event correlation, stale context detection, invalidation chain trace
 */

import { describe, it, expect } from "vitest";
import {
  createGovernanceEventBus,
  createGovernanceEvent,
  resolveInvalidation,
  attachAutoInvalidation,
  buildEventCorrelation,
  traceInvalidationChain,
  detectStaleContext,
  GOVERNANCE_INVALIDATION_RULES,
  type GovernanceEvent,
  type GovernanceDomain,
  type GovernanceEventBus,
  type InvalidationTarget,
  type InvalidationScope,
} from "../governance-event-bus";

// ── Fixtures ──

function makeEvent(overrides?: Partial<GovernanceEvent>): GovernanceEvent {
  // NOTE: createGovernanceEvent 는 domain / eventType 을 위치 인자 1·2 에서만 읽고,
  //       params 객체의 같은 이름 필드는 무시한다. overrides 에 domain / eventType 이
  //       들어오더라도 ...overrides 로 params 에 spread 되면 실제로 반영되지 않아
  //       bus.getHistory({ domain }), resolveInvalidation(eventType) 등이 drift 된다.
  //       → 여기서는 두 필드를 분리해서 위치 인자로 전달한다.
  const { domain, eventType, ...rest } = overrides ?? {};
  return createGovernanceEvent(
    (domain ?? "stock_release") as GovernanceDomain,
    eventType ?? "stock_release_full",
    {
      caseId: "case_001",
      poNumber: "PO-2024-001",
      fromStatus: "evaluating",
      toStatus: "released",
      actor: "op",
      detail: "stock release 완료",
      severity: "info",
      chainStage: "stock_release",
      ...rest,
    },
  );
}

// ══════════════════════════════════════════════
// EB1: Bus creation
// ══════════════════════════════════════════════

describe("EB1: createGovernanceEventBus", () => {
  it("creates bus with zero subscriptions", () => {
    const bus = createGovernanceEventBus();
    expect(bus.getSubscriptionCount()).toBe(0);
    expect(bus.getHistory()).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════
// EB2: Publish and history
// ══════════════════════════════════════════════

describe("EB2: publish / getHistory", () => {
  it("published events appear in history", () => {
    const bus = createGovernanceEventBus();
    const event = makeEvent();
    bus.publish(event);
    expect(bus.getHistory()).toHaveLength(1);
    expect(bus.getHistory()[0].eventType).toBe("stock_release_full");
  });

  it("history is bounded", () => {
    const bus = createGovernanceEventBus();
    for (let i = 0; i < 600; i++) {
      bus.publish(makeEvent({ detail: `event ${i}` }));
    }
    expect(bus.getHistory().length).toBeLessThanOrEqual(500);
  });
});

// ══════════════════════════════════════════════
// EB3: Subscribe and receive events
// ══════════════════════════════════════════════

describe("EB3: subscribe", () => {
  it("subscriber receives matching events", () => {
    const bus = createGovernanceEventBus();
    const received: GovernanceEvent[] = [];
    bus.subscribe({
      domains: ["stock_release"],
      chainStages: [],
      caseId: null,
      poNumber: null,
      severities: [],
      handler: (e) => received.push(e),
    });

    bus.publish(makeEvent());
    expect(received).toHaveLength(1);
  });

  it("subscriber ignores non-matching domain", () => {
    const bus = createGovernanceEventBus();
    const received: GovernanceEvent[] = [];
    bus.subscribe({
      domains: ["dispatch_prep"],
      chainStages: [],
      caseId: null,
      poNumber: null,
      severities: [],
      handler: (e) => received.push(e),
    });

    bus.publish(makeEvent({ domain: "stock_release" as GovernanceDomain }));
    expect(received).toHaveLength(0);
  });

  it("empty domain filter matches all", () => {
    const bus = createGovernanceEventBus();
    const received: GovernanceEvent[] = [];
    bus.subscribe({
      domains: [],
      chainStages: [],
      caseId: null,
      poNumber: null,
      severities: [],
      handler: (e) => received.push(e),
    });

    bus.publish(makeEvent({ domain: "stock_release" as GovernanceDomain }));
    bus.publish(makeEvent({ domain: "reorder_decision" as GovernanceDomain }));
    expect(received).toHaveLength(2);
  });
});

// ══════════════════════════════════════════════
// EB4: Case ID filter
// ══════════════════════════════════════════════

describe("EB4: caseId filter", () => {
  it("filters by caseId", () => {
    const bus = createGovernanceEventBus();
    const received: GovernanceEvent[] = [];
    bus.subscribe({
      domains: [],
      chainStages: [],
      caseId: "case_001",
      poNumber: null,
      severities: [],
      handler: (e) => received.push(e),
    });

    bus.publish(makeEvent({ caseId: "case_001" }));
    bus.publish(makeEvent({ caseId: "case_999" }));
    expect(received).toHaveLength(1);
  });
});

// ══════════════════════════════════════════════
// EB5: Severity filter
// ══════════════════════════════════════════════

describe("EB5: severity filter", () => {
  it("filters by severity", () => {
    const bus = createGovernanceEventBus();
    const received: GovernanceEvent[] = [];
    bus.subscribe({
      domains: [],
      chainStages: [],
      caseId: null,
      poNumber: null,
      severities: ["critical"],
      handler: (e) => received.push(e),
    });

    bus.publish(makeEvent({ severity: "info" }));
    bus.publish(makeEvent({ severity: "critical" }));
    expect(received).toHaveLength(1);
    expect(received[0].severity).toBe("critical");
  });
});

// ══════════════════════════════════════════════
// EB6: Unsubscribe
// ══════════════════════════════════════════════

describe("EB6: unsubscribe", () => {
  it("unsubscribed handler stops receiving", () => {
    const bus = createGovernanceEventBus();
    const received: GovernanceEvent[] = [];
    const subId = bus.subscribe({
      domains: [],
      chainStages: [],
      caseId: null,
      poNumber: null,
      severities: [],
      handler: (e) => received.push(e),
    });

    bus.publish(makeEvent());
    expect(received).toHaveLength(1);

    bus.unsubscribe(subId);
    bus.publish(makeEvent());
    expect(received).toHaveLength(1); // still 1, not 2
  });
});

// ══════════════════════════════════════════════
// EB7: History filtering
// ══════════════════════════════════════════════

describe("EB7: history filtering", () => {
  it("filters by domain", () => {
    const bus = createGovernanceEventBus();
    bus.publish(makeEvent({ domain: "stock_release" as GovernanceDomain }));
    bus.publish(makeEvent({ domain: "reorder_decision" as GovernanceDomain }));
    expect(bus.getHistory({ domain: "stock_release" })).toHaveLength(1);
  });

  it("filters by PO number", () => {
    const bus = createGovernanceEventBus();
    bus.publish(makeEvent({ poNumber: "PO-001" }));
    bus.publish(makeEvent({ poNumber: "PO-002" }));
    expect(bus.getHistory({ poNumber: "PO-001" })).toHaveLength(1);
  });

  it("limits results", () => {
    const bus = createGovernanceEventBus();
    for (let i = 0; i < 10; i++) bus.publish(makeEvent());
    expect(bus.getHistory({ limit: 3 })).toHaveLength(3);
  });
});

// ══════════════════════════════════════════════
// EB8: createGovernanceEvent factory
// ══════════════════════════════════════════════

describe("EB8: createGovernanceEvent", () => {
  it("creates event with unique ID", () => {
    const e1 = createGovernanceEvent("stock_release", "test", {
      caseId: "c", poNumber: "po", fromStatus: "a", toStatus: "b",
      actor: "op", detail: "test",
    });
    const e2 = createGovernanceEvent("stock_release", "test", {
      caseId: "c", poNumber: "po", fromStatus: "a", toStatus: "b",
      actor: "op", detail: "test",
    });
    expect(e1.eventId).not.toBe(e2.eventId);
  });

  it("defaults severity to info", () => {
    const e = createGovernanceEvent("stock_release", "test", {
      caseId: "c", poNumber: "po", fromStatus: "a", toStatus: "b",
      actor: "op", detail: "test",
    });
    expect(e.severity).toBe("info");
  });
});

// ══════════════════════════════════════════════
// EB9: Invalidation rules structure
// ══════════════════════════════════════════════

describe("EB9: GOVERNANCE_INVALIDATION_RULES", () => {
  it("has rules for all 8 governance domains as source", () => {
    const sourceDomains = new Set(GOVERNANCE_INVALIDATION_RULES.map(r => r.sourceDomain));
    // At minimum these should be covered
    expect(sourceDomains.has("quote_chain")).toBe(true);
    expect(sourceDomains.has("dispatch_prep")).toBe(true);
    expect(sourceDomains.has("dispatch_execution")).toBe(true);
    expect(sourceDomains.has("supplier_confirmation")).toBe(true);
    expect(sourceDomains.has("receiving_prep")).toBe(true);
    expect(sourceDomains.has("receiving_execution")).toBe(true);
    expect(sourceDomains.has("stock_release")).toBe(true);
    expect(sourceDomains.has("reorder_decision")).toBe(true);
  });

  it("each rule has at least one target", () => {
    for (const rule of GOVERNANCE_INVALIDATION_RULES) {
      expect(rule.targets.length).toBeGreaterThan(0);
    }
  });

  it("targets have valid scopes", () => {
    const validScopes: InvalidationScope[] = ["surface_only", "readiness_recompute", "state_transition_check", "handoff_invalidate"];
    for (const rule of GOVERNANCE_INVALIDATION_RULES) {
      for (const target of rule.targets) {
        expect(validScopes).toContain(target.scope);
      }
    }
  });
});

// ══════════════════════════════════════════════
// EB10: resolveInvalidation — stock release → reorder
// ══════════════════════════════════════════════

describe("EB10: resolveInvalidation", () => {
  it("stock_release_full → reorder_decision invalidation", () => {
    const event = makeEvent({ eventType: "stock_release_full" });
    const result = resolveInvalidation(event);
    expect(result.hasInvalidation).toBe(true);
    expect(result.invalidatedTargets.some(t => t.targetDomain === "reorder_decision")).toBe(true);
  });

  it("stock_release_hold_placed → reorder_decision invalidation", () => {
    const event = makeEvent({ eventType: "stock_release_hold_placed" });
    const result = resolveInvalidation(event);
    expect(result.hasInvalidation).toBe(true);
  });

  it("unknown event type returns no invalidation", () => {
    const event = makeEvent({ eventType: "some_random_event" });
    const result = resolveInvalidation(event);
    expect(result.hasInvalidation).toBe(false);
  });
});

// ══════════════════════════════════════════════
// EB11: resolveInvalidation — supplier confirmation → receiving
// ══════════════════════════════════════════════

describe("EB11: supplier confirmation → receiving invalidation", () => {
  it("confirmation_gov_confirmed → receiving_prep", () => {
    const event = createGovernanceEvent("supplier_confirmation", "confirmation_gov_confirmed", {
      caseId: "c", poNumber: "po", fromStatus: "a", toStatus: "confirmed",
      actor: "op", detail: "confirmed", chainStage: "supplier_confirmed",
    });
    const result = resolveInvalidation(event);
    expect(result.hasInvalidation).toBe(true);
    expect(result.invalidatedTargets.some(t => t.targetDomain === "receiving_prep")).toBe(true);
  });

  it("supplier_profile_changed → dispatch_prep + receiving_prep", () => {
    const event = createGovernanceEvent("supplier_confirmation", "supplier_profile_changed", {
      caseId: "c", poNumber: "po", fromStatus: "a", toStatus: "a",
      actor: "op", detail: "profile changed",
    });
    const result = resolveInvalidation(event);
    const domains = result.invalidatedTargets.map(t => t.targetDomain);
    expect(domains).toContain("dispatch_prep");
    expect(domains).toContain("receiving_prep");
  });
});

// ══════════════════════════════════════════════
// EB12: resolveInvalidation — receiving execution → stock release
// ══════════════════════════════════════════════

describe("EB12: receiving execution → stock release invalidation", () => {
  it("receiving_gov_received → stock_release", () => {
    const event = createGovernanceEvent("receiving_execution", "receiving_gov_received", {
      caseId: "c", poNumber: "po", fromStatus: "a", toStatus: "received",
      actor: "op", detail: "received",
    });
    const result = resolveInvalidation(event);
    expect(result.invalidatedTargets.some(t => t.targetDomain === "stock_release")).toBe(true);
  });
});

// ══════════════════════════════════════════════
// EB13: resolveInvalidation — handoff_invalidate on upstream cancel
// ══════════════════════════════════════════════

describe("EB13: handoff invalidation on cancel", () => {
  it("stock_release cancelled → reorder handoff invalidated", () => {
    const event = createGovernanceEvent("stock_release", "stock_release_cancelled", {
      caseId: "c", poNumber: "po", fromStatus: "evaluating", toStatus: "cancelled",
      actor: "op", detail: "cancelled",
    });
    const result = resolveInvalidation(event);
    const handoffTargets = result.invalidatedTargets.filter(t => t.scope === "handoff_invalidate");
    expect(handoffTargets.length).toBeGreaterThan(0);
    expect(handoffTargets[0].targetDomain).toBe("reorder_decision");
  });

  it("receiving_gov_cancelled → stock_release handoff invalidated", () => {
    const event = createGovernanceEvent("receiving_execution", "receiving_gov_cancelled", {
      caseId: "c", poNumber: "po", fromStatus: "a", toStatus: "cancelled",
      actor: "op", detail: "cancelled",
    });
    const result = resolveInvalidation(event);
    const handoffTargets = result.invalidatedTargets.filter(t => t.scope === "handoff_invalidate");
    expect(handoffTargets.some(t => t.targetDomain === "stock_release")).toBe(true);
  });
});

// ══════════════════════════════════════════════
// EB14: resolveInvalidation — reorder → quote chain (re-entry loop)
// ══════════════════════════════════════════════

describe("EB14: reorder → quote chain re-entry", () => {
  it("procurement_reentry_handoff_created → quote_chain", () => {
    const event = createGovernanceEvent("reorder_decision", "procurement_reentry_handoff_created", {
      caseId: "c", poNumber: "po", fromStatus: "reorder_required",
      toStatus: "procurement_reentry_ready", actor: "op", detail: "re-entry",
    });
    const result = resolveInvalidation(event);
    expect(result.invalidatedTargets.some(t => t.targetDomain === "quote_chain")).toBe(true);
  });
});

// ══════════════════════════════════════════════
// EB15: attachAutoInvalidation
// ══════════════════════════════════════════════

describe("EB15: attachAutoInvalidation", () => {
  it("automatically calls onInvalidate for matching events", () => {
    const bus = createGovernanceEventBus();
    const invalidated: Array<{ target: InvalidationTarget; event: GovernanceEvent }> = [];

    attachAutoInvalidation(bus, (target, event) => {
      invalidated.push({ target, event });
    });

    bus.publish(makeEvent({ eventType: "stock_release_full" }));
    expect(invalidated.length).toBeGreaterThan(0);
    expect(invalidated[0].target.targetDomain).toBe("reorder_decision");
  });

  it("does not call onInvalidate for non-matching events", () => {
    const bus = createGovernanceEventBus();
    const invalidated: Array<{ target: InvalidationTarget; event: GovernanceEvent }> = [];

    attachAutoInvalidation(bus, (target, event) => {
      invalidated.push({ target, event });
    });

    bus.publish(makeEvent({ eventType: "some_random_thing" }));
    expect(invalidated).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════
// EB16: buildEventCorrelation
// ══════════════════════════════════════════════

describe("EB16: buildEventCorrelation", () => {
  it("correlates events by PO number", () => {
    const bus = createGovernanceEventBus();
    bus.publish(makeEvent({ poNumber: "PO-001", domain: "stock_release" as GovernanceDomain, chainStage: "stock_release" }));
    bus.publish(makeEvent({ poNumber: "PO-001", domain: "reorder_decision" as GovernanceDomain, chainStage: "reorder_decision" }));
    bus.publish(makeEvent({ poNumber: "PO-999" })); // different PO

    const correlation = buildEventCorrelation(bus, "PO-001");
    expect(correlation).not.toBeNull();
    expect(correlation!.events).toHaveLength(2);
    expect(correlation!.domainsCovered).toContain("stock_release");
    expect(correlation!.domainsCovered).toContain("reorder_decision");
    expect(correlation!.stagesCovered).toContain("stock_release");
  });

  it("returns null for unknown PO", () => {
    const bus = createGovernanceEventBus();
    expect(buildEventCorrelation(bus, "PO-UNKNOWN")).toBeNull();
  });
});

// ══════════════════════════════════════════════
// EB17: traceInvalidationChain
// ══════════════════════════════════════════════

describe("EB17: traceInvalidationChain", () => {
  it("traces cascade from receiving_execution → stock_release → reorder_decision", () => {
    const event = createGovernanceEvent("receiving_execution", "receiving_gov_received", {
      caseId: "c", poNumber: "po", fromStatus: "a", toStatus: "received",
      actor: "op", detail: "received",
    });

    const chain = traceInvalidationChain(event, 3);
    expect(chain.length).toBeGreaterThan(0);

    // Depth 0: receiving_execution → stock_release
    expect(chain[0].targets.some(t => t.targetDomain === "stock_release")).toBe(true);

    // Deeper depths should show stock_release → reorder_decision cascade
    const allTargetDomains = chain.flatMap(n => n.targets.map(t => t.targetDomain));
    expect(allTargetDomains).toContain("stock_release");
    expect(allTargetDomains).toContain("reorder_decision");
  });

  it("does not infinite loop on circular references", () => {
    const event = createGovernanceEvent("reorder_decision", "procurement_reentry_handoff_created", {
      caseId: "c", poNumber: "po", fromStatus: "a", toStatus: "b",
      actor: "op", detail: "re-entry",
    });

    // Should not throw or loop infinitely
    const chain = traceInvalidationChain(event, 5);
    expect(chain.length).toBeLessThan(20);
  });
});

// ══════════════════════════════════════════════
// EB18: detectStaleContext
// ══════════════════════════════════════════════

describe("EB18: detectStaleContext", () => {
  it("detects stale when invalidating event happened after lastFetched", () => {
    const bus = createGovernanceEventBus();
    const oldTimestamp = "2024-01-01T00:00:00.000Z";

    // Publish event after lastFetched
    bus.publish(makeEvent({ eventType: "stock_release_full" }));

    const warnings = detectStaleContext(bus, "reorder_decision", oldTimestamp);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].domain).toBe("reorder_decision");
  });

  it("no stale when no relevant events after lastFetched", () => {
    const bus = createGovernanceEventBus();
    const futureTimestamp = "2099-01-01T00:00:00.000Z";

    bus.publish(makeEvent({ eventType: "stock_release_full" }));

    const warnings = detectStaleContext(bus, "reorder_decision", futureTimestamp);
    expect(warnings).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════
// EB19: Subscriber error isolation
// ══════════════════════════════════════════════

describe("EB19: subscriber error isolation", () => {
  it("broken subscriber does not prevent other subscribers", () => {
    const bus = createGovernanceEventBus();
    const received: GovernanceEvent[] = [];

    // Broken subscriber
    bus.subscribe({
      domains: [],
      chainStages: [],
      caseId: null,
      poNumber: null,
      severities: [],
      handler: () => { throw new Error("broken!"); },
    });

    // Working subscriber
    bus.subscribe({
      domains: [],
      chainStages: [],
      caseId: null,
      poNumber: null,
      severities: [],
      handler: (e) => received.push(e),
    });

    bus.publish(makeEvent());
    expect(received).toHaveLength(1); // still works
  });
});

// ══════════════════════════════════════════════
// EB20: clearHistory
// ══════════════════════════════════════════════

describe("EB20: clearHistory", () => {
  it("clears all history", () => {
    const bus = createGovernanceEventBus();
    bus.publish(makeEvent());
    bus.publish(makeEvent());
    expect(bus.getHistory()).toHaveLength(2);

    bus.clearHistory();
    expect(bus.getHistory()).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════
// EB21: Cross-cutting policy hold → dispatch + stock release
// ══════════════════════════════════════════════

describe("EB21: cross-cutting policy_hold_changed", () => {
  it("policy hold change invalidates dispatch_prep and stock_release", () => {
    const event = createGovernanceEvent("quote_chain", "policy_hold_changed", {
      caseId: "c", poNumber: "po", fromStatus: "a", toStatus: "a",
      actor: "op", detail: "policy hold changed",
    });
    const result = resolveInvalidation(event);
    const domains = result.invalidatedTargets.map(t => t.targetDomain);
    expect(domains).toContain("dispatch_prep");
    expect(domains).toContain("stock_release");
  });
});

// ══════════════════════════════════════════════
// EB22: Full chain invalidation flow — end-to-end
// ══════════════════════════════════════════════

describe("EB22: full chain invalidation flow", () => {
  it("simulates supplier profile change cascading through chain", () => {
    const bus = createGovernanceEventBus();
    const invalidations: Array<{ domain: GovernanceDomain; scope: InvalidationScope }> = [];

    attachAutoInvalidation(bus, (target) => {
      invalidations.push({ domain: target.targetDomain, scope: target.scope });
    });

    // Supplier profile changes → triggers rule matching
    const event = createGovernanceEvent("supplier_confirmation", "supplier_profile_changed", {
      caseId: "case_001", poNumber: "PO-2024-001",
      fromStatus: "confirmed", toStatus: "confirmed",
      actor: "system", detail: "supplier profile updated",
      severity: "warning",
    });
    bus.publish(event);

    // Should invalidate dispatch_prep + receiving_prep
    const domains = invalidations.map(i => i.domain);
    expect(domains).toContain("dispatch_prep");
    expect(domains).toContain("receiving_prep");

    // History should contain the event
    const history = bus.getHistory({ poNumber: "PO-2024-001" });
    expect(history).toHaveLength(1);

    // Correlation should show one domain
    const correlation = buildEventCorrelation(bus, "PO-2024-001");
    expect(correlation).not.toBeNull();
    expect(correlation!.hasWarnings).toBe(true);
  });
});
