/**
 * Drill-down / Cross-page Context Mapping — 중앙 관리
 *
 * KPI → queue filter, queue → detail return, source label 등
 * 모든 cross-page context 전달 규칙을 한 곳에서 관리.
 *
 * inline onClick 하드코딩 금지.
 * 같은 KPI가 여러 곳에서 다른 mapping을 가지면 안 됨.
 */

import type { DrilldownContext } from "@/lib/review-queue/types";

// ═══════════════════════════════════════════════════
// KPI → Queue Filter Mapping
// ═══════════════════════════════════════════════════

export type KpiDrilldownKey =
  | "review_needed"
  | "compare_pending"
  | "quote_ready"
  | "approval_pending"
  | "budget_warning"
  | "inventory_duplicate"
  | "low_stock"
  | "expiry_soon"
  | "match_failed"
  | "overdue_approval";

interface KpiDrilldownMapping {
  href: string;
  filters: Record<string, string>;
  sort?: string;
  sourceLabel: string;
  returnLabel: string;
}

export const KPI_DRILLDOWN_MAP: Record<KpiDrilldownKey, KpiDrilldownMapping> = {
  review_needed: {
    href: "/search",
    filters: { status: "needs_review" },
    sort: "priority_desc",
    sourceLabel: "대시보드 > 검토 필요 항목",
    returnLabel: "대시보드로 돌아가기",
  },
  compare_pending: {
    href: "/search",
    filters: { status: "selection_needed" },
    sort: "priority_desc",
    sourceLabel: "대시보드 > 비교 확정 대기",
    returnLabel: "대시보드로 돌아가기",
  },
  quote_ready: {
    href: "/search",
    filters: { status: "draft_ready" },
    sourceLabel: "대시보드 > 견적 초안 제출 가능",
    returnLabel: "대시보드로 돌아가기",
  },
  approval_pending: {
    href: "/dashboard/work-queue",
    filters: { status: "pending", tab: "approvals" },
    sort: "priority_desc",
    sourceLabel: "대시보드 > 승인 대기",
    returnLabel: "대시보드로 돌아가기",
  },
  budget_warning: {
    href: "/search",
    filters: { budgetHint: "budgetCheckRequired" },
    sourceLabel: "대시보드 > 예산 확인 필요",
    returnLabel: "대시보드로 돌아가기",
  },
  inventory_duplicate: {
    href: "/search",
    filters: { inventoryHint: "possibleDuplicatePurchase" },
    sourceLabel: "대시보드 > 재고 중복 가능",
    returnLabel: "대시보드로 돌아가기",
  },
  low_stock: {
    href: "/dashboard/inventory",
    filters: { filter: "low" },
    sourceLabel: "대시보드 > 재고 부족 알림",
    returnLabel: "대시보드로 돌아가기",
  },
  expiry_soon: {
    href: "/dashboard/inventory",
    filters: { filter: "expiring" },
    sourceLabel: "대시보드 > 만료 임박 품목",
    returnLabel: "대시보드로 돌아가기",
  },
  match_failed: {
    href: "/search",
    filters: { status: "match_failed" },
    sourceLabel: "대시보드 > 매칭 실패 항목",
    returnLabel: "대시보드로 돌아가기",
  },
  overdue_approval: {
    href: "/dashboard/work-queue",
    filters: { overdue: "true", tab: "approvals" },
    sort: "overdue_desc",
    sourceLabel: "대시보드 > 승인 지연",
    returnLabel: "대시보드로 돌아가기",
  },
};

// ═══════════════════════════════════════════════════
// Queue → Detail Return Mapping
// ═══════════════════════════════════════════════════

export type QueueSourceKey =
  | "approval_queue"
  | "review_queue"
  | "compare_queue"
  | "quote_draft_queue"
  | "inventory_queue"
  | "search_results"
  | "work_queue";

interface QueueReturnMapping {
  returnHref: string;
  returnLabel: string;
}

export const QUEUE_RETURN_MAP: Record<QueueSourceKey, QueueReturnMapping> = {
  approval_queue: {
    returnHref: "/dashboard/work-queue?tab=approvals",
    returnLabel: "승인 대기 목록으로 돌아가기",
  },
  review_queue: {
    returnHref: "/search",
    returnLabel: "검토 큐로 돌아가기",
  },
  compare_queue: {
    returnHref: "/search",
    returnLabel: "비교 큐로 돌아가기",
  },
  quote_draft_queue: {
    returnHref: "/search",
    returnLabel: "견적 초안으로 돌아가기",
  },
  inventory_queue: {
    returnHref: "/dashboard/inventory",
    returnLabel: "재고 관리로 돌아가기",
  },
  search_results: {
    returnHref: "/search",
    returnLabel: "검색 결과로 돌아가기",
  },
  work_queue: {
    returnHref: "/dashboard/work-queue",
    returnLabel: "작업 큐로 돌아가기",
  },
};

// ═══════════════════════════════════════════════════
// Related Queue Bridge Mapping
// ═══════════════════════════════════════════════════

