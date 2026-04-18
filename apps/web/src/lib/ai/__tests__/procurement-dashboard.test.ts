// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
import { describe, it, expect } from "vitest";
import {
  createProcurementDashboardContext,
  buildPanelData,
  createDashboardHandoffToken,
  validateHandoffReturn,
  applyDashboardEvent,
  resolveEventToPanelInvalidation,
  resolvePanelPriority,
  computePanelStateHash,
  computeStaleBanner,
  buildDashboardSurface,
  buildChainTimeline,
  mapPanelInvalidationsToQueryKeys,
  attachDashboardToBus,
  PANEL_LABELS,
  PANEL_DOMAIN_MAP,
  PROCUREMENT_PANELS,
  type ProcurementPanelItem,
  type ProcurementPanelData,
  type ProcurementPanelId,
  type ProcurementDashboardFilter,
} from "../procurement-dashboard-engine";
import type { GovernanceEvent, StaleContextWarning } from "../governance-event-bus";
import { createGovernanceEventBus, createGovernanceEvent } from "../governance-event-bus";

// ══════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════

function makeItem(overrides: Partial<ProcurementPanelItem> = {}): ProcurementPanelItem {
  return {
    itemId: `item_${Math.random().toString(36).slice(2)}`,
    caseId: "case_001",
    poNumber: "PO-2026-001",
    primaryLabel: "PO-2026-001 / 시약사",
    secondaryLabel: "billing 정보 누락",
    severity: "normal",
    governanceObjectId: "gov_001",
    targetDomain: "dispatch_prep",
    targetStage: "dispatch_prep",
    lastUpdatedAt: "2026-03-25T10:00:00Z",
    blockerCount: 1,
    daysInState: 3,
    ...overrides,
  };
}

function makeStaleWarning(domain: string = "dispatch_prep"): StaleContextWarning {
  return {
    domain: domain as any,
    chainStage: "dispatch_prep",
    reason: "supplier master 변경",
    staleSince: "2026-03-28T10:00:00Z",
    triggeringEvent: createGovernanceEvent("dispatch_prep" as any, "test", {
      caseId: "c1",
      poNumber: "PO-001",
      fromStatus: "a",
      toStatus: "b",
      actor: "system",
      detail: "test",
      severity: "warning",
    }),
  };
}

// ══════════════════════════════════════════════
// PD1: Dashboard context 생성
// ══════════════════════════════════════════════
describe("PD1: Dashboard Context", () => {
  it("should create initial context with default values", () => {
    const ctx = createProcurementDashboardContext();
    expect(ctx.contextId).toMatch(/^pdctx_/);
    expect(ctx.activeView).toBe("panels");
    expect(ctx.filter.domainFilter).toBeNull();
    expect(ctx.filter.severityFilter).toBeNull();
    expect(ctx.drilledPanel).toBeNull();
    expect(ctx.activeHandoff).toBeNull();
  });
});

// ══════════════════════════════════════════════
// PD2: Panel taxonomy
// ══════════════════════════════════════════════
describe("PD2: Panel Taxonomy", () => {
  it("should have 11 panels defined", () => {
    expect(PROCUREMENT_PANELS.length).toBe(11);
  });

  it("every panel has a label", () => {
    for (const panelId of PROCUREMENT_PANELS) {
      expect(PANEL_LABELS[panelId]).toBeTruthy();
    }
  });

  it("every panel maps to a domain", () => {
    for (const panelId of PROCUREMENT_PANELS) {
      expect(PANEL_DOMAIN_MAP[panelId]).toBeTruthy();
    }
  });
});

// ══════════════════════════════════════════════
// PD3: Panel data 빌드
// ══════════════════════════════════════════════
describe("PD3: Panel Data Build", () => {
  it("should build panel with correct counts", () => {
    const items = [
      makeItem({ severity: "critical" }),
      makeItem({ severity: "warning" }),
      makeItem({ severity: "normal" }),
      makeItem({ severity: "normal" }),
    ];
    const panel = buildPanelData("send_blocked", items, [], "2026-03-29T00:00:00Z");
    expect(panel.count).toBe(4);
    expect(panel.criticalCount).toBe(1);
    expect(panel.warningCount).toBe(1);
    expect(panel.normalCount).toBe(2);
    expect(panel.isStale).toBe(false);
  });

  it("should sort items: critical first, then warning, then normal", () => {
    const items = [
      makeItem({ severity: "normal", itemId: "n1" }),
      makeItem({ severity: "critical", itemId: "c1" }),
      makeItem({ severity: "warning", itemId: "w1" }),
    ];
    const panel = buildPanelData("send_blocked", items, [], "2026-03-29T00:00:00Z");
    expect(panel.items[0].itemId).toBe("c1");
    expect(panel.items[1].itemId).toBe("w1");
    expect(panel.items[2].itemId).toBe("n1");
  });

  it("should detect stale panel from warnings", () => {
    const stale = makeStaleWarning("dispatch_prep");
    const panel = buildPanelData("send_blocked", [], [stale], "2026-03-29T00:00:00Z");
    expect(panel.isStale).toBe(true);
    expect(panel.staleReason).toBe("supplier master 변경");
  });
});

