/**
 * Governance Loop Closure Engine — 운영 개입 루프 완전 폐쇄
 *
 * dashboard → drilldown → action → resolution → dashboard 재반영
 * 이 전체 루프가 context를 잃지 않고 이어지도록 보장.
 *
 * CLOSURE CONTRACT:
 * 1. drilldown 후 dashboard 복귀 시 이전 view/filter/scroll 유지
 * 2. resolution 후 dashboard KPI/panel이 즉시 재반영
 * 3. ownership 변경 후 관련 패널 invalidation
 * 4. policy publish/rollback 후 dashboard 전체 refresh
 * 5. same case 여러 패널 중복 시 우선 진입 기준 명확
 */

import type { ApprovalDomain } from "./approval-inbox-projection-v2-engine";

// ══════════════════════════════════════════════
// Dashboard Context Snapshot
// ══════════════════════════════════════════════

export interface DashboardContextSnapshot {
  contextId: string;
  // View state
  activeTab: "overview" | "breakdown" | "hotspot" | "reapproval" | "impact" | "ownership";
  breakdownDimension: string | null;
  selectedGroupId: string | null;
  selectedOwnerId: string | null;
  // Filter state
  domainFilter: ApprovalDomain | null;
  urgencyFilter: string | null;
  // Scroll
  scrollPosition: number;
  // Drilldown state
  isDrilledDown: boolean;
  drilldownTarget: string | null;
  drilldownSourcePanel: string | null;
  // Timestamp
  capturedAt: string;
}

// ══════════════════════════════════════════════
// Loop Events
// ══════════════════════════════════════════════

export type LoopEvent =
  | { type: "drilldown_start"; sourcePanel: string; targetRoute: string }
  | { type: "drilldown_return"; fromRoute: string }
  | { type: "resolution_complete"; caseId: string; domain: ApprovalDomain; decision: string }
  | { type: "ownership_changed"; ownershipType: string; ownerId: string }
  | { type: "policy_changed"; policySetId: string; changeType: "publish" | "rollback" }
  | { type: "inbox_action_complete"; itemId: string; action: string }
  | { type: "tab_changed"; tab: DashboardContextSnapshot["activeTab"] }
  | { type: "filter_changed"; domain: ApprovalDomain | null; urgency: string | null };

// ══════════════════════════════════════════════
// Apply Loop Event
// ══════════════════════════════════════════════

export interface LoopEventResult {
  updatedContext: DashboardContextSnapshot;
  invalidations: InvalidationTarget[];
  toastMessage: string | null;
  toastType: "success" | "info" | "warning" | null;
}

export type InvalidationTarget =
  | "kpi_strip"
  | "bottleneck_alerts"
  | "domain_breakdown"
  | "top_blockers"
  | "team_site_breakdown"
  | "escalation_hotspot"
  | "reapproval_loop"
  | "policy_impact_trend"
  | "owner_backlog"
  | "ownership_coverage"
  | "recommended_actions"
  | "all";

export function applyLoopEvent(
  context: DashboardContextSnapshot,
  event: LoopEvent,
): LoopEventResult {
  const now = new Date().toISOString();
  let u = { ...context, capturedAt: now };
  let invalidations: InvalidationTarget[] = [];
  let toastMessage: string | null = null;
  let toastType: LoopEventResult["toastType"] = null;

  switch (event.type) {
    case "drilldown_start":
      u.isDrilledDown = true;
      u.drilldownTarget = event.targetRoute;
      u.drilldownSourcePanel = event.sourcePanel;
      break;

    case "drilldown_return":
      // Restore previous view state — context 유지
      u.isDrilledDown = false;
      u.drilldownTarget = null;
      // Keep drilldownSourcePanel so we can scroll back to it
      break;

    case "resolution_complete":
      // Resolution → invalidate affected panels
      invalidations = [
        "kpi_strip", "bottleneck_alerts", "domain_breakdown",
        "team_site_breakdown", "owner_backlog", "ownership_coverage",
        "recommended_actions",
      ];
      toastMessage = `${event.caseId.slice(0, 8)} ${event.decision} 완료 — 대시보드 갱신`;
      toastType = event.decision === "approved" ? "success" : "info";
      break;

    case "ownership_changed":
      invalidations = [
        "owner_backlog", "ownership_coverage", "team_site_breakdown",
        "recommended_actions",
      ];
      toastMessage = `${event.ownershipType} 변경 반영`;
      toastType = "info";
      break;

    case "policy_changed":
      // Policy change → full dashboard refresh
      invalidations = ["all"];
      toastMessage = event.changeType === "publish"
        ? "정책 게시 완료 — 대시보드 전체 갱신"
        : "정책 롤백 완료 — 대시보드 전체 갱신";
      toastType = "warning";
      break;

    case "inbox_action_complete":
      invalidations = [
        "kpi_strip", "bottleneck_alerts", "domain_breakdown",
        "owner_backlog", "recommended_actions",
      ];
      break;

    case "tab_changed":
      u.activeTab = event.tab;
      u.selectedGroupId = null;
      u.selectedOwnerId = null;
      break;

    case "filter_changed":
      u.domainFilter = event.domain;
      u.urgencyFilter = event.urgency;
      break;
  }

  return { updatedContext: u, invalidations, toastMessage, toastType };
}

