/**
 * Ownership Governance Lifecycle Engine
 *
 * ownership 변경을 즉시 CRUD가 아니라 검토·승인·시뮬레이션 가능한 운영 변경 객체로 승격.
 *
 * LIFECYCLE:
 * draft → pending_review → approved → applied → (superseded | reverted)
 *                        ↘ rejected → draft (수정 후 재제출)
 *
 * MUTATION CLASSIFICATION:
 * - immediate: single assign (low risk) → lifecycle 생략 가능
 * - reviewed: update / deactivate → review required
 * - governed: bulk reassign / transfer / critical domain → approval + simulation required
 *
 * SOD:
 * - author ≠ reviewer
 * - self-assignment 제한 (critical domain)
 * - overloaded target block/warn
 */

import type { OwnershipRecord, OwnershipType } from "./multi-team-ownership-engine";
import type { OwnershipAuthoringAction } from "./ownership-authoring-engine";
import type { ProcurementRole } from "./dispatch-v2-permission-policy-engine";
import type { ApprovalDomain } from "./approval-inbox-projection-v2-engine";

// ══════════════════════════════════════════════
// Mutation Risk Classification
// ══════════════════════════════════════════════

export type OwnershipMutationRisk = "immediate" | "reviewed" | "governed";

const ACTION_RISK_MAP: Record<OwnershipAuthoringAction, OwnershipMutationRisk> = {
  create: "reviewed",
  update: "reviewed",
  deactivate: "reviewed",
  assign: "immediate",
  reassign: "governed",
  transfer: "governed",
};

const CRITICAL_DOMAINS: ApprovalDomain[] = ["fire_execution", "stock_release"];

export function classifyMutationRisk(
  action: OwnershipAuthoringAction,
  domain: ApprovalDomain | "all" | null,
  affectedCount: number,
): OwnershipMutationRisk {
  const base = ACTION_RISK_MAP[action] || "reviewed";
  // Elevate if critical domain or bulk
  if (base === "immediate" && domain && CRITICAL_DOMAINS.includes(domain as ApprovalDomain)) return "reviewed";
  if (base === "reviewed" && affectedCount > 3) return "governed";
  return base;
}

// ══════════════════════════════════════════════
// Change Request Status
// ══════════════════════════════════════════════

export type OwnershipChangeStatus =
  | "draft"
  | "pending_review"
  | "review_approved"
  | "review_rejected"
  | "approved"
  | "applied"
  | "superseded"
  | "reverted"
  | "cancelled";

// ══════════════════════════════════════════════
// Change Request
// ══════════════════════════════════════════════

export interface OwnershipChangeRequest {
  changeRequestId: string;
  status: OwnershipChangeStatus;
  mutationRisk: OwnershipMutationRisk;
  // What
  action: OwnershipAuthoringAction;
  targetRecords: string[]; // recordIds affected
  affectedCount: number;
  domain: ApprovalDomain | "all" | null;
  // Payload summary
  changeSummary: string;
  changeDetail: string;
  beforeSnapshot: OwnershipRecord[];
  afterSnapshot: OwnershipRecord[];
  // Schedule
  effectiveDate: string; // "immediate" or ISO date
  scheduledApply: boolean;
  // Author
  authorId: string;
  authorRole: ProcurementRole;
  authoredAt: string;
  // Review
  reviewerId: string | null;
  reviewerRole: ProcurementRole | null;
  reviewedAt: string | null;
  reviewDecision: "approved" | "rejected" | null;
  reviewComment: string;
  // Apply
  appliedAt: string | null;
  appliedBy: string | null;
  // Revert
  revertedAt: string | null;
  revertedBy: string | null;
  revertReason: string;
  // Audit
  createdAt: string;
  lastUpdatedAt: string;
}

// ══════════════════════════════════════════════
// Lifecycle Actions
// ══════════════════════════════════════════════

export type OwnershipLifecycleAction =
  | "create_draft"
  | "submit_for_review"
  | "approve_review"
  | "reject_review"
  | "apply"
  | "revert"
  | "cancel";

export interface OwnershipLifecyclePayload {
  action: OwnershipLifecycleAction;
  actor: string;
  actorRole: ProcurementRole;
  comment?: string;
  revertReason?: string;
  timestamp: string;
}

export interface OwnershipLifecycleResult {
  applied: boolean;
  rejectedReason: string | null;
  updatedRequest: OwnershipChangeRequest;
  events: OwnershipLifecycleEvent[];
}

// ══════════════════════════════════════════════
// Create Change Request
// ══════════════════════════════════════════════

