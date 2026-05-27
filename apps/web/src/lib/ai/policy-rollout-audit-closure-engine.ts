/**
 * Policy Rollout / Audit Closure Engine
 *
 * 어떤 정책 버전이 어느 ownership set에 적용됐는지,
 * rollout 결과가 정상/부분 실패/보류/롤백인지,
 * 사후 감사에서 explainability와 decision snapshot이 닫히는지.
 *
 * ROLLOUT TRACKING:
 * - policy version → target ownership scopes → apply status
 * - staged rollout (scope 단위 점진 적용)
 * - partial failure → remediation or rollback
 *
 * AUDIT CLOSURE:
 * - input snapshot (what was the state before)
 * - policy version at decision time
 * - reviewer decision rationale
 * - simulation summary at decision time
 * - effective date 기준 판단 근거
 * - applied/reverted linkage
 */

import type { OrgPolicyDomain, OrgPolicyScopeType } from "./organization-policy-engine";

// ══════════════════════════════════════════════
// Rollout Status
// ══════════════════════════════════════════════

export type RolloutStatus = "planned" | "in_progress" | "completed" | "partial_failure" | "paused" | "rolled_back" | "cancelled";

// ══════════════════════════════════════════════
// Rollout Record
// ══════════════════════════════════════════════

export interface PolicyRolloutRecord {
  rolloutId: string;
  // What
  policySetId: string;
  policyVersionId: string;
  policyDomain: OrgPolicyDomain;
  changeType: "publish" | "rollback";
  // Scope
  targetScopes: RolloutScope[];
  totalScopes: number;
  completedScopes: number;
  failedScopes: number;
  // Status
  status: RolloutStatus;
  // Timing
  plannedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  // Actor
  initiatedBy: string;
  // Audit snapshot
  auditSnapshot: RolloutAuditSnapshot;
}

export interface RolloutScope {
  scopeType: OrgPolicyScopeType;
  scopeId: string;
  scopeLabel: string;
  status: "pending" | "applied" | "failed" | "skipped" | "rolled_back";
  appliedAt: string | null;
  failureReason: string;
  affectedOwnershipRecordIds: string[];
  affectedApprovalSessionIds: string[];
}

// ══════════════════════════════════════════════
// Audit Snapshot (감사 폐쇄용)
// ══════════════════════════════════════════════

export interface RolloutAuditSnapshot {
  // Input state
  beforePolicyVersionId: string | null;
  beforeRuleCount: number;
  afterRuleCount: number;
  // Decision context
  decisionMaker: string;
  decisionMakerRole: string;
  decisionRationale: string;
  decisionTimestamp: string;
  // Review
  reviewerId: string | null;
  reviewDecision: "approved" | "rejected" | null;
  reviewComment: string;
  // Simulation at decision time
  simulationSummary: string;
  simulationImpact: "tightened" | "relaxed" | "mixed" | "neutral" | null;
  simulationWarnings: string[];
  // Effective date
  effectiveDate: string;
  effectiveDateBasis: string;
  // Applied/Reverted linkage
  appliedTimestamp: string | null;
  revertedTimestamp: string | null;
  revertReason: string;
  // Invalidation
  invalidatedApprovalCount: number;
  invalidatedSnapshotCount: number;
  staleInboxItemCount: number;
}

// ══════════════════════════════════════════════
// Create Rollout
// ══════════════════════════════════════════════

