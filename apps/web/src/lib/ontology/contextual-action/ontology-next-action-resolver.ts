/**
 * ontology-next-action-resolver.ts
 *
 * Deterministic next-step resolver for LabAxis contextual ontology layer.
 *
 * DESIGN PRINCIPLES:
 * 1. 규칙 기반 — LLM 추측이 아니라 current context에서 결정적으로 계산
 * 2. 우선순위:
 *    selection > route canonical next action > blocker correction > overview
 * 3. canonical truth 변경 금지 — resolver는 읽기만
 * 4. 기존 governance grammar / workbench interaction contract 재사용
 * 5. route → stage → action 매핑은 exhaustive (누락 불허)
 */

import type { WorkbenchDomain } from "@/lib/workbench-interaction-contract";

// ══════════════════════════════════════════════
// Route Context — resolver input
// ══════════════════════════════════════════════

/** Known app routes that map to governance stages */
export type AppRoute =
  | "sourcing_search"       // /app/search, /test/search
  | "dashboard_overview"    // /dashboard
  | "dashboard_quotes"      // /dashboard/quotes
  | "dashboard_orders"      // /dashboard/orders
  | "dashboard_purchases"   // /dashboard/purchases
  | "dashboard_inventory"   // /dashboard/inventory
  | "dashboard_analytics"   // /dashboard/analytics
  | "dashboard_receiving"   // /dashboard/receiving
  | "unknown";

export function classifyRoute(pathname: string): AppRoute {
  if (pathname.includes("/search")) return "sourcing_search";
  if (pathname === "/dashboard" || pathname === "/dashboard/") return "dashboard_overview";
  if (pathname.startsWith("/dashboard/quotes")) return "dashboard_quotes";
  if (pathname.startsWith("/dashboard/orders")) return "dashboard_orders";
  if (pathname.startsWith("/dashboard/purchases")) return "dashboard_purchases";
  if (pathname.startsWith("/dashboard/inventory")) return "dashboard_inventory";
  if (pathname.startsWith("/dashboard/analytics")) return "dashboard_analytics";
  if (pathname.startsWith("/dashboard/receiving")) return "dashboard_receiving";
  return "unknown";
}

// ══════════════════════════════════════════════
// Resolver Input / Output contracts
// ══════════════════════════════════════════════

export interface ContextualActionInput {
  /** Current pathname */
  currentRoute: AppRoute;
  /** Selected entity IDs (compare candidates, quote items, PO records, etc.) */
  selectedEntityIds: string[];
  /** Type of selected entities */
  selectedEntityType: "product" | "quote_item" | "po_record" | "dispatch_record" | "inventory_item" | "none";
  /** Current workflow stage if applicable */
  currentStage: WorkflowStage | null;
  /** Active blockers from blocker-adapter or domain engines */
  activeBlockers: ContextualBlocker[];
  /** Snapshot validity flags */
  snapshotValid: boolean;
  /** Policy hold active */
  policyHoldActive: boolean;
  /** Whether there are pending critical governance events */
  hasPendingCriticalEvents: boolean;
  /** Active work window (if any) */
  activeWorkWindow: string | null;
  /** Counts for quick triage */
  counts: ContextualCounts;
  /** Sourcing-specific enrichment data (optional — only sourcing route populates) */
  sourcingDetail?: SourcingContextDetail;
}

/** Enriched sourcing context for detailed overlay rendering */
export interface SourcingContextDetail {
  /** Human-readable selected product names */
  selectedProductNames: string[];
  /** Number of available suppliers for selected candidates */
  availableSupplierCount: number;
  /** Whether AI compare analysis has been completed */
  aiAnalysisExists: boolean;
  /** Whether a request draft exists */
  requestDraftExists: boolean;
  /** Request draft completeness: filled item count / total item count */
  requestDraftCompleteness: { filled: number; total: number } | null;
  /** Incomplete items that need attention before submission */
  incompleteItems: string[];
  /** Last submitted quote request ID (if just submitted) */
  lastSubmittedQuoteRequestId: string | null;
  /** Linked compare result exists */
  linkedCompareResultExists: boolean;
  /** Handoff target label */
  handoffTarget: string;
}

export interface ContextualCounts {
  compareIds: number;
  quoteItems: number;
  pendingQuotes: number;
  pendingApprovals: number;
  activePoConversions: number;
  dispatchPrepItems: number;
  pendingReceiving: number;
}

export type WorkflowStage =
  | "search_idle"
  | "search_comparing"
  | "search_requesting"
  | "request_assembly"
  | "request_submission"
  | "quote_management"
  | "quote_comparison"
  | "approval_pending"
  | "approval_completed"
  | "po_conversion"
  | "po_created"
  | "dispatch_prep"
  | "dispatch_execution"
  | "receiving"
  | "stock_release";

// ── Blocker (simplified from blocker-adapter for resolver consumption) ──

export interface ContextualBlocker {
  id: string;
  type: string;
  severity: "hard_block" | "review_gate" | "soft_warning" | "external_wait";
  label: string;
  resolutionAction: string | null;
  resolutionRoute: string | null;
}

// ── Resolved Actions ──

export type ActionPriority = "primary" | "secondary" | "correction" | "overview";

export interface ResolvedAction {
  /** Unique action key */
  actionKey: string;
  /** Human-readable label */
  label: string;
  /** Priority determines presentation order */
  priority: ActionPriority;
  /** Brief reason why this is the next step */
  reason: string;
  /** Target route (null = stay on current page, open overlay/workbench) */
  targetRoute: string | null;
  /** Work window to open (if staying on same page) */
  targetWorkWindow: string | null;
  /** Domain this action belongs to */
  domain: WorkbenchDomain | "sourcing" | "overview";
  /** Whether this action is blocked */
  blocked: boolean;
  /** Block reason if blocked */
  blockReason: string | null;
}

