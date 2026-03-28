/**
 * Policy Drift Invalidation Engine — active policy 변경 시 in-flight approval 무효화 규칙
 *
 * PROBLEM:
 * policy가 변경(publish/rollback)되면, 기존 approval snapshot은
 * 옛 policy 기준으로 발급된 것이므로 현재 policy와 불일치할 수 있음.
 *
 * RULES:
 * 1. policy publish → 동일 scope의 pending approval sessions invalidate
 * 2. policy rollback → 동일 scope의 all in-flight approvals invalidate
 * 3. invalidation은 "차단"이 아니라 "재평가 필요" 상태 전환
 * 4. consumed snapshot은 retroactive invalidation 불가 (이미 실행됨)
 * 5. inbox items은 stale 표시 + explanation refresh 요구
 *
 * INVALIDATION MATRIX:
 * | Policy Event    | Pending Approval | Approved (unconsumed) | Consumed | Inbox Items |
 * |-----------------|------------------|-----------------------|----------|-------------|
 * | publish         | invalidate       | invalidate            | no-op    | mark stale  |
 * | rollback        | invalidate       | invalidate            | no-op    | mark stale  |
 * | draft created   | no-op            | no-op                 | no-op    | no-op       |
 * | draft edited    | no-op            | no-op                 | no-op    | no-op       |
 * | review approved | no-op            | no-op                 | no-op    | warning     |
 */

import type { OrgPolicyDomain, OrgPolicyScopeType } from "./organization-policy-engine";
import type { PolicyVersionStatus, PolicyLifecycleEventType } from "./policy-admin-lifecycle-engine";
import type { ApprovalDomain } from "./approval-inbox-projection-v2-engine";

// ── Policy Change Event (trigger) ──
export interface PolicyChangeEvent {
  eventType: PolicyLifecycleEventType;
  policySetId: string;
  versionId: string;
  domain: OrgPolicyDomain;
  scopeType: OrgPolicyScopeType;
  scopeId: string;
  previousVersionId: string | null;
  actor: string;
  timestamp: string;
}

// ── Invalidation Target ──
export type InvalidationTargetType = "approval_session" | "approval_snapshot" | "inbox_item" | "explanation_payload";

export interface InvalidationTarget {
  targetType: InvalidationTargetType;
  targetId: string;
  caseId: string;
  domain: ApprovalDomain;
  currentStatus: string;
  /** consumed snapshot은 invalidation 불가 */
  isConsumed: boolean;
}

// ── Invalidation Decision ──
export type InvalidationAction = "invalidate" | "mark_stale" | "warning" | "no_op";

export interface InvalidationDecision {
  target: InvalidationTarget;
  action: InvalidationAction;
  reason: string;
  requiresReapproval: boolean;
  requiresExplanationRefresh: boolean;
  policyChangeRef: string;
}

// ── Invalidation Result ──
export interface PolicyDriftInvalidationResult {
  policyChangeEvent: PolicyChangeEvent;
  decisions: InvalidationDecision[];
  totalInvalidated: number;
  totalMarkedStale: number;
  totalWarnings: number;
  totalNoOp: number;
  summary: string;
  generatedAt: string;
}

