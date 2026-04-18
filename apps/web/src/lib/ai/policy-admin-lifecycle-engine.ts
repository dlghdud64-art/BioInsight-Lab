/**
 * Policy Admin Lifecycle Engine — policy draft / publish / version / rollback
 *
 * 조직 정책을 "코드에 고정된 규칙"이 아니라
 * draft → review → publish → active → superseded / rolled back
 * lifecycle으로 운영.
 *
 * LIFECYCLE:
 * draft → pending_review → approved → published → active
 *                       ↘ rejected → draft (수정 후 재제출)
 * active → superseded (새 version publish 시)
 * active → rolled_back (긴급 롤백 시)
 *
 * VERSION CONTROL:
 * - 모든 변경은 새 version 생성
 * - active version은 항상 1개만
 * - 이전 version은 superseded/rolled_back으로 이력 유지
 * - rollback은 이전 active version을 다시 active로 전환
 *
 * CHANGE DIFF:
 * - version 간 diff 생성 (어떤 rule이 추가/수정/삭제됐는지)
 * - review 시 diff 기반 판단
 */

import type { OrgPolicyRule, OrgPolicyDomain, OrgPolicyScopeType, OrgPolicyEffect } from "./organization-policy-engine";
import type { ProcurementRole } from "./dispatch-v2-permission-policy-engine";

// ══════════════════════════════════════════════
// Policy Version Status
// ══════════════════════════════════════════════

export type PolicyVersionStatus =
  | "draft"
  | "pending_review"
  | "review_approved"
  | "review_rejected"
  | "published"
  | "active"
  | "superseded"
  | "rolled_back";

// ══════════════════════════════════════════════
// Policy Version
// ══════════════════════════════════════════════

export interface PolicyVersion {
  versionId: string;
  policySetId: string;
  versionNumber: number;
  status: PolicyVersionStatus;
  // Content
  rules: OrgPolicyRule[];
  ruleCount: number;
  // Scope
  domain: OrgPolicyDomain;
  scopeType: OrgPolicyScopeType;
  scopeId: string;
  scopeLabel: string;
  // Dates
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  // Authoring
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  // Review
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewDecision: "approved" | "rejected" | null;
  reviewComment: string;
  // Publish
  publishedBy: string | null;
  publishedAt: string | null;
  // Superseded/Rollback
  supersededBy: string | null;
  supersededAt: string | null;
  rolledBackBy: string | null;
  rolledBackAt: string | null;
  rolledBackReason: string;
  // Change tracking
  changeDescription: string;
  parentVersionId: string | null;
}

// ══════════════════════════════════════════════
// Policy Set (all versions of a policy)
// ══════════════════════════════════════════════

export interface PolicySet {
  policySetId: string;
  domain: OrgPolicyDomain;
  scopeType: OrgPolicyScopeType;
  scopeId: string;
  scopeLabel: string;
  description: string;
  // Current state
  activeVersionId: string | null;
  draftVersionId: string | null;
  latestVersionNumber: number;
  // History
  versions: PolicyVersion[];
  totalVersions: number;
  // Metadata
  createdBy: string;
  createdAt: string;
  lastModifiedAt: string;
}

// ══════════════════════════════════════════════
// Lifecycle Actions
// ══════════════════════════════════════════════

export type PolicyLifecycleAction =
  | "create_draft"
  | "edit_draft"
  | "submit_for_review"
  | "approve_review"
  | "reject_review"
  | "publish"
  | "rollback"
  | "archive";

export interface PolicyLifecyclePayload {
  action: PolicyLifecycleAction;
  actor: string;
  actorRole: ProcurementRole;
  rules?: OrgPolicyRule[];
  changeDescription?: string;
  reviewComment?: string;
  rollbackTargetVersionId?: string;
  rollbackReason?: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  timestamp: string;
}

export interface PolicyLifecycleResult {
  applied: boolean;
  rejectedReason: string | null;
  updatedPolicySet: PolicySet;
  updatedVersion: PolicyVersion | null;
  events: PolicyLifecycleEvent[];
}

// ══════════════════════════════════════════════
// Create Policy Set
// ══════════════════════════════════════════════

