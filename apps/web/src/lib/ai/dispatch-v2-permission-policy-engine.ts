/**
 * Dispatch v2 Permission / Approval / Policy Engine
 *
 * Circular procurement chain 전체에 걸친 권한·승인·정책 통제 레이어.
 * 각 stage action에 대해 role permission / approval requirement / policy constraint를 평가.
 *
 * 원칙:
 * 1. 모든 write-path action은 permission check를 거침
 * 2. irreversible action은 approval gate 필수
 * 3. policy constraint는 action 전에 평가, 위반 시 block
 * 4. recovery/override는 허용하되 elevated permission + audit 필수
 */

// ══════════════════════════════════════════════
// Role System
// ══════════════════════════════════════════════

export type ProcurementRole = "viewer" | "requester" | "operator" | "approver" | "admin" | "owner";

export interface ActorContext {
  actorId: string;
  roles: ProcurementRole[];
  organizationId: string;
  departmentId: string;
  delegatedBy: string | null;
  sessionId: string;
}

// ══════════════════════════════════════════════
// Stage Action Permission Matrix
// ══════════════════════════════════════════════

export type StageActionKey =
  // Dispatch / Send chain
  | "dispatch_preparation_review" | "dispatch_draft_assembly" | "dispatch_draft_validation"
  | "send_confirmation_review" | "send_execution_review"
  | "actual_send_action_arming" | "actual_send_transaction_review" | "actual_send_commit_review"
  | "actual_send_execute_review" | "actual_send_run_review" | "actual_send_fire_review"
  | "actual_send_fire_execute"
  // Post-fire chain
  | "sent_outcome_review" | "delivery_tracking_manage" | "supplier_ack_capture" | "supplier_ack_classify"
  | "receiving_prep_manage" | "receiving_execution_record" | "variance_disposition_set"
  | "stock_release_execute" | "reorder_trigger_evaluate"
  // Recovery / Override
  | "exception_create" | "exception_investigate" | "exception_resolve" | "exception_return_to_stage"
  | "ack_followup_manage" | "ack_followup_resolve"
  // Approval actions
  | "approve_stock_release" | "approve_reorder_trigger" | "approve_exception_override"
  | "approve_fire_execution" | "approve_recovery_return";

export type PermissionLevel = "allowed" | "requires_approval" | "denied";

export interface StageActionPermission {
  actionKey: StageActionKey;
  minimumRole: ProcurementRole;
  requiresApproval: boolean;
  approvalRole: ProcurementRole | null;
  policyConstraints: PolicyConstraintKey[];
}

