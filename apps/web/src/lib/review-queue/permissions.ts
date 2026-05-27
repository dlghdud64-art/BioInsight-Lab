/**
 * Step 1~3 Role-Based Permission + Approval Routing
 *
 * 역할 기반 권한 통제 + 승인 라우팅 규칙.
 * activity-log.ts와 연결하여 모든 권한/승인 이벤트를 추적한다.
 */

// ═══════════════════════════════════════════════════
// Role Model
// ═══════════════════════════════════════════════════

export type Role =
  | "owner"
  | "admin"
  | "operator"
  | "buyer"
  | "research_lead"
  | "member"
  | "viewer";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "소유자",
  admin: "관리자",
  operator: "운영 담당",
  buyer: "구매 담당",
  research_lead: "연구 책임자",
  member: "일반 멤버",
  viewer: "조회 전용",
};

export const ROLE_PRIORITY: Record<Role, number> = {
  owner: 0,
  admin: 1,
  operator: 2,
  buyer: 3,
  research_lead: 4,
  member: 5,
  viewer: 6,
};

// ═══════════════════════════════════════════════════
// Permission Model
// ═══════════════════════════════════════════════════

export type PermissionKey =
  // Step 1
  | "review.create"
  | "review.update"
  | "review.approve"
  | "review.exclude"
  | "review.send_to_compare"
  | "review.send_to_quote_draft"
  // Step 2
  | "compare.view"
  | "compare.select_candidate"
  | "compare.confirm_selection"
  | "compare.remove"
  | "compare.send_to_quote_draft"
  // Step 3
  | "quote.view"
  | "quote.update"
  | "quote.mark_ready"
  | "quote.submit_request"
  | "quote.remove"
  // Approval
  | "approval.request"
  | "approval.review"
  | "approval.approve"
  | "approval.reject"
  // Budget/Inventory hints
  | "budget.view_hint"
  | "inventory.view_hint"
  // Organization
  | "organization.manage_permissions";

// ═══════════════════════════════════════════════════
// Role → Permission Map
// ═══════════════════════════════════════════════════

const ALL_PERMISSIONS: PermissionKey[] = [
  "review.create", "review.update", "review.approve", "review.exclude",
  "review.send_to_compare", "review.send_to_quote_draft",
  "compare.view", "compare.select_candidate", "compare.confirm_selection",
  "compare.remove", "compare.send_to_quote_draft",
  "quote.view", "quote.update", "quote.mark_ready", "quote.submit_request", "quote.remove",
  "approval.request", "approval.review", "approval.approve", "approval.reject",
  "budget.view_hint", "inventory.view_hint",
  "organization.manage_permissions",
];

export const ROLE_PERMISSIONS: Record<Role, Set<PermissionKey>> = {
  owner: new Set(ALL_PERMISSIONS),

  admin: new Set(ALL_PERMISSIONS.filter((p) => p !== "organization.manage_permissions" || true)),

  operator: new Set([
    "review.create", "review.update", "review.approve", "review.exclude",
    "review.send_to_compare", "review.send_to_quote_draft",
    "compare.view", "compare.select_candidate", "compare.confirm_selection",
    "compare.remove", "compare.send_to_quote_draft",
    "quote.view", "quote.update", "quote.mark_ready", "quote.remove",
    "approval.request", "approval.review",
    "budget.view_hint", "inventory.view_hint",
  ]),

  buyer: new Set([
    "review.create", "review.update", "review.exclude",
    "review.send_to_compare", "review.send_to_quote_draft",
    "compare.view", "compare.select_candidate", "compare.confirm_selection",
    "compare.remove", "compare.send_to_quote_draft",
    "quote.view", "quote.update", "quote.mark_ready", "quote.submit_request", "quote.remove",
    "approval.request",
    "budget.view_hint", "inventory.view_hint",
  ]),

  research_lead: new Set([
    "review.create", "review.update", "review.approve", "review.exclude",
    "review.send_to_compare",
    "compare.view", "compare.select_candidate",
    "quote.view", "quote.update",
    "approval.request",
    "budget.view_hint", "inventory.view_hint",
  ]),

  member: new Set([
    "review.create", "review.update", "review.exclude",
    "compare.view",
    "quote.view",
    "approval.request",
    "budget.view_hint", "inventory.view_hint",
  ]),

  viewer: new Set([
    "compare.view",
    "quote.view",
    "budget.view_hint",
    "inventory.view_hint",
  ]),
};