// ══════════════════════════════════════════════
// PD4: Handoff token 생성
// ══════════════════════════════════════════════
describe("PD4: Handoff Token", () => {
  it("should create token with correct fields", () => {
    const item = makeItem();
    const filter: ProcurementDashboardFilter = {
      domainFilter: "dispatch_prep",
      severityFilter: null,
      poNumberSearch: null,
      daysInStateMin: null,
    };
    const token = createDashboardHandoffToken(item, "send_blocked", filter, "hash_abc");
    expect(token.tokenId).toMatch(/^pdh_/);
    expect(token.originPanel).toBe("send_blocked");
    expect(token.caseId).toBe(item.caseId);
    expect(token.poNumber).toBe(item.poNumber);
    expect(token.governanceObjectId).toBe(item.governanceObjectId);
    expect(token.correlationId).toMatch(/^pcorr_/);
    expect(token.panelStateHash).toBe("hash_abc");
    expect(token.originFilter?.domainFilter).toBe("dispatch_prep");
  });
});

// ══════════════════════════════════════════════
// PD5: Handoff return validation
// ══════════════════════════════════════════════
describe("PD5: Handoff Return Validation", () => {
  it("should return_to_panel when resolved and not stale", () => {
    const item = makeItem();
    const token = createDashboardHandoffToken(item, "send_blocked", null, "hash_1");
    const result = validateHandoffReturn(token, "hash_1", true, []);
    expect(result.valid).toBe(true);
    expect(result.caseResolved).toBe(true);
    expect(result.originPanelStale).toBe(false);
    expect(result.recommendation).toBe("return_to_panel");
    expect(result.panelInvalidations).toContain("send_blocked");
  });

  it("should refresh_panel when resolved and stale", () => {
    const item = makeItem();
    const token = createDashboardHandoffToken(item, "send_blocked", null, "hash_1");
    const result = validateHandoffReturn(token, "hash_CHANGED", true, []);
    expect(result.originPanelStale).toBe(true);
    expect(result.recommendation).toBe("refresh_panel");
  });

  it("should cascade invalidation on resolution", () => {
    const item = makeItem();
    const token = createDashboardHandoffToken(item, "send_blocked", null, "hash_1");
    const result = validateHandoffReturn(token, "hash_1", true, []);
    // send_blocked → send_scheduled cascade
    expect(result.panelInvalidations).toContain("send_blocked");
    expect(result.panelInvalidations).toContain("send_scheduled");
  });
});

// ══════════════════════════════════════════════
// PD6: Dashboard event — panel drilldown
// ══════════════════════════════════════════════
describe("PD6: Dashboard Events", () => {
  it("panel_drilldown should set drilledPanel", () => {
    const ctx = createProcurementDashboardContext();
    const result = applyDashboardEvent(ctx, { type: "panel_drilldown", panelId: "send_blocked" });
    expect(result.updatedContext.drilledPanel).toBe("send_blocked");
  });

  it("panel_return should clear drilledPanel", () => {
    const ctx = { ...createProcurementDashboardContext(), drilledPanel: "send_blocked" as ProcurementPanelId };
    const result = applyDashboardEvent(ctx, { type: "panel_return", fromPanel: "send_blocked" });
    expect(result.updatedContext.drilledPanel).toBeNull();
  });

  it("workbench_return resolved should toast success", () => {
    const ctx = createProcurementDashboardContext();
    const item = makeItem();
    const token = createDashboardHandoffToken(item, "send_blocked", null, "h");
    const result = applyDashboardEvent(ctx, {
      type: "workbench_return",
      handoff: token,
      resolved: true,
    });
    expect(result.toastType).toBe("success");
    expect(result.panelInvalidations).toContain("send_blocked");
    expect(result.updatedContext.activeHandoff).toBeNull();
  });

  it("filter_changed should invalidate all panels", () => {
    const ctx = createProcurementDashboardContext();
    const result = applyDashboardEvent(ctx, {
      type: "filter_changed",
      filter: { domainFilter: "stock_release", severityFilter: null, poNumberSearch: null, daysInStateMin: null },
    });
    expect(result.panelInvalidations.length).toBe(PROCUREMENT_PANELS.length);
    expect(result.updatedContext.filter.domainFilter).toBe("stock_release");
  });
});