/** Rail lineage items for overlay right column */
export interface RailLineageItem {
  key: string;
  label: string;
  value: string;
  tone: "neutral" | "positive" | "warning" | "blocked";
}

/** Center context summary items */
export interface CenterContextItem {
  label: string;
  tone: "neutral" | "positive" | "warning" | "blocked";
}

export interface ResolvedNextActionResult {
  /** Primary next required action (always exactly one) */
  nextRequiredAction: ResolvedAction;
  /** Additional available follow-up actions */
  availableFollowUpActions: ResolvedAction[];
  /** Actions that are blocked */
  blockedActions: ResolvedAction[];
  /** Human-readable explanation of why this action was chosen */
  whyThisAction: string;
  /** Current stage label for display */
  currentStageLabel: string;
  /** Mode the overlay should render in */
  mode: "contextual" | "overview";
  /** Rail lineage data for overlay right column */
  railContext: RailLineageItem[];
  /** Center context summary items */
  centerContext: CenterContextItem[];
  /** Why this action is the right next step (reasoning block) */
  whyReasons: string[];
}

// ══════════════════════════════════════════════
// Resolution Rules — Priority-based deterministic
// ══════════════════════════════════════════════

/**
 * Primary resolution algorithm:
 * 1. If hard_block blocker exists → correction path first
 * 2. If current selection exists → selection-driven next action
 * 3. If current route has canonical next action → route-driven next action
 * 4. If current stage has blocker-free next step → stage-driven
 * 5. Fallback → overview mode (내 작업 요약)
 */
export function resolveNextAction(input: ContextualActionInput): ResolvedNextActionResult {
  const { currentRoute, activeBlockers } = input;

  const hardBlocks = activeBlockers.filter(b => b.severity === "hard_block");

  // ── Priority 1: Hard blockers → correction path ──
  if (hardBlocks.length > 0) {
    return buildCorrectionResult(input, hardBlocks);
  }

  // ── Priority 2–4: Route-specific resolution ──
  switch (currentRoute) {
    case "sourcing_search":
      return resolveSourcingContext(input);
    case "dashboard_quotes":
      return resolveQuoteManagementContext(input);
    case "dashboard_orders":
      return resolveOrdersContext(input);
    case "dashboard_purchases":
      return resolvePurchasesContext(input);
    case "dashboard_inventory":
      return resolveInventoryContext(input);
    case "dashboard_analytics":
      return resolveAnalyticsContext(input);
    case "dashboard_overview":
      return resolveOverviewContext(input);
    default:
      return resolveOverviewContext(input);
  }
}

// ── Correction path (hard blockers present) ──

function buildCorrectionResult(
  input: ContextualActionInput,
  hardBlocks: ContextualBlocker[],
): ResolvedNextActionResult {
  const primaryBlock = hardBlocks[0];

  const correctionAction: ResolvedAction = {
    actionKey: `correction_${primaryBlock.type}`,
    label: primaryBlock.resolutionAction || "차단 사항 해결",
    priority: "correction",
    reason: primaryBlock.label,
    targetRoute: primaryBlock.resolutionRoute,
    targetWorkWindow: null,
    domain: "overview",
    blocked: false,
    blockReason: null,
  };

  const otherCorrections = hardBlocks.slice(1).map((b): ResolvedAction => ({
    actionKey: `correction_${b.type}`,
    label: b.resolutionAction || "차단 사항 해결",
    priority: "correction",
    reason: b.label,
    targetRoute: b.resolutionRoute,
    targetWorkWindow: null,
    domain: "overview",
    blocked: false,
    blockReason: null,
  }));

  return {
    nextRequiredAction: correctionAction,
    availableFollowUpActions: otherCorrections,
    blockedActions: [],
    whyThisAction: `${hardBlocks.length}건의 차단 사항이 해결되어야 다음 단계로 진행할 수 있습니다.`,
    currentStageLabel: STAGE_LABELS[input.currentStage ?? "search_idle"] || "차단 상태",
    mode: "contextual",
    railContext: hardBlocks.map((b, i) => ({
      key: `block_${i}`, label: "차단 사항", value: b.label, tone: "blocked" as const,
    })),
    centerContext: hardBlocks.map(b => ({ label: b.label, tone: "blocked" as const })),
    whyReasons: [`${hardBlocks.length}건의 차단 사항이 해결되어야 합니다.`],
  };
}

// ── Sourcing search context (6-state deterministic) ──