// ═══════════════════════════════════════════════════
// Permission Check
// ═══════════════════════════════════════════════════

export function hasPermission(role: Role, permission: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function getPermissions(role: Role): PermissionKey[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

/** 권한 없을 때 승인 요청으로 대체 가능한지 */
export function canRequestApprovalInstead(role: Role, permission: PermissionKey): boolean {
  if (hasPermission(role, permission)) return false; // 이미 권한 있음
  if (!hasPermission(role, "approval.request")) return false; // 승인 요청 권한도 없음
  // viewer는 승인 요청 불가
  if (role === "viewer") return false;
  return true;
}

// ═══════════════════════════════════════════════════
// Action Permission Map
// ═══════════════════════════════════════════════════

export interface ActionPermissionCheck {
  allowed: boolean;
  canRequestApproval: boolean;
  requiredPermission: PermissionKey;
  helperText: string;
  ctaLabel: string;
}

export function checkActionPermission(
  role: Role,
  permission: PermissionKey
): ActionPermissionCheck {
  const allowed = hasPermission(role, permission);
  const canRequest = canRequestApprovalInstead(role, permission);

  if (allowed) {
    return {
      allowed: true,
      canRequestApproval: false,
      requiredPermission: permission,
      helperText: "",
      ctaLabel: ACTION_CTA_LABELS[permission] ?? "실행",
    };
  }

  if (canRequest) {
    return {
      allowed: false,
      canRequestApproval: true,
      requiredPermission: permission,
      helperText: ACTION_HELPER_TEXTS[permission] ?? "이 작업은 승인이 필요합니다",
      ctaLabel: ACTION_APPROVAL_CTA_LABELS[permission] ?? "승인 요청",
    };
  }

  return {
    allowed: false,
    canRequestApproval: false,
    requiredPermission: permission,
    helperText: "이 작업에 대한 권한이 없습니다",
    ctaLabel: "",
  };
}

const ACTION_CTA_LABELS: Partial<Record<PermissionKey, string>> = {
  "review.approve": "승인",
  "review.exclude": "제외",
  "review.send_to_compare": "비교에 담기",
  "review.send_to_quote_draft": "견적 초안으로 보내기",
  "compare.confirm_selection": "선택 확정",
  "compare.send_to_quote_draft": "견적 초안으로 보내기",
  "quote.submit_request": "견적 요청 제출",
  "quote.mark_ready": "제출 준비 완료",
  "approval.approve": "승인",
  "approval.reject": "반려",
};

const ACTION_APPROVAL_CTA_LABELS: Partial<Record<PermissionKey, string>> = {
  "review.approve": "승인 요청",
  "review.send_to_quote_draft": "견적 전송 승인 요청",
  "compare.confirm_selection": "선택안 제출",
  "quote.submit_request": "견적 요청 승인 받기",
  "quote.mark_ready": "제출 준비 승인 요청",
};

const ACTION_HELPER_TEXTS: Partial<Record<PermissionKey, string>> = {
  "review.approve": "이 항목은 운영 승인 후 확정할 수 있습니다",
  "review.send_to_quote_draft": "견적 초안 전송은 승인이 필요합니다",
  "compare.confirm_selection": "선택 확정은 구매 담당 승인 후 반영됩니다",
  "quote.submit_request": "제출 전 승인 절차가 필요합니다",
  "quote.mark_ready": "제출 준비 완료는 승인이 필요합니다",
};

// ═══════════════════════════════════════════════════
// Approval Routing Rules
// ═══════════════════════════════════════════════════

export type ApprovalPriority = "high" | "medium" | "low";

export interface ApprovalRoutingRule {
  ruleId: string;
  entityType: string;
  actionType: PermissionKey;
  triggerCondition: string;
  requiredApproverRole: Role;
  fallbackApproverRole: Role;
  priority: ApprovalPriority;
}

export const DEFAULT_ROUTING_RULES: ApprovalRoutingRule[] = [
  {
    ruleId: "r1",
    entityType: "quote_draft_item",
    actionType: "quote.submit_request",
    triggerCondition: "budgetHint === budgetCheckRequired",
    requiredApproverRole: "admin",
    fallbackApproverRole: "owner",
    priority: "high",
  },
  {
    ruleId: "r2",
    entityType: "quote_draft_item",
    actionType: "quote.submit_request",
    triggerCondition: "inventoryHint === possibleDuplicatePurchase",
    requiredApproverRole: "buyer",
    fallbackApproverRole: "admin",
    priority: "high",
  },
  {
    ruleId: "r3",
    entityType: "compare_queue_item",
    actionType: "compare.confirm_selection",
    triggerCondition: "sourceType === protocol && confidence === low",
    requiredApproverRole: "research_lead",
    fallbackApproverRole: "operator",
    priority: "medium",
  },
  {
    ruleId: "r4",
    entityType: "review_queue_item",
    actionType: "review.approve",
    triggerCondition: "status === match_failed",
    requiredApproverRole: "operator",
    fallbackApproverRole: "admin",
    priority: "high",
  },
  {
    ruleId: "r5",
    entityType: "review_queue_item",
    actionType: "review.approve",
    triggerCondition: "status === review_needed",
    requiredApproverRole: "operator",
    fallbackApproverRole: "buyer",
    priority: "medium",
  },
];

/** 특정 액션에 대한 승인 라우팅 규칙 찾기 */
export function findApprovalRoutingRule(
  entityType: string,
  actionType: PermissionKey,
  context: Record<string, string | undefined>
): ApprovalRoutingRule | null {
  return DEFAULT_ROUTING_RULES.find((rule) => {
    if (rule.entityType !== entityType) return false;
    if (rule.actionType !== actionType) return false;
    // 단순 조건 매칭 (P0)
    const [field, op, value] = rule.triggerCondition.split(" ");
    if (op === "===" && context[field] === value) return true;
    return false;
  }) ?? null;
}

// ═══════════════════════════════════════════════════
// Approval Request Schema
// ═══════════════════════════════════════════════════

export type ApprovalRequestState =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "cancelled";

export interface ApprovalRequest {
  approvalRequestId: string;
  entityType: string;
  entityId: string;
  requestedAction: PermissionKey;
  requestedByUserId: string;
  requestedByRole: Role;
  requiredApproverRole: Role;
  assignedApproverUserId: string | null;
  approvalState: ApprovalRequestState;
  requestReason: string;
  supportingContext: string;
  priority: ApprovalPriority;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

/** 승인 요청 생성 */
export function createApprovalRequest(params: {
  entityType: string;
  entityId: string;
  requestedAction: PermissionKey;
  requestedByUserId: string;
  requestedByRole: Role;
  requiredApproverRole: Role;
  requestReason: string;
  supportingContext: string;
  priority?: ApprovalPriority;
}): ApprovalRequest {
  return {
    approvalRequestId: `ar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    entityType: params.entityType,
    entityId: params.entityId,
    requestedAction: params.requestedAction,
    requestedByUserId: params.requestedByUserId,
    requestedByRole: params.requestedByRole,
    requiredApproverRole: params.requiredApproverRole,
    assignedApproverUserId: null,
    approvalState: "pending_approval",
    requestReason: params.requestReason,
    supportingContext: params.supportingContext,
    priority: params.priority ?? "medium",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolutionNote: null,
  };
}

/** 승인 처리 */
export function resolveApprovalRequest(
  request: ApprovalRequest,
  decision: "approved" | "rejected",
  resolverNote: string
): ApprovalRequest {
  return {
    ...request,
    approvalState: decision,
    resolvedAt: new Date().toISOString(),
    resolutionNote: resolverNote,
  };
}

// ═══════════════════════════════════════════════════
// Approval Inbox 기초 구조
// ═══════════════════════════════════════════════════

export type ApprovalInboxFilter =
  | "all"
  | "pending"
  | "approved"
  | "rejected"
  | "my_requests"
  | "assigned_to_me";

export function filterApprovalRequests(
  requests: ApprovalRequest[],
  filter: ApprovalInboxFilter,
  currentUserId: string
): ApprovalRequest[] {
  switch (filter) {
    case "pending":
      return requests.filter((r) => r.approvalState === "pending_approval");
    case "approved":
      return requests.filter((r) => r.approvalState === "approved");
    case "rejected":
      return requests.filter((r) => r.approvalState === "rejected");
    case "my_requests":
      return requests.filter((r) => r.requestedByUserId === currentUserId);
    case "assigned_to_me":
      return requests.filter((r) => r.assignedApproverUserId === currentUserId && r.approvalState === "pending_approval");
    default:
      return requests;
  }
}
