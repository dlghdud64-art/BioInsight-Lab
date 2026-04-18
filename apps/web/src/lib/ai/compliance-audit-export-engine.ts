/**
 * Compliance / Audit Export Engine — 감사 추적 데이터 직렬화
 *
 * 승인/정책/히스토리/SoD/위임 계보를 외부 감사 관점으로 직렬화.
 * CSV/JSON 우선 정의, 추후 PDF 확장 가능.
 *
 * EXPORT SCOPE:
 * - case-level: 특정 case의 전체 approval/policy/timeline
 * - date-range: 기간별 전체 approval activity
 * - domain-level: 특정 domain의 approval history
 *
 * EXPORT SECTIONS:
 * 1. case_timeline — stage transition + approval events
 * 2. approval_decisions — 승인/거부/에스컬레이션 이력
 * 3. policy_evaluations — 정책 평가 결과 + 적용된 규칙
 * 4. sod_audit — SoD 검증 이력 + 위반 시도
 * 5. delegation_audit — 위임 계보 + 충돌 감지
 * 6. snapshot_lifecycle — snapshot 발급/소비/무효화/만료
 * 7. org_policy_trace — 조직 정책 매칭 + governing rule
 */

import type { ApprovalDomain } from "./approval-inbox-projection-v2-engine";
import type { StageActionKey, ProcurementRole, ActionRiskTier } from "./dispatch-v2-permission-policy-engine";

// ══════════════════════════════════════════════
// Export Schema
// ══════════════════════════════════════════════

export interface AuditExportRequest {
  exportId: string;
  exportType: "case" | "date_range" | "domain";
  // Scope
  caseId: string | null;
  domain: ApprovalDomain | null;
  dateFrom: string | null;
  dateTo: string | null;
  // Options
  sections: AuditExportSection[];
  format: "json" | "csv";
  includeRawSnapshots: boolean;
  includePolicyTrace: boolean;
  // Metadata
  requestedBy: string;
  requestedAt: string;
  reason: string;
}

export type AuditExportSection =
  | "case_timeline"
  | "approval_decisions"
  | "policy_evaluations"
  | "sod_audit"
  | "delegation_audit"
  | "snapshot_lifecycle"
  | "org_policy_trace";

// ══════════════════════════════════════════════
// Export Record Types
// ══════════════════════════════════════════════

// 1. Case Timeline
export interface CaseTimelineExportRecord {
  caseId: string;
  entryId: string;
  fromStage: string;
  toStage: string;
  transitionType: string;
  actor: string;
  timestamp: string;
  reason: string;
  blockers: string[];
  warnings: string[];
}

// 2. Approval Decisions
export interface ApprovalDecisionExportRecord {
  caseId: string;
  sessionId: string;
  domain: ApprovalDomain;
  actionKey: StageActionKey;
  riskTier: ActionRiskTier;
  requestedBy: string;
  requestedAt: string;
  decision: "approved" | "rejected" | "escalated" | "expired" | "pending";
  decidedBy: string | null;
  decidedAt: string | null;
  decidedByRole: ProcurementRole | null;
  decisionReason: string;
  conditions: string[];
  snapshotId: string | null;
  leadTimeMinutes: number | null;
  slaBreached: boolean;
  dualApprovalUsed: boolean;
}

// 3. Policy Evaluations
export interface PolicyEvaluationExportRecord {
  caseId: string;
  actionKey: StageActionKey;
  constraintKey: string;
  status: "pass" | "warning" | "block";
  reason: string;
  escalationRequired: boolean;
  escalationRole: ProcurementRole | null;
  evaluatedAt: string;
  evaluatedBy: string;
}

// 4. SoD Audit
export interface SoDExportRecord {
  caseId: string;
  actionKey: StageActionKey;
  riskTier: ActionRiskTier;
  preparerId: string | null;
  modifierId: string | null;
  approverId: string | null;
  executorId: string | null;
  checkPhase: "approval" | "execution" | "full";
  result: "passed" | "violated" | "warning";
  violations: string[];
  warnings: string[];
  checkedAt: string;
}

// 5. Delegation Audit
export interface DelegationExportRecord {
  delegationId: string;
  delegatorId: string;
  delegateId: string;
  scopeType: string;
  scopeDetail: string;
  validFrom: string;
  validUntil: string;
  active: boolean;
  revoked: boolean;
  revokedReason: string;
  parentDelegationId: string | null;
  cascadeDepth: number;
  conflictDetected: boolean;
  conflictDetail: string;
}

