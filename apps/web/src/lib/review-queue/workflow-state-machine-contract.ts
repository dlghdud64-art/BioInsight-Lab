/**
 * Workflow / State Machine 중앙 계약
 *
 * 핵심 원칙: Workflow는 단순한 enum이 아니라 운영 단계와 책임 흐름을 지배하는 계약이다.
 * State machine은 허용된 전이, guard, side effect, UI 매핑을 명확히 정의하여
 * queue/detail/notification/audit/report 전체에서 공유해야 한다.
 */

// ---------------------------------------------------------------------------
// 1. WorkflowEntityType — 워크플로우 대상 엔티티 유형
// ---------------------------------------------------------------------------

/** 워크플로우가 적용되는 운영 엔티티 유형 */
export type WorkflowEntityType =
  | "purchase_request"
  | "quote_draft"
  | "approval"
  | "inventory_receipt"
  | "compare_task"
  | "document_submission";

// ---------------------------------------------------------------------------
// 2. PurchaseRequestState — 구매 요청 상태
// ---------------------------------------------------------------------------

/** 구매 요청의 전체 생애주기 상태 */
export type PurchaseRequestState =
  | "draft"
  | "review_pending"
  | "review_in_progress"
  | "approval_pending"
  | "approved"
  | "rejected"
  | "revision_requested"
  | "order_placed"
  | "received"
  | "cancelled"
  | "blocked"
  | "closed";

// ---------------------------------------------------------------------------
// 3. QuoteDraftState — 견적 초안 상태
// ---------------------------------------------------------------------------

/** 견적 초안의 전체 생애주기 상태 */
export type QuoteDraftState =
  | "collecting"
  | "compare_needed"
  | "comparing"
  | "selection_pending"
  | "selected"
  | "submission_ready"
  | "submitted"
  | "vendor_responded"
  | "expired"
  | "cancelled";

// ---------------------------------------------------------------------------
// 4. ApprovalState — 승인 상태
// ---------------------------------------------------------------------------

/** 승인 워크플로우의 전체 상태 */
export type ApprovalState =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "escalated"
  | "delegated"
  | "timed_out"
  | "withdrawn";

// ---------------------------------------------------------------------------
// 5. TransitionRule — 상태 전이 규칙
// ---------------------------------------------------------------------------

/** 하나의 상태 전이를 정의하는 규칙. guard, side effect, 확인 요구를 포함한다. */
export interface TransitionRule {
  /** 출발 상태 */
  from: string;
  /** 도착 상태 */
  to: string;
  /** 액션 라벨 (한국어, 예: "승인하기", "반려하기") */
  action: string;
  /** 자동 전이 여부 — true이면 시스템이 조건 충족 시 자동 실행 */
  isAutomatic: boolean;
  /** 전이 전 충족해야 하는 guard 조건 목록 */
  guardConditions: GuardCondition[];
  /** 전이 후 실행되는 side effect 목록 */
  sideEffects: SideEffectType[];
  /** 전이를 수행할 수 있는 역할 (미지정 시 제한 없음) */
  requiredRole?: string;
  /** 사용자 확인이 필요한 전이인지 여부 */
  confirmationRequired: boolean;
  /** 확인 대화상자에 표시할 메시지 (한국어) */
  confirmationMessage?: string;
}

// ---------------------------------------------------------------------------
// 6. GuardCondition — 전이 가드 조건
// ---------------------------------------------------------------------------

/** 전이를 허용하기 전에 평가해야 하는 개별 guard 조건 */
export interface GuardCondition {
  /** 조건 식별자 */
  id: string;
  /** 조건 설명 (한국어) */
  description: string;
  /** 조건 유형 */
  type:
    | "document_complete"
    | "budget_available"
    | "role_authorized"
    | "predecessor_complete"
    | "owner_assigned"
    | "integration_healthy"
    | "sla_within"
    | "custom";
  /** 현재 충족 여부 */
  isMet: boolean;
  /** 미충족 시 표시할 차단 메시지 (한국어) */
  blockingMessage?: string;
}

