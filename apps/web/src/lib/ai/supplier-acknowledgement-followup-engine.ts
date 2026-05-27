/**
 * Supplier Acknowledgement Follow-up Engine — open issue resolution + ack upgrade + reroute cases
 *
 * 고정 규칙:
 * 1. supplierAcknowledgementFollowupCase = 단일 입력 source.
 * 2. follow-up resolution ≠ supplier_acknowledged 자동 전이.
 * 3. upgrade_to_confirmed일 때만 ack record 승격 + poRecord 전이 허용.
 * 4. conditional/partial/unclear/decline → reroute case로 분기.
 * 5. receiving chain 직접 점프 금지.
 */

import type { SupplierAckFollowupCase, FollowupType } from "./supplier-acknowledgement-review-engine";

// ── Case Status ──
export type AckFollowupCaseStatus = "queued" | "in_followup" | "on_hold" | "awaiting_supplier_response" | "awaiting_internal_decision" | "resolved_confirmable" | "rerouted" | "cancelled";
export type AckFollowupResolutionReadiness = "blocked" | "warning" | "ready";

// ── Resolution Decision ──
export type FollowupResolutionDecision = "upgrade_to_confirmed" | "remain_conditional" | "remain_partial" | "reroute_to_correction" | "reroute_to_recovery" | "reroute_to_redispatch" | "escalate_unresolved";

// ── Decision ──
export interface FollowupDecision {
  type: FollowupType;
  resolution: FollowupResolutionDecision;
  resolvedScope: string;
  closedConditions: string[];
  remainingIssues: string[];
  requiresSupplierResponse: boolean;
  requiresInternalDecision: boolean;
  operatorNote: string;
}

// ── State ──
export interface SupplierAckFollowupWorkbenchState {
  caseStatus: AckFollowupCaseStatus;
  resolutionReadiness: AckFollowupResolutionReadiness;
  followupCaseId: string;
  poRecordId: string;
  vendorId: string;
  followupType: FollowupType;
  openIssuesSummary: string;
  conditionSummary: string;
  affectedLineSummary: string;
  decision: FollowupDecision | null;
  blockerCount: number;
  warningCount: number;
  resolutionRecordId: string | null;
  rerouteCaseId: string | null;
}

export function createInitialAckFollowupState(followupCase: SupplierAckFollowupCase): SupplierAckFollowupWorkbenchState {
  return {
    caseStatus: "in_followup",
    resolutionReadiness: "blocked",
    followupCaseId: followupCase.id,
    poRecordId: followupCase.sourcePoRecordId,
    vendorId: followupCase.vendorId,
    followupType: followupCase.followupType,
    openIssuesSummary: followupCase.openIssuesSummary,
    conditionSummary: followupCase.conditionSummary,
    affectedLineSummary: followupCase.affectedLineSummary,
    decision: null,
    blockerCount: 1,
    warningCount: 0,
    resolutionRecordId: null,
    rerouteCaseId: null,
  };
}

// ── Readiness ──
export interface AckFollowupReadinessResult { status: AckFollowupResolutionReadiness; blockers: string[]; warnings: string[]; }

export function evaluateAckFollowupReadiness(state: SupplierAckFollowupWorkbenchState): AckFollowupReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!state.followupCaseId) blockers.push("Follow-up case 없음");
  if (!state.decision) blockers.push("Resolution decision 미완료");

  if (state.decision) {
    if (state.decision.remainingIssues.length > 0 && state.decision.resolution === "upgrade_to_confirmed") {
      blockers.push("미해결 issue가 있는데 confirmed 승격 불가");
    }
    if (state.decision.requiresSupplierResponse) warnings.push("공급사 추가 답변 대기 중");
    if (state.decision.requiresInternalDecision) warnings.push("내부 판단 대기 중");
    if (state.decision.resolution === "remain_conditional") warnings.push("조건부 상태 유지");
    if (state.decision.resolution === "remain_partial") warnings.push("부분 확인 상태 유지");
  }

  if (state.caseStatus === "awaiting_supplier_response") warnings.push("공급사 응답 대기 상태");
  if (state.caseStatus === "awaiting_internal_decision") warnings.push("내부 판단 대기 상태");

  return { status: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready", blockers, warnings };
}

