/**
 * Ownership Conflict Remediation Engine
 *
 * detect만 하지 말고 바로 수정 가능한 remediation action 제공.
 *
 * CONFLICT TYPES:
 * 1. sod_violation — author = reviewer
 * 2. reviewer_absent — reviewer 미지정/비활성
 * 3. future_date_overlap — 같은 scope에 겹치는 effective date
 * 4. duplicate_scope — 같은 scope/domain에 복수 active record
 * 5. ownerless_hotspot — deactivate 후 ownerless 건 발생
 * 6. overload_threshold — 대상 owner load > threshold
 * 7. escalation_chain_broken — escalation path에 빈 단계
 *
 * 각 conflict에 대해 remediation action을 제안.
 */

import type { OwnershipRecord, OwnershipType } from "./multi-team-ownership-engine";
import type { OwnershipChangeRequest } from "./ownership-governance-lifecycle-engine";
import type { OwnerMetrics } from "./ownership-aware-governance-metrics";

// ── Conflict Type ──
export type OwnershipConflictType =
  | "sod_violation"
  | "reviewer_absent"
  | "future_date_overlap"
  | "duplicate_scope"
  | "ownerless_hotspot"
  | "overload_threshold"
  | "escalation_chain_broken";

// ── Detected Conflict ──
export interface DetectedConflict {
  conflictId: string;
  type: OwnershipConflictType;
  severity: "critical" | "high" | "medium" | "low";
  detail: string;
  affectedRecordIds: string[];
  affectedChangeRequestId: string | null;
  // Remediation
  remediationActions: RemediationAction[];
  autoRemediable: boolean;
}

// ── Remediation Action ──
export interface RemediationAction {
  actionId: string;
  label: string;
  description: string;
  type: "reassign_reviewer" | "resolve_overlap" | "deactivate_duplicate" | "assign_backup" | "redistribute_load" | "fill_escalation_gap" | "adjust_effective_date";
  targetRecordId: string | null;
  suggestedValue: string;
  autoExecutable: boolean;
}

// ── Detection Result ──
export interface ConflictDetectionResult {
  conflicts: DetectedConflict[];
  totalConflicts: number;
  criticalCount: number;
  autoRemediableCount: number;
  summary: string;
  generatedAt: string;
}