// ---------------------------------------------------------------------------
// 7. SideEffectType — 전이 부수 효과 유형
// ---------------------------------------------------------------------------

/** 전이 시 발생하는 부수 효과 유형 */
export type SideEffectType =
  | "send_notification"
  | "move_to_queue"
  | "create_audit_log"
  | "create_related_entity"
  | "record_timeline"
  | "trigger_approval"
  | "trigger_escalation"
  | "update_kpi"
  | "sync_external";

// ---------------------------------------------------------------------------
// 8. SideEffect — 전이 부수 효과 정의
// ---------------------------------------------------------------------------

/** 전이 시 실행되는 개별 부수 효과 */
export interface SideEffect {
  /** 부수 효과 유형 */
  type: SideEffectType;
  /** 부수 효과 설명 (한국어) */
  description: string;
  /** 대상 엔티티 또는 큐 식별자 */
  target?: string;
  /** 필수 여부 — true이면 실패 시 전이 차단 */
  isRequired: boolean;
}

// ---------------------------------------------------------------------------
// 9. PURCHASE_REQUEST_TRANSITIONS — 구매 요청 전이 규칙
// ---------------------------------------------------------------------------

/** 구매 요청 워크플로우의 모든 허용된 상태 전이 규칙 (~15개) */
export const PURCHASE_REQUEST_TRANSITIONS: TransitionRule[] = [
  // draft → review_pending
  {
    from: "draft",
    to: "review_pending",
    action: "검토 요청",
    isAutomatic: false,
    guardConditions: [
      {
        id: "doc_complete",
        description: "필수 문서가 모두 첨부되어 있는지 확인",
        type: "document_complete",
        isMet: false,
        blockingMessage: "필수 문서가 누락되어 검토를 요청할 수 없습니다",
      },
      {
        id: "owner_set",
        description: "담당자가 지정되어 있는지 확인",
        type: "owner_assigned",
        isMet: false,
        blockingMessage: "담당자가 지정되지 않았습니다. 담당자를 먼저 배정해 주세요",
      },
    ],
    sideEffects: ["send_notification", "create_audit_log", "record_timeline", "move_to_queue"],
    requiredRole: "REQUESTER",
    confirmationRequired: false,
  },

  // review_pending → review_in_progress (자동)
  {
    from: "review_pending",
    to: "review_in_progress",
    action: "검토 시작",
    isAutomatic: true,
    guardConditions: [],
    sideEffects: ["create_audit_log", "record_timeline"],
    confirmationRequired: false,
  },

  // review_in_progress → approval_pending
  {
    from: "review_in_progress",
    to: "approval_pending",
    action: "승인 요청",
    isAutomatic: false,
    guardConditions: [
      {
        id: "budget_ok",
        description: "예산이 충분한지 확인",
        type: "budget_available",
        isMet: false,
        blockingMessage: "예산이 부족하거나 한도를 초과합니다. 예산 현황을 확인해 주세요",
      },
    ],
    sideEffects: ["send_notification", "create_audit_log", "record_timeline", "trigger_approval"],
    requiredRole: "APPROVER",
    confirmationRequired: false,
  },

  // review_in_progress → revision_requested
  {
    from: "review_in_progress",
    to: "revision_requested",
    action: "수정 요청",
    isAutomatic: false,
    guardConditions: [],
    sideEffects: ["send_notification", "create_audit_log", "record_timeline"],
    requiredRole: "APPROVER",
    confirmationRequired: false,
  },

  // approval_pending → approved
  {
    from: "approval_pending",
    to: "approved",
    action: "승인",
    isAutomatic: false,
    guardConditions: [
      {
        id: "role_auth",
        description: "승인 권한이 있는 사용자인지 확인",
        type: "role_authorized",
        isMet: false,
        blockingMessage: "승인 권한이 없습니다. 승인 권한이 있는 사용자만 승인할 수 있습니다",
      },
    ],
    sideEffects: [
      "send_notification",
      "create_audit_log",
      "record_timeline",
      "move_to_queue",
      "update_kpi",
    ],
    requiredRole: "APPROVER",
    confirmationRequired: false,
  },

  // approval_pending → rejected
  {
    from: "approval_pending",
    to: "rejected",
    action: "반려",
    isAutomatic: false,
    guardConditions: [],
    sideEffects: ["send_notification", "create_audit_log", "record_timeline"],
    requiredRole: "APPROVER",
    confirmationRequired: true,
    confirmationMessage: "이 요청을 반려하시겠습니까? 반려 사유를 입력해 주세요.",
  },

  // approval_pending → escalated (자동 — SLA 초과 시)
  {
    from: "approval_pending",
    to: "blocked",
    action: "SLA 초과 에스컬레이션",
    isAutomatic: true,
    guardConditions: [
      {
        id: "sla_exceeded",
        description: "SLA 기한이 초과되었는지 확인",
        type: "sla_within",
        isMet: false,
        blockingMessage: "SLA 기한 내에 있어 자동 에스컬레이션이 불필요합니다",
      },
    ],
    sideEffects: ["trigger_escalation", "send_notification", "create_audit_log", "record_timeline"],
    confirmationRequired: false,
  },

  // rejected → draft
  {
    from: "rejected",
    to: "draft",
    action: "재작성",
    isAutomatic: false,
    guardConditions: [],
    sideEffects: ["create_audit_log", "record_timeline"],
    requiredRole: "REQUESTER",
    confirmationRequired: false,
  },

  // revision_requested → review_pending
  {
    from: "revision_requested",
    to: "review_pending",
    action: "수정 완료",
    isAutomatic: false,
    guardConditions: [],
    sideEffects: ["send_notification", "create_audit_log", "record_timeline", "move_to_queue"],
    requiredRole: "REQUESTER",
    confirmationRequired: false,
  },

  // approved → order_placed
  {
    from: "approved",
    to: "order_placed",
    action: "발주 전환",
    isAutomatic: false,
    guardConditions: [
      {
        id: "integration_ok",
        description: "외부 시스템 연동이 정상인지 확인",
        type: "integration_healthy",
        isMet: false,
        blockingMessage: "외부 시스템 연동이 비활성 상태입니다. 연동 상태를 확인해 주세요",
      },
    ],
    sideEffects: [
      "create_related_entity",
      "send_notification",
      "create_audit_log",
      "record_timeline",
      "sync_external",
    ],
    requiredRole: "ADMIN",
    confirmationRequired: true,
    confirmationMessage: "발주를 진행하시겠습니까? 외부 시스템에 주문이 생성됩니다.",
  },

  // order_placed → received
  {
    from: "order_placed",
    to: "received",
    action: "입고 확인",
    isAutomatic: false,
    guardConditions: [],
    sideEffects: ["create_audit_log", "record_timeline", "update_kpi"],
    requiredRole: "REQUESTER",
    confirmationRequired: false,
  },

  // received → closed
  {
    from: "received",
    to: "closed",
    action: "종료",
    isAutomatic: false,
    guardConditions: [],
    sideEffects: ["create_audit_log", "record_timeline", "update_kpi"],
    confirmationRequired: false,
  },

  // any → cancelled
  {
    from: "*",
    to: "cancelled",
    action: "취소",
    isAutomatic: false,
    guardConditions: [],
    sideEffects: ["send_notification", "create_audit_log", "record_timeline"],
    requiredRole: "ADMIN",
    confirmationRequired: true,
    confirmationMessage: "취소하면 되돌릴 수 없습니다. 진행하시겠습니까?",
  },

  // any → blocked
  {
    from: "*",
    to: "blocked",
    action: "차단",
    isAutomatic: false,
    guardConditions: [],
    sideEffects: ["trigger_escalation", "send_notification", "create_audit_log", "record_timeline"],
    requiredRole: "ADMIN",
    confirmationRequired: true,
    confirmationMessage: "이 항목을 차단하시겠습니까? 차단 사유를 입력해 주세요.",
  },

  // blocked → review_pending
  {
    from: "blocked",
    to: "review_pending",
    action: "차단 해제",
    isAutomatic: false,
    guardConditions: [
      {
        id: "role_auth_unblock",
        description: "차단 해제 권한이 있는 사용자인지 확인",
        type: "role_authorized",
        isMet: false,
        blockingMessage: "차단 해제 권한이 없습니다. 관리자에게 문의하세요",
      },
    ],
    sideEffects: ["create_audit_log", "record_timeline", "send_notification"],
    requiredRole: "ADMIN",
    confirmationRequired: false,
  },
];