// ── Permission Matrix ──
const PERMISSION_MATRIX: StageActionPermission[] = [
  // Dispatch / Send — operator level
  { actionKey: "dispatch_preparation_review", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  { actionKey: "dispatch_draft_assembly", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  { actionKey: "dispatch_draft_validation", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  { actionKey: "send_confirmation_review", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  { actionKey: "send_execution_review", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  // Arming / Transaction / Commit / Execute — operator + approval for irreversible
  { actionKey: "actual_send_action_arming", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  { actionKey: "actual_send_transaction_review", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  { actionKey: "actual_send_commit_review", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  { actionKey: "actual_send_execute_review", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  { actionKey: "actual_send_run_review", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  { actionKey: "actual_send_fire_review", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  // Fire execution — requires approver
  { actionKey: "actual_send_fire_execute", minimumRole: "operator", requiresApproval: true, approvalRole: "approver", policyConstraints: ["budget_threshold", "restricted_item"] },
  // Post-fire chain
  { actionKey: "sent_outcome_review", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  { actionKey: "delivery_tracking_manage", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  { actionKey: "supplier_ack_capture", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  { actionKey: "supplier_ack_classify", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  { actionKey: "receiving_prep_manage", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  { actionKey: "receiving_execution_record", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  { actionKey: "variance_disposition_set", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: ["variance_threshold"] },
  // Stock release — requires approval above threshold
  { actionKey: "stock_release_execute", minimumRole: "operator", requiresApproval: true, approvalRole: "approver", policyConstraints: ["budget_threshold", "location_policy"] },
  { actionKey: "reorder_trigger_evaluate", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  // Recovery — elevated permission
  { actionKey: "exception_create", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  { actionKey: "exception_investigate", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  { actionKey: "exception_resolve", minimumRole: "operator", requiresApproval: true, approvalRole: "approver", policyConstraints: [] },
  { actionKey: "exception_return_to_stage", minimumRole: "operator", requiresApproval: true, approvalRole: "approver", policyConstraints: ["reentry_matrix"] },
  { actionKey: "ack_followup_manage", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  { actionKey: "ack_followup_resolve", minimumRole: "operator", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  // Approval actions — approver/admin only
  { actionKey: "approve_stock_release", minimumRole: "approver", requiresApproval: false, approvalRole: null, policyConstraints: ["budget_threshold"] },
  { actionKey: "approve_reorder_trigger", minimumRole: "approver", requiresApproval: false, approvalRole: null, policyConstraints: ["budget_threshold"] },
  { actionKey: "approve_exception_override", minimumRole: "admin", requiresApproval: false, approvalRole: null, policyConstraints: [] },
  { actionKey: "approve_fire_execution", minimumRole: "approver", requiresApproval: false, approvalRole: null, policyConstraints: ["budget_threshold", "restricted_item"] },
  { actionKey: "approve_recovery_return", minimumRole: "approver", requiresApproval: false, approvalRole: null, policyConstraints: ["reentry_matrix"] },
];

// ══════════════════════════════════════════════
// Policy Constraint System
// ══════════════════════════════════════════════

export type PolicyConstraintKey = "budget_threshold" | "restricted_item" | "variance_threshold" | "location_policy" | "supplier_rule" | "reentry_matrix";

export interface PolicyConstraint {
  constraintKey: PolicyConstraintKey;
  label: string;
  evaluate: (context: PolicyEvaluationContext) => PolicyEvaluationResult;
}

export interface PolicyEvaluationContext {
  caseId: string;
  actionKey: StageActionKey;
  actor: ActorContext;
  totalAmount: number;
  lineCount: number;
  variancePercentage: number;
  isRestrictedItem: boolean;
  targetLocation: string;
  sourceStage: string;
  returnToStage: string | null;
}

export interface PolicyEvaluationResult {
  constraintKey: PolicyConstraintKey;
  status: "pass" | "warning" | "block";
  reason: string;
  requiresEscalation: boolean;
  escalationRole: ProcurementRole | null;
}

// ── Built-in Policy Evaluators ──
const BUDGET_THRESHOLD_LIMIT = 5000000; // 500만원
const VARIANCE_THRESHOLD_PERCENT = 10; // 10%

export const POLICY_EVALUATORS: Record<PolicyConstraintKey, (ctx: PolicyEvaluationContext) => PolicyEvaluationResult> = {
  budget_threshold: (ctx) => {
    if (ctx.totalAmount > BUDGET_THRESHOLD_LIMIT) return { constraintKey: "budget_threshold", status: "block", reason: `금액 ${ctx.totalAmount.toLocaleString()}원 > 한도 ${BUDGET_THRESHOLD_LIMIT.toLocaleString()}원 — 승인 필요`, requiresEscalation: true, escalationRole: "approver" };
    if (ctx.totalAmount > BUDGET_THRESHOLD_LIMIT * 0.8) return { constraintKey: "budget_threshold", status: "warning", reason: `금액 ${ctx.totalAmount.toLocaleString()}원 — 한도 80% 초과`, requiresEscalation: false, escalationRole: null };
    return { constraintKey: "budget_threshold", status: "pass", reason: "", requiresEscalation: false, escalationRole: null };
  },
  restricted_item: (ctx) => {
    if (ctx.isRestrictedItem) return { constraintKey: "restricted_item", status: "block", reason: "제한 품목 — 추가 승인 필요", requiresEscalation: true, escalationRole: "admin" };
    return { constraintKey: "restricted_item", status: "pass", reason: "", requiresEscalation: false, escalationRole: null };
  },
  variance_threshold: (ctx) => {
    if (ctx.variancePercentage > VARIANCE_THRESHOLD_PERCENT) return { constraintKey: "variance_threshold", status: "block", reason: `Variance ${ctx.variancePercentage}% > 한도 ${VARIANCE_THRESHOLD_PERCENT}% — 승인 필요`, requiresEscalation: true, escalationRole: "approver" };
    return { constraintKey: "variance_threshold", status: "pass", reason: "", requiresEscalation: false, escalationRole: null };
  },
  location_policy: (ctx) => {
    if (!ctx.targetLocation) return { constraintKey: "location_policy", status: "block", reason: "Location 미지정", requiresEscalation: false, escalationRole: null };
    return { constraintKey: "location_policy", status: "pass", reason: "", requiresEscalation: false, escalationRole: null };
  },
  supplier_rule: (ctx) => {
    return { constraintKey: "supplier_rule", status: "pass", reason: "", requiresEscalation: false, escalationRole: null };
  },
  reentry_matrix: (ctx) => {
    if (!ctx.returnToStage) return { constraintKey: "reentry_matrix", status: "pass", reason: "", requiresEscalation: false, escalationRole: null };
    // Re-entry matrix는 exception engine에서 이미 검증하므로 여기서는 approval 필요 여부만 확인
    return { constraintKey: "reentry_matrix", status: "warning", reason: `Return to ${ctx.returnToStage} — 승인 확인 필요`, requiresEscalation: true, escalationRole: "approver" };
  },
};

// ══════════════════════════════════════════════
// Permission Check Engine
// ══════════════════════════════════════════════

export interface PermissionCheckResult {
  actionKey: StageActionKey;
  permitted: boolean;
  permissionLevel: PermissionLevel;
  reason: string;
  requiresApproval: boolean;
  approvalRole: ProcurementRole | null;
  policyResults: PolicyEvaluationResult[];
  blockedByPolicy: boolean;
  escalationRequired: boolean;
  escalationRole: ProcurementRole | null;
}

const ROLE_HIERARCHY: Record<ProcurementRole, number> = { viewer: 0, requester: 1, operator: 2, approver: 3, admin: 4, owner: 5 };

function hasMinimumRole(actor: ActorContext, minimumRole: ProcurementRole): boolean {
  const minLevel = ROLE_HIERARCHY[minimumRole];
  return actor.roles.some(r => ROLE_HIERARCHY[r] >= minLevel);
}

export function checkPermission(actionKey: StageActionKey, actor: ActorContext, policyContext: Partial<PolicyEvaluationContext> = {}): PermissionCheckResult {
  const permission = PERMISSION_MATRIX.find(p => p.actionKey === actionKey);
  if (!permission) return { actionKey, permitted: false, permissionLevel: "denied", reason: `Unknown action: ${actionKey}`, requiresApproval: false, approvalRole: null, policyResults: [], blockedByPolicy: false, escalationRequired: false, escalationRole: null };

  // Role check
  if (!hasMinimumRole(actor, permission.minimumRole)) {
    return { actionKey, permitted: false, permissionLevel: "denied", reason: `최소 역할 ${permission.minimumRole} 필요 — 현재 역할: ${actor.roles.join(", ")}`, requiresApproval: false, approvalRole: null, policyResults: [], blockedByPolicy: false, escalationRequired: false, escalationRole: null };
  }

  // Policy evaluation
  const fullContext: PolicyEvaluationContext = { caseId: "", actionKey, actor, totalAmount: 0, lineCount: 0, variancePercentage: 0, isRestrictedItem: false, targetLocation: "", sourceStage: "", returnToStage: null, ...policyContext };
  const policyResults = permission.policyConstraints.map(key => POLICY_EVALUATORS[key](fullContext));
  const blockedByPolicy = policyResults.some(r => r.status === "block");
  const escalationRequired = policyResults.some(r => r.requiresEscalation);
  const escalationRole = policyResults.find(r => r.requiresEscalation)?.escalationRole || null;

  if (blockedByPolicy) {
    const blockReasons = policyResults.filter(r => r.status === "block").map(r => r.reason);
    return { actionKey, permitted: false, permissionLevel: "denied", reason: blockReasons.join("; "), requiresApproval: true, approvalRole: escalationRole, policyResults, blockedByPolicy: true, escalationRequired: true, escalationRole };
  }

  if (permission.requiresApproval) {
    // Check if actor can self-approve
    const canSelfApprove = permission.approvalRole && hasMinimumRole(actor, permission.approvalRole);
    if (canSelfApprove) {
      return { actionKey, permitted: true, permissionLevel: "allowed", reason: "Role sufficient for self-approval", requiresApproval: false, approvalRole: null, policyResults, blockedByPolicy: false, escalationRequired: false, escalationRole: null };
    }
    return { actionKey, permitted: false, permissionLevel: "requires_approval", reason: `${permission.approvalRole} 승인 필요`, requiresApproval: true, approvalRole: permission.approvalRole, policyResults, blockedByPolicy: false, escalationRequired, escalationRole };
  }

  return { actionKey, permitted: true, permissionLevel: "allowed", reason: "Permitted", requiresApproval: false, approvalRole: null, policyResults, blockedByPolicy: false, escalationRequired, escalationRole };
}

// ══════════════════════════════════════════════
// Approval Request / Record
// ══════════════════════════════════════════════

export type ApprovalRequestStatus = "pending" | "approved" | "rejected" | "expired" | "cancelled";

export interface ApprovalRequest {
  requestId: string;
  caseId: string;
  actionKey: StageActionKey;
  requestedBy: string;
  requestedAt: string;
  approvalRole: ProcurementRole;
  reason: string;
  policyContext: string;
  status: ApprovalRequestStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string;
}

export function createApprovalRequest(caseId: string, actionKey: StageActionKey, requestedBy: string, approvalRole: ProcurementRole, reason: string, policyContext: string): ApprovalRequest {
  return { requestId: `appreq_${Date.now().toString(36)}`, caseId, actionKey, requestedBy, requestedAt: new Date().toISOString(), approvalRole, reason, policyContext, status: "pending", decidedBy: null, decidedAt: null, decisionReason: "" };
}

export function decideApproval(request: ApprovalRequest, decision: "approved" | "rejected", decidedBy: string, reason: string): ApprovalRequest {
  return { ...request, status: decision, decidedBy, decidedAt: new Date().toISOString(), decisionReason: reason };
}

// ══════════════════════════════════════════════
// Audit Events
// ══════════════════════════════════════════════

export type PermissionEventType = "permission_check_passed" | "permission_check_denied" | "permission_check_requires_approval" | "policy_constraint_blocked" | "policy_constraint_warning" | "approval_requested" | "approval_decided" | "escalation_triggered";

export interface PermissionEvent {
  type: PermissionEventType;
  caseId: string;
  actionKey: StageActionKey;
  actorId: string;
  actorRoles: ProcurementRole[];
  result: PermissionLevel;
  reason: string;
  policyConstraints: string[];
  timestamp: string;
}

export function createPermissionEvent(type: PermissionEventType, result: PermissionCheckResult, actor: ActorContext, caseId: string): PermissionEvent {
  return { type, caseId, actionKey: result.actionKey, actorId: actor.actorId, actorRoles: actor.roles, result: result.permissionLevel, reason: result.reason, policyConstraints: result.policyResults.filter(r => r.status !== "pass").map(r => `${r.constraintKey}: ${r.reason}`), timestamp: new Date().toISOString() };
}