// ══════════════════════════════════════════════
// PD7: Event → Panel invalidation mapping
// ══════════════════════════════════════════════
describe("PD7: Event to Panel Invalidation", () => {
  it("dispatch_prep event invalidates send_blocked + send_scheduled", () => {
    const event = createGovernanceEvent("dispatch_prep", "readiness_changed", {
      caseId: "c1", poNumber: "PO-001", fromStatus: "a", toStatus: "b",
      actor: "sys", detail: "test",
    });
    const panels = resolveEventToPanelInvalidation(event);
    expect(panels).toContain("send_blocked");
    expect(panels).toContain("send_scheduled");
  });

  it("stock_release event invalidates stock_release_blocked", () => {
    const event = createGovernanceEvent("stock_release", "hold_placed", {
      caseId: "c1", poNumber: "PO-001", fromStatus: "a", toStatus: "b",
      actor: "sys", detail: "test",
    });
    const panels = resolveEventToPanelInvalidation(event);
    expect(panels).toContain("stock_release_blocked");
  });

  it("reorder_decision event invalidates reorder_required + reorder_watch + procurement_reentry", () => {
    const event = createGovernanceEvent("reorder_decision", "reorder_recommended", {
      caseId: "c1", poNumber: "PO-001", fromStatus: "a", toStatus: "b",
      actor: "sys", detail: "test",
    });
    const panels = resolveEventToPanelInvalidation(event);
    expect(panels).toContain("reorder_required");
    expect(panels).toContain("reorder_watch");
    expect(panels).toContain("procurement_reentry");
  });

  it("critical event also invalidates chain_health", () => {
    const event = createGovernanceEvent("stock_release", "critical_hold", {
      caseId: "c1", poNumber: "PO-001", fromStatus: "a", toStatus: "b",
      actor: "sys", detail: "test", severity: "critical",
    });
    const panels = resolveEventToPanelInvalidation(event);
    expect(panels).toContain("chain_health");
  });
});

// ══════════════════════════════════════════════
// PD8: Panel priority resolution
// ══════════════════════════════════════════════
describe("PD8: Panel Priority", () => {
  it("send_blocked has highest priority", () => {
    const result = resolvePanelPriority(["reorder_watch", "send_blocked", "chain_health"]);
    expect(result).toBe("send_blocked");
  });

  it("returns null for empty", () => {
    expect(resolvePanelPriority([])).toBeNull();
  });
});

// ══════════════════════════════════════════════
// PD9: Panel state hash
// ══════════════════════════════════════════════
describe("PD9: Panel State Hash", () => {
  it("should produce consistent hash for same data", () => {
    const panel = buildPanelData("send_blocked", [makeItem()], [], "2026-03-29T00:00:00Z");
    const hash1 = computePanelStateHash(panel);
    const hash2 = computePanelStateHash(panel);
    expect(hash1).toBe(hash2);
  });

  it("should differ when count changes", () => {
    const panel1 = buildPanelData("send_blocked", [makeItem()], [], "2026-03-29T00:00:00Z");
    const panel2 = buildPanelData("send_blocked", [makeItem(), makeItem()], [], "2026-03-29T00:00:00Z");
    expect(computePanelStateHash(panel1)).not.toBe(computePanelStateHash(panel2));
  });
});

// ══════════════════════════════════════════════
// PD10: Stale banner computation
// ══════════════════════════════════════════════
describe("PD10: Stale Banner", () => {
  it("no warnings → level none", () => {
    expect(computeStaleBanner([]).level).toBe("none");
  });

  it("warning severity → level warning", () => {
    const w = makeStaleWarning();
    expect(computeStaleBanner([w]).level).toBe("warning");
  });

  it("critical severity → level blocking, locks actions", () => {
    const w: StaleContextWarning = {
      ...makeStaleWarning(),
      triggeringEvent: createGovernanceEvent("dispatch_prep", "critical_event", {
        caseId: "c1", poNumber: "PO-001", fromStatus: "a", toStatus: "b",
        actor: "sys", detail: "critical", severity: "critical",
      }),
    };
    const banner = computeStaleBanner([w]);
    expect(banner.level).toBe("blocking");
    expect(banner.locksIrreversibleActions).toBe(true);
  });
});