// ---------------------------------------------------------------------------
// 10. QUOTE_DRAFT_TRANSITIONS — 견적 초안 전이 규칙
// ---------------------------------------------------------------------------

/** 견적 초안 워크플로우의 모든 허용된 상태 전이 규칙 (~10개) */
export const QUOTE_DRAFT_TRANSITIONS: TransitionRule[] = [
  // collecting → compare_needed
  {
    from: "collecting",
    to: "compare_needed",
    action: "비교 요청",
    isAutomatic: false,
    guardConditions: [],
    sideEffects: ["create_audit_log", "record_timeline", "move_to_queue"],
    confirmationRequired: false,
  },

  // compare_needed → comparing (자동)
  {
    from: "compare_needed",
    to: "comparing",
    action: "비교 시작",
    isAutomatic: true,
    guardConditions: [],
    sideEffects: ["create_audit_log", "record_timeline"],
    confirmationRequired: false,
  },

  // comparing → selection_pending
  {
    from: "comparing",
    to: "selection_pending",
    action: "비교 완료",
    isAutomatic: false,
    guardConditions: [],
    sideEffects: ["send_notification", "create_audit_log", "record_timeline"],
    confirmationRequired: false,
  },

  // selection_pending → selected
  {
    from: "selection_pending",
    to: "selected",
    action: "제품 선택",
    isAutomatic: false,
    guardConditions: [],
    sideEffects: ["create_audit_log", "record_timeline"],
    confirmationRequired: false,
  },

  // selected → submission_ready
  {
    from: "selected",
    to: "submission_ready",
    action: "제출 준비",
    isAutomatic: false,
    guardConditions: [
      {
        id: "doc_complete_quote",
        description: "견적에 필요한 문서가 모두 준비되었는지 확인",
        type: "document_complete",
        isMet: false,
        blockingMessage: "필수 문서가 누락되어 제출을 준비할 수 없습니다",
      },
      {
        id: "budget_ok_quote",
        description: "예산이 충분한지 확인",
        type: "budget_available",
        isMet: false,
        blockingMessage: "예산이 부족합니다. 예산 현황을 확인해 주세요",
      },
    ],
    sideEffects: ["create_audit_log", "record_timeline"],
    confirmationRequired: false,
  },

  // submission_ready → submitted
  {
    from: "submission_ready",
    to: "submitted",
    action: "견적 제출",
    isAutomatic: false,
    guardConditions: [],
    sideEffects: ["send_notification", "create_audit_log", "record_timeline", "sync_external"],
    confirmationRequired: true,
    confirmationMessage: "견적을 벤더에게 제출하시겠습니까?",
  },

  // submitted → vendor_responded
  {
    from: "submitted",
    to: "vendor_responded",
    action: "벤더 응답",
    isAutomatic: false,
    guardConditions: [],
    sideEffects: ["send_notification", "create_audit_log", "record_timeline"],
    confirmationRequired: false,
  },

  // vendor_responded → expired (자동 — 기한 초과 시)
  {
    from: "vendor_responded",
    to: "expired",
    action: "기한 만료",
    isAutomatic: true,
    guardConditions: [],
    sideEffects: ["send_notification", "create_audit_log", "record_timeline"],
    confirmationRequired: false,
  },

  // any → cancelled
  {
    from: "*",
    to: "cancelled",
    action: "취소",
    isAutomatic: false,
    guardConditions: [],
    sideEffects: ["send_notification", "create_audit_log", "record_timeline"],
    confirmationRequired: true,
    confirmationMessage: "견적을 취소하시겠습니까? 취소 후 복원할 수 없습니다.",
  },
];