function resolveSourcingContext(input: ContextualActionInput): ResolvedNextActionResult {
  const { counts, activeWorkWindow, sourcingDetail } = input;
  const sd = sourcingDetail ?? DEFAULT_SOURCING_DETAIL;

  // ── State 6: 제출 완료 (lastSubmittedQuoteRequestId 존재) ──
  if (sd.lastSubmittedQuoteRequestId) {
    return {
      nextRequiredAction: makeAction("go_quote_management", "견적 관리에서 계속", "primary",
        "견적 요청이 생성되어 견적 관리에서 응답을 추적합니다.", "/dashboard/quotes", null, "sourcing"),
      availableFollowUpActions: [
        makeAction("back_to_sourcing", "소싱으로 돌아가기", "secondary",
          "새 검색을 시작합니다.", null, null, "sourcing"),
      ],
      blockedActions: [],
      whyThisAction: "견적 요청이 생성되어 다음 단계는 견적 관리입니다.",
      currentStageLabel: "요청 제출 완료",
      mode: "contextual",
      railContext: [
        { key: "stage", label: "현재 stage", value: "sourcing → 제출 완료", tone: "positive" },
        { key: "request_id", label: "생성된 요청", value: sd.lastSubmittedQuoteRequestId, tone: "positive" },
        { key: "handoff", label: "다음 목적지", value: "견적 관리", tone: "neutral" },
      ],
      centerContext: [
        { label: `견적 요청 1건이 생성되었습니다`, tone: "positive" },
        { label: `품목 ${counts.quoteItems}건`, tone: "neutral" },
        ...(sd.availableSupplierCount > 0 ? [{ label: `공급사 ${sd.availableSupplierCount}곳`, tone: "neutral" as const }] : []),
      ],
      whyReasons: [
        "견적 요청이 성공적으로 생성되었습니다.",
        "다음 단계: 견적 관리에서 공급사 응답을 추적합니다.",
      ],
    };
  }

  // ── State 5: 제출 직전 (request-submission work window) ──
  if (activeWorkWindow === "request-submission") {
    const incompleteCount = sd.incompleteItems.length;
    return {
      nextRequiredAction: makeAction("continue_submission", "요청 제출 검토", "primary",
        "요청 제출 검토가 진행 중입니다.", null, "request-submission", "sourcing"),
      availableFollowUpActions: [
        makeAction("back_to_assembly", "요청 조립으로 돌아가기", "secondary",
          "조립 단계로 복귀합니다.", null, "request-assembly", "sourcing"),
      ],
      blockedActions: [],
      whyThisAction: "제출 검토 작업 창이 열려 있어 최종 검토를 진행합니다.",
      currentStageLabel: "요청 제출 검토",
      mode: "contextual",
      railContext: [
        { key: "stage", label: "현재 stage", value: "sourcing → 제출 검토", tone: "neutral" },
        ...(sd.selectedProductNames.length > 0
          ? [{ key: "items", label: "선택 품목", value: sd.selectedProductNames.join(", "), tone: "neutral" as const }]
          : []),
        ...(sd.linkedCompareResultExists
          ? [{ key: "compare", label: "비교 결과", value: "연결됨", tone: "positive" as const }]
          : []),
        { key: "draft", label: "요청 초안", value: sd.requestDraftCompleteness
            ? `${sd.requestDraftCompleteness.filled}/${sd.requestDraftCompleteness.total} 완료`
            : "있음", tone: "neutral" },
        ...(incompleteCount > 0
          ? [{ key: "blocker", label: "미확인 항목", value: `${incompleteCount}건`, tone: "warning" as const }]
          : []),
        { key: "handoff", label: "다음 목적지", value: sd.handoffTarget, tone: "neutral" },
      ],
      centerContext: [
        cc(`품목 ${counts.quoteItems}건`, "neutral"),
        ...(sd.availableSupplierCount > 0 ? [cc(`공급사 ${sd.availableSupplierCount}곳`, "neutral")] : []),
        ...(incompleteCount > 0
          ? [cc(`미확인 항목 ${incompleteCount}건`, "warning")]
          : [cc("모든 항목 확인 완료", "positive")]),
      ],
      whyReasons: [
        `견적 후보 ${counts.quoteItems}건이 조립되어 제출 준비가 완료되었습니다.`,
        ...(incompleteCount > 0
          ? [`${incompleteCount}건의 미확인 항목이 남아 있습니다: ${sd.incompleteItems.slice(0, 3).join(", ")}`]
          : []),
      ],
    };
  }

  // ── State 4: 요청 초안 작성 중 (request-assembly work window) ──
  if (activeWorkWindow === "request-assembly") {
    const comp = sd.requestDraftCompleteness;
    return {
      nextRequiredAction: makeAction("continue_assembly", "견적 요청 조립 계속", "primary",
        "요청 조립이 진행 중입니다.", null, "request-assembly", "sourcing"),
      availableFollowUpActions: [
        makeAction("go_to_submission", "제출 검토로 이동", "secondary",
          "조립을 완료하고 제출을 검토합니다.", null, "request-submission", "sourcing"),
      ],
      blockedActions: [],
      whyThisAction: "요청 조립 작업 창이 열려 있어 마지막 작성 상태를 이어갑니다.",
      currentStageLabel: "견적 요청 조립",
      mode: "contextual",
      railContext: [
        { key: "stage", label: "현재 stage", value: "sourcing → 요청 조립", tone: "neutral" },
        ...(sd.selectedProductNames.length > 0
          ? [{ key: "items", label: "선택 품목", value: sd.selectedProductNames.join(", "), tone: "neutral" as const }]
          : []),
        ...(sd.linkedCompareResultExists
          ? [{ key: "compare", label: "비교 결과", value: "연결됨", tone: "positive" as const }]
          : []),
        { key: "draft", label: "요청 초안", value: comp ? `${comp.filled}/${comp.total} 완료` : "작성 중", tone: "neutral" },
        ...(sd.incompleteItems.length > 0
          ? [{ key: "blocker", label: "미완료 항목", value: sd.incompleteItems.slice(0, 3).join(", "), tone: "warning" as const }]
          : []),
        { key: "handoff", label: "다음 목적지", value: sd.handoffTarget, tone: "neutral" },
      ],
      centerContext: [
        ...(comp ? [cc(`작성된 품목 ${comp.filled}/${comp.total}건`, "neutral")] : []),
        ...(sd.availableSupplierCount > 0 ? [cc(`선택된 공급사 ${sd.availableSupplierCount}곳`, "neutral")] : []),
        ...(sd.incompleteItems.length > 0
          ? [cc(`미완료 항목 ${sd.incompleteItems.length}건`, "warning")]
          : []),
      ],
      whyReasons: [
        "요청 조립이 진행 중입니다.",
        ...(comp ? [`${comp.filled}/${comp.total}건 작성 완료`] : []),
        ...(sd.incompleteItems.length > 0 ? [`미완료: ${sd.incompleteItems.slice(0, 3).join(", ")}`] : []),
      ],
    };
  }

  // compare / compare-review work window
  if (activeWorkWindow === "compare" || activeWorkWindow === "compare-review") {
    return {
      nextRequiredAction: makeAction("continue_compare", "비교 결과 재검토", "primary",
        "비교 검토가 진행 중입니다.", null, activeWorkWindow, "sourcing"),
      availableFollowUpActions: [
        makeAction("start_request", "선택 후보로 요청 준비", "secondary",
          "비교 완료 후 견적 요청으로 이어갑니다.", null, "request-assembly", "sourcing"),
      ],
      blockedActions: [],
      whyThisAction: "비교 검토 작업 창이 열려 있습니다.",
      currentStageLabel: "비교 검토",
      mode: "contextual",
      railContext: [
        { key: "stage", label: "현재 stage", value: "sourcing → 비교 검토", tone: "neutral" },
        { key: "candidates", label: "비교 후보", value: `${counts.compareIds}개`, tone: "neutral" },
        ...(sd.selectedProductNames.length > 0
          ? [{ key: "items", label: "선택 품목", value: sd.selectedProductNames.join(", "), tone: "neutral" as const }]
          : []),
        { key: "handoff", label: "다음 목적지", value: "견적 요청 조립", tone: "neutral" },
      ],
      centerContext: [
        { label: `비교 후보 ${counts.compareIds}건`, tone: "neutral" },
        { label: "비교 분석 진행 중", tone: "neutral" },
      ],
      whyReasons: [
        `${counts.compareIds}개 후보에 대한 비교 검토가 진행 중입니다.`,
        "비교 완료 후 견적 요청 조립으로 이어집니다.",
      ],
    };
  }

  // ── State 3: AI 비교 완료, 요청 초안 없음 (quoteItems > 0, no draft) ──
  if (counts.quoteItems > 0 && !sd.requestDraftExists) {
    const actions: ResolvedAction[] = [];
    if (counts.compareIds >= 2) {
      actions.push(makeAction("review_compare", "비교 결과 재검토", "secondary",
        `${counts.compareIds}개 비교 후보가 있습니다.`, null, "compare", "sourcing"));
    }
    return {
      nextRequiredAction: makeAction("start_request_assembly", "견적 요청 조립 시작", "primary",
        `${counts.quoteItems}건의 견적 후보를 요청서로 조립합니다.`, null, "request-assembly", "sourcing"),
      availableFollowUpActions: actions,
      blockedActions: [],
      whyThisAction: `견적 후보 ${counts.quoteItems}건이 선택되어 있어 요청 조립이 가능합니다.`,
      currentStageLabel: "견적 요청 조립 준비",
      mode: "contextual",
      railContext: [
        { key: "stage", label: "현재 stage", value: "sourcing → 비교 완료", tone: "positive" },
        ...(sd.selectedProductNames.length > 0
          ? [{ key: "items", label: "선택 품목", value: sd.selectedProductNames.join(", "), tone: "neutral" as const }]
          : []),
        ...(sd.linkedCompareResultExists
          ? [{ key: "compare", label: "비교 결과", value: "있음", tone: "positive" as const }]
          : []),
        { key: "draft", label: "요청 초안", value: "없음", tone: "neutral" },
        ...(sd.availableSupplierCount > 0
          ? [{ key: "suppliers", label: "공급사 대상", value: `${sd.availableSupplierCount}곳 가능`, tone: "neutral" as const }]
          : []),
        { key: "handoff", label: "다음 목적지", value: sd.handoffTarget, tone: "neutral" },
      ],
      centerContext: [
        cc(`선택 후보 ${counts.quoteItems}건`, "positive"),
        cc("비교 준비 완료", "positive"),
        ...(sd.aiAnalysisExists ? [cc("AI 비교 분석 완료", "positive")] : []),
        ...(sd.availableSupplierCount > 0 ? [cc(`공급사 대상 ${sd.availableSupplierCount}곳 가능`, "neutral")] : []),
        ...(sd.incompleteItems.length > 0
          ? [cc(`미완료 항목 ${sd.incompleteItems.length}건: ${sd.incompleteItems[0]}`, "warning")]
          : []),
      ],
      whyReasons: [
        "검색 결과에서 후보가 확정되어 있음",
        ...(sd.aiAnalysisExists ? ["비교 결과 기준이 정리돼 있음"] : []),
        "요청 조립 전 필요한 정보가 대부분 채워짐",
      ],
    };
  }

  // State 3 variant: quoteItems > 0, draft exists → "조립 계속"
  if (counts.quoteItems > 0 && sd.requestDraftExists) {
    const actions: ResolvedAction[] = [];
    if (counts.compareIds >= 2) {
      actions.push(makeAction("review_compare", "비교 결과 재검토", "secondary",
        `${counts.compareIds}개 비교 후보가 있습니다.`, null, "compare", "sourcing"));
    }
    return {
      nextRequiredAction: makeAction("continue_request_assembly", "견적 요청 조립 계속", "primary",
        `요청 초안이 있어 마지막 작성 상태로 복귀합니다.`, null, "request-assembly", "sourcing"),
      availableFollowUpActions: actions,
      blockedActions: [],
      whyThisAction: `견적 후보 ${counts.quoteItems}건과 요청 초안이 있어 조립을 이어갑니다.`,
      currentStageLabel: "견적 요청 조립 계속",
      mode: "contextual",
      railContext: [
        { key: "stage", label: "현재 stage", value: "sourcing → 요청 조립 중", tone: "neutral" },
        ...(sd.selectedProductNames.length > 0
          ? [{ key: "items", label: "선택 품목", value: sd.selectedProductNames.join(", "), tone: "neutral" as const }]
          : []),
        { key: "draft", label: "요청 초안", value: sd.requestDraftCompleteness
            ? `${sd.requestDraftCompleteness.filled}/${sd.requestDraftCompleteness.total} 완료`
            : "있음", tone: "neutral" },
        { key: "handoff", label: "다음 목적지", value: sd.handoffTarget, tone: "neutral" },
      ],
      centerContext: [
        cc(`작성된 품목 ${sd.requestDraftCompleteness?.filled ?? "?"}/${sd.requestDraftCompleteness?.total ?? "?"}건`, "neutral"),
        ...(sd.availableSupplierCount > 0 ? [cc(`선택된 공급사 ${sd.availableSupplierCount}곳`, "neutral")] : []),
        ...(sd.incompleteItems.length > 0
          ? [cc(`미완료 항목 ${sd.incompleteItems.length}건`, "warning")]
          : []),
      ],
      whyReasons: [
        "요청 초안이 이미 존재합니다.",
        "마지막 작성 상태로 복귀하여 조립을 완료합니다.",
      ],
    };
  }

  // ── State 2: 후보 있는데 AI 비교 안 함 (compareIds >= 2, no AI analysis) ──
  if (counts.compareIds >= 2 && !sd.aiAnalysisExists) {
    return {
      nextRequiredAction: makeAction("start_compare", "AI 비교 분석 열기", "primary",
        `${counts.compareIds}개 후보를 비교합니다.`, null, "compare", "sourcing"),
      availableFollowUpActions: [
        makeAction("skip_to_request", "비교 없이 요청 준비", "secondary",
          "비교를 건너뛰고 바로 요청 조립으로 이동합니다.", null, "request-assembly", "sourcing"),
      ],
      blockedActions: [],
      whyThisAction: `비교 후보 ${counts.compareIds}개가 선택되어 있어 비교 분석이 가능합니다.`,
      currentStageLabel: "AI 비교 분석 준비",
      mode: "contextual",
      railContext: [
        { key: "stage", label: "현재 stage", value: "sourcing → 비교 준비", tone: "neutral" },
        { key: "candidates", label: "비교 후보", value: `${counts.compareIds}개`, tone: "neutral" },
        ...(sd.selectedProductNames.length > 0
          ? [{ key: "items", label: "선택 품목", value: sd.selectedProductNames.join(", "), tone: "neutral" as const }]
          : []),
        { key: "analysis", label: "AI 분석", value: "미실행", tone: "warning" },
        { key: "handoff", label: "다음 목적지", value: "견적 요청 조립", tone: "neutral" },
      ],
      centerContext: [
        { label: `비교 후보 ${counts.compareIds}건 선택`, tone: "positive" },
        { label: "AI 비교 분석 미실행", tone: "warning" },
      ],
      whyReasons: [
        `${counts.compareIds}개 후보가 선택되어 비교 분석이 가능합니다.`,
        "AI 비교를 통해 공급사/가격/납기를 체계적으로 비교할 수 있습니다.",
      ],
    };
  }

  // State 2 variant: AI analysis exists but no quoteItems yet
  if (counts.compareIds >= 2 && sd.aiAnalysisExists) {
    return {
      nextRequiredAction: makeAction("start_request_from_compare", "견적 요청 조립 시작", "primary",
        "AI 비교가 완료되어 요청 조립이 가능합니다.", null, "request-assembly", "sourcing"),
      availableFollowUpActions: [
        makeAction("review_compare_result", "비교 결과 재검토", "secondary",
          "AI 비교 결과를 다시 확인합니다.", null, "compare", "sourcing"),
      ],
      blockedActions: [],
      whyThisAction: "AI 비교 분석이 완료되어 견적 요청 조립이 다음 단계입니다.",
      currentStageLabel: "비교 완료 → 요청 조립",
      mode: "contextual",
      railContext: [
        { key: "stage", label: "현재 stage", value: "sourcing → 비교 완료", tone: "positive" },
        { key: "candidates", label: "비교 후보", value: `${counts.compareIds}개`, tone: "neutral" },
        ...(sd.selectedProductNames.length > 0
          ? [{ key: "items", label: "선택 품목", value: sd.selectedProductNames.join(", "), tone: "neutral" as const }]
          : []),
        { key: "analysis", label: "AI 분석", value: "완료", tone: "positive" },
        { key: "handoff", label: "다음 목적지", value: "견적 요청 조립", tone: "neutral" },
      ],
      centerContext: [
        { label: `비교 후보 ${counts.compareIds}건`, tone: "positive" },
        { label: "AI 비교 분석 완료", tone: "positive" },
      ],
      whyReasons: [
        "AI 비교 분석이 완료되어 결과 기준이 정리되었습니다.",
        "견적 요청 조립으로 이어갑니다.",
      ],
    };
  }

  // ── State 1: 비교 후보 부족 (1개만) ──
  if (counts.compareIds === 1) {
    return {
      nextRequiredAction: makeAction("add_compare", "비교 후보를 먼저 선택하세요", "primary",
        "비교 시작을 위해 후보를 1개 더 선택해야 합니다.", null, null, "sourcing"),
      availableFollowUpActions: [],
      blockedActions: [
        makeAction("start_compare_blocked", "AI 비교 분석", "primary",
          "비교 후보가 부족합니다.", null, null, "sourcing", true, "비교 후보 2개 이상 필요"),
      ],
      whyThisAction: "비교 후보가 1개뿐이어서 비교를 시작할 수 없습니다.",
      currentStageLabel: "비교 후보 부족",
      mode: "contextual",
      railContext: [
        { key: "stage", label: "현재 stage", value: "sourcing → 후보 선택", tone: "warning" },
        { key: "candidates", label: "비교 후보", value: "1개 (최소 2개 필요)", tone: "warning" },
      ],
      centerContext: [
        { label: "비교 후보 1개 선택 (최소 2개 필요)", tone: "warning" },
      ],
      whyReasons: [
        "비교 후보가 1개뿐이어서 비교를 시작할 수 없습니다.",
        "검색 결과에서 후보를 1개 더 선택해주세요.",
      ],
    };
  }

  // ── State 0: 아무 선택도 없음 → overview ──
  return resolveOverviewContext(input);
}