// ── Compute Invalidations ──
export function computePolicyDriftInvalidations(
  changeEvent: PolicyChangeEvent,
  targets: InvalidationTarget[],
): PolicyDriftInvalidationResult {
  const decisions: InvalidationDecision[] = [];
  const isPublishOrRollback = changeEvent.eventType === "policy_published" || changeEvent.eventType === "policy_rolled_back";
  const isReviewApproved = changeEvent.eventType === "policy_review_approved";

  for (const target of targets) {
    // Rule: consumed snapshots are never retroactively invalidated
    if (target.isConsumed) {
      decisions.push({
        target, action: "no_op",
        reason: "이미 소비된 snapshot — retroactive invalidation 불가",
        requiresReapproval: false, requiresExplanationRefresh: false,
        policyChangeRef: changeEvent.versionId,
      });
      continue;
    }

    // Rule: only same-domain targets are affected
    if (!isDomainAffected(changeEvent.domain, target.domain)) {
      decisions.push({
        target, action: "no_op",
        reason: "다른 domain — 영향 없음",
        requiresReapproval: false, requiresExplanationRefresh: false,
        policyChangeRef: changeEvent.versionId,
      });
      continue;
    }

    if (isPublishOrRollback) {
      switch (target.targetType) {
        case "approval_session":
          decisions.push({
            target, action: "invalidate",
            reason: `Policy ${changeEvent.eventType}: 동일 scope(${changeEvent.scopeType}:${changeEvent.scopeId})의 approval session invalidation`,
            requiresReapproval: true, requiresExplanationRefresh: true,
            policyChangeRef: changeEvent.versionId,
          });
          break;

        case "approval_snapshot":
          decisions.push({
            target, action: "invalidate",
            reason: `Policy ${changeEvent.eventType}: 미소비 snapshot invalidation — 새 policy 기준으로 재승인 필요`,
            requiresReapproval: true, requiresExplanationRefresh: true,
            policyChangeRef: changeEvent.versionId,
          });
          break;

        case "inbox_item":
          decisions.push({
            target, action: "mark_stale",
            reason: `Policy ${changeEvent.eventType}: inbox item stale 표시 — explanation refresh 필요`,
            requiresReapproval: false, requiresExplanationRefresh: true,
            policyChangeRef: changeEvent.versionId,
          });
          break;

        case "explanation_payload":
          decisions.push({
            target, action: "mark_stale",
            reason: `Policy ${changeEvent.eventType}: explanation payload stale — 재생성 필요`,
            requiresReapproval: false, requiresExplanationRefresh: true,
            policyChangeRef: changeEvent.versionId,
          });
          break;
      }
    } else if (isReviewApproved) {
      // Review approved: warning only (publish 아직 안 됨)
      if (target.targetType === "inbox_item") {
        decisions.push({
          target, action: "warning",
          reason: "Policy review 승인됨 — 곧 publish될 수 있음. 현재 approval 진행 주의",
          requiresReapproval: false, requiresExplanationRefresh: false,
          policyChangeRef: changeEvent.versionId,
        });
      } else {
        decisions.push({
          target, action: "no_op",
          reason: "Review 승인 단계 — 아직 active 변경 아님",
          requiresReapproval: false, requiresExplanationRefresh: false,
          policyChangeRef: changeEvent.versionId,
        });
      }
    } else {
      // Draft created/edited: no-op
      decisions.push({
        target, action: "no_op",
        reason: "Draft 변경 — active policy 영향 없음",
        requiresReapproval: false, requiresExplanationRefresh: false,
        policyChangeRef: changeEvent.versionId,
      });
    }
  }

  const invalidated = decisions.filter(d => d.action === "invalidate").length;
  const stale = decisions.filter(d => d.action === "mark_stale").length;
  const warnings = decisions.filter(d => d.action === "warning").length;
  const noOp = decisions.filter(d => d.action === "no_op").length;

  return {
    policyChangeEvent: changeEvent,
    decisions,
    totalInvalidated: invalidated,
    totalMarkedStale: stale,
    totalWarnings: warnings,
    totalNoOp: noOp,
    summary: `Policy drift: ${invalidated} invalidated, ${stale} stale, ${warnings} warnings, ${noOp} no-op`,
    generatedAt: new Date().toISOString(),
  };
}

// ── Domain Affinity ──
const POLICY_DOMAIN_TO_APPROVAL_DOMAIN: Record<OrgPolicyDomain, ApprovalDomain[]> = {
  budget: ["fire_execution", "stock_release", "exception_resolve", "exception_return_to_stage"],
  vendor: ["fire_execution"],
  release: ["stock_release"],
  restricted_item: ["fire_execution", "stock_release"],
  reorder: ["stock_release"],
  sod_exception: ["fire_execution", "stock_release", "exception_resolve", "exception_return_to_stage"],
};

