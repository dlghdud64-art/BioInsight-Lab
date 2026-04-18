/**
 * Approval Shell Routing Engine — 승인 운영 흐름 route/state/handoff contract
 *
 * 핵심 목표: Inbox → Workbench → Resolution → Next Queue/Return
 * 흐름을 실제 운영 OS처럼 연결.
 *
 * ROUTE MAP:
 * /dashboard/approval                        → Governance Dashboard (hub)
 * /dashboard/approval/inbox                   → Approval Inbox
 * /dashboard/approval/inbox?domain=...&urgency=...&view=...
 * /dashboard/approval/case/[caseId]           → Case Overview
 * /dashboard/approval/case/[caseId]/[domain]  → Domain Workbench
 * /dashboard/approval/history                 → Approval History
 *
 * URL SEARCH PARAM CONTRACT:
 * - domain: ApprovalDomain filter
 * - urgency: ApprovalUrgencyLevel filter
 * - view: ApprovalInboxView
 * - caseId: selected case
 * - panel: "center" | "rail" | "dock" (active panel focus)
 * - tab: workbench internal tab
 *
 * STATE PERSISTENCE RULES:
 * - selected case → URL caseId param
 * - inbox view/filter → URL search params
 * - right rail open/close → local session (not URL)
 * - scroll position → browser native
 *
 * HANDOFF RULES:
 * - resolution success → redirect to inbox with toast
 * - resolution failure → stay on workbench with error
 * - stale handoff → refetch + redirect if session closed
 * - dashboard drilldown → inbox with pre-applied filters
 */

import type { ApprovalDomain, ApprovalUrgencyLevel, ApprovalInboxItemStatus } from "./approval-inbox-projection-v2-engine";

// ── Route Definitions ──
export const APPROVAL_ROUTES = {
  dashboard: "/dashboard/approval",
  inbox: "/dashboard/approval/inbox",
  caseOverview: (caseId: string) => `/dashboard/approval/case/${caseId}`,
  workbench: (caseId: string, domain: ApprovalDomain) => `/dashboard/approval/case/${caseId}/${domain}`,
  history: "/dashboard/approval/history",
} as const;

// ── URL Search Param Keys ──
export const APPROVAL_PARAMS = {
  domain: "domain",
  urgency: "urgency",
  view: "view",
  caseId: "caseId",
  panel: "panel",
  tab: "tab",
  status: "status",
  assignee: "assignee",
} as const;

// ── Navigation State Contract ──
export interface ApprovalNavigationState {
  currentRoute: string;
  // Inbox state (URL params)
  inboxView: string | null;
  inboxDomain: ApprovalDomain | null;
  inboxUrgency: ApprovalUrgencyLevel | null;
  inboxStatus: ApprovalInboxItemStatus | null;
  inboxAssignee: string | null;
  // Case state
  selectedCaseId: string | null;
  selectedDomain: ApprovalDomain | null;
  // Panel state (session-local, not URL)
  railOpen: boolean;
  activePanel: "center" | "rail" | "dock";
  workbenchTab: string | null;
}

// ── Parse URL → Navigation State ──
export function parseApprovalSearchParams(
  searchParams: URLSearchParams,
  pathname: string,
): ApprovalNavigationState {
  return {
    currentRoute: pathname,
    inboxView: searchParams.get(APPROVAL_PARAMS.view),
    inboxDomain: searchParams.get(APPROVAL_PARAMS.domain) as ApprovalDomain | null,
    inboxUrgency: searchParams.get(APPROVAL_PARAMS.urgency) as ApprovalUrgencyLevel | null,
    inboxStatus: searchParams.get(APPROVAL_PARAMS.status) as ApprovalInboxItemStatus | null,
    inboxAssignee: searchParams.get(APPROVAL_PARAMS.assignee),
    selectedCaseId: searchParams.get(APPROVAL_PARAMS.caseId),
    selectedDomain: searchParams.get(APPROVAL_PARAMS.domain) as ApprovalDomain | null,
    railOpen: true, // default open
    activePanel: "center",
    workbenchTab: searchParams.get(APPROVAL_PARAMS.tab),
  };
}