const DEFAULT_SOURCING_DETAIL: SourcingContextDetail = {
  selectedProductNames: [],
  availableSupplierCount: 0,
  aiAnalysisExists: false,
  requestDraftExists: false,
  requestDraftCompleteness: null,
  incompleteItems: [],
  lastSubmittedQuoteRequestId: null,
  linkedCompareResultExists: false,
  handoffTarget: "견적 관리",
};

// ── Quote management context ──

function resolveQuoteManagementContext(input: ContextualActionInput): ResolvedNextActionResult {
  const { counts, selectedEntityIds } = input;

  if (selectedEntityIds.length > 0) {
    return {
      nextRequiredAction: makeAction("continue_quote_review", "견적 응답 비교 계속", "primary",
        "선택된 견적 건의 응답을 비교합니다.", null, "quote-compare", "quote_case"),
      availableFollowUpActions: [
        makeAction("prepare_approval", "승인 준비", "secondary",
          "비교 완료 후 승인 절차로 이어갑니다.", "/dashboard/orders", null, "quote_case"),
      ],
      blockedActions: [],
      whyThisAction: "선택된 견적 건이 있어 비교/검토를 우선합니다.",
      currentStageLabel: "견적 응답 관리",
      mode: "contextual",
      railContext: [
        { key: "stage", label: "현재 stage", value: "견적 관리 → 응답 비교", tone: "neutral" },
        { key: "selected", label: "선택 건수", value: `${selectedEntityIds.length}건`, tone: "neutral" },
      ],
      centerContext: [{ label: `선택 견적 ${selectedEntityIds.length}건 비교 중`, tone: "neutral" }],
      whyReasons: ["선택된 견적 건의 응답을 비교/검토합니다."],
    };
  }

  if (counts.pendingQuotes > 0) {
    return {
      nextRequiredAction: makeAction("review_quotes", "공급사 응답 추적", "primary",
        `${counts.pendingQuotes}건의 견적 응답이 대기 중입니다.`, null, null, "quote_case"),
      availableFollowUpActions: [
        makeAction("start_comparison", "비교 검토 시작", "secondary",
          "응답이 충분하면 비교를 시작합니다.", null, "quote-compare", "quote_case"),
        makeAction("go_to_approval", "승인 준비", "secondary",
          "비교 완료된 건을 승인 절차로 넘깁니다.", "/dashboard/orders", null, "quote_case"),
      ],
      blockedActions: [],
      whyThisAction: `${counts.pendingQuotes}건의 견적 응답이 대기 중입니다.`,
      currentStageLabel: "공급사 응답 대기",
      mode: "contextual",
      railContext: [
        { key: "stage", label: "현재 stage", value: "견적 관리 → 응답 대기", tone: "neutral" },
        { key: "pending", label: "대기 응답", value: `${counts.pendingQuotes}건`, tone: "warning" },
      ],
      centerContext: [{ label: `${counts.pendingQuotes}건 응답 대기 중`, tone: "warning" }],
      whyReasons: [`${counts.pendingQuotes}건의 공급사 응답이 대기 중입니다.`],
    };
  }

  return resolveOverviewContext(input);
}