export interface RelatedQueueBridge {
  targetHref: string;
  bridgeLabel: string;
  bridgeReason: string;
}

export const RELATED_QUEUE_BRIDGES: Record<string, RelatedQueueBridge> = {
  "approval_blocked_by_document": {
    targetHref: "/dashboard/safety",
    bridgeLabel: "문서 확인 큐에서 처리",
    bridgeReason: "이 항목은 필수 문서 누락으로 차단되어 있습니다. 문서 확인 큐에서 먼저 처리할 수 있습니다.",
  },
  "low_stock_to_reorder": {
    targetHref: "/search",
    bridgeLabel: "재발주 검색 시작",
    bridgeReason: "재고 부족 품목을 검색하고 견적 요청으로 연결할 수 있습니다.",
  },
  "delayed_quote_to_vendor": {
    targetHref: "/dashboard/vendor/quotes",
    bridgeLabel: "공급사 응답 확인",
    bridgeReason: "이 견적은 공급사 응답이 지연되고 있습니다. 공급사 견적 상태를 확인할 수 있습니다.",
  },
};

// ═══════════════════════════════════════════════════
// Source Label Copy
// ═══════════════════════════════════════════════════

export const SOURCE_LABELS: Record<string, string> = {
  dashboard: "대시보드에서 전달된 조건",
  approval_queue: "승인 대기 큐에서 열람 중",
  review_queue: "검토 큐에서 열람 중",
  compare_queue: "비교 큐에서 열람 중",
  quote_draft_queue: "견적 초안에서 열람 중",
  inventory_queue: "재고 관리에서 열람 중",
  search_results: "검색 결과에서 이동",
  work_queue: "작업 큐에서 열람 중",
};

// ═══════════════════════════════════════════════════
// Context Builder Helpers
// ═══════════════════════════════════════════════════

/** KPI 클릭 → DrilldownContext 생성 */
export function buildKpiDrilldownContext(key: KpiDrilldownKey): DrilldownContext {
  const mapping = KPI_DRILLDOWN_MAP[key];
  return {
    sourcePageId: "dashboard",
    sourceLabel: mapping.sourceLabel,
    dataFilters: mapping.filters,
    viewContext: {
      sort: mapping.sort,
    },
    returnHref: "/dashboard",
    returnLabel: mapping.returnLabel,
  };
}

/** Queue → Detail → Return context 생성 */
export function buildQueueReturnContext(
  queueKey: QueueSourceKey,
  currentFilters?: Record<string, string>,
  currentSort?: string,
  currentTab?: string,
): DrilldownContext {
  const mapping = QUEUE_RETURN_MAP[queueKey];
  return {
    sourcePageId: queueKey,
    sourceLabel: SOURCE_LABELS[queueKey] ?? queueKey,
    dataFilters: currentFilters ?? {},
    viewContext: {
      sort: currentSort,
      tab: currentTab,
    },
    returnHref: mapping.returnHref,
    returnLabel: mapping.returnLabel,
  };
}

/** URL query string으로 context 직렬화 */
export function serializeContextToQuery(ctx: DrilldownContext): string {
  const params = new URLSearchParams();
  params.set("source", ctx.sourcePageId);
  Object.entries(ctx.dataFilters).forEach(([k, v]) => params.set(k, v));
  if (ctx.viewContext.sort) params.set("sort", ctx.viewContext.sort);
  if (ctx.viewContext.tab) params.set("tab", ctx.viewContext.tab);
  if (ctx.viewContext.page) params.set("page", String(ctx.viewContext.page));
  return params.toString();
}

/** URL query string에서 context 복원 */
export function restoreContextFromQuery(searchParams: URLSearchParams): Partial<DrilldownContext> | null {
  const source = searchParams.get("source");
  if (!source) return null;

  const dataFilters: Record<string, string> = {};
  searchParams.forEach((v, k) => {
    if (!["source", "sort", "tab", "page"].includes(k)) {
      dataFilters[k] = v;
    }
  });

  return {
    sourcePageId: source,
    sourceLabel: SOURCE_LABELS[source] ?? source,
    dataFilters,
    viewContext: {
      sort: searchParams.get("sort") ?? undefined,
      tab: searchParams.get("tab") ?? undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
    },
    returnHref: QUEUE_RETURN_MAP[source as QueueSourceKey]?.returnHref ?? "/dashboard",
    returnLabel: QUEUE_RETURN_MAP[source as QueueSourceKey]?.returnLabel ?? "돌아가기",
  };
}

// ═══════════════════════════════════════════════════
// Cross-page Context ViewModel
// ═══════════════════════════════════════════════════

export interface CrossPageContextViewModel {
  sourceType?: "dashboard" | "queue" | "search" | "detail" | "report";
  sourceLabel?: string;
  returnLabel?: string;
  returnHref?: string;
  appliedSummary?: string;
  nextItemHref?: string;
  currentPositionLabel?: string;
}
