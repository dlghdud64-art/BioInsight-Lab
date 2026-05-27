/**
 * Approval Inbox Workspace v2 — approver 운영면 surface
 *
 * center = ranked approval queue (우선순위 정렬된 승인 대기 목록)
 * rail = selected item detail + policy evidence + SoD check
 * dock = approve / reject / escalate / assign / bulk actions
 *
 * WORKSPACE CONTRACT:
 * - 읽기 전용 surface — mutation은 각 domain의 resolution engine에서만
 * - inbox는 projection + ranking 결과를 렌더
 * - selected item drill-down → 해당 domain workspace로 handoff
 *
 * VIEWS:
 * - all: 전체 대기
 * - by_domain: fire / stock / exception 필터
 * - by_urgency: critical / high / medium / low 필터
 * - escalation: escalation 대기만
 * - reapproval: reapproval 필요만
 * - expiring: snapshot 만료 임박
 * - my_assigned: 나에게 배정된 것만
 */

import type { RankedApprovalItemV2 } from "./approval-priority-ranking-v2-engine";
import type { ApprovalInboxSummaryV2, ApprovalDomain, ApprovalUrgencyLevel, ApprovalInboxItemStatus } from "./approval-inbox-projection-v2-engine";
import type { ProcurementRole } from "./dispatch-v2-permission-policy-engine";

// ── Workspace View ──
export type ApprovalInboxView =
  | "all"
  | "by_domain"
  | "by_urgency"
  | "escalation"
  | "reapproval"
  | "expiring"
  | "my_assigned"
  | "sla_breached";

// ── Workspace Mode ──
export type ApprovalInboxMode =
  | "queue_overview"
  | "item_detail"
  | "bulk_action";

// ── Queue Segment ──
export interface ApprovalQueueSegment {
  segmentKey: string;
  label: string;
  items: RankedApprovalItemV2[];
  count: number;
  hasUrgentItems: boolean;
}

// ── Center Panel ──
export interface ApprovalInboxCenterPanelState {
  currentView: ApprovalInboxView;
  viewFilter: {
    domain: ApprovalDomain | null;
    urgency: ApprovalUrgencyLevel | null;
    assignee: string | null;
  };
  segments: ApprovalQueueSegment[];
  totalVisibleItems: number;
  selectedItemId: string | null;
}

// ── Rail Panel (selected item detail) ──
export interface ApprovalInboxRailPanelState {
  hasSelection: boolean;
  selectedItem: RankedApprovalItemV2 | null;
  // Detail sections
  actionSummary: string;
  riskTierExplanation: string;
  policyBlockers: string[];
  policyWarnings: string[];
  sodStatus: string;
  snapshotStatus: string;
  approvalHistory: string[];
  // Handoff
  handoffTarget: {
    domain: ApprovalDomain;
    workspaceUrl: string;
    workspaceLabel: string;
  } | null;
}

// ── Dock ──
export interface ApprovalInboxDockState {
  // Single-item actions (when selected)
  canApproveSelected: boolean;
  canRejectSelected: boolean;
  canEscalateSelected: boolean;
  canAssignSelected: boolean;
  canOpenWorkbench: boolean;
  // Bulk actions
  canBulkAssign: boolean;
  canBulkEscalate: boolean;
  selectedCount: number;
  // Labels
  approveLabel: string;
  rejectLabel: string;
  escalateLabel: string;
  assignLabel: string;
  openWorkbenchLabel: string;
}

// ── Workspace State ──
export interface ApprovalInboxWorkspaceStateV2 {
  workspaceId: string;
  // Summary
  summary: ApprovalInboxSummaryV2;
  // Panels
  centerPanel: ApprovalInboxCenterPanelState;
  railPanel: ApprovalInboxRailPanelState;
  dock: ApprovalInboxDockState;
  // Context
  currentMode: ApprovalInboxMode;
  reviewer: { actorId: string; roles: ProcurementRole[] };
  // URL state
  urlState: {
    view: ApprovalInboxView;
    domain: ApprovalDomain | null;
    urgency: ApprovalUrgencyLevel | null;
    selectedItemId: string | null;
  };
  generatedAt: string;
}