// ── Orders context (approval / PO conversion) ──

function resolveOrdersContext(input: ContextualActionInput): ResolvedNextActionResult {
  const { counts, currentStage } = input;

  if (currentStage === "po_created" || currentStage === "dispatch_prep") {
    return resolveDispatchContext(input);
  }

  if (counts.pendingApprovals > 0) {
    return {
      nextRequiredAction: makeAction("review_approval", "승인 대기 건 검토", "primary",
        `${counts.pendingApprovals}건의 승인이 대기 중입니다.`, null, null, "po_candidate"),
      availableFollowUpActions: [
        makeAction("po_conversion", "PO 전환 재개", "secondary",
          "승인된 건을 PO로 전환합니다.", null, "po-conversion", "po_candidate"),
      ],
      blockedActions: [],
      whyThisAction: `승인 대기 ${counts.pendingApprovals}건이 있습니다.`,
      currentStageLabel: "승인 대기",
      mode: "contextual",
      railContext: [{ key: "stage", label: "현재 stage", value: "주문 → 승인 대기", tone: "warning" }],
      centerContext: [{ label: `승인 대기 ${counts.pendingApprovals}건`, tone: "warning" }],
      whyReasons: [`${counts.pendingApprovals}건의 승인이 대기 중입니다.`],
    };
  }

  if (counts.activePoConversions > 0) {
    return {
      nextRequiredAction: makeAction("continue_po_conversion", "PO 전환 계속", "primary",
        `${counts.activePoConversions}건의 PO 전환이 진행 중입니다.`, null, "po-conversion", "po_candidate"),
      availableFollowUpActions: [
        makeAction("po_created_review", "PO created 확인", "secondary",
          "전환 완료된 PO를 확인합니다.", null, "po-created-reentry", "po_candidate"),
        makeAction("dispatch_prep_entry", "발송 준비로 이동", "secondary",
          "PO 확인 후 발송 준비를 시작합니다.", null, "dispatch-prep", "po_candidate"),
      ],
      blockedActions: [],
      whyThisAction: `PO 전환 ${counts.activePoConversions}건이 진행 중입니다.`,
      currentStageLabel: "PO 전환",
      mode: "contextual",
      railContext: [{ key: "stage", label: "현재 stage", value: "주문 → PO 전환", tone: "neutral" }],
      centerContext: [{ label: `PO 전환 진행 ${counts.activePoConversions}건`, tone: "neutral" }],
      whyReasons: [`${counts.activePoConversions}건의 PO 전환이 진행 중입니다.`],
    };
  }

  return resolveOverviewContext(input);
}

