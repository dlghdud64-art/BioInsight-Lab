/**
 * Workbench Interaction Contract
 *
 * 제품 전체의 3-surface interaction grammar를 정의합니다.
 * quote / inventory / purchase 모든 workbench가 이 계약을 따릅니다.
 *
 * 3-Surface Model:
 *   1. List / Queue Surface — 다건 triage, 정렬, 필터, selection entry
 *   2. Right Context Rail  — 선택 객체의 상태/blocker/next action/handoff snapshot
 *   3. Center Work Window  — 실제 처리 작업 실행
 *
 * Interaction Flow:
 *   row click → rail open → rail CTA → work window open
 *   work window close → rail context 복귀
 *   explicit "전체 상세 열기" → fallback detail route (2급 경로)
 */

// ═══ 1. Selection State Contract ═══

export interface WorkbenchSelectionState {
  /** 현재 선택된 record의 canonical id */
  selectedRecordId: string | null;
  /** record 도메인 타입 */
  selectedRecordType: WorkbenchDomain;
  /** rail open 여부 */
  railOpen: boolean;
  /** 현재 열려있는 work window key */
  activeWorkWindowKey: string | null;
  /** 현재 실행 중인 action key */
  activeActionKey: string | null;
}

export type WorkbenchDomain =
  | "quote_case"
  | "inventory_record"
  | "po_candidate"
  | "receiving_batch"
  | "reorder_candidate";

// ═══ 2. URL Sync Contract ═══

/**
 * URL 동기화 규칙:
 * - list selection → ?selected=recordId
 * - work window open → ?selected=recordId&task=actionKey
 * - path는 유지, query만 변경
 *
 * 금지:
 * - row 클릭 시 상세 path 이동
 * - rail open 시 route push
 * - work window open 시 새 page transition
 *
 * 예외 (명시적 deep-link만):
 * - explicit "전체 상세 열기"
 * - direct URL 진입 / 북마크 / 공유 링크
 */
export interface UrlSyncContract {
  /** 현재 base path (변경 금지) */
  basePath: string;
  /** selected query param */
  selectedParam: string;
  /** task query param */
  taskParam: string;
}

export const URL_SYNC_DEFAULTS: Record<WorkbenchDomain, UrlSyncContract> = {
  quote_case:        { basePath: "/dashboard/quotes",    selectedParam: "selected", taskParam: "task" },
  inventory_record:  { basePath: "/dashboard/inventory", selectedParam: "selected", taskParam: "task" },
  po_candidate:      { basePath: "/dashboard/orders",    selectedParam: "selected", taskParam: "task" },
  receiving_batch:   { basePath: "/dashboard/receiving",  selectedParam: "selected", taskParam: "task" },
  reorder_candidate: { basePath: "/dashboard/reorder",   selectedParam: "selected", taskParam: "task" },
};

// ═══ 3. Handoff Payload Contract ═══

/**
 * Rail → Work Window 전환 시 최소 공통 handoff payload.
 * full detail object 넘기기 금지. 이 payload로 shell 즉시 렌더,
 * 세부 데이터는 work window가 lazy hydrate.
 */
export interface WorkbenchHandoffPayload {
  recordId: string;
  recordType: WorkbenchDomain;
  resolvedUiState: string;
  actionKey: string;
  title: string;
  statusLabel: string;
  riskLabel: string;
  nextActionLabel: string;
  policyFlags?: Record<string, boolean>;
  readinessFlags?: Record<string, boolean>;
  estimatedAmount?: number;
}

// ═══ 4. Right Rail State Contract ═══

export type RailState = "unselected" | "loading" | "ready" | "partial_error";

/**
 * Right Rail 공통 slot 구조:
 * 1. Header Slot
 * 2. Operating Summary Slot
 * 3. Domain Snapshot Slot
 * 4. Activity Snapshot Slot
 * 5. Handoff Slot
 * 6. Sticky Action Slot
 *
 * 도메인별 내용은 달라도 slot 역할은 같아야 합니다.
 */
export interface RailSlotConfig {
  headerSlot: boolean;
  operatingSummarySlot: boolean;
  domainSnapshotSlot: boolean;
  activitySnapshotSlot: boolean;
  handoffSlot: boolean;
  stickyActionSlot: boolean;
}

export const RAIL_SLOT_DEFAULTS: RailSlotConfig = {
  headerSlot: true,
  operatingSummarySlot: true,
  domainSnapshotSlot: true,
  activitySnapshotSlot: true,
  handoffSlot: true,
  stickyActionSlot: true,
};

// ═══ 5. Work Window State Contract ═══

export type WorkWindowState = "opening" | "summary_ready" | "fully_hydrated" | "section_partial_error";

/**
 * Center Work Window 공통 block grammar:
 * 1. Sticky Work Header
 * 2. Summary Block
 * 3. Decision / Execution Block
 * 4. Guardrail / Exception Block
 * 5. Inline AI Recommendation (1줄만)
 * 6. Sticky Action Bar
 */
export interface WorkWindowBlockConfig {
  stickyWorkHeader: boolean;
  summaryBlock: boolean;
  decisionBlock: boolean;
  guardrailBlock: boolean;
  inlineAiRecommendation: boolean;
  stickyActionBar: boolean;
}

