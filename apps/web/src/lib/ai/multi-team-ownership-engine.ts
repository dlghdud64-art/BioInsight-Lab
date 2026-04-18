/**
 * Multi-Team Ownership Engine — canonical ownership resolution
 *
 * "이 문제를 누가 가져가야 하는가"를 canonical하게 결정.
 * dashboard / inbox / policy admin / escalation flow가 같은 ownership truth 참조.
 *
 * OWNERSHIP AXES:
 * 1. approval_owner — team/site/domain별 승인 담당자
 * 2. escalation_owner — domain/policy type별 에스컬레이션 담당자
 * 3. policy_owner — domain/scope별 정책 관리 담당자
 * 4. backlog_owner — queue/team별 대기 건 담당자
 * 5. sla_owner — queue/domain/site별 SLA 책임자
 *
 * RESOLUTION RULES:
 * - site > team > department > organization > system (narrowest wins)
 * - explicit assignment > rule-based > fallback
 * - owner 결정도 explainable — ownershipReason 필수
 */

import type { ApprovalDomain } from "./approval-inbox-projection-v2-engine";
import type { OrgPolicyDomain, OrgPolicyScopeType } from "./organization-policy-engine";
import type { ProcurementRole } from "./dispatch-v2-permission-policy-engine";

// ══════════════════════════════════════════════
// Ownership Types
// ══════════════════════════════════════════════

export type OwnershipType = "approval_owner" | "escalation_owner" | "policy_owner" | "backlog_owner" | "sla_owner";

export interface OwnershipRecord {
  recordId: string;
  ownershipType: OwnershipType;
  // Owner identity
  ownerId: string;
  ownerName: string;
  ownerRole: ProcurementRole;
  ownerTeamId: string;
  ownerDepartmentId: string;
  // Scope
  scopeType: OrgPolicyScopeType;
  scopeId: string;
  scopeLabel: string;
  // Domain (optional — some ownership is cross-domain)
  domain: ApprovalDomain | "all" | null;
  policyDomain: OrgPolicyDomain | "all" | null;
  // Status
  active: boolean;
  effectiveFrom: string;
  effectiveUntil: string | null;
  // Fallback
  fallbackOwnerId: string | null;
  fallbackOwnerName: string | null;
  // Metadata
  assignedBy: string;
  assignedAt: string;
  reason: string;
}

// ══════════════════════════════════════════════
// Ownership Resolution Context
// ══════════════════════════════════════════════

export interface OwnershipResolutionContext {
  ownershipType: OwnershipType;
  organizationId: string;
  departmentId: string;
  teamId: string;
  siteId: string;
  domain: ApprovalDomain | null;
  policyDomain: OrgPolicyDomain | null;
}

// ══════════════════════════════════════════════
// Resolved Owner
// ══════════════════════════════════════════════

export interface ResolvedOwner {
  ownershipType: OwnershipType;
  ownerId: string;
  ownerName: string;
  ownerRole: ProcurementRole;
  ownerTeamId: string;
  // Resolution trace
  resolvedBy: "explicit_assignment" | "rule_based" | "fallback" | "unresolved";
  matchedRecordId: string | null;
  matchedScopeType: OrgPolicyScopeType | null;
  matchedScopePrecedence: number;
  // Fallback
  fallbackOwnerId: string | null;
  fallbackOwnerName: string | null;
  // Escalation path
  escalationPath: EscalationPathEntry[];
  // Explainability
  ownershipReason: string;
  handoffTarget: string;
}

export interface EscalationPathEntry {
  level: number;
  ownerId: string;
  ownerName: string;
  ownerRole: ProcurementRole;
  scopeType: OrgPolicyScopeType;
  reason: string;
}

// ══════════════════════════════════════════════
// Scope Precedence
// ══════════════════════════════════════════════

const SCOPE_PRECEDENCE: Record<OrgPolicyScopeType, number> = {
  system: 0, organization: 10, department: 20, team: 30, site: 40, location: 50,
};

// ══════════════════════════════════════════════
// Resolve Owner
// ══════════════════════════════════════════════

export function resolveOwner(
  records: OwnershipRecord[],
  context: OwnershipResolutionContext,
): ResolvedOwner {
  // Filter active records matching ownership type
  const candidates = records
    .filter(r => r.ownershipType === context.ownershipType && r.active)
    .filter(r => isRecordInScope(r, context))
    .sort((a, b) => SCOPE_PRECEDENCE[b.scopeType] - SCOPE_PRECEDENCE[a.scopeType]); // narrowest first

  if (candidates.length === 0) {
    return buildUnresolved(context);
  }

  const winner = candidates[0];
  const escalationPath = buildEscalationPath(candidates);

  return {
    ownershipType: context.ownershipType,
    ownerId: winner.ownerId,
    ownerName: winner.ownerName,
    ownerRole: winner.ownerRole,
    ownerTeamId: winner.ownerTeamId,
    resolvedBy: "explicit_assignment",
    matchedRecordId: winner.recordId,
    matchedScopeType: winner.scopeType,
    matchedScopePrecedence: SCOPE_PRECEDENCE[winner.scopeType],
    fallbackOwnerId: winner.fallbackOwnerId,
    fallbackOwnerName: winner.fallbackOwnerName,
    escalationPath,
    ownershipReason: `${winner.scopeType}:${winner.scopeLabel}에서 지정된 ${OWNERSHIP_LABELS[context.ownershipType]}`,
    handoffTarget: winner.ownerId,
  };
}