// ── Dispatch context (PO created / dispatch prep) ──

function resolveDispatchContext(input: ContextualActionInput): ResolvedNextActionResult {
  const { currentStage, snapshotValid, policyHoldActive } = input;
  const actions: ResolvedAction[] = [];
  const blocked: ResolvedAction[] = [];

  if (currentStage === "po_created") {
    // PO created → dispatch prep 진입 허브
    const dispatchAction = makeAction("enter_dispatch_prep", "발송 준비 시작", "primary",
      "PO 확인 후 발송 준비를 시작합니다.", null, "dispatch-prep", "po_candidate");

    if (!snapshotValid) {
      dispatchAction.blocked = true;
      dispatchAction.blockReason = "승인 스냅샷이 유효하지 않습니다. 재검증이 필요합니다.";
      blocked.push(dispatchAction);
      actions.push(makeAction("revalidate_snapshot", "스냅샷 재검증", "correction",
        "승인 스냅샷을 재검증합니다.", null, null, "po_candidate"));
    }

    if (policyHoldActive) {
      dispatchAction.blocked = true;
      dispatchAction.blockReason = "정책 보류가 활성 상태입니다.";
      if (!blocked.includes(dispatchAction)) blocked.push(dispatchAction);
      actions.push(makeAction("resolve_policy_hold", "정책 보류 해결", "correction",
        "활성 정책 보류를 확인합니다.", null, null, "po_candidate"));
    }

    if (!dispatchAction.blocked) {
      return {
        nextRequiredAction: dispatchAction,
        availableFollowUpActions: [
          makeAction("request_correction", "교정 요청", "secondary",
            "PO 내용 교정을 요청합니다.", null, null, "po_candidate"),
        ],
        blockedActions: [],
        whyThisAction: "PO 확인이 완료되어 발송 준비로 진행할 수 있습니다.",
        currentStageLabel: "PO Created",
        mode: "contextual",
        railContext: [{ key: "stage", label: "현재 stage", value: "PO Created → 발송 준비", tone: "positive" }],
        centerContext: [{ label: "PO 확인 완료, 발송 준비 가능", tone: "positive" }],
        whyReasons: ["PO 확인이 완료되어 발송 준비로 진행할 수 있습니다."],
      };
    }

    return {
      nextRequiredAction: actions[0] || makeAction("wait_resolution", "차단 해결 대기", "correction",
        "차단 사항이 해결되어야 합니다.", null, null, "po_candidate"),
      availableFollowUpActions: actions.slice(1),
      blockedActions: blocked,
      whyThisAction: "발송 준비가 차단되어 있어 선행 조건을 해결해야 합니다.",
      currentStageLabel: "PO Created (차단)",
      mode: "contextual",
      railContext: [
        { key: "stage", label: "현재 stage", value: "PO Created (차단)", tone: "blocked" },
        ...(!snapshotValid ? [{ key: "snapshot", label: "스냅샷", value: "유효하지 않음", tone: "blocked" as const }] : []),
        ...(policyHoldActive ? [{ key: "policy", label: "정책 보류", value: "활성", tone: "blocked" as const }] : []),
      ],
      centerContext: blocked.map(b => ({ label: b.blockReason || b.label, tone: "blocked" as const })),
      whyReasons: ["발송 준비가 차단되어 선행 조건을 해결해야 합니다."],
    };
  }

  // dispatch_prep stage
  if (currentStage === "dispatch_prep") {
    const sendAction = makeAction("execute_dispatch", "발송 실행", "primary",
      "발송 준비가 완료되면 실행합니다.", null, null, "po_candidate");

    if (!snapshotValid || policyHoldActive || input.hasPendingCriticalEvents) {
      sendAction.blocked = true;
      sendAction.blockReason = !snapshotValid
        ? "스냅샷 유효성 실패"
        : policyHoldActive
        ? "정책 보류 활성"
        : "미결 거버넌스 이벤트 존재";
      blocked.push(sendAction);
    }

    const followUps: ResolvedAction[] = [
      makeAction("continue_dispatch_prep", "발송 준비 계속", "secondary",
        "필수 필드와 첨부를 확인합니다.", null, "dispatch-prep", "po_candidate"),
      makeAction("schedule_send", "발송 예약", "secondary",
        "발송 일정을 예약합니다.", null, null, "po_candidate"),
      makeAction("request_correction_dispatch", "교정 요청", "secondary",
        "발송 전 교정을 요청합니다.", null, null, "po_candidate"),
      makeAction("blocker_check", "blocker 확인", "secondary",
        "현재 차단 사항을 확인합니다.", null, null, "po_candidate"),
    ];

    if (sendAction.blocked) {
      return {
        nextRequiredAction: makeAction("resolve_dispatch_blocker", "발송 차단 사항 해결", "correction",
          sendAction.blockReason || "차단 사항이 있습니다.", null, null, "po_candidate"),
        availableFollowUpActions: followUps,
        blockedActions: blocked,
        whyThisAction: `발송 실행이 차단되어 있습니다: ${sendAction.blockReason}`,
        currentStageLabel: "Dispatch Prep (차단)",
        mode: "contextual",
        railContext: [{ key: "stage", label: "현재 stage", value: "Dispatch Prep (차단)", tone: "blocked" }],
        centerContext: [{ label: sendAction.blockReason || "차단됨", tone: "blocked" }],
        whyReasons: [`발송 실행이 차단됨: ${sendAction.blockReason}`],
      };
    }

    return {
      nextRequiredAction: sendAction,
      availableFollowUpActions: followUps,
      blockedActions: [],
      whyThisAction: "발송 준비가 완료되어 실행할 수 있습니다.",
      currentStageLabel: "Dispatch Prep",
      mode: "contextual",
      railContext: [{ key: "stage", label: "현재 stage", value: "Dispatch Prep → 실행 가능", tone: "positive" }],
      centerContext: [{ label: "발송 준비 완료, 실행 가능", tone: "positive" }],
      whyReasons: ["발송 준비가 완료되어 실행할 수 있습니다."],
    };
  }

  return resolveOverviewContext(input);
}