function isDomainAffected(policyDomain: OrgPolicyDomain, approvalDomain: ApprovalDomain): boolean {
  const affected = POLICY_DOMAIN_TO_APPROVAL_DOMAIN[policyDomain];
  return affected ? affected.includes(approvalDomain) : false;
}

// ── Snapshot Policy Version Guard ──
export interface SnapshotPolicyVersionCheck {
  snapshotId: string;
  snapshotPolicyVersionId: string;
  currentActivePolicyVersionId: string;
  versionsMatch: boolean;
  driftDetected: boolean;
  driftReason: string;
}

/**
 * checkSnapshotPolicyVersion — snapshot이 발급된 policy version과 현재 active version 비교
 * consume 전에 반드시 호출.
 */
export function checkSnapshotPolicyVersion(
  snapshotId: string,
  snapshotPolicyVersionId: string,
  currentActivePolicyVersionId: string,
): SnapshotPolicyVersionCheck {
  const match = snapshotPolicyVersionId === currentActivePolicyVersionId;
  return {
    snapshotId,
    snapshotPolicyVersionId,
    currentActivePolicyVersionId,
    versionsMatch: match,
    driftDetected: !match,
    driftReason: match ? "" : `Snapshot은 policy v${snapshotPolicyVersionId} 기준이지만 현재 active는 v${currentActivePolicyVersionId} — policy drift 감지. 재승인 필요`,
  };
}

// ── Cross-Session Stale Contract ──
export interface CrossSessionStaleCheck {
  sessionId: string;
  caseId: string;
  domain: ApprovalDomain;
  /** session이 열린 시점의 policy version */
  sessionPolicyVersionId: string;
  /** 현재 active policy version */
  currentPolicyVersionId: string;
  /** session이 열린 시점의 explanation payload generatedAt */
  sessionExplanationGeneratedAt: string;
  /** 현재 explanation payload generatedAt */
  currentExplanationGeneratedAt: string;
  // Results
  policyDrifted: boolean;
  explanationOutdated: boolean;
  isStale: boolean;
  staleReason: string;
  recommendedAction: "continue" | "refresh_explanation" | "reapproval_required" | "session_invalid";
}

export function checkCrossSessionStale(
  sessionId: string,
  caseId: string,
  domain: ApprovalDomain,
  sessionPolicyVersionId: string,
  currentPolicyVersionId: string,
  sessionExplanationGeneratedAt: string,
  currentExplanationGeneratedAt: string,
): CrossSessionStaleCheck {
  const policyDrifted = sessionPolicyVersionId !== currentPolicyVersionId;
  const explanationOutdated = sessionExplanationGeneratedAt < currentExplanationGeneratedAt;
  const isStale = policyDrifted || explanationOutdated;

  let recommendedAction: CrossSessionStaleCheck["recommendedAction"];
  let staleReason = "";

  if (policyDrifted) {
    recommendedAction = "reapproval_required";
    staleReason = `Policy version 변경됨 (${sessionPolicyVersionId} → ${currentPolicyVersionId}) — 재승인 필요`;
  } else if (explanationOutdated) {
    recommendedAction = "refresh_explanation";
    staleReason = "Explanation payload가 갱신됨 — 새로고침 필요";
  } else {
    recommendedAction = "continue";
  }

  return {
    sessionId, caseId, domain,
    sessionPolicyVersionId, currentPolicyVersionId,
    sessionExplanationGeneratedAt, currentExplanationGeneratedAt,
    policyDrifted, explanationOutdated, isStale, staleReason, recommendedAction,
  };
}

// ── Events ──
export type PolicyDriftEventType = "policy_drift_detected" | "approval_invalidated_by_drift" | "snapshot_invalidated_by_drift" | "inbox_stale_by_drift" | "explanation_stale_by_drift" | "cross_session_stale_detected";
export interface PolicyDriftEvent { type: PolicyDriftEventType; policySetId: string; versionId: string; targetId: string; targetType: InvalidationTargetType; action: InvalidationAction; reason: string; timestamp: string; }