// ── Build URL from Navigation State ──
export function buildApprovalSearchParams(
  state: Partial<ApprovalNavigationState>,
): URLSearchParams {
  const params = new URLSearchParams();
  if (state.inboxView) params.set(APPROVAL_PARAMS.view, state.inboxView);
  if (state.inboxDomain) params.set(APPROVAL_PARAMS.domain, state.inboxDomain);
  if (state.inboxUrgency) params.set(APPROVAL_PARAMS.urgency, state.inboxUrgency);
  if (state.inboxStatus) params.set(APPROVAL_PARAMS.status, state.inboxStatus);
  if (state.inboxAssignee) params.set(APPROVAL_PARAMS.assignee, state.inboxAssignee);
  if (state.selectedCaseId) params.set(APPROVAL_PARAMS.caseId, state.selectedCaseId);
  if (state.workbenchTab) params.set(APPROVAL_PARAMS.tab, state.workbenchTab);
  return params;
}

// ── Handoff Destination Rules ──
export type HandoffDestination =
  | { type: "inbox"; params: Partial<ApprovalNavigationState> }
  | { type: "workbench"; caseId: string; domain: ApprovalDomain }
  | { type: "dashboard" }
  | { type: "case_overview"; caseId: string }
  | { type: "stay"; reason: string }
  | { type: "refresh"; reason: string };

export interface ResolutionHandoffResult {
  success: boolean;
  destination: HandoffDestination;
  toastMessage: string;
  toastType: "success" | "error" | "warning" | "info";
}

/**
 * computeResolutionHandoff — resolution 완료 후 다음 목적지 결정
 */
export function computeResolutionHandoff(
  decision: "approved" | "rejected" | "escalated" | "request_change" | "error",
  caseId: string,
  domain: ApprovalDomain,
  hasNextPendingInSameCase: boolean,
  inboxHasPending: boolean,
): ResolutionHandoffResult {
  switch (decision) {
    case "approved":
      if (hasNextPendingInSameCase) {
        return {
          success: true,
          destination: { type: "case_overview", caseId },
          toastMessage: `${DOMAIN_LABELS[domain]} 승인 완료 — 동일 케이스 추가 승인 대기`,
          toastType: "success",
        };
      }
      return {
        success: true,
        destination: inboxHasPending
          ? { type: "inbox", params: {} }
          : { type: "dashboard" },
        toastMessage: `${DOMAIN_LABELS[domain]} 승인 완료`,
        toastType: "success",
      };

    case "rejected":
      return {
        success: true,
        destination: inboxHasPending
          ? { type: "inbox", params: {} }
          : { type: "dashboard" },
        toastMessage: `${DOMAIN_LABELS[domain]} 거부 완료`,
        toastType: "info",
      };

    case "escalated":
      return {
        success: true,
        destination: { type: "inbox", params: { inboxView: "escalation" } },
        toastMessage: `${DOMAIN_LABELS[domain]} 에스컬레이션 완료`,
        toastType: "warning",
      };

    case "request_change":
      return {
        success: true,
        destination: { type: "stay", reason: "수정 요청 전달됨 — 요청자 응답 대기" },
        toastMessage: "수정 요청 전달됨",
        toastType: "info",
      };

    case "error":
      return {
        success: false,
        destination: { type: "stay", reason: "처리 중 오류 발생" },
        toastMessage: "처리 중 오류가 발생했습니다",
        toastType: "error",
      };
  }
}

/**
 * computeStaleHandoff — stale handoff 감지 시 처리
 */