export function createPolicyRollout(
  policySetId: string,
  policyVersionId: string,
  policyDomain: OrgPolicyDomain,
  changeType: "publish" | "rollback",
  targetScopes: Array<{ scopeType: OrgPolicyScopeType; scopeId: string; scopeLabel: string; ownershipIds: string[]; approvalIds: string[] }>,
  auditSnapshot: RolloutAuditSnapshot,
  initiatedBy: string,
): PolicyRolloutRecord {
  const now = new Date().toISOString();
  return {
    rolloutId: `rollout_${Date.now().toString(36)}`,
    policySetId, policyVersionId, policyDomain, changeType,
    targetScopes: targetScopes.map(s => ({
      scopeType: s.scopeType, scopeId: s.scopeId, scopeLabel: s.scopeLabel,
      status: "pending", appliedAt: null, failureReason: "",
      affectedOwnershipRecordIds: s.ownershipIds,
      affectedApprovalSessionIds: s.approvalIds,
    })),
    totalScopes: targetScopes.length, completedScopes: 0, failedScopes: 0,
    status: "planned",
    plannedAt: now, startedAt: null, completedAt: null,
    initiatedBy,
    auditSnapshot,
  };
}

// ══════════════════════════════════════════════
// Rollout Actions
// ══════════════════════════════════════════════

export type RolloutAction = "start" | "complete_scope" | "fail_scope" | "complete" | "pause" | "resume" | "rollback" | "cancel";

export interface RolloutActionPayload {
  action: RolloutAction;
  scopeId?: string;
  failureReason?: string;
  actor: string;
  timestamp: string;
}

export interface RolloutActionResult {
  applied: boolean;
  rejectedReason: string | null;
  updatedRollout: PolicyRolloutRecord;
  events: RolloutEvent[];
}

export function applyRolloutAction(
  rollout: PolicyRolloutRecord,
  payload: RolloutActionPayload,
): RolloutActionResult {
  const now = payload.timestamp;
  const events: RolloutEvent[] = [];
  const reject = (reason: string): RolloutActionResult => {
    events.push({ type: "rollout_action_rejected", rolloutId: rollout.rolloutId, reason, actor: payload.actor, timestamp: now });
    return { applied: false, rejectedReason: reason, updatedRollout: rollout, events };
  };

  let u = { ...rollout, targetScopes: rollout.targetScopes.map(s => ({ ...s })) };

  switch (payload.action) {
    case "start": {
      if (u.status !== "planned") return reject(`시작 불가: ${u.status}`);
      u.status = "in_progress";
      u.startedAt = now;
      events.push({ type: "rollout_started", rolloutId: u.rolloutId, reason: `${u.totalScopes} scopes`, actor: payload.actor, timestamp: now });
      break;
    }
    case "complete_scope": {
      if (u.status !== "in_progress") return reject(`scope 완료 불가: ${u.status}`);
      if (!payload.scopeId) return reject("scopeId 필수");
      const scope = u.targetScopes.find(s => s.scopeId === payload.scopeId);
      if (!scope || scope.status !== "pending") return reject(`scope ${payload.scopeId} 처리 불가`);
      scope.status = "applied";
      scope.appliedAt = now;
      u.completedScopes++;
      events.push({ type: "rollout_scope_completed", rolloutId: u.rolloutId, reason: payload.scopeId, actor: payload.actor, timestamp: now });
      break;
    }
    case "fail_scope": {
      if (u.status !== "in_progress") return reject(`scope 실패 불가: ${u.status}`);
      if (!payload.scopeId) return reject("scopeId 필수");
      const scope = u.targetScopes.find(s => s.scopeId === payload.scopeId);
      if (!scope || scope.status !== "pending") return reject(`scope ${payload.scopeId} 처리 불가`);
      scope.status = "failed";
      scope.failureReason = payload.failureReason || "Unknown";
      u.failedScopes++;
      events.push({ type: "rollout_scope_failed", rolloutId: u.rolloutId, reason: `${payload.scopeId}: ${scope.failureReason}`, actor: payload.actor, timestamp: now });
      break;
    }
    case "complete": {
      if (u.status !== "in_progress") return reject(`완료 불가: ${u.status}`);
      const pending = u.targetScopes.filter(s => s.status === "pending");
      if (pending.length > 0) return reject(`${pending.length}개 scope 미처리`);
      u.status = u.failedScopes > 0 ? "partial_failure" : "completed";
      u.completedAt = now;
      u.auditSnapshot.appliedTimestamp = now;
      events.push({ type: "rollout_completed", rolloutId: u.rolloutId, reason: `${u.completedScopes} OK, ${u.failedScopes} failed`, actor: payload.actor, timestamp: now });
      break;
    }
    case "pause": {
      if (u.status !== "in_progress") return reject(`일시정지 불가: ${u.status}`);
      u.status = "paused";
      events.push({ type: "rollout_paused", rolloutId: u.rolloutId, reason: "Manual pause", actor: payload.actor, timestamp: now });
      break;
    }
    case "resume": {
      if (u.status !== "paused") return reject(`재개 불가: ${u.status}`);
      u.status = "in_progress";
      events.push({ type: "rollout_resumed", rolloutId: u.rolloutId, reason: "Resume", actor: payload.actor, timestamp: now });
      break;
    }
    case "rollback": {
      if (u.status !== "completed" && u.status !== "partial_failure" && u.status !== "in_progress") return reject(`롤백 불가: ${u.status}`);
      u.targetScopes.forEach(s => { if (s.status === "applied") s.status = "rolled_back"; });
      u.status = "rolled_back";
      u.auditSnapshot.revertedTimestamp = now;
      u.auditSnapshot.revertReason = payload.failureReason || "Manual rollback";
      events.push({ type: "rollout_rolled_back", rolloutId: u.rolloutId, reason: payload.failureReason || "Manual rollback", actor: payload.actor, timestamp: now });
      break;
    }
    case "cancel": {
      if (u.status === "completed" || u.status === "rolled_back") return reject(`취소 불가: ${u.status}`);
      u.status = "cancelled";
      events.push({ type: "rollout_cancelled", rolloutId: u.rolloutId, reason: "Cancelled", actor: payload.actor, timestamp: now });
      break;
    }
    default:
      return reject(`Unknown action: ${payload.action}`);
  }

  return { applied: true, rejectedReason: null, updatedRollout: u, events };
}