// ── Purchases context ──

function resolvePurchasesContext(input: ContextualActionInput): ResolvedNextActionResult {
  return resolveOverviewContext(input);
}

// ── Inventory context ──

function resolveInventoryContext(input: ContextualActionInput): ResolvedNextActionResult {
  if (input.counts.pendingReceiving > 0) {
    return {
      nextRequiredAction: makeAction("continue_receiving", "입고 처리 계속", "primary",
        `${input.counts.pendingReceiving}건의 입고가 대기 중입니다.`, "/dashboard/receiving", null, "inventory_record"),
      availableFollowUpActions: [],
      blockedActions: [],
      whyThisAction: `입고 대기 ${input.counts.pendingReceiving}건이 있습니다.`,
      currentStageLabel: "입고 대기",
      mode: "contextual",
      railContext: [{ key: "stage", label: "현재 stage", value: "재고 → 입고 대기", tone: "warning" }],
      centerContext: [{ label: `입고 대기 ${input.counts.pendingReceiving}건`, tone: "warning" }],
      whyReasons: [`${input.counts.pendingReceiving}건의 입고가 대기 중입니다.`],
    };
  }

  return resolveOverviewContext(input);
}

// ── Analytics context ──

function resolveAnalyticsContext(input: ContextualActionInput): ResolvedNextActionResult {
  return resolveOverviewContext(input);
}