// ---------------------------------------------------------------------------
// 11. StateUIMapping — 상태별 UI 매핑
// ---------------------------------------------------------------------------

/** 각 워크플로우 상태의 UI 표시 정보 */
export interface StateUIMapping {
  /** 상태 키 */
  state: string;
  /** 상태 라벨 (한국어) */
  label: string;
  /** 상태 톤 (색상 계열) */
  tone: "neutral" | "info" | "warning" | "danger" | "success" | "muted";
  /** 아이콘 이름 (Lucide 등) */
  icon?: string;
  /** 배지 변형 */
  badgeVariant: "default" | "outline" | "destructive" | "secondary";
  /** 종료 상태인지 여부 — true이면 더 이상 전이 불가 */
  isTerminal: boolean;
  /** 차단 상태인지 여부 */
  isBlocked: boolean;
}

// ---------------------------------------------------------------------------
// 12. PURCHASE_REQUEST_UI_MAP — 구매 요청 상태 UI 매핑
// ---------------------------------------------------------------------------

/** 구매 요청의 각 상태에 대한 UI 표시 정보 (한국어 라벨, 톤, 배지, 종료/차단 플래그) */
export const PURCHASE_REQUEST_UI_MAP: Record<PurchaseRequestState, StateUIMapping> = {
  draft: {
    state: "draft",
    label: "초안",
    tone: "neutral",
    icon: "FileText",
    badgeVariant: "secondary",
    isTerminal: false,
    isBlocked: false,
  },
  review_pending: {
    state: "review_pending",
    label: "검토 대기",
    tone: "info",
    icon: "Eye",
    badgeVariant: "default",
    isTerminal: false,
    isBlocked: false,
  },
  review_in_progress: {
    state: "review_in_progress",
    label: "검토 중",
    tone: "info",
    icon: "Search",
    badgeVariant: "default",
    isTerminal: false,
    isBlocked: false,
  },
  approval_pending: {
    state: "approval_pending",
    label: "승인 대기",
    tone: "warning",
    icon: "Clock",
    badgeVariant: "outline",
    isTerminal: false,
    isBlocked: false,
  },
  approved: {
    state: "approved",
    label: "승인 완료",
    tone: "success",
    icon: "CheckCircle",
    badgeVariant: "default",
    isTerminal: true,
    isBlocked: false,
  },
  rejected: {
    state: "rejected",
    label: "반려",
    tone: "danger",
    icon: "XCircle",
    badgeVariant: "destructive",
    isTerminal: false,
    isBlocked: false,
  },
  revision_requested: {
    state: "revision_requested",
    label: "수정 요청",
    tone: "warning",
    icon: "Edit",
    badgeVariant: "outline",
    isTerminal: false,
    isBlocked: false,
  },
  order_placed: {
    state: "order_placed",
    label: "발주 완료",
    tone: "success",
    icon: "ShoppingCart",
    badgeVariant: "default",
    isTerminal: false,
    isBlocked: false,
  },
  received: {
    state: "received",
    label: "입고 완료",
    tone: "success",
    icon: "Package",
    badgeVariant: "default",
    isTerminal: true,
    isBlocked: false,
  },
  cancelled: {
    state: "cancelled",
    label: "취소됨",
    tone: "muted",
    icon: "Slash",
    badgeVariant: "secondary",
    isTerminal: true,
    isBlocked: false,
  },
  blocked: {
    state: "blocked",
    label: "차단됨",
    tone: "danger",
    icon: "AlertTriangle",
    badgeVariant: "destructive",
    isTerminal: false,
    isBlocked: true,
  },
  closed: {
    state: "closed",
    label: "종료",
    tone: "muted",
    icon: "Archive",
    badgeVariant: "secondary",
    isTerminal: true,
    isBlocked: false,
  },
};

