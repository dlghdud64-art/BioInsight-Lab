/**
 * Work Queue State Mapper
 *
 * 도메인별 이벤트(substatus)를 글로벌 TaskStatus + ApprovalStatus 조합으로 매핑.
 * 대시보드 노출/필터링은 오직 taskStatus를 기준으로 하며,
 * 도메인 세부 상태는 substatus 필드에 보존됩니다.
 */

// ── Enum 타입 (Prisma 생성 타입과 동기화) ──

export type TaskStatus =
  | "READY"
  | "REVIEW_NEEDED"
  | "IN_PROGRESS"
  | "WAITING_RESPONSE"
  | "ACTION_NEEDED"
  | "COMPLETED"
  | "FAILED"
  | "BLOCKED";

export type ApprovalStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export type AiActionType =
  | "QUOTE_DRAFT"
  | "VENDOR_EMAIL_DRAFT"
  | "REORDER_SUGGESTION"
  | "EXPIRY_ALERT"
  | "FOLLOWUP_DRAFT"
  | "VENDOR_RESPONSE_PARSED"
  | "STATUS_CHANGE_SUGGEST"
  | "COMPARE_DECISION";

// ── 매핑 결과 ──

export interface StateMapping {
  taskStatus: TaskStatus;
  approvalStatus: ApprovalStatus;
  substatus: string;
  summary?: string; // 대시보드 카드 1줄 요약 (옵션)
}

// ── 도메인 이벤트 → 상태 매핑 테이블 ──

/**
 * 각 도메인 substatus에 대한 글로벌 상태 매핑.
 *
 * 매핑 규칙:
 * - TaskStatus: 대시보드 필터링 기준
 * - ApprovalStatus: 사용자 결재 필요 여부
 * - substatus: 도메인 원본 상태 (변경하지 않고 pass-through)
 */
const STATE_MAP: Record<string, Omit<StateMapping, "substatus">> = {
  // ═══ 견적 도메인 ═══
  quote_draft_generated: {
    taskStatus: "REVIEW_NEEDED",
    approvalStatus: "PENDING",
  },
  quote_draft_approved: {
    taskStatus: "IN_PROGRESS",
    approvalStatus: "APPROVED",
  },
  quote_draft_dismissed: {
    taskStatus: "COMPLETED",
    approvalStatus: "REJECTED",
  },
  vendor_email_generated: {
    taskStatus: "REVIEW_NEEDED",
    approvalStatus: "PENDING",
  },
  vendor_email_approved: {
    taskStatus: "IN_PROGRESS",
    approvalStatus: "APPROVED",
  },
  email_sent: {
    taskStatus: "WAITING_RESPONSE",
    approvalStatus: "APPROVED",
  },
  vendor_reply_received: {
    taskStatus: "ACTION_NEEDED",
    approvalStatus: "NOT_REQUIRED",
  },
  quote_completed: {
    taskStatus: "COMPLETED",
    approvalStatus: "APPROVED",
  },

  // ═══ 주문 도메인 ═══
  followup_draft_generated: {
    taskStatus: "REVIEW_NEEDED",
    approvalStatus: "PENDING",
  },
  followup_approved: {
    taskStatus: "IN_PROGRESS",
    approvalStatus: "APPROVED",
  },
  followup_sent: {
    taskStatus: "WAITING_RESPONSE",
    approvalStatus: "APPROVED",
  },
  status_change_proposed: {
    taskStatus: "REVIEW_NEEDED",
    approvalStatus: "PENDING",
  },
  status_change_approved: {
    taskStatus: "COMPLETED",
    approvalStatus: "APPROVED",
  },
  vendor_response_parsed: {
    taskStatus: "ACTION_NEEDED",
    approvalStatus: "NOT_REQUIRED",
  },

  // ═══ 재고 도메인 ═══
  restock_suggested: {
    taskStatus: "ACTION_NEEDED",
    approvalStatus: "PENDING",
  },
  restock_approved: {
    taskStatus: "IN_PROGRESS",
    approvalStatus: "APPROVED",
  },
  restock_ordered: {
    taskStatus: "WAITING_RESPONSE",
    approvalStatus: "APPROVED",
  },
  restock_completed: {
    taskStatus: "COMPLETED",
    approvalStatus: "APPROVED",
  },
  expiry_alert_created: {
    taskStatus: "ACTION_NEEDED",
    approvalStatus: "NOT_REQUIRED",
  },
  expiry_acknowledged: {
    taskStatus: "COMPLETED",
    approvalStatus: "NOT_REQUIRED",
  },
  purchase_request_created: {
    taskStatus: "WAITING_RESPONSE",
    approvalStatus: "PENDING",
  },

  // ═══ 비교 도메인 ═══
  compare_decision_pending: {
    taskStatus: "REVIEW_NEEDED",
    approvalStatus: "PENDING",
  },
  compare_inquiry_followup: {
    taskStatus: "ACTION_NEEDED",
    approvalStatus: "NOT_REQUIRED",
  },
  compare_quote_in_progress: {
    taskStatus: "WAITING_RESPONSE",
    approvalStatus: "NOT_REQUIRED",
  },
  compare_decided: {
    taskStatus: "COMPLETED",
    approvalStatus: "APPROVED",
  },
  compare_reopened: {
    taskStatus: "REVIEW_NEEDED",
    approvalStatus: "PENDING",
  },

  // ═══ 공통 ═══
  execution_failed: {
    taskStatus: "FAILED",
    approvalStatus: "NOT_REQUIRED",
  },
  budget_insufficient: {
    taskStatus: "BLOCKED",
    approvalStatus: "NOT_REQUIRED",
  },
  permission_denied: {
    taskStatus: "BLOCKED",
    approvalStatus: "NOT_REQUIRED",
  },
};

