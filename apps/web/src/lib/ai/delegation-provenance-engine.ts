/**
 * Delegation Provenance Engine — delegation이 SoD 우회가 되지 않게 제어
 *
 * RULES:
 * 1. delegation scope: 특정 action / domain / 기간 제한
 * 2. delegation lineage: delegator → delegate 체인 추적
 * 3. delegation conflict: delegate가 원래 actor와 동일 건 승인 불가
 * 4. delegation expiry: 기간 만료 후 자동 무효
 * 5. cascade block: A→B 위임, B→C 재위임 시 A의 건은 C도 승인 불가
 */

import type { ProcurementRole, StageActionKey, ActorContext } from "./dispatch-v2-permission-policy-engine";
import type { ApprovalDomain } from "./approval-inbox-projection-v2-engine";

// ── Delegation Record ──
export interface DelegationRecord {
  delegationId: string;
  delegatorId: string;
  delegatorRole: ProcurementRole;
  delegateId: string;
  delegateRole: ProcurementRole;
  // Scope
  scopeType: "all" | "domain" | "action" | "case";
  scopeDomains: ApprovalDomain[];
  scopeActions: StageActionKey[];
  scopeCaseIds: string[];
  // Period
  validFrom: string;
  validUntil: string;
  // Status
  active: boolean;
  revokedAt: string | null;
  revokedBy: string | null;
  revokedReason: string;
  // Lineage
  parentDelegationId: string | null; // cascade tracking
  // Audit
  createdAt: string;
  createdBy: string;
  reason: string;
}

// ── Delegation Conflict Check ──
export interface DelegationConflictResult {
  allowed: boolean;
  conflicts: DelegationConflict[];
  warnings: DelegationWarning[];
  lineage: string[]; // full delegation chain
}

export interface DelegationConflict {
  conflictType: "self_delegation_loop" | "cascade_conflict" | "scope_expired" | "scope_mismatch" | "revoked" | "delegator_is_requester";
  delegationId: string;
  detail: string;
}

export interface DelegationWarning {
  warningType: "cascade_depth" | "broad_scope" | "expiring_soon" | "same_department";
  detail: string;
}

// ── Create Delegation ──
export function createDelegation(
  delegator: ActorContext,
  delegateId: string,
  delegateRole: ProcurementRole,
  scopeType: DelegationRecord["scopeType"],
  scopeDomains: ApprovalDomain[] = [],
  scopeActions: StageActionKey[] = [],
  scopeCaseIds: string[] = [],
  validFrom: string,
  validUntil: string,
  reason: string,
  parentDelegationId: string | null = null,
): DelegationRecord {
  return {
    delegationId: `deleg_${Date.now().toString(36)}`,
    delegatorId: delegator.actorId,
    delegatorRole: delegator.roles[0] || "approver",
    delegateId,
    delegateRole,
    scopeType, scopeDomains, scopeActions, scopeCaseIds,
    validFrom, validUntil,
    active: true, revokedAt: null, revokedBy: null, revokedReason: "",
    parentDelegationId,
    createdAt: new Date().toISOString(),
    createdBy: delegator.actorId,
    reason,
  };
}

// ── Revoke Delegation ──
export function revokeDelegation(record: DelegationRecord, revokedBy: string, reason: string): DelegationRecord {
  return { ...record, active: false, revokedAt: new Date().toISOString(), revokedBy, revokedReason: reason };
}

// ── Check Delegation Validity ──
export function isDelegationValid(record: DelegationRecord, now: Date = new Date()): boolean {
  if (!record.active) return false;
  if (record.revokedAt) return false;
  if (new Date(record.validFrom) > now) return false;
  if (new Date(record.validUntil) < now) return false;
  return true;
}

// ── Check Delegation Scope ──
export function isDelegationInScope(
  record: DelegationRecord,
  domain: ApprovalDomain,
  actionKey: StageActionKey,
  caseId: string,
): boolean {
  if (!isDelegationValid(record)) return false;

  switch (record.scopeType) {
    case "all": return true;
    case "domain": return record.scopeDomains.includes(domain);
    case "action": return record.scopeActions.includes(actionKey);
    case "case": return record.scopeCaseIds.includes(caseId);
    default: return false;
  }
}