// ---------------------------------------------------------------------------
// 13. RecoveryAction — 복구 액션 유형
// ---------------------------------------------------------------------------

/** 비정상 상태에서의 복구 액션 유형 */
export type RecoveryAction =
  | "retry"
  | "reopen"
  | "cancel"
  | "override"
  | "manual_intervention"
  | "exception_routing";

// ---------------------------------------------------------------------------
// 14. RecoveryRule — 복구 규칙
// ---------------------------------------------------------------------------

/** 비정상 상태에서 수행 가능한 복구 경로 정의 */
export interface RecoveryRule {
  /** 출발 상태 */
  fromState: string;
  /** 복구 액션 유형 */
  action: RecoveryAction;
  /** 복구 후 도착 상태 */
  toState: string;
  /** 복구 액션 설명 (한국어) */
  description: string;
  /** 복구를 수행할 수 있는 역할 */
  requiredRole: string;
  /** 감사 로그 기록 필수 여부 */
  auditRequired: boolean;
  /** 복구 시 영향 범위 설명 (한국어) */
  impactDescription?: string;
}

// ---------------------------------------------------------------------------
// 15. PURCHASE_RECOVERY_RULES — 구매 요청 복구 규칙
// ---------------------------------------------------------------------------

/** 구매 요청의 비정상 상태에서 사용 가능한 복구 규칙 (6개) */
export const PURCHASE_RECOVERY_RULES: RecoveryRule[] = [
  {
    fromState: "blocked",
    action: "manual_intervention",
    toState: "review_pending",
    description: "차단 해제 후 검토 재개",
    requiredRole: "ADMIN",
    auditRequired: true,
    impactDescription: "차단 사유가 해소된 후 검토 대기열로 복귀합니다",
  },
  {
    fromState: "rejected",
    action: "reopen",
    toState: "draft",
    description: "반려 항목 재작성",
    requiredRole: "REQUESTER",
    auditRequired: true,
  },
  {
    fromState: "cancelled",
    action: "reopen",
    toState: "draft",
    description: "취소 항목 복원",
    requiredRole: "ADMIN",
    auditRequired: true,
    impactDescription: "이전 승인 이력은 유지되지만 새로운 승인 절차가 필요합니다",
  },
  {
    fromState: "timed_out",
    action: "retry",
    toState: "approval_pending",
    description: "시간 초과 승인 재요청",
    requiredRole: "APPROVER",
    auditRequired: true,
  },
  {
    fromState: "order_placed",
    action: "cancel",
    toState: "cancelled",
    description: "발주 취소",
    requiredRole: "ADMIN",
    auditRequired: true,
    impactDescription: "외부 시스템에 이미 전송된 발주는 수동 취소가 필요할 수 있습니다",
  },
  {
    fromState: "*",
    action: "exception_routing",
    toState: "blocked",
    description: "예외 처리 라우팅",
    requiredRole: "ADMIN",
    auditRequired: true,
    impactDescription: "예외 상황 발생 시 차단 상태로 전환하여 수동 개입을 유도합니다",
  },
];

