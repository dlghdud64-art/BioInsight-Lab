/**
 * Procurement Dashboard Engine — 구매 운영 체인 전체 대시보드 진입 시스템
 *
 * 기존 governance-loop-closure-engine.ts는 approval domain 한정.
 * 이 엔진은 8개 governance domain 전체를 아우르는 procurement chain dashboard.
 *
 * CORE CONTRACT:
 * 1. Dashboard는 summary가 아니라 entry system — 패널 클릭 = exact workbench 진입
 * 2. source context 보존: originPanel, filter, correlationId, staleAt
 * 3. event bus 소비: 패널 count/badge/stale warning이 이벤트 기반 갱신
 * 4. exact entry + exact return: Dashboard → Workbench → Resolution → Dashboard
 * 5. targeted panel invalidation: resolution 후 영향받는 패널만 재계산
 *
 * IMMUTABLE RULES:
 * - panel → workbench 진입 시 handoff token 없이 진입 금지
 * - stale context에서 irreversible action 금지
 * - broad panel refresh 금지 — targeted invalidation만
 * - dashboard는 truth 계산 안 함 — engine 결과 projection만
 */

import type { GovernanceDomain, GovernanceEvent, GovernanceEventBus, StaleContextWarning } from "./governance-event-bus";
import type { QuoteChainStage } from "./quote-approval-governance-engine";

// ══════════════════════════════════════════════
// Panel Taxonomy — 운영 대시보드 패널 유형
// ══════════════════════════════════════════════

export type ProcurementPanelId =
  | "send_blocked"              // dispatch prep blockers
  | "send_scheduled"            // scheduled but not sent
  | "supplier_response_pending" // awaiting supplier ack
  | "supplier_change_requested" // supplier requested changes
  | "receiving_blocked"         // receiving prep blockers
  | "receiving_discrepancy"     // active discrepancies
  | "stock_release_blocked"     // holds / review gates pending
  | "reorder_required"          // reorder required / expedite
  | "reorder_watch"             // watch active items
  | "procurement_reentry"       // ready for re-entry
  | "chain_health";             // overall chain health summary

export const PROCUREMENT_PANELS: readonly ProcurementPanelId[] = [
  "send_blocked",
  "send_scheduled",
  "supplier_response_pending",
  "supplier_change_requested",
  "receiving_blocked",
  "receiving_discrepancy",
  "stock_release_blocked",
  "reorder_required",
  "reorder_watch",
  "procurement_reentry",
  "chain_health",
] as const;

// ══════════════════════════════════════════════
// Panel → Domain 매핑
// ══════════════════════════════════════════════

export const PANEL_DOMAIN_MAP: Record<ProcurementPanelId, GovernanceDomain> = {
  send_blocked: "dispatch_prep",
  send_scheduled: "dispatch_prep",
  supplier_response_pending: "supplier_confirmation",
  supplier_change_requested: "supplier_confirmation",
  receiving_blocked: "receiving_prep",
  receiving_discrepancy: "receiving_execution",
  stock_release_blocked: "stock_release",
  reorder_required: "reorder_decision",
  reorder_watch: "reorder_decision",
  procurement_reentry: "reorder_decision",
  chain_health: "quote_chain",
};

export const PANEL_STAGE_MAP: Record<ProcurementPanelId, QuoteChainStage> = {
  send_blocked: "dispatch_prep",
  send_scheduled: "dispatch_prep",
  supplier_response_pending: "supplier_confirmed",
  supplier_change_requested: "supplier_confirmed",
  receiving_blocked: "receiving_prep",
  receiving_discrepancy: "receiving_prep",
  stock_release_blocked: "stock_release",
  reorder_required: "reorder_decision",
  reorder_watch: "reorder_decision",
  procurement_reentry: "reorder_decision",
  chain_health: "quote_review",
};

// ══════════════════════════════════════════════
// Panel Priority — 같은 case가 여러 패널에 있을 때
// ══════════════════════════════════════════════

const PANEL_PRIORITY: readonly ProcurementPanelId[] = [
  "send_blocked",
  "receiving_blocked",
  "stock_release_blocked",
  "receiving_discrepancy",
  "reorder_required",
  "supplier_change_requested",
  "supplier_response_pending",
  "send_scheduled",
  "reorder_watch",
  "procurement_reentry",
  "chain_health",
];