export function computeStaleHandoff(
  staleReason: string,
  sessionClosed: boolean,
): ResolutionHandoffResult {
  if (sessionClosed) {
    return {
      success: false,
      destination: { type: "inbox", params: {} },
      toastMessage: "이 승인 건은 이미 처리되었습니다",
      toastType: "warning",
    };
  }
  return {
    success: false,
    destination: { type: "refresh", reason: staleReason },
    toastMessage: `상태가 변경되었습니다: ${staleReason}`,
    toastType: "warning",
  };
}

/**
 * computeDashboardDrilldown — dashboard에서 inbox로 drilldown
 */
export function computeDashboardDrilldown(
  drilldownType: "bottleneck" | "domain" | "blocker" | "kpi" | "backlog",
  domain?: ApprovalDomain,
  urgency?: ApprovalUrgencyLevel,
  view?: string,
): HandoffDestination {
  const params: Partial<ApprovalNavigationState> = {};

  switch (drilldownType) {
    case "bottleneck":
      params.inboxView = "sla_breached";
      if (domain) params.inboxDomain = domain;
      break;
    case "domain":
      params.inboxView = "by_domain";
      if (domain) params.inboxDomain = domain;
      break;
    case "blocker":
      // blocker drilldown → filtered inbox
      params.inboxView = "all";
      break;
    case "kpi":
      params.inboxView = view || "all";
      if (urgency) params.inboxUrgency = urgency;
      break;
    case "backlog":
      params.inboxView = "sla_breached";
      if (domain) params.inboxDomain = domain;
      break;
  }

  return { type: "inbox", params };
}

// ── Right Rail Persistence Rules ──
export interface RailPersistenceState {
  isOpen: boolean;
  lastOpenedAt: string | null;
  pinned: boolean;
  /** rail은 case 전환 시 자동 닫힘 (pinned가 아닌 경우) */
  autoCloseOnCaseChange: boolean;
}

export function computeRailState(
  current: RailPersistenceState,
  event: "case_selected" | "case_deselected" | "toggle" | "pin" | "unpin",
): RailPersistenceState {
  switch (event) {
    case "case_selected":
      return { ...current, isOpen: true, lastOpenedAt: new Date().toISOString() };
    case "case_deselected":
      return current.pinned ? current : { ...current, isOpen: false };
    case "toggle":
      return { ...current, isOpen: !current.isOpen, lastOpenedAt: !current.isOpen ? new Date().toISOString() : current.lastOpenedAt };
    case "pin":
      return { ...current, pinned: true };
    case "unpin":
      return { ...current, pinned: false };
    default:
      return current;
  }
}

// ── Domain Labels ──
const DOMAIN_LABELS: Record<ApprovalDomain, string> = {
  fire_execution: "발송",
  stock_release: "재고 릴리스",
  exception_resolve: "예외 해결",
  exception_return_to_stage: "예외 복귀",
};

// ── Breadcrumb Builder ──
export interface BreadcrumbItem {
  label: string;
  href: string;
  active: boolean;
}

export function buildApprovalBreadcrumbs(
  pathname: string,
  caseId?: string,
  domain?: ApprovalDomain,
): BreadcrumbItem[] {
  const crumbs: BreadcrumbItem[] = [
    { label: "Governance", href: APPROVAL_ROUTES.dashboard, active: pathname === APPROVAL_ROUTES.dashboard },
  ];

  if (pathname.includes("/inbox")) {
    crumbs.push({ label: "Inbox", href: APPROVAL_ROUTES.inbox, active: pathname === APPROVAL_ROUTES.inbox });
  }

  if (caseId) {
    crumbs.push({ label: `Case ${caseId.slice(0, 8)}`, href: APPROVAL_ROUTES.caseOverview(caseId), active: !domain });
    if (domain) {
      crumbs.push({ label: DOMAIN_LABELS[domain] || domain, href: APPROVAL_ROUTES.workbench(caseId, domain), active: true });
    }
  }

  if (pathname.includes("/history")) {
    crumbs.push({ label: "History", href: APPROVAL_ROUTES.history, active: true });
  }

  return crumbs;
}