// 6. Snapshot Lifecycle
export interface SnapshotLifecycleExportRecord {
  snapshotId: string;
  caseId: string;
  actionKey: StageActionKey;
  riskTier: ActionRiskTier;
  issuedBy: string;
  issuedAt: string;
  validUntil: string;
  consumed: boolean;
  consumedAt: string | null;
  consumedByAction: string | null;
  invalidated: boolean;
  invalidationReason: string;
  expired: boolean;
}

// 7. Org Policy Trace
export interface OrgPolicyTraceExportRecord {
  caseId: string;
  domain: string;
  effectiveEffect: string;
  governingRuleId: string | null;
  governingScopeType: string | null;
  governingScopeId: string | null;
  matchedRuleCount: number;
  overriddenRuleIds: string[];
  whyThisEffect: string;
  evaluatedAt: string;
}

// ══════════════════════════════════════════════
// Export Result
// ══════════════════════════════════════════════

export interface AuditExportResult {
  exportId: string;
  exportType: AuditExportRequest["exportType"];
  format: "json" | "csv";
  generatedAt: string;
  generatedBy: string;
  // Sections
  caseTimeline: CaseTimelineExportRecord[];
  approvalDecisions: ApprovalDecisionExportRecord[];
  policyEvaluations: PolicyEvaluationExportRecord[];
  sodAudit: SoDExportRecord[];
  delegationAudit: DelegationExportRecord[];
  snapshotLifecycle: SnapshotLifecycleExportRecord[];
  orgPolicyTrace: OrgPolicyTraceExportRecord[];
  // Summary
  totalRecords: number;
  sectionCounts: Record<AuditExportSection, number>;
}

// ══════════════════════════════════════════════
// Build Export
// ══════════════════════════════════════════════

export function buildAuditExport(
  request: AuditExportRequest,
  data: {
    caseTimeline?: CaseTimelineExportRecord[];
    approvalDecisions?: ApprovalDecisionExportRecord[];
    policyEvaluations?: PolicyEvaluationExportRecord[];
    sodAudit?: SoDExportRecord[];
    delegationAudit?: DelegationExportRecord[];
    snapshotLifecycle?: SnapshotLifecycleExportRecord[];
    orgPolicyTrace?: OrgPolicyTraceExportRecord[];
  },
): AuditExportResult {
  const sections = request.sections;
  const ct = sections.includes("case_timeline") ? (data.caseTimeline || []) : [];
  const ad = sections.includes("approval_decisions") ? (data.approvalDecisions || []) : [];
  const pe = sections.includes("policy_evaluations") ? (data.policyEvaluations || []) : [];
  const sa = sections.includes("sod_audit") ? (data.sodAudit || []) : [];
  const da = sections.includes("delegation_audit") ? (data.delegationAudit || []) : [];
  const sl = sections.includes("snapshot_lifecycle") ? (data.snapshotLifecycle || []) : [];
  const opt = sections.includes("org_policy_trace") ? (data.orgPolicyTrace || []) : [];

  const totalRecords = ct.length + ad.length + pe.length + sa.length + da.length + sl.length + opt.length;

  return {
    exportId: request.exportId,
    exportType: request.exportType,
    format: request.format,
    generatedAt: new Date().toISOString(),
    generatedBy: request.requestedBy,
    caseTimeline: ct,
    approvalDecisions: ad,
    policyEvaluations: pe,
    sodAudit: sa,
    delegationAudit: da,
    snapshotLifecycle: sl,
    orgPolicyTrace: opt,
    totalRecords,
    sectionCounts: {
      case_timeline: ct.length,
      approval_decisions: ad.length,
      policy_evaluations: pe.length,
      sod_audit: sa.length,
      delegation_audit: da.length,
      snapshot_lifecycle: sl.length,
      org_policy_trace: opt.length,
    },
  };
}

// ══════════════════════════════════════════════
// CSV Serialization
// ══════════════════════════════════════════════

export function serializeToCSV<T extends Record<string, unknown>>(
  records: T[],
  columns?: string[],
): string {
  if (records.length === 0) return "";
  const keys = columns || Object.keys(records[0]);
  const header = keys.join(",");
  const rows = records.map(r =>
    keys.map(k => {
      const val = r[k];
      if (val === null || val === undefined) return "";
      const str = Array.isArray(val) ? val.join("; ") : String(val);
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(",")
  );
  return [header, ...rows].join("\n");
}

// ══════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════

export type AuditExportEventType = "audit_export_requested" | "audit_export_generated" | "audit_export_downloaded";
export interface AuditExportEvent { type: AuditExportEventType; exportId: string; exportType: string; requestedBy: string; totalRecords: number; timestamp: string; }