// ══════════════════════════════════════════════
// PD11: Dashboard surface build
// ══════════════════════════════════════════════
describe("PD11: Dashboard Surface", () => {
  it("should aggregate counts across panels", () => {
    const panels: ProcurementPanelData[] = [
      buildPanelData("send_blocked", [makeItem({ severity: "critical" }), makeItem()], [], "2026-03-29T00:00:00Z"),
      buildPanelData("stock_release_blocked", [makeItem({ severity: "warning" })], [], "2026-03-29T00:00:00Z"),
    ];
    const ctx = createProcurementDashboardContext();
    const surface = buildDashboardSurface(panels, ctx, []);
    expect(surface.totalActiveCount).toBe(3);
    expect(surface.totalCriticalCount).toBe(1);
    expect(surface.totalWarningCount).toBe(1);
  });

  it("should apply domain filter", () => {
    const panels: ProcurementPanelData[] = [
      buildPanelData("send_blocked", [makeItem()], [], "2026-03-29T00:00:00Z"),
      buildPanelData("stock_release_blocked", [makeItem()], [], "2026-03-29T00:00:00Z"),
    ];
    const ctx = createProcurementDashboardContext();
    ctx.filter.domainFilter = "stock_release";
    const surface = buildDashboardSurface(panels, ctx, []);
    expect(surface.isFiltered).toBe(true);
    // send_blocked (dispatch_prep) should be empty after filter
    const sendPanel = surface.panels.find(p => p.panelId === "send_blocked");
    expect(sendPanel?.count).toBe(0);
    // stock_release_blocked should remain
    const stockPanel = surface.panels.find(p => p.panelId === "stock_release_blocked");
    expect(stockPanel?.count).toBe(1);
  });

  it("should apply severity filter", () => {
    const panels: ProcurementPanelData[] = [
      buildPanelData("send_blocked", [
        makeItem({ severity: "critical" }),
        makeItem({ severity: "normal" }),
      ], [], "2026-03-29T00:00:00Z"),
    ];
    const ctx = createProcurementDashboardContext();
    ctx.filter.severityFilter = "critical";
    const surface = buildDashboardSurface(panels, ctx, []);
    const sendPanel = surface.panels.find(p => p.panelId === "send_blocked");
    expect(sendPanel?.count).toBe(1);
    expect(sendPanel?.criticalCount).toBe(1);
  });

  it("should detect stale panels", () => {
    const stale = makeStaleWarning("dispatch_prep");
    const panels = [buildPanelData("send_blocked", [], [stale], "2026-03-29T00:00:00Z")];
    const ctx = createProcurementDashboardContext();
    const surface = buildDashboardSurface(panels, ctx, [stale]);
    expect(surface.hasStalePanel).toBe(true);
    expect(surface.stalePanelIds).toContain("send_blocked");
  });
});

