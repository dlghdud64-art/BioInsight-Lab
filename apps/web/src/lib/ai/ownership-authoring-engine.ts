/**
 * Ownership Authoring Engine — ownership record CRUD + assign/reassign/transfer
 *
 * 검증된 governance loop 위에 안전하게 얹는 mutation layer.
 *
 * ACTIONS:
 * 1. create — 새 ownership record 생성
 * 2. update — 기존 record 수정 (scope/owner/fallback)
 * 3. deactivate — record 비활성화
 * 4. assign — ownerless item에 owner 즉시 배정
 * 5. reassign — overloaded owner → 다른 owner로 이관
 * 6. transfer — team/site 이관 시 bulk ownership 이전
 *
 * AUDIT:
 * - 모든 변경에 diff + reason + actor 기록
 * - ownership change event → governance loop invalidation 연결
 */

import type { OwnershipRecord, OwnershipType, ResolvedOwner } from "./multi-team-ownership-engine";
import type { ApprovalDomain } from "./approval-inbox-projection-v2-engine";
import type { OrgPolicyDomain, OrgPolicyScopeType } from "./organization-policy-engine";
import type { ProcurementRole } from "./dispatch-v2-permission-policy-engine";

// ══════════════════════════════════════════════
// Authoring Actions
// ══════════════════════════════════════════════

export type OwnershipAuthoringAction =
  | "create"
  | "update"
  | "deactivate"
  | "assign"
  | "reassign"
  | "transfer";

export interface OwnershipAuthoringPayload {
  action: OwnershipAuthoringAction;
  actor: string;
  actorRole: ProcurementRole;
  timestamp: string;
  // Create/Update fields
  ownershipType?: OwnershipType;
  ownerId?: string;
  ownerName?: string;
  ownerRole?: ProcurementRole;
  ownerTeamId?: string;
  ownerDepartmentId?: string;
  scopeType?: OrgPolicyScopeType;
  scopeId?: string;
  scopeLabel?: string;
  domain?: ApprovalDomain | "all" | null;
  policyDomain?: OrgPolicyDomain | "all" | null;
  fallbackOwnerId?: string | null;
  fallbackOwnerName?: string | null;
  effectiveFrom?: string;
  effectiveUntil?: string | null;
  reason: string;
  // Reassign specific
  fromOwnerId?: string;
  toOwnerId?: string;
  toOwnerName?: string;
  itemIds?: string[];
  // Transfer specific
  fromScopeId?: string;
  toScopeId?: string;
  toScopeLabel?: string;
  // Target record (for update/deactivate)
  targetRecordId?: string;
}

// ══════════════════════════════════════════════
// Authoring Result
// ══════════════════════════════════════════════

export interface OwnershipAuthoringResult {
  applied: boolean;
  rejectedReason: string | null;
  record: OwnershipRecord | null;
  affectedRecords: OwnershipRecord[];
  diff: OwnershipChangeDiff | null;
  events: OwnershipAuthoringEvent[];
}

// ══════════════════════════════════════════════
// Change Diff
// ══════════════════════════════════════════════

export interface OwnershipChangeDiff {
  recordId: string;
  action: OwnershipAuthoringAction;
  changes: Array<{
    field: string;
    fromValue: string;
    toValue: string;
  }>;
  summary: string;
}

// ══════════════════════════════════════════════
// Apply Authoring Action
// ══════════════════════════════════════════════