/**
 * Substatus → TaskStatus + ApprovalStatus 변환
 *
 * @param substatus  도메인 세부 상태 문자열
 * @returns          3-Layer 상태 매핑 결과
 * @throws           매핑 테이블에 없는 substatus
 */
export function resolveState(substatus: string): StateMapping {
  const mapped = STATE_MAP[substatus];
  if (!mapped) {
    // 알 수 없는 substatus → 안전하게 ACTION_NEEDED로 폴백
    console.warn(`[StateMapper] Unknown substatus: "${substatus}", falling back to ACTION_NEEDED`);
    return {
      taskStatus: "ACTION_NEEDED",
      approvalStatus: "NOT_REQUIRED",
      substatus,
    };
  }
  return { ...mapped, substatus };
}

// ── AiActionType → 초기 Substatus 매핑 ──

/**
 * AI 작업 생성 시 AiActionType 기반 초기 substatus 결정.
 * 새 AiActionItem이 생성될 때 호출됩니다.
 */
const INITIAL_SUBSTATUS: Record<AiActionType, string> = {
  QUOTE_DRAFT: "quote_draft_generated",
  VENDOR_EMAIL_DRAFT: "vendor_email_generated",
  REORDER_SUGGESTION: "restock_suggested",
  EXPIRY_ALERT: "expiry_alert_created",
  FOLLOWUP_DRAFT: "followup_draft_generated",
  VENDOR_RESPONSE_PARSED: "vendor_response_parsed",
  STATUS_CHANGE_SUGGEST: "status_change_proposed",
  COMPARE_DECISION: "compare_decision_pending",
};

/**
 * AI 작업 생성 시 초기 3-Layer 상태 계산
 */
export function resolveInitialState(actionType: AiActionType): StateMapping {
  const substatus = INITIAL_SUBSTATUS[actionType];
  return resolveState(substatus);
}

// ── Legacy 상태 → 3-Layer 변환 (마이그레이션용) ──

type LegacyStatus = "PENDING" | "APPROVED" | "DISMISSED" | "EXPIRED" | "EXECUTING" | "FAILED";

const LEGACY_TO_TASK_STATUS: Record<LegacyStatus, TaskStatus> = {
  PENDING: "REVIEW_NEEDED",
  APPROVED: "COMPLETED",
  DISMISSED: "COMPLETED",
  EXPIRED: "COMPLETED",
  EXECUTING: "IN_PROGRESS",
  FAILED: "FAILED",
};

const LEGACY_TO_APPROVAL_STATUS: Record<LegacyStatus, ApprovalStatus> = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  DISMISSED: "REJECTED",
  EXPIRED: "NOT_REQUIRED",
  EXECUTING: "APPROVED",
  FAILED: "NOT_REQUIRED",
};

/**
 * Legacy AiActionStatus → 3-Layer 상태 변환 (마이그레이션 + 하위 호환)
 */
export function resolveLegacyState(legacyStatus: LegacyStatus, actionType: AiActionType): StateMapping {
  const substatus = INITIAL_SUBSTATUS[actionType] || "unknown";
  return {
    taskStatus: LEGACY_TO_TASK_STATUS[legacyStatus] || "ACTION_NEEDED",
    approvalStatus: LEGACY_TO_APPROVAL_STATUS[legacyStatus] || "NOT_REQUIRED",
    substatus,
  };
}

// ── TaskStatus 정렬 우선순위 ──

/**
 * 대시보드 Work Queue 정렬 시 사용하는 상태별 우선순위.
 * 숫자가 작을수록 높은 우선순위(먼저 노출).
 */
export const TASK_STATUS_SORT_ORDER: Record<TaskStatus, number> = {
  BLOCKED: 0,
  FAILED: 1,
  ACTION_NEEDED: 2,
  REVIEW_NEEDED: 3,
  WAITING_RESPONSE: 4,
  IN_PROGRESS: 5,
  READY: 6,
  COMPLETED: 99,
};

/**
 * 대시보드 상태 배지 색상 매핑
 */
export const TASK_STATUS_BADGE: Record<TaskStatus, { label: string; color: string }> = {
  READY: { label: "준비", color: "bg-[#222226] text-slate-700" },
  REVIEW_NEEDED: { label: "검토 필요", color: "bg-amber-100 text-amber-800" },
  IN_PROGRESS: { label: "진행 중", color: "bg-blue-100 text-blue-800" },
  WAITING_RESPONSE: { label: "응답 대기", color: "bg-purple-100 text-purple-800" },
  ACTION_NEEDED: { label: "조치 필요", color: "bg-red-100 text-red-800" },
  COMPLETED: { label: "완료", color: "bg-green-100 text-green-800" },
  FAILED: { label: "실패", color: "bg-red-200 text-red-900" },
  BLOCKED: { label: "차단됨", color: "bg-gray-200 text-gray-800" },
};

export const APPROVAL_STATUS_BADGE: Record<ApprovalStatus, { label: string; color: string }> = {
  NOT_REQUIRED: { label: "", color: "" },
  PENDING: { label: "승인 대기", color: "bg-yellow-100 text-yellow-800" },
  APPROVED: { label: "승인됨", color: "bg-green-100 text-green-800" },
  REJECTED: { label: "거절됨", color: "bg-red-100 text-red-800" },
};
