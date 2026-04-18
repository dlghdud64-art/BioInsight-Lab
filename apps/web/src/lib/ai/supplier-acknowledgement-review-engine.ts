/**
 * Supplier Acknowledgement Review Engine — evidence review + classification + final ack record + followup case
 *
 * 고정 규칙:
 * 1. supplierAcknowledgementReviewCase = 단일 입력 source.
 * 2. intake candidate ≠ final ack truth. review 판정 이후에만 record 생성.
 * 3. confirmed / conditional / partial / declined / unclear 구조적 분리.
 * 4. confirmed일 때만 poRecord.status = supplier_acknowledged 전이.
 * 5. conditional / partial / unclear → followup case로 분기.
 */

import type { SupplierAcknowledgementReviewCase, CandidateClassification } from "./supplier-acknowledgement-intake-engine";

// ── Review Case Status ──
export type AckReviewCaseStatus = "queued" | "in_review" | "on_hold" | "resolved_confirmed" | "resolved_followup_required" | "returned_to_intake" | "cancelled";
export type AckResolutionReadiness = "blocked" | "warning" | "ready";

// ── Acknowledgement Type ──
export type AcknowledgementType = "confirmed" | "conditional" | "partial" | "declined" | "unclear_followup_required";

// ── Classification ──
export type AckClassification = "auto_reply_not_ack" | "delivery_receipt_not_ack" | "acknowledgement_confirmed" | "acknowledgement_conditional" | "acknowledgement_partial" | "acknowledgement_declined" | "ambiguous_followup_required";

// ── Scope ──
export type AckScope = "full_po" | "partial_lines" | "receipt_only" | "pricing_pending" | "schedule_pending" | "condition_attached";

// ── Decision ──
export interface SupplierAckDecision {
  type: AckClassification;
  scope: AckScope;
  confidence: "high" | "medium" | "low";
  conditions: string[];
  followupRequired: boolean;
  operatorNote: string;
}

// ── State ──
export interface SupplierAckReviewWorkbenchState {
  caseStatus: AckReviewCaseStatus;
  resolutionReadiness: AckResolutionReadiness;
  reviewCaseId: string;
  poRecordId: string;
  vendorId: string;
  candidateType: CandidateClassification;
  matchingConfidence: string;
  evidenceSummary: string;
  decision: SupplierAckDecision | null;
  blockerCount: number;
  warningCount: number;
  ackRecordId: string | null;
  followupCaseId: string | null;
}

export function createInitialAckReviewState(reviewCase: SupplierAcknowledgementReviewCase): SupplierAckReviewWorkbenchState {
  const readiness = evaluateAckReviewReadiness(reviewCase, null);
  return {
    caseStatus: "in_review",
    resolutionReadiness: readiness.status,
    reviewCaseId: reviewCase.id,
    poRecordId: reviewCase.sourcePoRecordId,
    vendorId: reviewCase.vendorId,
    candidateType: reviewCase.candidateType,
    matchingConfidence: reviewCase.matchingConfidence,
    evidenceSummary: reviewCase.evidenceSummary,
    decision: null,
    blockerCount: readiness.blockers.length,
    warningCount: readiness.warnings.length,
    ackRecordId: null,
    followupCaseId: null,
  };
}

// ── Readiness ──
export interface AckReviewReadinessResult { status: AckResolutionReadiness; blockers: string[]; warnings: string[]; }

export function evaluateAckReviewReadiness(reviewCase: SupplierAcknowledgementReviewCase, decision: SupplierAckDecision | null): AckReviewReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!reviewCase.sourcePoRecordId) blockers.push("PO record lineage 없음");
  if (!reviewCase.sourceDispatchSendRecordId) blockers.push("Send record lineage 없음");
  if (reviewCase.matchingConfidence === "none" || reviewCase.matchingConfidence === "low") blockers.push("매칭 신뢰도 부족");
  if (reviewCase.ambiguitySnapshot.includes("있음")) warnings.push("모호한 매칭 존재");
  if (reviewCase.duplicateSnapshot.includes("있음")) warnings.push("중복 위험 존재");

  if (!decision) {
    blockers.push("분류 결정 미완료");
  } else {
    if (decision.type === "auto_reply_not_ack" || decision.type === "delivery_receipt_not_ack") {
      blockers.push("자동응답/수신확인은 acknowledgement로 확정 불가");
    }
    if (decision.confidence === "low") warnings.push("판정 신뢰도 낮음");
    if (decision.followupRequired) warnings.push("후속 확인 필요");
  }

  return { status: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready", blockers, warnings };
}