export function applyOwnershipAuthoring(
  existingRecords: OwnershipRecord[],
  payload: OwnershipAuthoringPayload,
): OwnershipAuthoringResult {
  const now = payload.timestamp;
  const events: OwnershipAuthoringEvent[] = [];
  const reject = (reason: string): OwnershipAuthoringResult => {
    events.push({ type: "ownership_authoring_rejected", action: payload.action, actor: payload.actor, reason, timestamp: now, recordId: null });
    return { applied: false, rejectedReason: reason, record: null, affectedRecords: [], diff: null, events };
  };

  switch (payload.action) {
    case "create": {
      if (!payload.ownershipType || !payload.ownerId || !payload.scopeType || !payload.scopeId) {
        return reject("필수 필드 누락: ownershipType, ownerId, scopeType, scopeId");
      }

      // Check duplicate
      const existing = existingRecords.find(r =>
        r.ownershipType === payload.ownershipType &&
        r.scopeType === payload.scopeType &&
        r.scopeId === payload.scopeId &&
        r.domain === (payload.domain || null) &&
        r.active
      );
      if (existing) {
        return reject(`동일 scope/domain에 이미 active ownership이 존재합니다 (${existing.recordId})`);
      }

      const record: OwnershipRecord = {
        recordId: `own_${Date.now().toString(36)}`,
        ownershipType: payload.ownershipType,
        ownerId: payload.ownerId,
        ownerName: payload.ownerName || payload.ownerId,
        ownerRole: payload.ownerRole || "operator",
        ownerTeamId: payload.ownerTeamId || "",
        ownerDepartmentId: payload.ownerDepartmentId || "",
        scopeType: payload.scopeType,
        scopeId: payload.scopeId,
        scopeLabel: payload.scopeLabel || payload.scopeId,
        domain: payload.domain || null,
        policyDomain: payload.policyDomain || null,
        active: true,
        effectiveFrom: payload.effectiveFrom || now,
        effectiveUntil: payload.effectiveUntil || null,
        fallbackOwnerId: payload.fallbackOwnerId || null,
        fallbackOwnerName: payload.fallbackOwnerName || null,
        assignedBy: payload.actor,
        assignedAt: now,
        reason: payload.reason,
      };

      events.push({ type: "ownership_created", action: "create", actor: payload.actor, reason: payload.reason, timestamp: now, recordId: record.recordId });
      return {
        applied: true, rejectedReason: null, record, affectedRecords: [record],
        diff: { recordId: record.recordId, action: "create", changes: [{ field: "owner", fromValue: "없음", toValue: record.ownerName }], summary: `${record.ownershipType} 생성: ${record.ownerName} (${record.scopeType}:${record.scopeLabel})` },
        events,
      };
    }

    case "update": {
      if (!payload.targetRecordId) return reject("targetRecordId 필수");
      const idx = existingRecords.findIndex(r => r.recordId === payload.targetRecordId);
      if (idx === -1) return reject("Record를 찾을 수 없습니다");
      const original = existingRecords[idx];
      const updated = { ...original };
      const changes: OwnershipChangeDiff["changes"] = [];

      if (payload.ownerId && payload.ownerId !== original.ownerId) {
        changes.push({ field: "ownerId", fromValue: original.ownerId, toValue: payload.ownerId });
        updated.ownerId = payload.ownerId;
        updated.ownerName = payload.ownerName || payload.ownerId;
      }
      if (payload.fallbackOwnerId !== undefined && payload.fallbackOwnerId !== original.fallbackOwnerId) {
        changes.push({ field: "fallbackOwnerId", fromValue: original.fallbackOwnerId || "없음", toValue: payload.fallbackOwnerId || "없음" });
        updated.fallbackOwnerId = payload.fallbackOwnerId;
        updated.fallbackOwnerName = payload.fallbackOwnerName || null;
      }
      if (payload.effectiveUntil !== undefined && payload.effectiveUntil !== original.effectiveUntil) {
        changes.push({ field: "effectiveUntil", fromValue: original.effectiveUntil || "무기한", toValue: payload.effectiveUntil || "무기한" });
        updated.effectiveUntil = payload.effectiveUntil;
      }

      if (changes.length === 0) return reject("변경 사항 없음");

      events.push({ type: "ownership_updated", action: "update", actor: payload.actor, reason: payload.reason, timestamp: now, recordId: updated.recordId });
      return {
        applied: true, rejectedReason: null, record: updated, affectedRecords: [updated],
        diff: { recordId: updated.recordId, action: "update", changes, summary: `${changes.length}개 필드 수정` },
        events,
      };
    }

    case "deactivate": {
      if (!payload.targetRecordId) return reject("targetRecordId 필수");
      const idx = existingRecords.findIndex(r => r.recordId === payload.targetRecordId);
      if (idx === -1) return reject("Record를 찾을 수 없습니다");
      const deactivated = { ...existingRecords[idx], active: false };

      events.push({ type: "ownership_deactivated", action: "deactivate", actor: payload.actor, reason: payload.reason, timestamp: now, recordId: deactivated.recordId });
      return {
        applied: true, rejectedReason: null, record: deactivated, affectedRecords: [deactivated],
        diff: { recordId: deactivated.recordId, action: "deactivate", changes: [{ field: "active", fromValue: "true", toValue: "false" }], summary: "비활성화" },
        events,
      };
    }

    case "assign": {
      // Assign = create with immediate effect for ownerless items
      if (!payload.ownershipType || !payload.ownerId || !payload.scopeType || !payload.scopeId) {
        return reject("배정에 필요한 필드 누락");
      }
      // Delegate to create
      return applyOwnershipAuthoring(existingRecords, { ...payload, action: "create" });
    }

    case "reassign": {
      if (!payload.fromOwnerId || !payload.toOwnerId) return reject("fromOwnerId, toOwnerId 필수");

      // Find records owned by fromOwner and transfer to toOwner
      const fromRecords = existingRecords.filter(r => r.ownerId === payload.fromOwnerId && r.active);
      if (fromRecords.length === 0) return reject(`${payload.fromOwnerId}의 active ownership이 없습니다`);

      const affectedRecords: OwnershipRecord[] = [];
      const changes: OwnershipChangeDiff["changes"] = [];

      for (const record of fromRecords) {
        const reassigned = { ...record, ownerId: payload.toOwnerId, ownerName: payload.toOwnerName || payload.toOwnerId };
        affectedRecords.push(reassigned);
        changes.push({ field: `${record.recordId}.ownerId`, fromValue: payload.fromOwnerId, toValue: payload.toOwnerId });
      }

      events.push({ type: "ownership_reassigned", action: "reassign", actor: payload.actor, reason: payload.reason, timestamp: now, recordId: null });
      return {
        applied: true, rejectedReason: null, record: affectedRecords[0] || null, affectedRecords,
        diff: { recordId: "bulk", action: "reassign", changes, summary: `${affectedRecords.length}건 재배정: ${payload.fromOwnerId} → ${payload.toOwnerId}` },
        events,
      };
    }

    case "transfer": {
      if (!payload.fromScopeId || !payload.toScopeId) return reject("fromScopeId, toScopeId 필수");

      const transferRecords = existingRecords.filter(r => r.scopeId === payload.fromScopeId && r.active);
      if (transferRecords.length === 0) return reject(`${payload.fromScopeId}에 active ownership이 없습니다`);

      const affectedRecords: OwnershipRecord[] = [];
      for (const record of transferRecords) {
        affectedRecords.push({ ...record, scopeId: payload.toScopeId, scopeLabel: payload.toScopeLabel || payload.toScopeId });
      }

      events.push({ type: "ownership_transferred", action: "transfer", actor: payload.actor, reason: payload.reason, timestamp: now, recordId: null });
      return {
        applied: true, rejectedReason: null, record: affectedRecords[0] || null, affectedRecords,
        diff: { recordId: "bulk", action: "transfer", changes: [{ field: "scopeId", fromValue: payload.fromScopeId, toValue: payload.toScopeId }], summary: `${affectedRecords.length}건 scope 이전: ${payload.fromScopeId} → ${payload.toScopeId}` },
        events,
      };
    }

    default:
      return reject(`Unknown action: ${payload.action}`);
  }
}

// ══════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════

export type OwnershipAuthoringEventType =
  | "ownership_created" | "ownership_updated" | "ownership_deactivated"
  | "ownership_reassigned" | "ownership_transferred"
  | "ownership_authoring_rejected";

export interface OwnershipAuthoringEvent {
  type: OwnershipAuthoringEventType;
  action: OwnershipAuthoringAction;
  actor: string;
  reason: string;
  timestamp: string;
  recordId: string | null;
}
