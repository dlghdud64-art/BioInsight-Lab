/**
 * Approval Workbench Engine — canonical approval workbench + decision record + routing
 */

import type { CanonicalApprovalHandoffPackage } from "./approval-handoff-gate-engine";

// ── Case Status ──
export type ApprovalCaseStatus = "pending_review" | "in_review" | "approved" | "returned_for_revision" | "rejected" | "cancelled";
export type ApprovalDecisionMode = "approve" | "return_for_revision" | "reject";
export type ApprovalDecisionReadiness = "blocked" | "warning" | "ready";

// ── Reason Codes ──
export type ApprovalReasonCode = "budget_ok" | "policy_fit" | "preferred_vendor" | "operational_urgency" | "spec_validated" | "prior_performance" | "other";
export type ReturnReasonCode = "missing_context" | "insufficient_rationale" | "policy_exception_needs_fix" | "budget_issue" | "quote_stale" | "vendor_risk_needs_review" | "other";
export type RejectReasonCode = "policy_violation" | "budget_rejected" | "invalid_vendor_selection" | "duplicate_request" | "non_compliant_item" | "other";

// ── State ──
export interface ApprovalWorkbenchState {
  approvalCaseStatus: ApprovalCaseStatus;
  approvalHandoffPackageId: string;
  requestReference: string;
  compareReference: string;
  selectedVendor: string;
  totalAmountSummary: string;
  decisionMode: ApprovalDecisionMode | null;
  decisionReadiness: ApprovalDecisionReadiness;
  approvalReasonCodes: ApprovalReasonCode[];
  approvalNote: string;
  returnReasonCodes: ReturnReasonCode[];
  returnNote: string;
  rejectReasonCodes: RejectReasonCode[];
  rejectNote: string;
  acknowledgedWarnings: string[];
  approvalDecisionRecordId: string | null;
  nextDestination: string | null;
}

export function createInitialApprovalWorkbenchState(pkg: CanonicalApprovalHandoffPackage): ApprovalWorkbenchState {
  return { approvalCaseStatus: "in_review", approvalHandoffPackageId: pkg.id, requestReference: pkg.sourceRequestId, compareReference: pkg.sourceCompareReviewId, selectedVendor: pkg.selectedVendorId, totalAmountSummary: "", decisionMode: null, decisionReadiness: pkg.blockerSnapshot.length > 0 ? "blocked" : pkg.warningSnapshot.length > 0 ? "warning" : "ready", approvalReasonCodes: [], approvalNote: "", returnReasonCodes: [], returnNote: "", rejectReasonCodes: [], rejectNote: "", acknowledgedWarnings: [], approvalDecisionRecordId: null, nextDestination: null };
}

// ── Validator ──
export interface ApprovalWorkbenchValidation { canApprove: boolean; canReturn: boolean; canReject: boolean; blockingIssues: string[]; warnings: string[]; recommendedNextAction: string; }
export function validateApprovalWorkbenchDecision(state: ApprovalWorkbenchState): ApprovalWorkbenchValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (state.decisionReadiness === "blocked") blocking.push("Handoff package blocker 미해결");
  if (state.decisionMode === "approve" && state.approvalReasonCodes.length === 0) blocking.push("승인 이유 미선택");
  if (state.decisionMode === "return_for_revision" && state.returnReasonCodes.length === 0) blocking.push("보완 요청 이유 미선택");
  if (state.decisionMode === "reject" && state.rejectReasonCodes.length === 0) blocking.push("반려 이유 미선택");
  if (state.decisionReadiness === "warning" && state.decisionMode === "approve" && state.acknowledgedWarnings.length === 0) warnings.push("경고 인지 필요");
  const canApprove = state.decisionMode === "approve" && blocking.length === 0 && (state.decisionReadiness !== "warning" || state.acknowledgedWarnings.length > 0);
  return { canApprove, canReturn: state.decisionMode === "return_for_revision" && state.returnReasonCodes.length > 0, canReject: state.decisionMode === "reject" && state.rejectReasonCodes.length > 0, blockingIssues: blocking, warnings, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : !state.decisionMode ? "결정 모드 선택" : "결정 확정" };
}