function isRecordInScope(record: OwnershipRecord, context: OwnershipResolutionContext): boolean {
  // Domain match
  if (record.domain && record.domain !== "all" && context.domain && record.domain !== context.domain) return false;
  if (record.policyDomain && record.policyDomain !== "all" && context.policyDomain && record.policyDomain !== context.policyDomain) return false;

  // Scope match
  switch (record.scopeType) {
    case "system": return true;
    case "organization": return record.scopeId === context.organizationId;
    case "department": return record.scopeId === context.departmentId;
    case "team": return record.scopeId === context.teamId;
    case "site": return record.scopeId === context.siteId;
    default: return false;
  }
}

function buildEscalationPath(candidates: OwnershipRecord[]): EscalationPathEntry[] {
  return candidates.map((c, idx) => ({
    level: idx + 1,
    ownerId: c.ownerId,
    ownerName: c.ownerName,
    ownerRole: c.ownerRole,
    scopeType: c.scopeType,
    reason: idx === 0
      ? `Primary owner (${c.scopeType}:${c.scopeLabel})`
      : `Escalation level ${idx + 1} (${c.scopeType}:${c.scopeLabel})`,
  }));
}

function buildUnresolved(context: OwnershipResolutionContext): ResolvedOwner {
  return {
    ownershipType: context.ownershipType,
    ownerId: "", ownerName: "미지정", ownerRole: "admin",
    ownerTeamId: "",
    resolvedBy: "unresolved",
    matchedRecordId: null, matchedScopeType: null, matchedScopePrecedence: -1,
    fallbackOwnerId: null, fallbackOwnerName: null,
    escalationPath: [],
    ownershipReason: `${OWNERSHIP_LABELS[context.ownershipType]} 미지정 — 관리자 확인 필요`,
    handoffTarget: "",
  };
}

// ══════════════════════════════════════════════
// Resolve All Ownership for a Context
// ══════════════════════════════════════════════

export interface FullOwnershipResolution {
  approvalOwner: ResolvedOwner;
  escalationOwner: ResolvedOwner;
  policyOwner: ResolvedOwner;
  backlogOwner: ResolvedOwner;
  slaOwner: ResolvedOwner;
  unresolvedCount: number;
  allResolved: boolean;
  summary: string;
}

export function resolveFullOwnership(
  records: OwnershipRecord[],
  baseContext: Omit<OwnershipResolutionContext, "ownershipType">,
): FullOwnershipResolution {
  const types: OwnershipType[] = ["approval_owner", "escalation_owner", "policy_owner", "backlog_owner", "sla_owner"];
  const resolved: Record<string, ResolvedOwner> = {};

  for (const type of types) {
    resolved[type] = resolveOwner(records, { ...baseContext, ownershipType: type });
  }

  const unresolvedCount = Object.values(resolved).filter(r => r.resolvedBy === "unresolved").length;

  return {
    approvalOwner: resolved.approval_owner,
    escalationOwner: resolved.escalation_owner,
    policyOwner: resolved.policy_owner,
    backlogOwner: resolved.backlog_owner,
    slaOwner: resolved.sla_owner,
    unresolvedCount,
    allResolved: unresolvedCount === 0,
    summary: unresolvedCount === 0
      ? "모든 ownership 해결됨"
      : `${unresolvedCount}개 ownership 미지정 — 관리자 확인 필요`,
  };
}

// ══════════════════════════════════════════════
// Ownership Labels
// ══════════════════════════════════════════════

const OWNERSHIP_LABELS: Record<OwnershipType, string> = {
  approval_owner: "승인 담당자",
  escalation_owner: "에스컬레이션 담당자",
  policy_owner: "정책 관리자",
  backlog_owner: "대기 건 담당자",
  sla_owner: "SLA 책임자",
};

export function getOwnershipLabel(type: OwnershipType): string {
  return OWNERSHIP_LABELS[type];
}

// ══════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════

export type OwnershipEventType = "ownership_resolved" | "ownership_unresolved" | "ownership_assigned" | "ownership_escalated" | "ownership_fallback_used";
export interface OwnershipEvent { type: OwnershipEventType; ownershipType: OwnershipType; ownerId: string; scopeType: string; reason: string; timestamp: string; }