export function createPolicySet(
  domain: OrgPolicyDomain,
  scopeType: OrgPolicyScopeType,
  scopeId: string,
  scopeLabel: string,
  description: string,
  actor: string,
): PolicySet {
  const now = new Date().toISOString();
  return {
    policySetId: `polset_${Date.now().toString(36)}`,
    domain, scopeType, scopeId, scopeLabel, description,
    activeVersionId: null, draftVersionId: null, latestVersionNumber: 0,
    versions: [], totalVersions: 0,
    createdBy: actor, createdAt: now, lastModifiedAt: now,
  };
}

// ══════════════════════════════════════════════
// Apply Lifecycle Action
// ══════════════════════════════════════════════

export function applyPolicyLifecycle(
  policySet: PolicySet,
  payload: PolicyLifecyclePayload,
): PolicyLifecycleResult {
  const now = payload.timestamp;
  const events: PolicyLifecycleEvent[] = [];
  const reject = (reason: string): PolicyLifecycleResult => {
    events.push({ type: "policy_lifecycle_rejected", policySetId: policySet.policySetId, versionId: null, action: payload.action, actor: payload.actor, reason, timestamp: now });
    return { applied: false, rejectedReason: reason, updatedPolicySet: policySet, updatedVersion: null, events };
  };

  let u = { ...policySet, lastModifiedAt: now, versions: [...policySet.versions] };

  switch (payload.action) {
    case "create_draft": {
      if (u.draftVersionId) return reject("이미 draft가 존재합니다. 기존 draft를 수정하세요.");
      const versionNumber = u.latestVersionNumber + 1;
      const version: PolicyVersion = {
        versionId: `polv_${Date.now().toString(36)}`,
        policySetId: u.policySetId, versionNumber,
        status: "draft",
        rules: payload.rules || [], ruleCount: payload.rules?.length || 0,
        domain: u.domain, scopeType: u.scopeType, scopeId: u.scopeId, scopeLabel: u.scopeLabel,
        effectiveFrom: payload.effectiveFrom || null, effectiveUntil: payload.effectiveUntil || null,
        createdBy: payload.actor, createdAt: now, lastModifiedBy: payload.actor, lastModifiedAt: now,
        reviewedBy: null, reviewedAt: null, reviewDecision: null, reviewComment: "",
        publishedBy: null, publishedAt: null,
        supersededBy: null, supersededAt: null,
        rolledBackBy: null, rolledBackAt: null, rolledBackReason: "",
        changeDescription: payload.changeDescription || "", parentVersionId: u.activeVersionId,
      };
      u.versions.push(version);
      u.draftVersionId = version.versionId;
      u.latestVersionNumber = versionNumber;
      u.totalVersions++;
      events.push({ type: "policy_draft_created", policySetId: u.policySetId, versionId: version.versionId, action: "create_draft", actor: payload.actor, reason: payload.changeDescription || "", timestamp: now });
      return { applied: true, rejectedReason: null, updatedPolicySet: u, updatedVersion: version, events };
    }

    case "edit_draft": {
      if (!u.draftVersionId) return reject("Draft가 없습니다.");
      const draftIdx = u.versions.findIndex(v => v.versionId === u.draftVersionId);
      if (draftIdx === -1) return reject("Draft version을 찾을 수 없습니다.");
      const draft = { ...u.versions[draftIdx] };
      if (draft.status !== "draft" && draft.status !== "review_rejected") return reject(`Draft 상태가 아닙니다: ${draft.status}`);
      draft.rules = payload.rules || draft.rules;
      draft.ruleCount = draft.rules.length;
      draft.lastModifiedBy = payload.actor;
      draft.lastModifiedAt = now;
      draft.changeDescription = payload.changeDescription || draft.changeDescription;
      if (payload.effectiveFrom) draft.effectiveFrom = payload.effectiveFrom;
      if (payload.effectiveUntil) draft.effectiveUntil = payload.effectiveUntil;
      u.versions[draftIdx] = draft;
      events.push({ type: "policy_draft_edited", policySetId: u.policySetId, versionId: draft.versionId, action: "edit_draft", actor: payload.actor, reason: "Draft edited", timestamp: now });
      return { applied: true, rejectedReason: null, updatedPolicySet: u, updatedVersion: draft, events };
    }

    case "submit_for_review": {
      if (!u.draftVersionId) return reject("Draft가 없습니다.");
      const idx = u.versions.findIndex(v => v.versionId === u.draftVersionId);
      if (idx === -1) return reject("Draft version을 찾을 수 없습니다.");
      const v = { ...u.versions[idx] };
      if (v.rules.length === 0) return reject("빈 정책은 제출할 수 없습니다.");
      v.status = "pending_review";
      v.lastModifiedBy = payload.actor;
      v.lastModifiedAt = now;
      u.versions[idx] = v;
      events.push({ type: "policy_submitted_for_review", policySetId: u.policySetId, versionId: v.versionId, action: "submit_for_review", actor: payload.actor, reason: v.changeDescription, timestamp: now });
      return { applied: true, rejectedReason: null, updatedPolicySet: u, updatedVersion: v, events };
    }

    case "approve_review": {
      const idx = u.versions.findIndex(v => v.status === "pending_review");
      if (idx === -1) return reject("Review 대기 version이 없습니다.");
      const v = { ...u.versions[idx] };
      if (v.createdBy === payload.actor) return reject("작성자가 직접 승인할 수 없습니다.");
      v.status = "review_approved";
      v.reviewedBy = payload.actor;
      v.reviewedAt = now;
      v.reviewDecision = "approved";
      v.reviewComment = payload.reviewComment || "";
      u.versions[idx] = v;
      events.push({ type: "policy_review_approved", policySetId: u.policySetId, versionId: v.versionId, action: "approve_review", actor: payload.actor, reason: payload.reviewComment || "", timestamp: now });
      return { applied: true, rejectedReason: null, updatedPolicySet: u, updatedVersion: v, events };
    }

    case "reject_review": {
      const idx = u.versions.findIndex(v => v.status === "pending_review");
      if (idx === -1) return reject("Review 대기 version이 없습니다.");
      const v = { ...u.versions[idx] };
      v.status = "review_rejected";
      v.reviewedBy = payload.actor;
      v.reviewedAt = now;
      v.reviewDecision = "rejected";
      v.reviewComment = payload.reviewComment || "";
      u.versions[idx] = v;
      events.push({ type: "policy_review_rejected", policySetId: u.policySetId, versionId: v.versionId, action: "reject_review", actor: payload.actor, reason: payload.reviewComment || "", timestamp: now });
      return { applied: true, rejectedReason: null, updatedPolicySet: u, updatedVersion: v, events };
    }

    case "publish": {
      const idx = u.versions.findIndex(v => v.status === "review_approved");
      if (idx === -1) return reject("승인된 version이 없습니다. Review 승인 먼저 필요합니다.");
      const v = { ...u.versions[idx] };

      // Supersede current active version
      if (u.activeVersionId) {
        const activeIdx = u.versions.findIndex(av => av.versionId === u.activeVersionId);
        if (activeIdx !== -1) {
          const active = { ...u.versions[activeIdx] };
          active.status = "superseded";
          active.supersededBy = v.versionId;
          active.supersededAt = now;
          u.versions[activeIdx] = active;
        }
      }

      v.status = "active";
      v.publishedBy = payload.actor;
      v.publishedAt = now;
      u.versions[idx] = v;
      u.activeVersionId = v.versionId;
      u.draftVersionId = null;
      events.push({ type: "policy_published", policySetId: u.policySetId, versionId: v.versionId, action: "publish", actor: payload.actor, reason: `v${v.versionNumber} published`, timestamp: now });
      return { applied: true, rejectedReason: null, updatedPolicySet: u, updatedVersion: v, events };
    }

    case "rollback": {
      if (!payload.rollbackTargetVersionId) return reject("롤백 대상 version ID가 필요합니다.");
      if (!u.activeVersionId) return reject("Active version이 없습니다.");

      const targetIdx = u.versions.findIndex(v => v.versionId === payload.rollbackTargetVersionId);
      if (targetIdx === -1) return reject("롤백 대상 version을 찾을 수 없습니다.");
      const target = { ...u.versions[targetIdx] };
      if (target.status !== "superseded") return reject(`롤백 가능 상태가 아닙니다: ${target.status}`);

      // Roll back current active
      const activeIdx = u.versions.findIndex(v => v.versionId === u.activeVersionId);
      if (activeIdx !== -1) {
        const active = { ...u.versions[activeIdx] };
        active.status = "rolled_back";
        active.rolledBackBy = payload.actor;
        active.rolledBackAt = now;
        active.rolledBackReason = payload.rollbackReason || "Emergency rollback";
        u.versions[activeIdx] = active;
      }

      // Restore target
      target.status = "active";
      target.supersededBy = null;
      target.supersededAt = null;
      u.versions[targetIdx] = target;
      u.activeVersionId = target.versionId;
      events.push({ type: "policy_rolled_back", policySetId: u.policySetId, versionId: target.versionId, action: "rollback", actor: payload.actor, reason: payload.rollbackReason || "", timestamp: now });
      return { applied: true, rejectedReason: null, updatedPolicySet: u, updatedVersion: target, events };
    }

    default:
      return reject(`Unknown action: ${payload.action}`);
  }
}