// ── Build Workspace ──
export function buildApprovalInboxWorkspaceStateV2(
  rankedItems: RankedApprovalItemV2[],
  summary: ApprovalInboxSummaryV2,
  reviewer: { actorId: string; roles: ProcurementRole[] },
  view: ApprovalInboxView = "all",
  domainFilter: ApprovalDomain | null = null,
  urgencyFilter: ApprovalUrgencyLevel | null = null,
  selectedItemId: string | null = null,
): ApprovalInboxWorkspaceStateV2 {
  // Apply view filters
  let visibleItems = rankedItems;

  if (view === "by_domain" && domainFilter) {
    visibleItems = visibleItems.filter(i => i.item.domain === domainFilter);
  } else if (view === "by_urgency" && urgencyFilter) {
    const urgencyOrder: ApprovalUrgencyLevel[] = ["low", "medium", "high", "critical"];
    const minIdx = urgencyOrder.indexOf(urgencyFilter);
    visibleItems = visibleItems.filter(i => urgencyOrder.indexOf(i.item.urgencyLevel) >= minIdx);
  } else if (view === "escalation") {
    visibleItems = visibleItems.filter(i => i.item.escalationRequired);
  } else if (view === "reapproval") {
    visibleItems = visibleItems.filter(i => i.item.itemStatus === "reapproval_required" || i.item.snapshotInvalidated);
  } else if (view === "expiring") {
    visibleItems = visibleItems.filter(i => i.item.snapshotExpiringSoon);
  } else if (view === "my_assigned") {
    visibleItems = visibleItems.filter(i => i.item.assignedApprover === reviewer.actorId || i.item.assignedApprover === null);
  } else if (view === "sla_breached") {
    visibleItems = visibleItems.filter(i => i.item.slaBreached);
  }

  // Build segments
  const segments = buildSegments(visibleItems);

  // Selected item
  const selectedRanked = selectedItemId
    ? visibleItems.find(i => i.item.inboxItemId === selectedItemId) || null
    : null;

  // Center panel
  const centerPanel: ApprovalInboxCenterPanelState = {
    currentView: view,
    viewFilter: { domain: domainFilter, urgency: urgencyFilter, assignee: view === "my_assigned" ? reviewer.actorId : null },
    segments,
    totalVisibleItems: visibleItems.length,
    selectedItemId,
  };

  // Rail panel
  const railPanel: ApprovalInboxRailPanelState = buildRailPanel(selectedRanked);

  // Dock
  const dock: ApprovalInboxDockState = {
    canApproveSelected: selectedRanked !== null && selectedRanked.item.itemStatus === "pending_review",
    canRejectSelected: selectedRanked !== null,
    canEscalateSelected: selectedRanked !== null,
    canAssignSelected: selectedRanked !== null,
    canOpenWorkbench: selectedRanked !== null,
    canBulkAssign: visibleItems.length > 0,
    canBulkEscalate: visibleItems.some(i => i.item.escalationRequired),
    selectedCount: selectedRanked ? 1 : 0,
    approveLabel: "승인",
    rejectLabel: "거부",
    escalateLabel: "에스컬레이션",
    assignLabel: "배정",
    openWorkbenchLabel: selectedRanked ? getDomainWorkbenchLabel(selectedRanked.item.domain) : "상세 보기",
  };

  return {
    workspaceId: `appinbxws_${Date.now().toString(36)}`,
    summary,
    centerPanel, railPanel, dock,
    currentMode: selectedRanked ? "item_detail" : "queue_overview",
    reviewer,
    urlState: { view, domain: domainFilter, urgency: urgencyFilter, selectedItemId },
    generatedAt: new Date().toISOString(),
  };
}

