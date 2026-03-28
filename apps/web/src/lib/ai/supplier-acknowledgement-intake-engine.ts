/**
 * Supplier Acknowledgement Intake Engine — inbound signal capture + candidate matching + review case
 *
 * 고정 규칙:
 * 1. dispatchSendRecord = intake 기준 source. sent ≠ supplier_acknowledged.
 * 2. intake에서 acknowledgement 확정 금지 — candidate capture + match + route만.
 * 3. duplicate / ambiguity guard 필수.
 * 4. canonical supplierAcknowledgementReviewCase = 다음 단계 단일 intake source.
 * 5. raw inbound source를 다음 단계에서 재해석하지 않게 candidate로 정규화.
 */

import type { DispatchSendRecord } from "./dispatch-execution-workbench-engine";

// ── Case Status ──
export type SupplierAckIntakeCaseStatus = "queued" | "monitoring" | "candidate_captured" | "on_hold" | "routed_to_review" | "cancelled";

// ── Candidate Classification ──
export type CandidateClassification = "delivery_receipt_only" | "auto_reply_only" | "portal_received" | "supplier_ack_message" | "supplier_commitment_signal" | "ambiguous_response" | "unrelated_signal";
export type CandidateStatus = "unmatched" | "matched" | "ambiguous" | "duplicate" | "ignored" | "routed_for_review";

// ── Candidate ──
export interface SupplierAcknowledgementCandidate {
  id: string;
  sourceType: CandidateClassification;
  receivedAt: string;
  sourceChannel: string;
  supplierContact: string;
  matchedPoId: string | null;
  matchedSendRecordId: string | null;
  matchingConfidence: "high" | "medium" | "low" | "none";
  status: CandidateStatus;
  operatorIntakeNote: string;
  evidenceSummary: string;
}

// ── State ──
export interface SupplierAckIntakeWorkbenchState {
  caseStatus: SupplierAckIntakeCaseStatus;
  dispatchSendRecordId: string;
  poRecordId: string;
  vendorId: string;
  sentChannel: string;
  sentAt: string;
  candidates: SupplierAcknowledgementCandidate[];
  selectedCandidateId: string | null;
  duplicateRisk: boolean;
  ambiguityPresent: boolean;
  blockerCount: number;
  warningCount: number;
  reviewCaseId: string | null;
}

export function createInitialSupplierAckIntakeState(sendRecord: DispatchSendRecord): SupplierAckIntakeWorkbenchState {
  return {
    caseStatus: "monitoring",
    dispatchSendRecordId: sendRecord.id,
    poRecordId: sendRecord.sourcePoRecordId,
    vendorId: sendRecord.vendorId,
    sentChannel: sendRecord.channel,
    sentAt: sendRecord.sentAt,
    candidates: [],
    selectedCandidateId: null,
    duplicateRisk: false,
    ambiguityPresent: false,
    blockerCount: 0,
    warningCount: 0,
    reviewCaseId: null,
  };
}

// ── Intake Readiness ──
export interface AckIntakeReadinessResult { canRouteToReview: boolean; blockers: string[]; warnings: string[]; }

export function evaluateAckIntakeReadiness(state: SupplierAckIntakeWorkbenchState): AckIntakeReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!state.dispatchSendRecordId) blockers.push("Send record 없음");
  if (state.candidates.length === 0) blockers.push("Inbound candidate 없음");

  const matched = state.candidates.filter(c => c.status === "matched");
  const ambiguous = state.candidates.filter(c => c.status === "ambiguous");

  if (matched.length === 0 && ambiguous.length === 0) blockers.push("매칭된 candidate 없음");

  const autoReplyOnly = state.candidates.every(c => c.sourceType === "auto_reply_only" || c.sourceType === "delivery_receipt_only");
  if (autoReplyOnly && state.candidates.length > 0) blockers.push("자동응답만으로는 acknowledgement review 불가");

  if (ambiguous.length > 0) warnings.push(`${ambiguous.length}개 모호한 매칭 존재`);
  if (state.duplicateRisk) warnings.push("중복 candidate 위험");

  const selectedCandidate = state.selectedCandidateId ? state.candidates.find(c => c.id === state.selectedCandidateId) : null;
  if (selectedCandidate?.status === "duplicate") blockers.push("선택된 candidate가 duplicate입니다");

  return { canRouteToReview: blockers.length === 0, blockers, warnings };
}

// ── Candidate Capture (simulate) ──
export function captureAckCandidate(
  state: SupplierAckIntakeWorkbenchState,
  candidate: Omit<SupplierAcknowledgementCandidate, "id">,
): SupplierAckIntakeWorkbenchState {
  const newCandidate: SupplierAcknowledgementCandidate = {
    ...candidate,
    id: `ackcandidate_${Date.now().toString(36)}`,
  };

  // Duplicate check
  const isDuplicate = state.candidates.some(
    c => c.sourceChannel === newCandidate.sourceChannel
      && c.receivedAt === newCandidate.receivedAt
      && c.supplierContact === newCandidate.supplierContact,
  );

  if (isDuplicate) {
    newCandidate.status = "duplicate";
  }

  const candidates = [...state.candidates, newCandidate];
  const ambiguityPresent = candidates.some(c => c.status === "ambiguous");
  const duplicateRisk = candidates.some(c => c.status === "duplicate");

  return {
    ...state,
    caseStatus: "candidate_captured",
    candidates,
    ambiguityPresent,
    duplicateRisk,
  };
}

// ── Canonical Supplier Acknowledgement Review Case ──
export interface SupplierAcknowledgementReviewCase {
  id: string;
  sourcePoRecordId: string;
  sourceDispatchSendRecordId: string;
  sourceSupplierAckIntakeCaseId: string;
  sourceSupplierAckCandidateId: string;
  vendorId: string;
  candidateType: CandidateClassification;
  sourceChannel: string;
  senderIdentity: string;
  receivedAt: string;
  matchingConfidence: string;
  evidenceSummary: string;
  ambiguitySnapshot: string;
  duplicateSnapshot: string;
  operatorIntakeNote: string;
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_review" | "resolved" | "returned_to_intake" | "cancelled";
  nextDestination: string;
}

export function buildSupplierAckReviewCase(
  state: SupplierAckIntakeWorkbenchState,
  candidateId: string,
): SupplierAcknowledgementReviewCase | null {
  const candidate = state.candidates.find(c => c.id === candidateId);
  if (!candidate || (candidate.status !== "matched" && candidate.status !== "routed_for_review")) return null;

  return {
    id: `ackreview_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceDispatchSendRecordId: state.dispatchSendRecordId,
    sourceSupplierAckIntakeCaseId: `ackintake_${state.dispatchSendRecordId}`,
    sourceSupplierAckCandidateId: candidate.id,
    vendorId: state.vendorId,
    candidateType: candidate.sourceType,
    sourceChannel: candidate.sourceChannel,
    senderIdentity: candidate.supplierContact,
    receivedAt: candidate.receivedAt,
    matchingConfidence: candidate.matchingConfidence,
    evidenceSummary: candidate.evidenceSummary,
    ambiguitySnapshot: state.ambiguityPresent ? "모호한 매칭 있음" : "없음",
    duplicateSnapshot: state.duplicateRisk ? "중복 위험 있음" : "없음",
    operatorIntakeNote: candidate.operatorIntakeNote,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "queued",
    nextDestination: "acknowledgement_review",
  };
}