export function resolvePanelPriority(
  panelsContainingCase: ProcurementPanelId[],
): ProcurementPanelId | null {
  for (const panel of PANEL_PRIORITY) {
    if (panelsContainingCase.includes(panel)) return panel;
  }
  return null;
}

// ══════════════════════════════════════════════
// Panel Item — 각 패널에 표시되는 건별 항목
// ══════════════════════════════════════════════

export type PanelItemSeverity = "normal" | "warning" | "critical";

export interface ProcurementPanelItem {
  /** Unique item ID within this panel */
  itemId: string;
  /** Associated governance case ID */
  caseId: string;
  /** PO number for correlation */
  poNumber: string;
  /** Primary label (e.g., PO number + vendor) */
  primaryLabel: string;
  /** Secondary label (e.g., blocker reason, discrepancy type) */
  secondaryLabel: string;
  /** Item severity */
  severity: PanelItemSeverity;
  /** Which governance object to open */
  governanceObjectId: string;
  /** Target domain for workbench entry */
  targetDomain: GovernanceDomain;
  /** Target chain stage */
  targetStage: QuoteChainStage;
  /** When this item was last updated */
  lastUpdatedAt: string;
  /** Blocker count (0 if not applicable) */
  blockerCount: number;
  /** Days in current state */
  daysInState: number;
}

// ══════════════════════════════════════════════
// Panel Data — 패널 전체 상태
// ══════════════════════════════════════════════

export interface ProcurementPanelData {
  panelId: ProcurementPanelId;
  /** 패널 표시명 */
  label: string;
  /** 건수 */
  count: number;
  /** 심각도별 건수 */
  criticalCount: number;
  warningCount: number;
  normalCount: number;
  /** 개별 항목 목록 */
  items: ProcurementPanelItem[];
  /** 패널이 stale 상태인지 */
  isStale: boolean;
  /** Stale reason (if stale) */
  staleReason: string | null;
  /** 마지막 갱신 시각 */
  lastRefreshedAt: string;
}

// ══════════════════════════════════════════════
// Panel Labels
// ══════════════════════════════════════════════

export const PANEL_LABELS: Record<ProcurementPanelId, string> = {
  send_blocked: "발송 차단",
  send_scheduled: "발송 예정",
  supplier_response_pending: "공급사 응답 대기",
  supplier_change_requested: "공급사 변경 요청",
  receiving_blocked: "수령 차단",
  receiving_discrepancy: "수령 불일치",
  stock_release_blocked: "재고 릴리즈 차단",
  reorder_required: "재주문 필요",
  reorder_watch: "모니터링 중",
  procurement_reentry: "구매 재진입 대기",
  chain_health: "체인 건강도",
};

// ══════════════════════════════════════════════
// Dashboard Handoff Token — panel → workbench 정확한 진입
// ══════════════════════════════════════════════

export interface ProcurementDashboardHandoffToken {
  /** Unique token ID */
  tokenId: string;
  /** Source panel this came from */
  originPanel: ProcurementPanelId;
  /** Applied filter at handoff time */
  originFilter: ProcurementDashboardFilter | null;
  /** Target governance case */
  caseId: string;
  /** PO number */
  poNumber: string;
  /** Target governance object */
  governanceObjectId: string;
  /** Target domain */
  targetDomain: GovernanceDomain;
  /** Target chain stage */
  targetStage: QuoteChainStage;
  /** Event correlation ID for chain tracking */
  correlationId: string;
  /** Panel item severity at handoff time */
  severityAtHandoff: PanelItemSeverity;
  /** Panel item blocker count at handoff time */
  blockerCountAtHandoff: number;
  /** Handoff timestamp */
  handoffAt: string;
  /** Hash of panel state at handoff time — for stale detection on return */
  panelStateHash: string;
}

// ══════════════════════════════════════════════
// Handoff Validation — workbench에서 돌아올 때
// ══════════════════════════════════════════════

export interface HandoffReturnValidation {
  /** Is the handoff token still valid */
  valid: boolean;
  /** Is the origin panel stale */
  originPanelStale: boolean;
  /** Stale reasons */
  staleReasons: string[];
  /** Was the case resolved */
  caseResolved: boolean;
  /** Recommendation */
  recommendation: "return_to_panel" | "refresh_panel" | "return_to_overview" | "stay";
  /** Which panels need invalidation */
  panelInvalidations: ProcurementPanelId[];
}