// ── Build Segments ──
function buildSegments(items: RankedApprovalItemV2[]): ApprovalQueueSegment[] {
  const segments: ApprovalQueueSegment[] = [];

  // Critical + High urgency segment
  const urgent = items.filter(i => i.item.urgencyLevel === "critical" || i.item.urgencyLevel === "high");
  if (urgent.length > 0) {
    segments.push({
      segmentKey: "urgent",
      label: `긴급 승인 대기 (${urgent.length}건)`,
      items: urgent, count: urgent.length,
      hasUrgentItems: true,
    });
  }

  // Reapproval / Invalidated segment
  const reapproval = items.filter(i => i.item.itemStatus === "reapproval_required" || i.item.snapshotInvalidated);
  if (reapproval.length > 0) {
    segments.push({
      segmentKey: "reapproval",
      label: `재승인 필요 (${reapproval.length}건)`,
      items: reapproval, count: reapproval.length,
      hasUrgentItems: reapproval.some(i => i.item.urgencyLevel === "critical"),
    });
  }

  // Normal pending segment
  const normal = items.filter(i =>
    i.item.urgencyLevel !== "critical" && i.item.urgencyLevel !== "high" &&
    i.item.itemStatus !== "reapproval_required" && !i.item.snapshotInvalidated
  );
  if (normal.length > 0) {
    segments.push({
      segmentKey: "normal",
      label: `일반 대기 (${normal.length}건)`,
      items: normal, count: normal.length,
      hasUrgentItems: false,
    });
  }

  return segments;
}

// ── Build Rail Panel ──
function buildRailPanel(selected: RankedApprovalItemV2 | null): ApprovalInboxRailPanelState {
  if (!selected) {
    return {
      hasSelection: false, selectedItem: null,
      actionSummary: "", riskTierExplanation: "",
      policyBlockers: [], policyWarnings: [],
      sodStatus: "", snapshotStatus: "",
      approvalHistory: [], handoffTarget: null,
    };
  }

  const item = selected.item;
  return {
    hasSelection: true,
    selectedItem: selected,
    actionSummary: `${item.domain} — ${item.objectSummary} (${item.affectedLineCount}건, ${item.totalAmount.toLocaleString()}원)`,
    riskTierExplanation: item.riskTier === "tier3_irreversible"
      ? "Tier 3 — 실행 후 취소 불가. 별도 승인자 필수."
      : item.riskTier === "tier2_org_impact"
        ? "Tier 2 — 조직 영향. 승인 권장."
        : "Tier 1 — 일반 작업.",
    policyBlockers: item.blockerSummary,
    policyWarnings: [],
    sodStatus: item.sodViolationDetected ? `SoD 위반: ${item.sodViolationDetail}` : "SoD 검증 통과",
    snapshotStatus: item.snapshotInvalidated
      ? "Snapshot 무효화 — 재승인 필요"
      : item.snapshotExpiringSoon
        ? `Snapshot 만료 임박 (${item.snapshotExpiresAt})`
        : item.hasSnapshot
          ? "Snapshot 유효"
          : "Snapshot 미생성",
    approvalHistory: [],
    handoffTarget: {
      domain: item.domain,
      workspaceUrl: `/${item.domain}/${item.caseId}/${item.sourceSessionId}`,
      workspaceLabel: getDomainWorkbenchLabel(item.domain),
    },
  };
}

function getDomainWorkbenchLabel(domain: ApprovalDomain): string {
  switch (domain) {
    case "fire_execution": return "발송 승인 워크벤치 열기";
    case "stock_release": return "재고 릴리스 승인 워크벤치 열기";
    case "exception_resolve": return "예외 해결 승인 워크벤치 열기";
    case "exception_return_to_stage": return "예외 복귀 승인 워크벤치 열기";
    default: return "상세 보기";
  }
}

// ── Events ──
export type ApprovalInboxWorkspaceEventType =
  | "inbox_workspace_opened"
  | "inbox_view_changed"
  | "inbox_item_selected"
  | "inbox_item_opened_in_workbench"
  | "inbox_bulk_action_started"
  | "inbox_workspace_closed";

export interface ApprovalInboxWorkspaceEvent {
  type: ApprovalInboxWorkspaceEventType;
  actorId: string;
  view: ApprovalInboxView;
  selectedItemId: string | null;
  timestamp: string;
}
