/**
 * Approval Inbox Projection v2 Engine — pending approvals 수집/투영
 *
 * approver가 조직 전체의 승인 대기 건을 한눈에 파악할 수 있도록 투영.
 * 개별 approval workbench (fire / stock / exception)의 상태를 수집해서
 * 통합 ApprovalInboxItem으로 정규화.
 *
 * SOURCE OF TRUTH:
 * - FireApprovalSessionV2 → fire approval items
 * - StockReleaseApprovalSessionV2 → stock release approval items
 * - ExceptionApprovalSessionV2 → exception approval items
 *
 * PROJECTION RULES:
 * - pending_approval / approval_in_progress / approved_pending_consume / change_requested → inbox visible
 * - rejected / expired / snapshot_consumed_*_unlocked → inbox에서 제거 (history only)
 * - escalated → escalation 대기 별도 표시
 * - snapshot_invalidated → reapproval_required로 재표시
 */

import type { StageActionKey, ProcurementRole, ActionRiskTier } from "./dispatch-v2-permission-policy-engine";

// ── Approval Domain ──
export type ApprovalDomain = "fire_execution" | "stock_release" | "exception_resolve" | "exception_return_to_stage";

// ── Inbox Item Status ──
export type ApprovalInboxItemStatus =
  | "pending_review"
  | "in_review"
  | "approved_pending_consume"
  | "reapproval_required"
  | "escalation_pending"
  | "change_requested"
  | "expired_needs_action";

// ── Urgency Level ──
export type ApprovalUrgencyLevel = "critical" | "high" | "medium" | "low";

// ── Inbox Item ──
export interface ApprovalInboxItemV2 {
  inboxItemId: string;
  // Identity
  caseId: string;
  domain: ApprovalDomain;
  actionKey: StageActionKey;
  riskTier: ActionRiskTier;
  // Source reference
  sourceSessionId: string;
  sourceGateId: string;
  sourceWorkbenchId: string | null;
  // Status
  itemStatus: ApprovalInboxItemStatus;
  urgencyLevel: ApprovalUrgencyLevel;
  // Requester
  requestedBy: string;
  requestedByRole: ProcurementRole;
  requestedAt: string;
  // Approval target
  requiredApproverRole: ProcurementRole;
  assignedApprover: string | null;
  // Content summary
  objectSummary: string;
  totalAmount: number;
  affectedLineCount: number;
  // Risk indicators
  selfApprovalBlocked: boolean;
  dualApprovalRequired: boolean;
  policyBlockerCount: number;
  policyWarningCount: number;
  blockerSummary: string[];
  // Snapshot state
  hasSnapshot: boolean;
  snapshotExpiringSoon: boolean;
  snapshotExpiresAt: string | null;
  snapshotInvalidated: boolean;
  // SoD
  sodViolationDetected: boolean;
  sodViolationDetail: string;
  // Escalation
  escalationRequired: boolean;
  escalationRole: ProcurementRole | null;
  escalationReason: string;
  // Timing
  ageMinutes: number;
  slaDeadline: string | null;
  slaBreached: boolean;
  // Exception-specific
  exceptionSourceStage: string | null;
  exceptionReturnTarget: string | null;
  exceptionSeverity: string | null;
  // Audit
  lastActivityAt: string;
  lastActivityBy: string;
  lastActivityAction: string;
}