export function createOwnershipChangeRequest(
  action: OwnershipAuthoringAction,
  domain: ApprovalDomain | "all" | null,
  beforeSnapshot: OwnershipRecord[],
  afterSnapshot: OwnershipRecord[],
  changeSummary: string,
  changeDetail: string,
  effectiveDate: string,
  author: string,
  authorRole: ProcurementRole,
): OwnershipChangeRequest {
  const now = new Date().toISOString();
  const affectedCount = Math.max(beforeSnapshot.length, afterSnapshot.length);
  const risk = classifyMutationRisk(action, domain, affectedCount);

  return {
    changeRequestId: `ownchg_${Date.now().toString(36)}`,
    status: risk === "immediate" ? "approved" : "draft", // immediate skips draft
    mutationRisk: risk,
    action, targetRecords: afterSnapshot.map(r => r.recordId), affectedCount, domain,
    changeSummary, changeDetail,
    beforeSnapshot, afterSnapshot,
    effectiveDate, scheduledApply: effectiveDate !== "immediate",
    authorId: author, authorRole, authoredAt: now,
    reviewerId: null, reviewerRole: null, reviewedAt: null, reviewDecision: null, reviewComment: "",
    appliedAt: risk === "immediate" ? now : null,
    appliedBy: risk === "immediate" ? author : null,
    revertedAt: null, revertedBy: null, revertReason: "",
    createdAt: now, lastUpdatedAt: now,
  };
}

// ══════════════════════════════════════════════
// Apply Lifecycle Action
// ══════════════════════════════════════════════

export function applyOwnershipLifecycle(
  request: OwnershipChangeRequest,
  payload: OwnershipLifecyclePayload,
): OwnershipLifecycleResult {
  const now = payload.timestamp;
  const events: OwnershipLifecycleEvent[] = [];
  const reject = (reason: string): OwnershipLifecycleResult => {
    events.push({ type: "ownership_lifecycle_rejected", changeRequestId: request.changeRequestId, action: payload.action, actor: payload.actor, reason, timestamp: now });
    return { applied: false, rejectedReason: reason, updatedRequest: request, events };
  };

  let u = { ...request, lastUpdatedAt: now };

  switch (payload.action) {
    case "create_draft":
      // Already created via createOwnershipChangeRequest
      break;

    case "submit_for_review": {
      if (u.status !== "draft" && u.status !== "review_rejected") return reject(`제출 불가 상태: ${u.status}`);
      u.status = "pending_review";
      events.push({ type: "ownership_submitted_for_review", changeRequestId: u.changeRequestId, action: "submit_for_review", actor: payload.actor, reason: u.changeSummary, timestamp: now });
      break;
    }

    case "approve_review": {
      if (u.status !== "pending_review") return reject(`승인 불가 상태: ${u.status}`);
      // SoD: author ≠ reviewer
      if (payload.actor === u.authorId) return reject("작성자가 직접 승인할 수 없습니다 (SoD)");
      u.status = "approved";
      u.reviewerId = payload.actor;
      u.reviewerRole = payload.actorRole;
      u.reviewedAt = now;
      u.reviewDecision = "approved";
      u.reviewComment = payload.comment || "";
      events.push({ type: "ownership_review_approved", changeRequestId: u.changeRequestId, action: "approve_review", actor: payload.actor, reason: payload.comment || "", timestamp: now });
      break;
    }

    case "reject_review": {
      if (u.status !== "pending_review") return reject(`거부 불가 상태: ${u.status}`);
      u.status = "review_rejected";
      u.reviewerId = payload.actor;
      u.reviewerRole = payload.actorRole;
      u.reviewedAt = now;
      u.reviewDecision = "rejected";
      u.reviewComment = payload.comment || "";
      events.push({ type: "ownership_review_rejected", changeRequestId: u.changeRequestId, action: "reject_review", actor: payload.actor, reason: payload.comment || "", timestamp: now });
      break;
    }

    case "apply": {
      if (u.status !== "approved") return reject(`적용 불가 상태: ${u.status}`);
      // Check effective date
      if (u.scheduledApply && u.effectiveDate !== "immediate") {
        const effectiveTime = new Date(u.effectiveDate).getTime();
        const nowTime = new Date(now).getTime();
        if (effectiveTime > nowTime) return reject(`예약 적용 시점(${u.effectiveDate}) 미도래`);
      }
      u.status = "applied";
      u.appliedAt = now;
      u.appliedBy = payload.actor;
      events.push({ type: "ownership_change_applied", changeRequestId: u.changeRequestId, action: "apply", actor: payload.actor, reason: `${u.affectedCount}건 적용`, timestamp: now });
      break;
    }

    case "revert": {
      if (u.status !== "applied") return reject(`롤백 불가 상태: ${u.status}`);
      u.status = "reverted";
      u.revertedAt = now;
      u.revertedBy = payload.actor;
      u.revertReason = payload.revertReason || "Manual revert";
      events.push({ type: "ownership_change_reverted", changeRequestId: u.changeRequestId, action: "revert", actor: payload.actor, reason: payload.revertReason || "", timestamp: now });
      break;
    }

    case "cancel": {
      if (u.status === "applied" || u.status === "reverted") return reject(`취소 불가 상태: ${u.status}`);
      u.status = "cancelled";
      events.push({ type: "ownership_change_cancelled", changeRequestId: u.changeRequestId, action: "cancel", actor: payload.actor, reason: payload.comment || "", timestamp: now });
      break;
    }

    default:
      return reject(`Unknown action: ${payload.action}`);
  }

  return { applied: true, rejectedReason: null, updatedRequest: u, events };
}