// ── Canonical Resolution Record ──
export interface SupplierAckResolutionRecord {
  id: string;
  sourcePoRecordId: string;
  sourceSupplierAckRecordId: string;
  sourceSupplierAckFollowupCaseId: string;
  vendorId: string;
  followupType: FollowupType;
  resolutionDecision: FollowupResolutionDecision;
  resolvedScope: string;
  closedConditions: string[];
  remainingIssues: string[];
  supplierResponseSummary: string;
  internalDecisionSummary: string;
  resolvedAt: string;
  resolvedBy: string;
  operatorFollowupNote: string;
  status: FollowupResolutionDecision;
  nextDestination: string;
}

export function buildSupplierAckResolutionRecord(state: SupplierAckFollowupWorkbenchState): SupplierAckResolutionRecord | null {
  if (!state.decision) return null;
  const d = state.decision;
  const nextDest =
    d.resolution === "upgrade_to_confirmed" ? "receiving_preparation"
    : d.resolution === "reroute_to_correction" ? "acknowledgement_correction"
    : d.resolution === "reroute_to_recovery" ? "acknowledgement_recovery"
    : d.resolution === "reroute_to_redispatch" ? "acknowledgement_redispatch"
    : d.resolution === "escalate_unresolved" ? "escalation_queue"
    : "followup_hold";

  return {
    id: `ackresolution_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceSupplierAckRecordId: "",
    sourceSupplierAckFollowupCaseId: state.followupCaseId,
    vendorId: state.vendorId,
    followupType: state.followupType,
    resolutionDecision: d.resolution,
    resolvedScope: d.resolvedScope,
    closedConditions: d.closedConditions,
    remainingIssues: d.remainingIssues,
    supplierResponseSummary: "",
    internalDecisionSummary: "",
    resolvedAt: new Date().toISOString(),
    resolvedBy: "operator",
    operatorFollowupNote: d.operatorNote,
    status: d.resolution,
    nextDestination: nextDest,
  };
}

// ── Can Upgrade Ack to Confirmed ──
export function canUpgradeAckToConfirmed(resolutionRecord: SupplierAckResolutionRecord): boolean {
  return resolutionRecord.status === "upgrade_to_confirmed" && resolutionRecord.remainingIssues.length === 0;
}

// ── Canonical Reroute Case ──
export interface AckRerouteCase {
  id: string;
  sourcePoRecordId: string;
  sourceSupplierAckResolutionRecordId: string;
  issueType: string;
  openIssuesSummary: string;
  affectedLineSummary: string;
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_progress" | "resolved" | "cancelled";
  nextDestination: string;
}

export function buildAckRerouteCase(resolutionRecord: SupplierAckResolutionRecord): AckRerouteCase | null {
  if (resolutionRecord.status === "upgrade_to_confirmed") return null;
  if (resolutionRecord.status === "remain_conditional" || resolutionRecord.status === "remain_partial") return null;

  const issueType =
    resolutionRecord.status === "reroute_to_correction" ? "correction"
    : resolutionRecord.status === "reroute_to_recovery" ? "recovery"
    : resolutionRecord.status === "reroute_to_redispatch" ? "redispatch"
    : "escalation";

  return {
    id: `ackrr_${Date.now().toString(36)}`,
    sourcePoRecordId: resolutionRecord.sourcePoRecordId,
    sourceSupplierAckResolutionRecordId: resolutionRecord.id,
    issueType,
    openIssuesSummary: resolutionRecord.remainingIssues.join("; "),
    affectedLineSummary: resolutionRecord.resolvedScope,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "queued",
    nextDestination: resolutionRecord.nextDestination,
  };
}