// ── Inbox Source (개별 domain에서 주입) ──
export interface ApprovalInboxSource {
  domain: ApprovalDomain;
  sessionId: string;
  gateId: string;
  workbenchId: string | null;
  caseId: string;
  actionKey: StageActionKey;
  riskTier: ActionRiskTier;
  sessionStatus: string;
  requestedBy: string;
  requestedByRole: ProcurementRole;
  requestedAt: string;
  requiredApproverRole: ProcurementRole;
  assignedApprover: string | null;
  objectSummary: string;
  totalAmount: number;
  affectedLineCount: number;
  selfApprovalBlocked: boolean;
  dualApprovalRequired: boolean;
  policyBlockerCount: number;
  policyWarningCount: number;
  blockerSummary: string[];
  hasSnapshot: boolean;
  snapshotExpiresAt: string | null;
  snapshotInvalidated: boolean;
  sodViolationDetected: boolean;
  sodViolationDetail: string;
  escalationRequired: boolean;
  escalationRole: ProcurementRole | null;
  escalationReason: string;
  // Exception-specific (optional)
  exceptionSourceStage?: string;
  exceptionReturnTarget?: string;
  exceptionSeverity?: string;
  // Activity
  lastActivityAt: string;
  lastActivityBy: string;
  lastActivityAction: string;
}

// ── Status Mapping ──
const STATUS_MAP: Record<string, ApprovalInboxItemStatus | null> = {
  pending_approval: "pending_review",
  approval_in_progress: "in_review",
  approved_pending_consume: "approved_pending_consume",
  change_requested: "change_requested",
  snapshot_invalidated: "reapproval_required",
  escalated: "escalation_pending",
  expired: "expired_needs_action",
  // Terminal statuses → not in inbox
  snapshot_consumed_fire_unlocked: null,
  snapshot_consumed_release_unlocked: null,
  snapshot_consumed_recovery_unlocked: null,
  rejected: null,
};

// ── Project Inbox Items ──
export function projectApprovalInbox(
  sources: ApprovalInboxSource[],
  now: Date = new Date(),
): ApprovalInboxItemV2[] {
  const items: ApprovalInboxItemV2[] = [];

  for (const src of sources) {
    const mappedStatus = STATUS_MAP[src.sessionStatus];
    if (mappedStatus === null || mappedStatus === undefined) continue;

    const requestedAt = new Date(src.requestedAt);
    const ageMinutes = Math.floor((now.getTime() - requestedAt.getTime()) / 60000);

    // Snapshot expiry check
    const snapshotExpiringSoon = src.snapshotExpiresAt
      ? (new Date(src.snapshotExpiresAt).getTime() - now.getTime()) < 2 * 60 * 60 * 1000 // < 2 hours
      : false;

    // Urgency calculation
    const urgency = computeUrgency(src, ageMinutes, snapshotExpiringSoon);

    items.push({
      inboxItemId: `inbx_${src.sessionId}_${Date.now().toString(36)}`,
      caseId: src.caseId,
      domain: src.domain,
      actionKey: src.actionKey,
      riskTier: src.riskTier,
      sourceSessionId: src.sessionId,
      sourceGateId: src.gateId,
      sourceWorkbenchId: src.workbenchId,
      itemStatus: mappedStatus,
      urgencyLevel: urgency,
      requestedBy: src.requestedBy,
      requestedByRole: src.requestedByRole,
      requestedAt: src.requestedAt,
      requiredApproverRole: src.requiredApproverRole,
      assignedApprover: src.assignedApprover,
      objectSummary: src.objectSummary,
      totalAmount: src.totalAmount,
      affectedLineCount: src.affectedLineCount,
      selfApprovalBlocked: src.selfApprovalBlocked,
      dualApprovalRequired: src.dualApprovalRequired,
      policyBlockerCount: src.policyBlockerCount,
      policyWarningCount: src.policyWarningCount,
      blockerSummary: src.blockerSummary,
      hasSnapshot: src.hasSnapshot,
      snapshotExpiringSoon,
      snapshotExpiresAt: src.snapshotExpiresAt,
      snapshotInvalidated: src.snapshotInvalidated,
      sodViolationDetected: src.sodViolationDetected,
      sodViolationDetail: src.sodViolationDetail,
      escalationRequired: src.escalationRequired,
      escalationRole: src.escalationRole,
      escalationReason: src.escalationReason,
      ageMinutes,
      slaDeadline: null, // SLA는 조직 설정에서 주입
      slaBreached: ageMinutes > 480, // 8시간 default SLA
      exceptionSourceStage: src.exceptionSourceStage || null,
      exceptionReturnTarget: src.exceptionReturnTarget || null,
      exceptionSeverity: src.exceptionSeverity || null,
      lastActivityAt: src.lastActivityAt,
      lastActivityBy: src.lastActivityBy,
      lastActivityAction: src.lastActivityAction,
    });
  }

  return items;
}