// ── Overview fallback ──

function resolveOverviewContext(input: ContextualActionInput): ResolvedNextActionResult {
  const { counts } = input;
  const actions: ResolvedAction[] = [];

  // 현재 진행 중인 작업들을 우선순위로 정렬
  if (counts.dispatchPrepItems > 0) {
    actions.push(makeAction("dispatch_overview", "발송 준비 계속", "primary",
      `${counts.dispatchPrepItems}건의 발송 준비가 진행 중입니다.`, "/dashboard/orders", null, "po_candidate"));
  }
  if (counts.activePoConversions > 0) {
    actions.push(makeAction("po_overview", "PO 전환 계속", "primary",
      `${counts.activePoConversions}건의 PO 전환이 진행 중입니다.`, "/dashboard/orders", null, "po_candidate"));
  }
  if (counts.pendingApprovals > 0) {
    actions.push(makeAction("approval_overview", "승인 대기 확인", "primary",
      `${counts.pendingApprovals}건의 승인이 대기 중입니다.`, "/dashboard/orders", null, "po_candidate"));
  }
  if (counts.pendingQuotes > 0) {
    actions.push(makeAction("quote_overview", "견적 응답 관리", "secondary",
      `${counts.pendingQuotes}건의 견적 응답이 대기 중입니다.`, "/dashboard/quotes", null, "quote_case"));
  }
  if (counts.pendingReceiving > 0) {
    actions.push(makeAction("receiving_overview", "입고 처리 확인", "secondary",
      `${counts.pendingReceiving}건의 입고가 대기 중입니다.`, "/dashboard/receiving", null, "receiving_batch"));
  }
  if (counts.quoteItems > 0) {
    actions.push(makeAction("sourcing_overview", "견적 요청 조립", "secondary",
      `${counts.quoteItems}건의 견적 후보가 있습니다.`, null, "request-assembly", "sourcing"));
  }

  // 하나라도 있으면 첫 번째를 primary로
  if (actions.length > 0) {
    const summaryItems = actions.map(a => ({ label: a.reason, tone: "neutral" as const }));
    return {
      nextRequiredAction: { ...actions[0], priority: "primary" },
      availableFollowUpActions: actions.slice(1),
      blockedActions: [],
      whyThisAction: "진행 중인 작업 중 우선순위가 높은 항목입니다.",
      currentStageLabel: "작업 허브",
      mode: "overview",
      railContext: actions.map((a, i) => ({
        key: `task_${i}`, label: a.domain as string, value: a.reason, tone: "neutral" as const,
      })),
      centerContext: summaryItems,
      whyReasons: ["진행 중인 작업 중 우선순위가 높은 항목을 표시합니다."],
    };
  }

  // 아무것도 없으면 대시보드
  return {
    nextRequiredAction: makeAction("go_dashboard", "대시보드 열기", "overview",
      "진행 중인 작업이 없습니다.", "/dashboard", null, "overview"),
    availableFollowUpActions: [
      makeAction("start_sourcing", "소싱 검색 시작", "secondary",
        "새로운 검색을 시작합니다.", "/app/search", null, "sourcing"),
    ],
    blockedActions: [],
    whyThisAction: "진행 중인 작업이 없어 대시보드로 안내합니다.",
    currentStageLabel: "대기",
    mode: "overview",
    railContext: [],
    centerContext: [{ label: "진행 중인 작업이 없습니다", tone: "neutral" }],
    whyReasons: ["진행 중인 작업이 없어 대시보드로 안내합니다."],
  };
}

// ══════════════════════════════════════════════
// Utility
// ══════════════════════════════════════════════

function cc(label: string, tone: CenterContextItem["tone"]): CenterContextItem {
  return { label, tone };
}

function rl(key: string, label: string, value: string, tone: RailLineageItem["tone"]): RailLineageItem {
  return { key, label, value, tone };
}

function makeAction(
  actionKey: string,
  label: string,
  priority: ActionPriority,
  reason: string,
  targetRoute: string | null,
  targetWorkWindow: string | null,
  domain: WorkbenchDomain | "sourcing" | "overview",
  blocked = false,
  blockReason: string | null = null,
): ResolvedAction {
  return { actionKey, label, priority, reason, targetRoute, targetWorkWindow, domain, blocked, blockReason };
}

const STAGE_LABELS: Record<WorkflowStage, string> = {
  search_idle: "소싱 대기",
  search_comparing: "비교 검토",
  search_requesting: "요청 준비",
  request_assembly: "요청 조립",
  request_submission: "제출 검토",
  quote_management: "견적 관리",
  quote_comparison: "견적 비교",
  approval_pending: "승인 대기",
  approval_completed: "승인 완료",
  po_conversion: "PO 전환",
  po_created: "PO Created",
  dispatch_prep: "발송 준비",
  dispatch_execution: "발송 실행",
  receiving: "입고 처리",
  stock_release: "재고 출고",
};

export { STAGE_LABELS };