// ══════════════════════════════════════════════
// Create Initial Context
// ══════════════════════════════════════════════

export function createDashboardContext(): DashboardContextSnapshot {
  return {
    contextId: `dctx_${Date.now().toString(36)}`,
    activeTab: "overview",
    breakdownDimension: null,
    selectedGroupId: null,
    selectedOwnerId: null,
    domainFilter: null,
    urgencyFilter: null,
    scrollPosition: 0,
    isDrilledDown: false,
    drilldownTarget: null,
    drilldownSourcePanel: null,
    capturedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════
// Drilldown Priority (same case 여러 패널 중복 시)
// ══════════════════════════════════════════════

export type PanelPriority =
  | "bottleneck_alerts"    // 1
  | "recommended_actions"  // 2
  | "escalation_hotspot"   // 3
  | "reapproval_loop"      // 4
  | "team_site_breakdown"  // 5
  | "owner_backlog"        // 6
  | "policy_impact_trend"  // 7
  | "kpi_strip";           // 8

const PANEL_PRIORITY_ORDER: PanelPriority[] = [
  "bottleneck_alerts",
  "recommended_actions",
  "escalation_hotspot",
  "reapproval_loop",
  "team_site_breakdown",
  "owner_backlog",
  "policy_impact_trend",
  "kpi_strip",
];

/**
 * resolveDrilldownPriority — 같은 case가 여러 패널에 표시될 때 우선 진입 패널 결정
 */
export function resolveDrilldownPriority(
  panelsContainingCase: PanelPriority[],
): PanelPriority | null {
  for (const panel of PANEL_PRIORITY_ORDER) {
    if (panelsContainingCase.includes(panel)) return panel;
  }
  return null;
}

// ══════════════════════════════════════════════
// Invalidation → Query Key Mapping
// ══════════════════════════════════════════════

/**
 * mapInvalidationsToQueryKeys — invalidation target을 TanStack Query key로 매핑
 * UI layer에서 useQueryClient().invalidateQueries()에 전달.
 */
export function mapInvalidationsToQueryKeys(
  invalidations: InvalidationTarget[],
): string[][] {
  if (invalidations.includes("all")) {
    return [["approval"]]; // invalidate everything under approval key
  }

  const keyMap: Record<InvalidationTarget, string[]> = {
    all: ["approval"],
    kpi_strip: ["approval", "governance-metrics"],
    bottleneck_alerts: ["approval", "governance-metrics"],
    domain_breakdown: ["approval", "governance-metrics"],
    top_blockers: ["approval", "governance-metrics"],
    team_site_breakdown: ["approval", "governance-breakdown"],
    escalation_hotspot: ["approval", "governance-hotspot"],
    reapproval_loop: ["approval", "governance-reapproval"],
    policy_impact_trend: ["approval", "governance-policy-impact"],
    owner_backlog: ["approval", "governance-owner"],
    ownership_coverage: ["approval", "governance-owner"],
    recommended_actions: ["approval", "governance-actions"],
  };

  return [...new Set(invalidations.flatMap(i => [keyMap[i] || ["approval"]]))];
}

// ══════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════

export type GovernanceLoopEventType = "loop_drilldown" | "loop_return" | "loop_resolution_reflected" | "loop_policy_refresh" | "loop_ownership_refresh";
export interface GovernanceLoopEvent { type: GovernanceLoopEventType; contextId: string; sourcePanel: string | null; invalidations: InvalidationTarget[]; timestamp: string; }