// ══════════════════════════════════════════════
// PD12: Chain timeline build
// ══════════════════════════════════════════════
describe("PD12: Chain Timeline", () => {
  it("should build timeline with 13 stages", () => {
    const tl = buildChainTimeline("PO-001", "case_001", {}, []);
    expect(tl.entries.length).toBe(13);
    expect(tl.overallHealth).toBe("healthy");
    expect(tl.currentStage).toBeNull();
  });

  it("should detect blocked health", () => {
    const tl = buildChainTimeline("PO-001", "case_001", {
      dispatch_prep: { status: "blocked", enteredAt: "2026-03-20T00:00:00Z", completedAt: null, blockerCount: 2 },
    }, []);
    expect(tl.overallHealth).toBe("blocked");
    expect(tl.currentStage).toBe("dispatch_prep");
  });

  it("should detect at_risk from stale warnings", () => {
    const stale: StaleContextWarning = {
      ...makeStaleWarning("dispatch_prep"),
      chainStage: "dispatch_prep",
    };
    const tl = buildChainTimeline("PO-001", "case_001", {
      dispatch_prep: { status: "active", enteredAt: "2026-03-20T00:00:00Z", completedAt: null, blockerCount: 0 },
    }, [stale]);
    expect(tl.overallHealth).toBe("at_risk");
    const dpEntry = tl.entries.find(e => e.stage === "dispatch_prep");
    expect(dpEntry?.stale).toBe(true);
  });

  it("should calculate totalDaysInChain", () => {
    const tl = buildChainTimeline("PO-001", "case_001", {
      quote_review: { status: "completed", enteredAt: "2026-03-10T00:00:00Z", completedAt: "2026-03-12T00:00:00Z", blockerCount: 0 },
    }, []);
    expect(tl.totalDaysInChain).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════
// PD13: Event bus → dashboard 연결
// ══════════════════════════════════════════════
describe("PD13: Event Bus Integration", () => {
  it("should receive panel invalidation from bus events", () => {
    const bus = createGovernanceEventBus();
    const invalidated: ProcurementPanelId[] = [];

    attachDashboardToBus(bus, (panels) => {
      invalidated.push(...panels);
    });

    bus.publish(createGovernanceEvent("stock_release", "hold_placed", {
      caseId: "c1", poNumber: "PO-001", fromStatus: "evaluating", toStatus: "hold_active",
      actor: "operator", detail: "quality hold",
    }));

    expect(invalidated).toContain("stock_release_blocked");
  });

  it("should unsubscribe cleanly", () => {
    const bus = createGovernanceEventBus();
    let callCount = 0;
    const sub = attachDashboardToBus(bus, () => { callCount++; });

    bus.publish(createGovernanceEvent("stock_release", "test", {
      caseId: "c1", poNumber: "PO-001", fromStatus: "a", toStatus: "b",
      actor: "sys", detail: "test",
    }));
    expect(callCount).toBe(1);

    sub.unsubscribe();
    bus.publish(createGovernanceEvent("stock_release", "test2", {
      caseId: "c1", poNumber: "PO-001", fromStatus: "a", toStatus: "b",
      actor: "sys", detail: "test2",
    }));
    expect(callCount).toBe(1); // not incremented
  });
});

// ══════════════════════════════════════════════
// PD14: Query key mapping
// ══════════════════════════════════════════════
describe("PD14: Query Key Mapping", () => {
  it("should map individual panels to specific keys", () => {
    const keys = mapPanelInvalidationsToQueryKeys(["send_blocked"]);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys[0]).toContain("procurement-dashboard");
  });

  it("should map all panels to root key", () => {
    const keys = mapPanelInvalidationsToQueryKeys([...PROCUREMENT_PANELS]);
    expect(keys.length).toBe(1);
    expect(keys[0]).toEqual(["procurement-dashboard"]);
  });
});

// ══════════════════════════════════════════════
// PD15: PO number search filter
// ══════════════════════════════════════════════
describe("PD15: PO Number Search", () => {
  it("should filter items by PO number substring", () => {
    const panels = [
      buildPanelData("send_blocked", [
        makeItem({ poNumber: "PO-2026-001" }),
        makeItem({ poNumber: "PO-2026-002" }),
        makeItem({ poNumber: "PO-2025-999" }),
      ], [], "2026-03-29T00:00:00Z"),
    ];
    const ctx = createProcurementDashboardContext();
    ctx.filter.poNumberSearch = "2026-001";
    const surface = buildDashboardSurface(panels, ctx, []);
    const sendPanel = surface.panels.find(p => p.panelId === "send_blocked");
    expect(sendPanel?.count).toBe(1);
  });
});

// ══════════════════════════════════════════════
// PD16: Days in state filter
// ══════════════════════════════════════════════
describe("PD16: Days in State Filter", () => {
  it("should filter items by minimum days in state", () => {
    const panels = [
      buildPanelData("send_blocked", [
        makeItem({ daysInState: 10 }),
        makeItem({ daysInState: 2 }),
        makeItem({ daysInState: 7 }),
      ], [], "2026-03-29T00:00:00Z"),
    ];
    const ctx = createProcurementDashboardContext();
    ctx.filter.daysInStateMin = 5;
    const surface = buildDashboardSurface(panels, ctx, []);
    const sendPanel = surface.panels.find(p => p.panelId === "send_blocked");
    expect(sendPanel?.count).toBe(2); // 10 and 7
  });
});

// ══════════════════════════════════════════════
// PD17: workbench_enter should set activeHandoff
// ══════════════════════════════════════════════
describe("PD17: Workbench Enter", () => {
  it("should set activeHandoff on workbench_enter", () => {
    const ctx = createProcurementDashboardContext();
    const item = makeItem();
    const token = createDashboardHandoffToken(item, "send_blocked", null, "h");
    const result = applyDashboardEvent(ctx, { type: "workbench_enter", handoff: token });
    expect(result.updatedContext.activeHandoff).toBe(token);
  });
});

// ══════════════════════════════════════════════
// PD18: View change
// ══════════════════════════════════════════════
describe("PD18: View Change", () => {
  it("should change activeView", () => {
    const ctx = createProcurementDashboardContext();
    const result = applyDashboardEvent(ctx, { type: "view_changed", view: "chain_timeline" });
    expect(result.updatedContext.activeView).toBe("chain_timeline");
  });
});

// ══════════════════════════════════════════════
// PD19: Handoff return — cascade to downstream panels
// ══════════════════════════════════════════════
describe("PD19: Cascade Invalidation on Return", () => {
  it("receiving_discrepancy resolution cascades to stock_release_blocked", () => {
    const item = makeItem({ targetDomain: "receiving_execution" });
    const token = createDashboardHandoffToken(item, "receiving_discrepancy", null, "h");
    const result = validateHandoffReturn(token, "h", true, []);
    expect(result.panelInvalidations).toContain("receiving_discrepancy");
    expect(result.panelInvalidations).toContain("stock_release_blocked");
  });

  it("stock_release_blocked resolution cascades to reorder panels", () => {
    const item = makeItem({ targetDomain: "stock_release" });
    const token = createDashboardHandoffToken(item, "stock_release_blocked", null, "h");
    const result = validateHandoffReturn(token, "h", true, []);
    expect(result.panelInvalidations).toContain("stock_release_blocked");
    expect(result.panelInvalidations).toContain("reorder_required");
    expect(result.panelInvalidations).toContain("reorder_watch");
  });
});

// ══════════════════════════════════════════════
// PD20: Full flow — dashboard → handoff → workbench → return → panel refresh
// ══════════════════════════════════════════════
describe("PD20: Full Dashboard Flow", () => {
  it("complete drilldown → handoff → resolution → return cycle", () => {
    // 1. Create context
    let ctx = createProcurementDashboardContext();

    // 2. Panel drilldown
    let result = applyDashboardEvent(ctx, { type: "panel_drilldown", panelId: "send_blocked" });
    ctx = result.updatedContext;
    expect(ctx.drilledPanel).toBe("send_blocked");

    // 3. Create handoff token
    const item = makeItem();
    const token = createDashboardHandoffToken(item, "send_blocked", ctx.filter, "hash_before");

    // 4. Enter workbench
    result = applyDashboardEvent(ctx, { type: "workbench_enter", handoff: token });
    ctx = result.updatedContext;
    expect(ctx.activeHandoff).toBe(token);

    // 5. Return from workbench (resolved)
    result = applyDashboardEvent(ctx, { type: "workbench_return", handoff: token, resolved: true });
    ctx = result.updatedContext;
    expect(ctx.activeHandoff).toBeNull();
    expect(result.toastType).toBe("success");
    expect(result.panelInvalidations).toContain("send_blocked");

    // 6. Validate return
    const validation = validateHandoffReturn(token, "hash_before", true, []);
    expect(validation.recommendation).toBe("return_to_panel");
    expect(validation.panelInvalidations).toContain("send_blocked");

    // 7. Return to panels
    result = applyDashboardEvent(ctx, { type: "panel_return", fromPanel: "send_blocked" });
    ctx = result.updatedContext;
    expect(ctx.drilledPanel).toBeNull();
  });
});

// ══════════════════════════════════════════════
// PD21: Stale handoff return → refresh recommendation
// ══════════════════════════════════════════════
describe("PD21: Stale Handoff Return", () => {
  it("stale warnings during workbench should recommend refresh", () => {
    const item = makeItem();
    const token = createDashboardHandoffToken(item, "send_blocked", null, "hash_1");
    const stale = makeStaleWarning("dispatch_prep");
    const result = validateHandoffReturn(token, "hash_1", false, [stale]);
    expect(result.originPanelStale).toBe(true);
    expect(result.recommendation).toBe("refresh_panel");
  });
});

// ══════════════════════════════════════════════
// PD22: Scroll position preservation
// ══════════════════════════════════════════════
describe("PD22: Scroll Position", () => {
  it("should save and restore scroll position", () => {
    const ctx = createProcurementDashboardContext();
    const result = applyDashboardEvent(ctx, { type: "scroll_position_saved", position: 450 });
    expect(result.updatedContext.scrollPosition).toBe(450);
  });
});