// ══════════════════════════════════════════════
// Bulk Mutation Guard
// ══════════════════════════════════════════════

export interface BulkMutationGuardResult {
  allowed: boolean;
  riskLevel: OwnershipMutationRisk;
  requiresReview: boolean;
  requiresApproval: boolean;
  requiresSimulation: boolean;
  warnings: string[];
  blockReasons: string[];
}

export function checkBulkMutationGuard(
  action: OwnershipAuthoringAction,
  domain: ApprovalDomain | "all" | null,
  affectedCount: number,
  targetOwnerCurrentLoad: number,
): BulkMutationGuardResult {
  const risk = classifyMutationRisk(action, domain, affectedCount);
  const warnings: string[] = [];
  const blockReasons: string[] = [];

  // Overload check
  if (action === "reassign" && targetOwnerCurrentLoad > 80) {
    blockReasons.push(`대상 owner load score ${targetOwnerCurrentLoad} — 과부하 대상에 추가 배정 차단`);
  } else if (action === "reassign" && targetOwnerCurrentLoad > 50) {
    warnings.push(`대상 owner load score ${targetOwnerCurrentLoad} — 추가 배정 주의`);
  }

  // Bulk size check
  if (affectedCount > 10) {
    warnings.push(`${affectedCount}건 일괄 변경 — 시뮬레이션 권장`);
  }

  // Critical domain check
  if (domain && CRITICAL_DOMAINS.includes(domain as ApprovalDomain)) {
    warnings.push(`${domain}는 고위험 도메인 — 변경 영향 확인 필요`);
  }

  return {
    allowed: blockReasons.length === 0,
    riskLevel: risk,
    requiresReview: risk !== "immediate",
    requiresApproval: risk === "governed",
    requiresSimulation: risk === "governed" || affectedCount > 5,
    warnings,
    blockReasons,
  };
}

// ══════════════════════════════════════════════
// Ownership Change Explainability
// ══════════════════════════════════════════════

export interface OwnershipChangeExplanation {
  changeRequestId: string;
  action: OwnershipAuthoringAction;
  whyThisChange: string;
  whyThisOwner: string;
  whyApprovalNeeded: string;
  affectedQueues: string[];
  affectedCaseCount: number;
  beforeOwnerMapping: Array<{ type: OwnershipType; owner: string }>;
  afterOwnerMapping: Array<{ type: OwnershipType; owner: string }>;
  escalationPathDiff: string;
  fallbackPathDiff: string;
}

export function buildOwnershipChangeExplanation(
  request: OwnershipChangeRequest,
): OwnershipChangeExplanation {
  const beforeMapping = request.beforeSnapshot.map(r => ({ type: r.ownershipType, owner: r.ownerName }));
  const afterMapping = request.afterSnapshot.map(r => ({ type: r.ownershipType, owner: r.ownerName }));

  return {
    changeRequestId: request.changeRequestId,
    action: request.action,
    whyThisChange: request.changeDetail || request.changeSummary,
    whyThisOwner: request.afterSnapshot.length > 0
      ? `${request.afterSnapshot[0].ownerName} (${request.afterSnapshot[0].scopeType}:${request.afterSnapshot[0].scopeLabel})`
      : "변경 후 owner 없음",
    whyApprovalNeeded: request.mutationRisk === "governed"
      ? `고위험 변경 (${request.action}, ${request.affectedCount}건) — 승인 필요`
      : request.mutationRisk === "reviewed"
        ? `검토 필요 변경 — 작성자 ≠ 검토자`
        : "즉시 적용 가능",
    affectedQueues: [...new Set(request.afterSnapshot.map(r => r.domain || "all").filter(Boolean))] as string[],
    affectedCaseCount: request.affectedCount,
    beforeOwnerMapping: beforeMapping,
    afterOwnerMapping: afterMapping,
    escalationPathDiff: beforeMapping.length !== afterMapping.length
      ? `에스컬레이션 경로 변경: ${beforeMapping.length} → ${afterMapping.length} owner(s)`
      : "에스컬레이션 경로 동일",
    fallbackPathDiff: request.beforeSnapshot.some(r => r.fallbackOwnerId) !== request.afterSnapshot.some(r => r.fallbackOwnerId)
      ? "Fallback owner 변경됨"
      : "Fallback owner 동일",
  };
}

// ══════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════

export type OwnershipLifecycleEventType =
  | "ownership_submitted_for_review"
  | "ownership_review_approved"
  | "ownership_review_rejected"
  | "ownership_change_applied"
  | "ownership_change_reverted"
  | "ownership_change_cancelled"
  | "ownership_lifecycle_rejected";

export interface OwnershipLifecycleEvent {
  type: OwnershipLifecycleEventType;
  changeRequestId: string;
  action: OwnershipLifecycleAction;
  actor: string;
  reason: string;
  timestamp: string;
}