// ══════════════════════════════════════════════
// Dashboard Context — 전체 대시보드 상태
// ══════════════════════════════════════════════

export interface ProcurementDashboardFilter {
  /** Domain filter */
  domainFilter: GovernanceDomain | null;
  /** Severity filter */
  severityFilter: PanelItemSeverity | null;
  /** PO number search */
  poNumberSearch: string | null;
  /** Days-in-state threshold */
  daysInStateMin: number | null;
}

export interface ProcurementDashboardContext {
  /** Unique context ID */
  contextId: string;
  /** Current view */
  activeView: "panels" | "chain_timeline" | "po_detail";
  /** Active filter */
  filter: ProcurementDashboardFilter;
  /** Currently drilled-down panel */
  drilledPanel: ProcurementPanelId | null;
  /** Active handoff token (if in workbench) */
  activeHandoff: ProcurementDashboardHandoffToken | null;
  /** Scroll position for return */
  scrollPosition: number;
  /** Last event processed */
  lastProcessedEventId: string | null;
  /** Context captured at */
  capturedAt: string;
}

// ══════════════════════════════════════════════
// Create Dashboard Context
// ══════════════════════════════════════════════

export function createProcurementDashboardContext(): ProcurementDashboardContext {
  return {
    contextId: `pdctx_${Date.now().toString(36)}`,
    activeView: "panels",
    filter: {
      domainFilter: null,
      severityFilter: null,
      poNumberSearch: null,
      daysInStateMin: null,
    },
    drilledPanel: null,
    activeHandoff: null,
    scrollPosition: 0,
    lastProcessedEventId: null,
    capturedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════
// Build Panel Data — items → panel projection
// ══════════════════════════════════════════════

export function buildPanelData(
  panelId: ProcurementPanelId,
  items: ProcurementPanelItem[],
  staleWarnings: StaleContextWarning[],
  lastRefreshedAt: string,
): ProcurementPanelData {
  const domain = PANEL_DOMAIN_MAP[panelId];
  const relevantStale = staleWarnings.filter(w => w.domain === domain);
  const isStale = relevantStale.length > 0;

  return {
    panelId,
    label: PANEL_LABELS[panelId],
    count: items.length,
    criticalCount: items.filter(i => i.severity === "critical").length,
    warningCount: items.filter(i => i.severity === "warning").length,
    normalCount: items.filter(i => i.severity === "normal").length,
    items: items.sort((a, b) => {
      // Sort: critical first, then warning, then normal; within same severity by daysInState desc
      const severityOrder = { critical: 0, warning: 1, normal: 2 };
      const sDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (sDiff !== 0) return sDiff;
      return b.daysInState - a.daysInState;
    }),
    isStale,
    staleReason: isStale ? relevantStale[0].reason : null,
    lastRefreshedAt,
  };
}

// ══════════════════════════════════════════════
// Create Handoff Token — panel item → workbench 진입
// ══════════════════════════════════════════════

export function createDashboardHandoffToken(
  item: ProcurementPanelItem,
  originPanel: ProcurementPanelId,
  filter: ProcurementDashboardFilter | null,
  panelStateHash: string,
): ProcurementDashboardHandoffToken {
  return {
    tokenId: `pdh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    originPanel,
    originFilter: filter ? { ...filter } : null,
    caseId: item.caseId,
    poNumber: item.poNumber,
    governanceObjectId: item.governanceObjectId,
    targetDomain: item.targetDomain,
    targetStage: item.targetStage,
    correlationId: `pcorr_${item.poNumber}_${Date.now().toString(36)}`,
    severityAtHandoff: item.severity,
    blockerCountAtHandoff: item.blockerCount,
    handoffAt: new Date().toISOString(),
    panelStateHash,
  };
}

// ══════════════════════════════════════════════
// Validate Handoff Return — workbench → dashboard 복귀 시
// ══════════════════════════════════════════════

export function validateHandoffReturn(
  token: ProcurementDashboardHandoffToken,
  currentPanelStateHash: string,
  caseResolved: boolean,
  staleWarnings: StaleContextWarning[],
): HandoffReturnValidation {
  const staleReasons: string[] = [];
  const panelInvalidations: ProcurementPanelId[] = [];

  // Check if panel state changed since handoff
  const panelChanged = token.panelStateHash !== currentPanelStateHash;
  if (panelChanged) {
    staleReasons.push("패널 상태가 handoff 이후 변경됨");
  }

  // Check stale warnings for origin domain
  const originDomain = PANEL_DOMAIN_MAP[token.originPanel];
  const relevantStale = staleWarnings.filter(w => w.domain === originDomain);
  if (relevantStale.length > 0) {
    staleReasons.push(...relevantStale.map(w => w.reason));
  }

  const originPanelStale = panelChanged || relevantStale.length > 0;

  // Determine which panels need invalidation
  if (caseResolved) {
    // Resolution affects the origin panel and potentially adjacent panels
    panelInvalidations.push(token.originPanel);
    // Also invalidate related panels based on domain cascade
    const cascadeMap: Partial<Record<ProcurementPanelId, ProcurementPanelId[]>> = {
      send_blocked: ["send_scheduled"],
      send_scheduled: ["supplier_response_pending"],
      supplier_response_pending: ["receiving_blocked"],
      supplier_change_requested: ["supplier_response_pending"],
      receiving_blocked: ["receiving_discrepancy"],
      receiving_discrepancy: ["stock_release_blocked"],
      stock_release_blocked: ["reorder_required", "reorder_watch"],
      reorder_required: ["procurement_reentry"],
      reorder_watch: ["reorder_required"],
      procurement_reentry: ["chain_health"],
    };
    const cascaded = cascadeMap[token.originPanel] ?? [];
    panelInvalidations.push(...cascaded);
  }

  // Determine recommendation
  let recommendation: HandoffReturnValidation["recommendation"];
  if (caseResolved && !originPanelStale) {
    recommendation = "return_to_panel";
  } else if (caseResolved && originPanelStale) {
    recommendation = "refresh_panel";
  } else if (!caseResolved && originPanelStale) {
    recommendation = "refresh_panel";
  } else {
    recommendation = "return_to_panel";
  }

  return {
    valid: true, // token itself is always valid — staleness is separate concern
    originPanelStale,
    staleReasons,
    caseResolved,
    recommendation,
    panelInvalidations: [...new Set(panelInvalidations)],
  };
}

// ══════════════════════════════════════════════
// Dashboard Loop Events — context 전이
// ══════════════════════════════════════════════

export type ProcurementDashboardEvent =
  | { type: "panel_drilldown"; panelId: ProcurementPanelId }
  | { type: "panel_return"; fromPanel: ProcurementPanelId }
  | { type: "workbench_enter"; handoff: ProcurementDashboardHandoffToken }
  | { type: "workbench_return"; handoff: ProcurementDashboardHandoffToken; resolved: boolean }
  | { type: "filter_changed"; filter: ProcurementDashboardFilter }
  | { type: "view_changed"; view: ProcurementDashboardContext["activeView"] }
  | { type: "scroll_position_saved"; position: number }
  | { type: "event_processed"; eventId: string };

export interface ProcurementDashboardEventResult {
  updatedContext: ProcurementDashboardContext;
  panelInvalidations: ProcurementPanelId[];
  toastMessage: string | null;
  toastType: "success" | "info" | "warning" | null;
}

export function applyDashboardEvent(
  context: ProcurementDashboardContext,
  event: ProcurementDashboardEvent,
): ProcurementDashboardEventResult {
  const now = new Date().toISOString();
  const u = { ...context, capturedAt: now };
  let panelInvalidations: ProcurementPanelId[] = [];
  let toastMessage: string | null = null;
  let toastType: ProcurementDashboardEventResult["toastType"] = null;

  switch (event.type) {
    case "panel_drilldown":
      u.drilledPanel = event.panelId;
      break;

    case "panel_return":
      u.drilledPanel = null;
      break;

    case "workbench_enter":
      u.activeHandoff = event.handoff;
      break;

    case "workbench_return": {
      const handoff = event.handoff;
      u.activeHandoff = null;
      if (event.resolved) {
        panelInvalidations.push(handoff.originPanel);
        toastMessage = `${handoff.poNumber} 처리 완료 — 패널 갱신`;
        toastType = "success";
      }
      break;
    }

    case "filter_changed":
      u.filter = { ...event.filter };
      // All panels need refresh when filter changes
      panelInvalidations = [...PROCUREMENT_PANELS];
      break;

    case "view_changed":
      u.activeView = event.view;
      break;

    case "scroll_position_saved":
      u.scrollPosition = event.position;
      break;

    case "event_processed":
      u.lastProcessedEventId = event.eventId;
      break;
  }

  return { updatedContext: u, panelInvalidations, toastMessage, toastType };
}

// ══════════════════════════════════════════════
// Event Bus → Panel Invalidation Bridge
// ══════════════════════════════════════════════

/**
 * governance event → 어떤 dashboard panel을 invalidate해야 하는지 결정
 */
export function resolveEventToPanelInvalidation(
  event: GovernanceEvent,
): ProcurementPanelId[] {
  const panelIds: ProcurementPanelId[] = [];

  // Map event domain → affected panels
  const domainToPanels: Record<GovernanceDomain, ProcurementPanelId[]> = {
    quote_chain: ["chain_health"],
    dispatch_prep: ["send_blocked", "send_scheduled"],
    dispatch_execution: ["supplier_response_pending"],
    supplier_confirmation: ["supplier_response_pending", "supplier_change_requested"],
    receiving_prep: ["receiving_blocked"],
    receiving_execution: ["receiving_discrepancy"],
    stock_release: ["stock_release_blocked"],
    reorder_decision: ["reorder_required", "reorder_watch", "procurement_reentry"],
  };

  const directPanels = domainToPanels[event.domain] ?? [];
  panelIds.push(...directPanels);

  // Severity-based escalation: critical events also invalidate chain_health
  if (event.severity === "critical" && event.domain !== "quote_chain") {
    panelIds.push("chain_health");
  }

  return [...new Set(panelIds)];
}

// ══════════════════════════════════════════════
// Panel State Hash — stale detection용
// ══════════════════════════════════════════════

export function computePanelStateHash(panel: ProcurementPanelData): string {
  // Simple hash: count + critical + warning + last item update
  const lastUpdate = panel.items.length > 0
    ? panel.items.reduce((latest, item) =>
        item.lastUpdatedAt > latest ? item.lastUpdatedAt : latest, "")
    : "";
  return `${panel.panelId}:${panel.count}:${panel.criticalCount}:${panel.warningCount}:${lastUpdate}`;
}

// ══════════════════════════════════════════════
// Stale Context Banner — workbench/panel stale 표시
// ══════════════════════════════════════════════

export type StaleBannerLevel = "none" | "info" | "warning" | "blocking";

export interface StaleBannerState {
  level: StaleBannerLevel;
  message: string | null;
  /** If blocking, irreversible actions should be locked */
  locksIrreversibleActions: boolean;
  /** Stale warnings that triggered this banner */
  warnings: StaleContextWarning[];
}

export function computeStaleBanner(
  staleWarnings: StaleContextWarning[],
): StaleBannerState {
  if (staleWarnings.length === 0) {
    return { level: "none", message: null, locksIrreversibleActions: false, warnings: [] };
  }

  // If any warning has a handoff_invalidate scope triggering event, it's blocking
  const hasHandoffInvalidation = staleWarnings.some(w =>
    w.triggeringEvent.severity === "critical"
  );

  if (hasHandoffInvalidation) {
    return {
      level: "blocking",
      message: "이 작업면의 기반 데이터가 변경되었습니다. 되돌아가서 새로고침해 주세요.",
      locksIrreversibleActions: true,
      warnings: staleWarnings,
    };
  }

  const hasWarning = staleWarnings.some(w =>
    w.triggeringEvent.severity === "warning"
  );

  if (hasWarning) {
    return {
      level: "warning",
      message: `${staleWarnings.length}건의 변경이 감지되었습니다. 최신 상태를 확인해 주세요.`,
      locksIrreversibleActions: false,
      warnings: staleWarnings,
    };
  }

  return {
    level: "info",
    message: "일부 정보가 업데이트되었습니다.",
    locksIrreversibleActions: false,
    warnings: staleWarnings,
  };
}

// ══════════════════════════════════════════════
// Attach Dashboard to Event Bus
// ══════════════════════════════════════════════

export interface DashboardBusSubscription {
  subscriptionId: string;
  unsubscribe: () => void;
}

/**
 * Dashboard를 event bus에 연결.
 * 이벤트가 들어올 때마다 영향받는 panel을 계산하여 callback 호출.
 */
export function attachDashboardToBus(
  bus: GovernanceEventBus,
  onPanelInvalidation: (panels: ProcurementPanelId[], event: GovernanceEvent) => void,
): DashboardBusSubscription {
  const subscriptionId = bus.subscribe({
    domains: [],
    chainStages: [],
    caseId: null,
    poNumber: null,
    severities: [],
    handler: (event) => {
      const panels = resolveEventToPanelInvalidation(event);
      if (panels.length > 0) {
        onPanelInvalidation(panels, event);
      }
    },
  });

  return {
    subscriptionId,
    unsubscribe: () => bus.unsubscribe(subscriptionId),
  };
}

// ══════════════════════════════════════════════
// Query Key Mapping — panel invalidation → TanStack Query keys
// ══════════════════════════════════════════════

export function mapPanelInvalidationsToQueryKeys(
  panels: ProcurementPanelId[],
): string[][] {
  if (panels.length === PROCUREMENT_PANELS.length) {
    return [["procurement-dashboard"]];
  }

  const keyMap: Record<ProcurementPanelId, string[]> = {
    send_blocked: ["procurement-dashboard", "dispatch-prep"],
    send_scheduled: ["procurement-dashboard", "dispatch-scheduled"],
    supplier_response_pending: ["procurement-dashboard", "supplier-confirmation"],
    supplier_change_requested: ["procurement-dashboard", "supplier-changes"],
    receiving_blocked: ["procurement-dashboard", "receiving-prep"],
    receiving_discrepancy: ["procurement-dashboard", "receiving-discrepancy"],
    stock_release_blocked: ["procurement-dashboard", "stock-release"],
    reorder_required: ["procurement-dashboard", "reorder"],
    reorder_watch: ["procurement-dashboard", "reorder-watch"],
    procurement_reentry: ["procurement-dashboard", "reentry"],
    chain_health: ["procurement-dashboard", "chain-health"],
  };

  return [...new Set(panels.map(p => keyMap[p]))];
}

// ══════════════════════════════════════════════
// Dashboard Surface — UI 렌더링용 projection
// ══════════════════════════════════════════════

export interface ProcurementDashboardSurface {
  /** 전체 활성 건수 */
  totalActiveCount: number;
  /** 심각(critical) 건수 */
  totalCriticalCount: number;
  /** 경고(warning) 건수 */
  totalWarningCount: number;
  /** 패널별 데이터 */
  panels: ProcurementPanelData[];
  /** 전체 stale 상태 */
  hasStalePanel: boolean;
  /** Stale panel IDs */
  stalePanelIds: ProcurementPanelId[];
  /** 현재 필터 적용 여부 */
  isFiltered: boolean;
  /** Stale banner */
  staleBanner: StaleBannerState;
}

export function buildDashboardSurface(
  panels: ProcurementPanelData[],
  context: ProcurementDashboardContext,
  staleWarnings: StaleContextWarning[],
): ProcurementDashboardSurface {
  // Apply filter if present
  let filteredPanels = panels;
  const f = context.filter;
  const isFiltered = !!(f.domainFilter || f.severityFilter || f.poNumberSearch || f.daysInStateMin);

  if (isFiltered) {
    filteredPanels = panels.map(panel => {
      let items = [...panel.items];

      if (f.domainFilter) {
        const panelDomain = PANEL_DOMAIN_MAP[panel.panelId];
        if (panelDomain !== f.domainFilter) {
          items = [];
        }
      }

      if (f.severityFilter) {
        items = items.filter(i => i.severity === f.severityFilter);
      }

      if (f.poNumberSearch) {
        const search = f.poNumberSearch.toLowerCase();
        items = items.filter(i => i.poNumber.toLowerCase().includes(search));
      }

      if (f.daysInStateMin != null) {
        items = items.filter(i => i.daysInState >= f.daysInStateMin!);
      }

      return {
        ...panel,
        items,
        count: items.length,
        criticalCount: items.filter(i => i.severity === "critical").length,
        warningCount: items.filter(i => i.severity === "warning").length,
        normalCount: items.filter(i => i.severity === "normal").length,
      };
    });
  }

  const stalePanelIds = filteredPanels
    .filter(p => p.isStale)
    .map(p => p.panelId);

  const totalActiveCount = filteredPanels.reduce((sum, p) => sum + p.count, 0);
  const totalCriticalCount = filteredPanels.reduce((sum, p) => sum + p.criticalCount, 0);
  const totalWarningCount = filteredPanels.reduce((sum, p) => sum + p.warningCount, 0);

  return {
    totalActiveCount,
    totalCriticalCount,
    totalWarningCount,
    panels: filteredPanels,
    hasStalePanel: stalePanelIds.length > 0,
    stalePanelIds,
    isFiltered,
    staleBanner: computeStaleBanner(staleWarnings),
  };
}

// ══════════════════════════════════════════════
// Chain Timeline — PO 단위 체인 진행 타임라인
// ══════════════════════════════════════════════

export interface ChainTimelineEntry {
  stage: QuoteChainStage;
  domain: GovernanceDomain;
  status: "completed" | "active" | "blocked" | "pending" | "skipped";
  enteredAt: string | null;
  completedAt: string | null;
  blockerCount: number;
  stale: boolean;
}

export interface ChainTimeline {
  poNumber: string;
  caseId: string;
  entries: ChainTimelineEntry[];
  currentStage: QuoteChainStage | null;
  overallHealth: "healthy" | "at_risk" | "blocked";
  totalDaysInChain: number;
}

const CHAIN_STAGE_ORDER: { stage: QuoteChainStage; domain: GovernanceDomain }[] = [
  { stage: "quote_review", domain: "quote_chain" },
  { stage: "quote_shortlist", domain: "quote_chain" },
  { stage: "quote_approval", domain: "quote_chain" },
  { stage: "po_conversion", domain: "quote_chain" },
  { stage: "po_approval", domain: "quote_chain" },
  { stage: "po_send_readiness", domain: "dispatch_prep" },
  { stage: "po_created", domain: "dispatch_prep" },
  { stage: "dispatch_prep", domain: "dispatch_prep" },
  { stage: "sent", domain: "dispatch_execution" },
  { stage: "supplier_confirmed", domain: "supplier_confirmation" },
  { stage: "receiving_prep", domain: "receiving_prep" },
  { stage: "stock_release", domain: "stock_release" },
  { stage: "reorder_decision", domain: "reorder_decision" },
];

export function buildChainTimeline(
  poNumber: string,
  caseId: string,
  stageStatuses: Partial<Record<QuoteChainStage, {
    status: ChainTimelineEntry["status"];
    enteredAt: string | null;
    completedAt: string | null;
    blockerCount: number;
  }>>,
  staleWarnings: StaleContextWarning[],
): ChainTimeline {
  let currentStage: QuoteChainStage | null = null;
  let hasBlocked = false;
  let firstEnteredAt: string | null = null;

  const entries: ChainTimelineEntry[] = CHAIN_STAGE_ORDER.map(({ stage, domain }) => {
    const stageData = stageStatuses[stage];
    const isStale = staleWarnings.some(w => w.chainStage === stage);

    const entry: ChainTimelineEntry = {
      stage,
      domain,
      status: stageData?.status ?? "pending",
      enteredAt: stageData?.enteredAt ?? null,
      completedAt: stageData?.completedAt ?? null,
      blockerCount: stageData?.blockerCount ?? 0,
      stale: isStale,
    };

    if (entry.status === "active" || entry.status === "blocked") {
      currentStage = stage;
    }
    if (entry.status === "blocked") {
      hasBlocked = true;
    }
    if (entry.enteredAt && (!firstEnteredAt || entry.enteredAt < firstEnteredAt)) {
      firstEnteredAt = entry.enteredAt;
    }

    return entry;
  });

  const totalDaysInChain = firstEnteredAt
    ? Math.floor((Date.now() - new Date(firstEnteredAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const overallHealth: ChainTimeline["overallHealth"] = hasBlocked
    ? "blocked"
    : entries.some(e => e.stale || e.blockerCount > 0)
      ? "at_risk"
      : "healthy";

  return {
    poNumber,
    caseId,
    entries,
    currentStage,
    overallHealth,
    totalDaysInChain,
  };
}