// ── Check Delegation Conflict (Full Chain) ──
export function checkDelegationConflict(
  delegations: DelegationRecord[],
  delegateId: string,
  requesterId: string,
  domain: ApprovalDomain,
  actionKey: StageActionKey,
  caseId: string,
  now: Date = new Date(),
): DelegationConflictResult {
  const conflicts: DelegationConflict[] = [];
  const warnings: DelegationWarning[] = [];
  const lineage: string[] = [];

  // Find all delegations where delegateId is the delegate
  const relevantDelegations = delegations.filter(d =>
    d.delegateId === delegateId && isDelegationInScope(d, domain, actionKey, caseId)
  );

  for (const deleg of relevantDelegations) {
    lineage.push(`${deleg.delegatorId} → ${deleg.delegateId} (${deleg.delegationId})`);

    // Conflict 1: delegator is the requester
    if (deleg.delegatorId === requesterId) {
      conflicts.push({
        conflictType: "delegator_is_requester",
        delegationId: deleg.delegationId,
        detail: `위임자(${deleg.delegatorId})가 요청자와 동일 — 위임 승인 불가`,
      });
    }

    // Conflict 2: delegation expired
    if (!isDelegationValid(deleg, now)) {
      conflicts.push({
        conflictType: "scope_expired",
        delegationId: deleg.delegationId,
        detail: `위임 만료 또는 취소됨 (validUntil: ${deleg.validUntil})`,
      });
    }

    // Conflict 3: revoked
    if (deleg.revokedAt) {
      conflicts.push({
        conflictType: "revoked",
        delegationId: deleg.delegationId,
        detail: `위임 취소됨 (${deleg.revokedReason})`,
      });
    }

    // Cascade check: walk parent chain
    if (deleg.parentDelegationId) {
      const cascadeResult = walkCascadeChain(delegations, deleg, requesterId, now);
      conflicts.push(...cascadeResult.conflicts);
      warnings.push(...cascadeResult.warnings);
      lineage.push(...cascadeResult.lineage);
    }
  }

  // Warning: broad scope
  for (const deleg of relevantDelegations) {
    if (deleg.scopeType === "all") {
      warnings.push({ warningType: "broad_scope", detail: `전체 범위 위임 — 제한 범위 권장` });
    }

    // Warning: expiring soon (< 24h)
    const expiresIn = new Date(deleg.validUntil).getTime() - now.getTime();
    if (expiresIn > 0 && expiresIn < 24 * 60 * 60 * 1000) {
      warnings.push({ warningType: "expiring_soon", detail: `위임 만료 임박 (${deleg.validUntil})` });
    }
  }

  return {
    allowed: conflicts.length === 0,
    conflicts, warnings,
    lineage: [...new Set(lineage)],
  };
}

// ── Walk Cascade Chain ──
function walkCascadeChain(
  delegations: DelegationRecord[],
  current: DelegationRecord,
  requesterId: string,
  now: Date,
  depth: number = 0,
): { conflicts: DelegationConflict[]; warnings: DelegationWarning[]; lineage: string[] } {
  const conflicts: DelegationConflict[] = [];
  const warnings: DelegationWarning[] = [];
  const lineage: string[] = [];

  if (depth > 5) {
    warnings.push({ warningType: "cascade_depth", detail: `Delegation cascade depth > 5 — 과도한 재위임` });
    return { conflicts, warnings, lineage };
  }

  if (!current.parentDelegationId) return { conflicts, warnings, lineage };

  const parent = delegations.find(d => d.delegationId === current.parentDelegationId);
  if (!parent) return { conflicts, warnings, lineage };

  lineage.push(`${parent.delegatorId} → ${parent.delegateId} (cascade, ${parent.delegationId})`);

  // Cascade conflict: original delegator is requester
  if (parent.delegatorId === requesterId) {
    conflicts.push({
      conflictType: "cascade_conflict",
      delegationId: parent.delegationId,
      detail: `Cascade 충돌 — 원래 위임자(${parent.delegatorId})가 요청자와 동일. 재위임 체인을 통한 SoD 우회 금지`,
    });
  }

  // Recurse
  const deeper = walkCascadeChain(delegations, parent, requesterId, now, depth + 1);
  conflicts.push(...deeper.conflicts);
  warnings.push(...deeper.warnings);
  lineage.push(...deeper.lineage);

  return { conflicts, warnings, lineage };
}

// ── Events ──
export type DelegationEventType = "delegation_created" | "delegation_revoked" | "delegation_expired" | "delegation_conflict_detected" | "delegation_cascade_blocked";
export interface DelegationEvent { type: DelegationEventType; delegationId: string; delegatorId: string; delegateId: string; reason: string; timestamp: string; }