// ---------------------------------------------------------------------------
// 16. getAvailableActions — 현재 상태에서 수행 가능한 액션 조회
// ---------------------------------------------------------------------------

/**
 * 주어진 엔티티 유형, 현재 상태, 사용자 역할을 기반으로
 * 수행 가능한 액션 목록을 반환한다.
 *
 * @param entityType - 워크플로우 엔티티 유형
 * @param currentState - 현재 상태
 * @param userRole - 현재 사용자의 역할
 * @returns 수행 가능한 액션 배열 (비활성 사유 포함)
 */
export function getAvailableActions(
  entityType: WorkflowEntityType,
  currentState: string,
  userRole: string,
): {
  action: string;
  toState: string;
  label: string;
  isEnabled: boolean;
  disabledReason?: string;
}[] {
  const transitions =
    entityType === "purchase_request"
      ? PURCHASE_REQUEST_TRANSITIONS
      : entityType === "quote_draft"
        ? QUOTE_DRAFT_TRANSITIONS
        : [];

  const matching = transitions.filter(
    (t) => t.from === currentState || t.from === "*",
  );

  return matching.map((t) => {
    const roleOk = !t.requiredRole || t.requiredRole === userRole || userRole === "OWNER" || userRole === "ADMIN";
    const guardsBlocking = t.guardConditions.filter((g) => !g.isMet);
    const isEnabled = roleOk && guardsBlocking.length === 0;

    let disabledReason: string | undefined;
    if (!roleOk) {
      disabledReason = `이 액션은 ${t.requiredRole} 역할이 필요합니다`;
    } else if (guardsBlocking.length > 0) {
      disabledReason = guardsBlocking
        .map((g) => g.blockingMessage || g.description)
        .join("; ");
    }

    return {
      action: t.action,
      toState: t.to,
      label: t.action,
      isEnabled,
      disabledReason,
    };
  });
}

