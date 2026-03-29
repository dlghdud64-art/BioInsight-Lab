/**
 * Governance Grammar Registry Tests
 *
 * Grammar freeze 무결성 검증 — stage/status/action/panel/severity 전체를
 * 하나의 운영 grammar로 고정했는지 확인.
 *
 * GG1-GG25: 25 scenarios
 */
import { describe, it, expect } from "vitest";
import {
  CHAIN_STAGE_GRAMMAR,
  STATUS_GRAMMAR,
  BLOCKER_SEVERITY_SPEC,
  SEVERITY_SPEC,
  PANEL_GRAMMAR,
  DOCK_ACTION_GRAMMAR,
  validateGrammarRegistry,
  getStageGrammar,
  getStatusGrammar,
  getStatusLabel,
  getStageLabel,
  getTerminalStatuses,
  isTerminalStatus,
  isIrreversibleActionAllowed,
  getDockActions,
  getIrreversibleActions,
  getPanelGrammar,
  getPanelLabel,
  type StatusCategory,
  type BlockerSeverity,
  type UnifiedSeverity,
  type ActionRisk,
} from "../governance-grammar-registry";

// ══════════════════════════════════════════════════════
// Section 1: Registry Integrity
// ══════════════════════════════════════════════════════

describe("Grammar Registry Integrity", () => {
  it("GG1: validateGrammarRegistry reports no errors", () => {
    const result = validateGrammarRegistry();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("GG2: registry has correct counts", () => {
    const result = validateGrammarRegistry();
    expect(result.stats.stageCount).toBe(13);
    expect(result.stats.statusCount).toBe(STATUS_GRAMMAR.length);
    expect(result.stats.panelCount).toBe(11);
    expect(result.stats.actionCount).toBe(26);
    expect(result.stats.terminalStatusCount).toBeGreaterThan(0);
    expect(result.stats.irreversibleActionCount).toBeGreaterThan(0);
  });

  it("GG3: stage order is unique and sequential 0-12", () => {
    const orders = CHAIN_STAGE_GRAMMAR.map(s => s.order).sort((a, b) => a - b);
    expect(orders).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("GG4: all stage names are unique", () => {
    const names = CHAIN_STAGE_GRAMMAR.map(s => s.stage);
    expect(new Set(names).size).toBe(names.length);
  });

  it("GG5: all panel IDs are unique", () => {
    const ids = PANEL_GRAMMAR.map(p => p.panelId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("GG6: all action keys are unique", () => {
    const keys = DOCK_ACTION_GRAMMAR.map(a => a.actionKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ══════════════════════════════════════════════════════
// Section 2: Chain Stage Grammar
// ══════════════════════════════════════════════════════

describe("Chain Stage Grammar", () => {
  it("GG7: 5 phases cover all 13 stages", () => {
    const phases = new Set(CHAIN_STAGE_GRAMMAR.map(s => s.phase));
    expect(phases).toEqual(new Set(["sourcing", "approval", "dispatch", "fulfillment", "inventory"]));

    const phaseCount: Record<string, number> = {};
    CHAIN_STAGE_GRAMMAR.forEach(s => {
      phaseCount[s.phase] = (phaseCount[s.phase] || 0) + 1;
    });
    // sourcing(2) + approval(3) + dispatch(4) + fulfillment(2) + inventory(2) = 13
    expect(phaseCount["sourcing"]).toBe(2);
    expect(phaseCount["approval"]).toBe(3);
    expect(phaseCount["dispatch"]).toBe(4);
    expect(phaseCount["fulfillment"]).toBe(2);
    expect(phaseCount["inventory"]).toBe(2);
  });

  it("GG8: shortLabel ≤ 5 characters", () => {
    for (const stage of CHAIN_STAGE_GRAMMAR) {
      expect(stage.shortLabel.length).toBeLessThanOrEqual(5);
    }
  });

  it("GG9: getStageGrammar returns correct stage", () => {
    const result = getStageGrammar("po_conversion");
    expect(result).toBeDefined();
    expect(result!.domain).toBe("quote_chain");
    expect(result!.phase).toBe("approval");
    expect(result!.order).toBe(3);
  });

  it("GG10: getStageLabel returns short and full labels", () => {
    expect(getStageLabel("dispatch_prep", true)).toBe("발송검증");
    expect(getStageLabel("dispatch_prep", false)).toBe("발송 전 최종 검증");
  });
});

// ══════════════════════════════════════════════════════
// Section 3: Status Grammar
// ══════════════════════════════════════════════════════

describe("Status Grammar", () => {
  const domains = [
    "dispatch_prep", "dispatch_execution", "supplier_confirmation",
    "receiving_prep", "receiving_execution", "stock_release", "reorder_decision",
  ] as const;

  it("GG11: every domain has at least one terminal status", () => {
    for (const domain of domains) {
      const terminals = getTerminalStatuses(domain);
      expect(terminals.length).toBeGreaterThan(0);
    }
  });

  it("GG12: every domain has 'cancelled' as terminal", () => {
    for (const domain of domains) {
      expect(isTerminalStatus(domain, "cancelled")).toBe(true);
    }
  });

  it("GG13: status categories are valid", () => {
    const validCategories: StatusCategory[] = [
      "not_started", "in_progress", "waiting", "blocked", "ready", "completed", "cancelled",
    ];
    for (const status of STATUS_GRAMMAR) {
      expect(validCategories).toContain(status.category);
    }
  });

  it("GG14: terminal statuses never allow irreversible actions (except completed with handoff ready)", () => {
    for (const status of STATUS_GRAMMAR) {
      if (status.isTerminal && status.category === "cancelled") {
        expect(status.allowsIrreversibleAction).toBe(false);
      }
    }
  });

  it("GG15: getStatusGrammar looks up correctly", () => {
    const result = getStatusGrammar("dispatch_prep", "ready_to_send");
    expect(result).toBeDefined();
    expect(result!.category).toBe("ready");
    expect(result!.label).toBe("발송 가능");
    expect(result!.allowsIrreversibleAction).toBe(true);
  });

  it("GG16: getStatusLabel returns fallback for unknown status", () => {
    expect(getStatusLabel("dispatch_prep", "nonexistent_status")).toBe("nonexistent_status");
  });

  it("GG17: isIrreversibleActionAllowed returns false for blocked statuses", () => {
    expect(isIrreversibleActionAllowed("dispatch_prep", "blocked")).toBe(false);
    expect(isIrreversibleActionAllowed("dispatch_prep", "needs_review")).toBe(false);
  });
});

// ══════════════════════════════════════════════════════
// Section 4: Blocker Severity
// ══════════════════════════════════════════════════════

describe("Blocker Severity Formal Spec", () => {
  it("GG18: hard blocker locks irreversible actions", () => {
    expect(BLOCKER_SEVERITY_SPEC.hard.locksIrreversibleAction).toBe(true);
    expect(BLOCKER_SEVERITY_SPEC.hard.requiresAcknowledgment).toBe(true);
    expect(BLOCKER_SEVERITY_SPEC.hard.badgeColor).toBe("red");
  });

  it("GG19: soft blocker does NOT lock irreversible actions", () => {
    expect(BLOCKER_SEVERITY_SPEC.soft.locksIrreversibleAction).toBe(false);
    expect(BLOCKER_SEVERITY_SPEC.soft.requiresAcknowledgment).toBe(false);
    expect(BLOCKER_SEVERITY_SPEC.soft.badgeColor).toBe("amber");
  });
});

// ══════════════════════════════════════════════════════
// Section 5: Unified Severity
// ══════════════════════════════════════════════════════

describe("Unified Severity Spec", () => {
  it("GG20: only 3 severities exist — no 'error'", () => {
    const severities = Object.keys(SEVERITY_SPEC);
    expect(severities).toEqual(["info", "warning", "critical"]);
    expect(severities).not.toContain("error");
  });

  it("GG21: severity → stale banner level mapping", () => {
    expect(SEVERITY_SPEC.info.staleBannerLevel).toBe("info");
    expect(SEVERITY_SPEC.warning.staleBannerLevel).toBe("warning");
    expect(SEVERITY_SPEC.critical.staleBannerLevel).toBe("blocking");
  });

  it("GG22: critical severity caps at handoff_invalidate scope", () => {
    expect(SEVERITY_SPEC.critical.maxInvalidationScope).toBe("handoff_invalidate");
    expect(SEVERITY_SPEC.info.maxInvalidationScope).toBe("surface_only");
  });
});

// ══════════════════════════════════════════════════════
// Section 6: Dock Action Grammar
// ══════════════════════════════════════════════════════

describe("Dock Action Grammar", () => {
  it("GG23: every irreversible action blocked by stale (with known exceptions tracked)", () => {
    const irreversible = DOCK_ACTION_GRAMMAR.filter(a => a.risk === "irreversible");
    // Nearly all irreversible should be blocked by stale
    const notBlockedByStale = irreversible.filter(a => !a.blockedByStale);
    // Allow known exceptions — but none expected currently
    expect(notBlockedByStale).toHaveLength(0);
  });

  it("GG24: getDockActions returns correct domain actions", () => {
    const dispatchPrepActions = getDockActions("dispatch_prep");
    expect(dispatchPrepActions.length).toBe(5);
    const keys = dispatchPrepActions.map(a => a.actionKey);
    expect(keys).toContain("send_now");
    expect(keys).toContain("schedule_send");
    expect(keys).toContain("cancel_dispatch_prep");
  });

  it("GG25: getIrreversibleActions filters correctly", () => {
    const irreversible = getIrreversibleActions("stock_release");
    for (const action of irreversible) {
      expect(action.risk).toBe("irreversible");
      expect(action.domain).toBe("stock_release");
    }
    const keys = irreversible.map(a => a.actionKey);
    expect(keys).toContain("release_stock");
    expect(keys).toContain("partial_release");
    expect(keys).toContain("cancel_release");
  });
});

// ══════════════════════════════════════════════════════
// Section 7: Panel Grammar
// ══════════════════════════════════════════════════════

describe("Panel Grammar", () => {
  it("GG26: getPanelGrammar returns correct panel", () => {
    const panel = getPanelGrammar("send_blocked");
    expect(panel).toBeDefined();
    expect(panel!.label).toBe("발송 차단");
    expect(panel!.domain).toBe("dispatch_prep");
    expect(panel!.priority).toBe(1);
  });

  it("GG27: getPanelLabel returns fallback for unknown panel", () => {
    expect(getPanelLabel("nonexistent_panel")).toBe("nonexistent_panel");
  });

  it("GG28: panel priorities are unique", () => {
    const priorities = PANEL_GRAMMAR.map(p => p.priority);
    expect(new Set(priorities).size).toBe(priorities.length);
  });
});

// ══════════════════════════════════════════════════════
// Section 8: Cross-registry Consistency
// ══════════════════════════════════════════════════════

describe("Cross-registry Consistency", () => {
  it("GG29: panel domains exist in stage grammar", () => {
    const stageDomains = new Set(CHAIN_STAGE_GRAMMAR.map(s => s.domain));
    for (const panel of PANEL_GRAMMAR) {
      expect(stageDomains).toContain(panel.domain);
    }
  });

  it("GG30: dock action domains exist in status grammar", () => {
    const statusDomains = new Set(STATUS_GRAMMAR.map(s => s.domain));
    for (const action of DOCK_ACTION_GRAMMAR) {
      expect(statusDomains).toContain(action.domain);
    }
  });

  it("GG31: receiving_prep has no dock actions (prep is not execution)", () => {
    const rpActions = getDockActions("receiving_prep");
    expect(rpActions).toHaveLength(0);
  });

  it("GG32: quote_chain domain has no dock actions in this registry (managed by existing engines)", () => {
    const qcActions = getDockActions("quote_chain");
    expect(qcActions).toHaveLength(0);
  });
});