// ── Canonical Supplier Acknowledgement Record ──
export interface SupplierAcknowledgementRecord {
  id: string;
  sourcePoRecordId: string;
  sourceDispatchSendRecordId: string;
  sourceSupplierAckCandidateId: string;
  sourceSupplierAckReviewCaseId: string;
  vendorId: string;
  acknowledgementType: AcknowledgementType;
  acknowledgementScope: AckScope;
  confidence: string;
  conditions: string[];
  declineReason: string;
  confirmedLineSummary: string;
  receivedAt: string;
  resolvedAt: string;
  resolvedBy: string;
  evidenceSummary: string;
  operatorReviewNote: string;
  status: AcknowledgementType;
  nextDestination: string;
}

export function buildSupplierAckRecord(state: SupplierAckReviewWorkbenchState, reviewCase: SupplierAcknowledgementReviewCase): SupplierAcknowledgementRecord | null {
  if (!state.decision) return null;
  const d = state.decision;
  const ackType: AcknowledgementType =
    d.type === "acknowledgement_confirmed" ? "confirmed"
    : d.type === "acknowledgement_conditional" ? "conditional"
    : d.type === "acknowledgement_partial" ? "partial"
    : d.type === "acknowledgement_declined" ? "declined"
    : "unclear_followup_required";

  const nextDest = ackType === "confirmed" ? "receiving_preparation" : ackType === "declined" ? "correction_reopen" : "acknowledgement_followup";

  return {
    id: `ackrecord_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceDispatchSendRecordId: reviewCase.sourceDispatchSendRecordId,
    sourceSupplierAckCandidateId: reviewCase.sourceSupplierAckCandidateId,
    sourceSupplierAckReviewCaseId: reviewCase.id,
    vendorId: state.vendorId,
    acknowledgementType: ackType,
    acknowledgementScope: d.scope,
    confidence: d.confidence,
    conditions: d.conditions,
    declineReason: ackType === "declined" ? d.operatorNote : "",
    confirmedLineSummary: d.scope === "full_po" ? "전체 라인" : "부분 라인",
    receivedAt: reviewCase.receivedAt,
    resolvedAt: new Date().toISOString(),
    resolvedBy: "operator",
    evidenceSummary: state.evidenceSummary,
    operatorReviewNote: d.operatorNote,
    status: ackType,
    nextDestination: nextDest,
  };
}

// ── poRecord.status 전이 판단 ──
export function canTransitionToSupplierAcknowledged(ackRecord: SupplierAcknowledgementRecord): boolean {
  return ackRecord.status === "confirmed";
}

// ── Canonical Follow-up Case ──
export type FollowupType = "scope_clarification" | "schedule_confirmation" | "pricing_confirmation" | "partial_acceptance_resolution" | "decline_recovery" | "ambiguous_ack_resolution";

export interface SupplierAckFollowupCase {
  id: string;
  sourcePoRecordId: string;
  sourceSupplierAckRecordId: string;
  vendorId: string;
  followupType: FollowupType;
  openIssuesSummary: string;
  conditionSummary: string;
  affectedLineSummary: string;
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_progress" | "resolved" | "cancelled";
  nextDestination: string;
}

export function buildSupplierAckFollowupCase(ackRecord: SupplierAcknowledgementRecord): SupplierAckFollowupCase | null {
  if (ackRecord.status === "confirmed") return null; // no followup needed

  const followupType: FollowupType =
    ackRecord.status === "conditional" ? "scope_clarification"
    : ackRecord.status === "partial" ? "partial_acceptance_resolution"
    : ackRecord.status === "declined" ? "decline_recovery"
    : "ambiguous_ack_resolution";

  return {
    id: `ackfollowup_${Date.now().toString(36)}`,
    sourcePoRecordId: ackRecord.sourcePoRecordId,
    sourceSupplierAckRecordId: ackRecord.id,
    vendorId: ackRecord.vendorId,
    followupType,
    openIssuesSummary: ackRecord.conditions.join("; ") || ackRecord.operatorReviewNote,
    conditionSummary: ackRecord.conditions.join("; "),
    affectedLineSummary: ackRecord.confirmedLineSummary,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "queued",
    nextDestination: "acknowledgement_followup",
  };
}