// ---------------------------------------------------------------------------
// 17. evaluateGuards — guard 조건 일괄 평가
// ---------------------------------------------------------------------------

/**
 * guard 조건 목록을 평가하여 전체 충족 여부와 미충족 차단 조건을 반환한다.
 *
 * @param guards - 평가할 guard 조건 배열
 * @returns allMet(전체 충족 여부)과 blockers(미충족 조건 배열)
 */
export function evaluateGuards(guards: GuardCondition[]): {
  allMet: boolean;
  blockers: GuardCondition[];
} {
  const blockers = guards.filter((g) => !g.isMet);
  return {
    allMet: blockers.length === 0,
    blockers,
  };
}

// ---------------------------------------------------------------------------
// 18. WORKFLOW_ANTI_PATTERNS — 워크플로우 안티패턴
// ---------------------------------------------------------------------------

/** 워크플로우 구현 시 피해야 할 안티패턴 목록 (8개) */
export const WORKFLOW_ANTI_PATTERNS: string[] = [
  "상태 이름은 있지만 전이 규칙이 정의되지 않음",
  "UI 상태와 백엔드 상태가 불일치",
  "같은 항목이 화면마다 다른 상태 라벨",
  "액션 disabled 이유가 설명되지 않음",
  "차단 상태와 완료 상태가 같은 위계",
  "side effect가 누락되어 알림/감사 로그 빠짐",
  "rollback/reopen 규칙이 없어 복구 불가",
  "queue/detail/notification/audit가 다른 상태 정의 사용",
];

// ---------------------------------------------------------------------------
// 19. workflowCodeReviewChecklist — 코드 리뷰 체크리스트
// ---------------------------------------------------------------------------

/** 워크플로우 관련 코드 리뷰 시 확인해야 할 항목 (10개) */
export const workflowCodeReviewChecklist: string[] = [
  "모든 상태 전이가 중앙 TransitionRule에서 관리되는가",
  "각 전이에 guard 조건이 명시되어 있는가",
  "guard 미충족 시 사용자에게 차단 사유가 표시되는가",
  "side effect가 전이 정의에 선언되어 있는가",
  "side effect 실패 시 rollback/재시도 정책이 있는가",
  "UI 상태 라벨이 PURCHASE_REQUEST_UI_MAP과 일치하는가",
  "queue/detail/notification/audit/report가 동일한 상태 정의를 사용하는가",
  "blocked/rejected/cancelled에서 복구 경로(RecoveryRule)가 있는가",
  "자동 전이(isAutomatic)와 수동 전이가 명확히 구분되는가",
  "SLA/기한 초과와 상태 전이 에스컬레이션의 관계가 정의되어 있는가",
];