// ── Canonical Decision Record ──
export interface ApprovalDecisionRecord { id: string; approvalCaseId: string; approvalHandoffPackageId: string; decisionMode: ApprovalDecisionMode; readinessAtDecision: ApprovalDecisionReadiness; approvalReasonCodes: ApprovalReasonCode[]; approvalNote: string; returnReasonCodes: ReturnReasonCode[]; returnNote: string; rejectReasonCodes: RejectReasonCode[]; rejectNote: string; acknowledgedWarnings: string[]; approvedScope: string; decidedAt: string; decidedBy: string; nextDestination: string; }
export function buildApprovalDecisionRecord(state: ApprovalWorkbenchState): ApprovalDecisionRecord {
  const destination = state.decisionMode === "approve" ? "po_conversion_entry" : state.decisionMode === "return_for_revision" ? "compare_review_reopen" : "terminated";
  return { id: `appdec_${Date.now().toString(36)}`, approvalCaseId: state.approvalHandoffPackageId, approvalHandoffPackageId: state.approvalHandoffPackageId, decisionMode: state.decisionMode || "approve", readinessAtDecision: state.decisionReadiness, approvalReasonCodes: state.approvalReasonCodes, approvalNote: state.approvalNote, returnReasonCodes: state.returnReasonCodes, returnNote: state.returnNote, rejectReasonCodes: state.rejectReasonCodes, rejectNote: state.rejectNote, acknowledgedWarnings: state.acknowledgedWarnings, approvedScope: state.selectedVendor, decidedAt: new Date().toISOString(), decidedBy: "operator", nextDestination: destination };
}

// ── PO Conversion Entry Handoff Package ──
export interface PoConversionEntryHandoffPackageV2 { id: string; sourceRequestId: string; sourceCompareReviewId: string; sourceApprovalCaseId: string; sourceApprovalDecisionRecordId: string; selectedVendorId: string; approvedItemLines: ApprovedItemLine[]; approvedQtySummary: string; approvedAmountSummary: string; requesterContext: string; departmentContext: string; budgetPolicyContext: string; approvalRationaleSummary: string; exceptionSummary: string; quoteReferenceSummary: string; attachmentSummary: string; createdAt: string; createdBy: string; }
export interface ApprovedItemLine { itemId: string; itemName: string; supplierSku: string; pack: string; qty: number; unitPrice: number; lineTotal: number; note: string; }

export function buildPoConversionEntryHandoffPackageV2(record: ApprovalDecisionRecord, pkg: CanonicalApprovalHandoffPackage): PoConversionEntryHandoffPackageV2 {
  return { id: `poehpkg_${Date.now().toString(36)}`, sourceRequestId: pkg.sourceRequestId, sourceCompareReviewId: pkg.sourceCompareReviewId, sourceApprovalCaseId: record.approvalCaseId, sourceApprovalDecisionRecordId: record.id, selectedVendorId: pkg.selectedVendorId, approvedItemLines: pkg.selectedOptionIds.map((id, i) => ({ itemId: id, itemName: `Item ${i + 1}`, supplierSku: "", pack: "", qty: 1, unitPrice: 0, lineTotal: 0, note: "" })), approvedQtySummary: `${pkg.selectedOptionIds.length}개 항목`, approvedAmountSummary: "", requesterContext: pkg.requestContext, departmentContext: "", budgetPolicyContext: pkg.budgetPolicyContext, approvalRationaleSummary: record.approvalReasonCodes.join(", "), exceptionSummary: "", quoteReferenceSummary: pkg.quoteContext, attachmentSummary: "", createdAt: new Date().toISOString(), createdBy: "operator" };
}