export const WORK_WINDOW_BLOCK_DEFAULTS: WorkWindowBlockConfig = {
  stickyWorkHeader: true,
  summaryBlock: true,
  decisionBlock: true,
  guardrailBlock: true,
  inlineAiRecommendation: true,
  stickyActionBar: true,
};

// ═══ 6. Action Key Registry ═══

/**
 * 도메인별 action key.
 * label은 화면 언어에 맞게 바뀌어도 key naming grammar는 공통 유지.
 */
export const ACTION_KEYS = {
  // Quote
  send_request: "send_request",
  send_followup: "send_followup",
  open_compare_review: "open_compare_review",
  prepare_approval_package: "prepare_approval_package",
  open_po_conversion: "open_po_conversion",
  // Inventory
  open_receiving_confirm: "open_receiving_confirm",
  open_inventory_linkage: "open_inventory_linkage",
  open_reorder_candidate: "open_reorder_candidate",
  // Purchase
  open_po_review: "open_po_review",
  mark_po_created: "mark_po_created",
} as const;

export type ActionKey = typeof ACTION_KEYS[keyof typeof ACTION_KEYS];

// ═══ 7. Trace / Logging Contract ═══

/**
 * 모든 3-surface interaction은 이 이벤트 체계를 공유합니다.
 */
export type WorkbenchTraceEvent =
  | "record_selected"
  | "context_rail_opened"
  | "context_rail_closed"
  | "task_surface_opened"
  | "task_surface_closed"
  | "task_surface_partial_error"
  | "task_surface_completed"
  | "explicit_full_detail_opened";

export interface WorkbenchTracePayload {
  event: WorkbenchTraceEvent;
  recordId: string | null;
  recordType: WorkbenchDomain;
  resolvedUiState?: string;
  actionKey?: string;
  activePath: string;
  activeQuery: string;
  timestamp: number;
}

/**
 * 공통 trace logger.
 * 각 workbench에서 이 함수를 호출하면 일관된 로그가 남습니다.
 */
export function logWorkbenchTrace(payload: WorkbenchTracePayload): void {
  if (typeof window !== "undefined") {
    console.log(`[Workbench:${payload.recordType}]`, payload.event, {
      recordId: payload.recordId,
      state: payload.resolvedUiState,
      action: payload.actionKey,
      path: payload.activePath,
      query: payload.activeQuery,
    });
  }
}

// ═══ 8. Partial Error / Empty State Contract ═══

/**
 * Rail/Work Window의 empty/error 문구 규칙:
 * - generic "데이터 없음" 금지
 * - 항상 "왜 비어있는지" + "다음 행동" 포함
 * - partial error는 사용 가능한 범위를 명시
 */
export interface SectionFallbackCopy {
  title: string;
  description: string;
  nextAction?: string;
  retryable?: boolean;
}

export const PARTIAL_ERROR_COPY: SectionFallbackCopy = {
  title: "일부 운영 정보를 불러오지 못했습니다",
  description: "기본 상태 검토와 다음 액션은 계속 확인할 수 있습니다",
  retryable: true,
};

export const RAIL_UNSELECTED_COPY: SectionFallbackCopy = {
  title: "항목을 선택하세요",
  description: "행을 클릭하면 상태와 다음 액션을 여기서 바로 확인할 수 있습니다",
};

// ═══ 9. Rail + Work Window 동시 유지 규칙 ═══

/**
 * 기본 원칙:
 * - row 선택 시 rail open
 * - rail CTA 클릭 시 center work window open
 * - rail은 닫지 않고 compact mode로 유지
 * - work window close 시 rail context 복귀
 *
 * 즉 rail과 center work window는 경쟁 관계가 아니라,
 * context panel + task surface 관계입니다.
 */
export interface SurfaceCoexistenceRule {
  /** rail과 work window 동시 표시 허용 */
  allowSimultaneous: boolean;
  /** work window open 시 rail compact mode 적용 */
  compactRailOnWorkWindow: boolean;
  /** work window close 시 rail 상태 복귀 */
  restoreRailOnWorkWindowClose: boolean;
  /** work window open 시 list 유지 */
  keepListOnWorkWindow: boolean;
}

export const SURFACE_COEXISTENCE_DEFAULTS: SurfaceCoexistenceRule = {
  allowSimultaneous: true,
  compactRailOnWorkWindow: true,
  restoreRailOnWorkWindowClose: true,
  keepListOnWorkWindow: true,
};

// ═══ 10. Fallback Detail Route 규칙 ═══

/**
 * full detail route는 2급 경로.
 * 기본 운영 진입점은 list → rail → work window.
 *
 * full detail route 허용 조건:
 * 1. explicit "전체 상세 열기" 클릭
 * 2. direct URL 진입 / 북마크
 * 3. 공유 링크
 */
export const FALLBACK_DETAIL_ROUTES: Record<WorkbenchDomain, string> = {
  quote_case:        "/quotes/[id]",
  inventory_record:  "/dashboard/inventory/[id]",
  po_candidate:      "/dashboard/orders/[id]",
  receiving_batch:   "/dashboard/receiving/[id]",
  reorder_candidate: "/dashboard/reorder/[id]",
};