// ══════════════════════════════════════════════
// Audit Closure Verification
// ══════════════════════════════════════════════

export interface AuditClosureVerification {
  rolloutId: string;
  closed: boolean;
  missingFields: string[];
  completenessScore: number; // 0-100
  summary: string;
}

export function verifyAuditClosure(rollout: PolicyRolloutRecord): AuditClosureVerification {
  const missing: string[] = [];
  const snap = rollout.auditSnapshot;

  if (!snap.decisionMaker) missing.push("decisionMaker");
  if (!snap.decisionRationale) missing.push("decisionRationale");
  if (!snap.decisionTimestamp) missing.push("decisionTimestamp");
  if (snap.reviewerId === null && rollout.status !== "cancelled") missing.push("reviewerId");
  if (!snap.effectiveDate) missing.push("effectiveDate");
  if (rollout.status === "completed" && !snap.appliedTimestamp) missing.push("appliedTimestamp");
  if (rollout.status === "rolled_back" && !snap.revertedTimestamp) missing.push("revertedTimestamp");
  if (rollout.status === "rolled_back" && !snap.revertReason) missing.push("revertReason");

  const totalFields = 8;
  const completeness = Math.round(((totalFields - missing.length) / totalFields) * 100);

  return {
    rolloutId: rollout.rolloutId,
    closed: missing.length === 0,
    missingFields: missing,
    completenessScore: completeness,
    summary: missing.length === 0
      ? "감사 폐쇄 완료 — 모든 필수 필드 확인됨"
      : `감사 폐쇄 미완료 — ${missing.length}개 필드 누락: ${missing.join(", ")}`,
  };
}

// ── Events ──
export type RolloutEventType = "rollout_started" | "rollout_scope_completed" | "rollout_scope_failed" | "rollout_completed" | "rollout_paused" | "rollout_resumed" | "rollout_rolled_back" | "rollout_cancelled" | "rollout_action_rejected";
export interface RolloutEvent { type: RolloutEventType; rolloutId: string; reason: string; actor: string; timestamp: string; }