// ══════════════════════════════════════════════
// Change Diff
// ══════════════════════════════════════════════

export interface PolicyChangeDiff {
  fromVersionId: string;
  toVersionId: string;
  fromVersionNumber: number;
  toVersionNumber: number;
  addedRules: OrgPolicyRule[];
  removedRules: OrgPolicyRule[];
  modifiedRules: Array<{ ruleId: string; field: string; from: string; to: string }>;
  totalChanges: number;
  summary: string;
}

export function computePolicyChangeDiff(
  fromVersion: PolicyVersion,
  toVersion: PolicyVersion,
): PolicyChangeDiff {
  const fromIds = new Set(fromVersion.rules.map(r => r.ruleId));
  const toIds = new Set(toVersion.rules.map(r => r.ruleId));

  const addedRules = toVersion.rules.filter(r => !fromIds.has(r.ruleId));
  const removedRules = fromVersion.rules.filter(r => !toIds.has(r.ruleId));

  const modifiedRules: PolicyChangeDiff["modifiedRules"] = [];
  for (const toRule of toVersion.rules) {
    if (fromIds.has(toRule.ruleId)) {
      const fromRule = fromVersion.rules.find(r => r.ruleId === toRule.ruleId)!;
      if (fromRule.effect !== toRule.effect) modifiedRules.push({ ruleId: toRule.ruleId, field: "effect", from: fromRule.effect, to: toRule.effect });
      if (String(fromRule.conditionValue) !== String(toRule.conditionValue)) modifiedRules.push({ ruleId: toRule.ruleId, field: "conditionValue", from: String(fromRule.conditionValue), to: String(toRule.conditionValue) });
      if (fromRule.dualApprovalRequired !== toRule.dualApprovalRequired) modifiedRules.push({ ruleId: toRule.ruleId, field: "dualApprovalRequired", from: String(fromRule.dualApprovalRequired), to: String(toRule.dualApprovalRequired) });
    }
  }

  const totalChanges = addedRules.length + removedRules.length + modifiedRules.length;
  const parts: string[] = [];
  if (addedRules.length > 0) parts.push(`+${addedRules.length} 추가`);
  if (removedRules.length > 0) parts.push(`-${removedRules.length} 삭제`);
  if (modifiedRules.length > 0) parts.push(`~${modifiedRules.length} 수정`);

  return {
    fromVersionId: fromVersion.versionId, toVersionId: toVersion.versionId,
    fromVersionNumber: fromVersion.versionNumber, toVersionNumber: toVersion.versionNumber,
    addedRules, removedRules, modifiedRules,
    totalChanges,
    summary: parts.length > 0 ? `v${fromVersion.versionNumber} → v${toVersion.versionNumber}: ${parts.join(", ")}` : "변경 없음",
  };
}

// ══════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════

export type PolicyLifecycleEventType =
  | "policy_draft_created" | "policy_draft_edited"
  | "policy_submitted_for_review" | "policy_review_approved" | "policy_review_rejected"
  | "policy_published" | "policy_rolled_back"
  | "policy_lifecycle_rejected";

export interface PolicyLifecycleEvent {
  type: PolicyLifecycleEventType;
  policySetId: string;
  versionId: string | null;
  action: PolicyLifecycleAction;
  actor: string;
  reason: string;
  timestamp: string;
}