// ── Detect All Conflicts ──
export function detectOwnershipConflicts(
  records: OwnershipRecord[],
  changeRequests: OwnershipChangeRequest[],
  ownerMetrics: OwnerMetrics[],
): ConflictDetectionResult {
  const conflicts: DetectedConflict[] = [];
  let conflictIdx = 0;
  const makeId = () => `ownconf_${(conflictIdx++).toString(36)}`;

  const active = records.filter(r => r.active);

  // 1. SoD violations in pending change requests
  for (const cr of changeRequests) {
    if (cr.status === "pending_review" && cr.authorId === cr.reviewerId) {
      conflicts.push({
        conflictId: makeId(), type: "sod_violation", severity: "critical",
        detail: `변경 요청 ${cr.changeRequestId}: 작성자(${cr.authorId})와 검토자가 동일인`,
        affectedRecordIds: cr.targetRecords,
        affectedChangeRequestId: cr.changeRequestId,
        remediationActions: [{
          actionId: `rem_${makeId()}`, label: "다른 검토자 지정",
          description: "작성자와 다른 검토자를 배정하세요",
          type: "reassign_reviewer", targetRecordId: null,
          suggestedValue: "", autoExecutable: false,
        }],
        autoRemediable: false,
      });
    }
  }

  // 2. Reviewer absent
  for (const cr of changeRequests) {
    if (cr.status === "pending_review" && !cr.reviewerId) {
      conflicts.push({
        conflictId: makeId(), type: "reviewer_absent", severity: "high",
        detail: `변경 요청 ${cr.changeRequestId}: 검토자 미지정`,
        affectedRecordIds: cr.targetRecords,
        affectedChangeRequestId: cr.changeRequestId,
        remediationActions: [{
          actionId: `rem_${makeId()}`, label: "검토자 배정",
          description: "적절한 검토자를 지정하세요",
          type: "reassign_reviewer", targetRecordId: null,
          suggestedValue: "", autoExecutable: false,
        }],
        autoRemediable: false,
      });
    }
  }

  // 3. Duplicate scope
  const scopeGroups = new Map<string, OwnershipRecord[]>();
  for (const r of active) {
    const key = `${r.ownershipType}:${r.scopeType}:${r.scopeId}:${r.domain || "all"}`;
    if (!scopeGroups.has(key)) scopeGroups.set(key, []);
    scopeGroups.get(key)!.push(r);
  }
  for (const [key, group] of scopeGroups) {
    if (group.length > 1) {
      conflicts.push({
        conflictId: makeId(), type: "duplicate_scope", severity: "high",
        detail: `동일 scope에 ${group.length}개 active ownership: ${key}`,
        affectedRecordIds: group.map(r => r.recordId),
        affectedChangeRequestId: null,
        remediationActions: group.slice(1).map(r => ({
          actionId: `rem_${makeId()}`, label: `${r.ownerName} 비활성화`,
          description: `중복 record ${r.recordId} 비활성화`,
          type: "deactivate_duplicate" as const, targetRecordId: r.recordId,
          suggestedValue: "deactivate", autoExecutable: true,
        })),
        autoRemediable: true,
      });
    }
  }

  // 4. Overload threshold
  for (const m of ownerMetrics) {
    if (m.loadLevel === "overloaded") {
      const ownerRecords = active.filter(r => r.ownerId === m.ownerId);
      conflicts.push({
        conflictId: makeId(), type: "overload_threshold", severity: "high",
        detail: `${m.ownerName} load ${m.loadScore} — 과부하. ${m.pendingCount}건 대기`,
        affectedRecordIds: ownerRecords.map(r => r.recordId),
        affectedChangeRequestId: null,
        remediationActions: [{
          actionId: `rem_${makeId()}`, label: "부하 재분배",
          description: `${m.ownerName}의 일부 건을 다른 담당자에게 재배정`,
          type: "redistribute_load", targetRecordId: null,
          suggestedValue: "", autoExecutable: false,
        }],
        autoRemediable: false,
      });
    }
  }

  // 5. Escalation chain gaps
  const ownershipTypes: OwnershipType[] = ["approval_owner", "escalation_owner", "policy_owner", "backlog_owner", "sla_owner"];
  const scopes = [...new Set(active.map(r => `${r.scopeType}:${r.scopeId}`))];
  for (const scope of scopes) {
    const scopeRecords = active.filter(r => `${r.scopeType}:${r.scopeId}` === scope);
    const coveredTypes = new Set(scopeRecords.map(r => r.ownershipType));
    const missingTypes = ownershipTypes.filter(t => !coveredTypes.has(t));
    if (missingTypes.length > 0 && coveredTypes.size > 0) { // at least some ownership exists
      conflicts.push({
        conflictId: makeId(), type: "escalation_chain_broken", severity: "medium",
        detail: `${scope}에 ${missingTypes.join(", ")} ownership 미지정`,
        affectedRecordIds: scopeRecords.map(r => r.recordId),
        affectedChangeRequestId: null,
        remediationActions: missingTypes.map(t => ({
          actionId: `rem_${makeId()}`, label: `${t} 배정`,
          description: `${scope}에 ${t} 담당자를 배정하세요`,
          type: "fill_escalation_gap" as const, targetRecordId: null,
          suggestedValue: t, autoExecutable: false,
        })),
        autoRemediable: false,
      });
    }
  }

  // 6. Future date overlap
  for (const cr of changeRequests) {
    if (cr.scheduledApply && cr.status === "approved") {
      const overlapping = changeRequests.filter(other =>
        other.changeRequestId !== cr.changeRequestId &&
        other.scheduledApply && other.status === "approved" &&
        other.domain === cr.domain &&
        other.targetRecords.some(t => cr.targetRecords.includes(t))
      );
      if (overlapping.length > 0) {
        conflicts.push({
          conflictId: makeId(), type: "future_date_overlap", severity: "medium",
          detail: `변경 ${cr.changeRequestId}과 ${overlapping.map(o => o.changeRequestId).join(", ")}이 같은 scope/date에 겹침`,
          affectedRecordIds: cr.targetRecords,
          affectedChangeRequestId: cr.changeRequestId,
          remediationActions: [{
            actionId: `rem_${makeId()}`, label: "적용 일자 조정",
            description: "겹치는 변경의 effective date를 조정하세요",
            type: "adjust_effective_date", targetRecordId: null,
            suggestedValue: "", autoExecutable: false,
          }],
          autoRemediable: false,
        });
      }
    }
  }

  const criticalCount = conflicts.filter(c => c.severity === "critical").length;
  const autoRemediableCount = conflicts.filter(c => c.autoRemediable).length;

  return {
    conflicts,
    totalConflicts: conflicts.length,
    criticalCount,
    autoRemediableCount,
    summary: conflicts.length === 0
      ? "충돌 없음"
      : `${conflicts.length}건 충돌 (${criticalCount} critical, ${autoRemediableCount} 자동 수정 가능)`,
    generatedAt: new Date().toISOString(),
  };
}