function computeUrgency(
  src: ApprovalInboxSource,
  ageMinutes: number,
  snapshotExpiringSoon: boolean,
): ApprovalUrgencyLevel {
  // Critical: Tier 3 + policy blocker + escalation
  if (src.riskTier === "tier3_irreversible" && src.escalationRequired) return "critical";
  if (src.riskTier === "tier3_irreversible" && src.snapshotInvalidated) return "critical";
  if (src.riskTier === "tier3_irreversible" && snapshotExpiringSoon) return "critical";

  // High: Tier 3 or exception with high severity
  if (src.riskTier === "tier3_irreversible") return "high";
  if (src.exceptionSeverity === "critical" || src.exceptionSeverity === "high") return "high";
  if (snapshotExpiringSoon) return "high";
  if (ageMinutes > 240) return "high"; // > 4 hours

  // Medium: Tier 2 or moderate age
  if (src.riskTier === "tier2_org_impact") return "medium";
  if (ageMinutes > 60) return "medium"; // > 1 hour

  // Low: everything else
  return "low";
}

// ── Inbox Summary ──
export interface ApprovalInboxSummaryV2 {
  totalPending: number;
  byDomain: Record<ApprovalDomain, number>;
  byUrgency: Record<ApprovalUrgencyLevel, number>;
  byStatus: Record<ApprovalInboxItemStatus, number>;
  escalationPending: number;
  reapprovalRequired: number;
  snapshotExpiringSoon: number;
  slaBreached: number;
  sodViolations: number;
  oldestPendingAge: number;
  generatedAt: string;
}

export function computeInboxSummary(items: ApprovalInboxItemV2[]): ApprovalInboxSummaryV2 {
  const byDomain: Record<ApprovalDomain, number> = { fire_execution: 0, stock_release: 0, exception_resolve: 0, exception_return_to_stage: 0 };
  const byUrgency: Record<ApprovalUrgencyLevel, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const byStatus: Record<ApprovalInboxItemStatus, number> = { pending_review: 0, in_review: 0, approved_pending_consume: 0, reapproval_required: 0, escalation_pending: 0, change_requested: 0, expired_needs_action: 0 };

  let escalationPending = 0;
  let reapprovalRequired = 0;
  let snapshotExpiringSoon = 0;
  let slaBreached = 0;
  let sodViolations = 0;
  let oldestAge = 0;

  for (const item of items) {
    byDomain[item.domain]++;
    byUrgency[item.urgencyLevel]++;
    byStatus[item.itemStatus]++;
    if (item.escalationRequired) escalationPending++;
    if (item.itemStatus === "reapproval_required") reapprovalRequired++;
    if (item.snapshotExpiringSoon) snapshotExpiringSoon++;
    if (item.slaBreached) slaBreached++;
    if (item.sodViolationDetected) sodViolations++;
    if (item.ageMinutes > oldestAge) oldestAge = item.ageMinutes;
  }

  return {
    totalPending: items.length,
    byDomain, byUrgency, byStatus,
    escalationPending, reapprovalRequired, snapshotExpiringSoon,
    slaBreached, sodViolations, oldestPendingAge: oldestAge,
    generatedAt: new Date().toISOString(),
  };
}

// ── Events ──
export type ApprovalInboxEventType = "inbox_projected" | "inbox_item_assigned" | "inbox_item_escalated" | "inbox_sla_breached";
export interface ApprovalInboxEvent { type: ApprovalInboxEventType; caseId: string; itemId: string; domain: ApprovalDomain; actorId: string; reason: string; timestamp: string; }
