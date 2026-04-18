/**
 * PO Conversion Re-entry Engine — locked/editable 재분리 + prior draft overlap + PO created re-entry handoff
 */

import type { PoConversionReentryHandoff } from "./approval-reentry-engine";

// ── Status ──
export type PoConversionReentryStatus = "po_conversion_reentry_open" | "po_conversion_reentry_in_progress" | "po_conversion_reentry_recorded";
export type PoConversionReentrySubstatus = "awaiting_locked_field_review" | "awaiting_operational_field_revalidation" | "awaiting_prior_draft_overlap_resolution" | "po_conversion_reentry_blocked" | "ready_for_po_created_reentry";

// ── State ──
export interface PoConversionReentryState {
  poConversionReentryStatus: PoConversionReentryStatus;
  substatus: PoConversionReentrySubstatus;
  poConversionReentryOpenedAt: string;
  approvalReentryDecisionObjectId: string;
  approvedCandidateIds: string[];
  lockedApprovalFieldCount: number;
  editableOperationalFieldCount: number;
  priorDraftOverlapCount: number;
  reusedDraftFieldCount: number;
  resetDraftFieldCount: number;
  missingDecisionCount: number;
  poConversionReentryBlockedFlag: boolean;
  poConversionReentryBlockedReason: string | null;
  poConversionReentryDraftObjectId: string | null;
  // ── Operational fields ──
  paymentTerm: string;
  billingReference: string;
  deliveryTarget: string;
  shipToReference: string;
  receivingInstruction: string;
  internalNote: string;
  supplierNote: string;
}

export function createInitialPoConversionReentryState(handoff: PoConversionReentryHandoff): PoConversionReentryState {
  return {
    poConversionReentryStatus: "po_conversion_reentry_open",
    substatus: "awaiting_locked_field_review",
    poConversionReentryOpenedAt: new Date().toISOString(),
    approvalReentryDecisionObjectId: handoff.approvalReentryDecisionObjectId,
    approvedCandidateIds: handoff.approvedCandidateIds,
    lockedApprovalFieldCount: 5,
    editableOperationalFieldCount: 7,
    priorDraftOverlapCount: 0,
    reusedDraftFieldCount: 0,
    resetDraftFieldCount: 0,
    missingDecisionCount: 0,
    poConversionReentryBlockedFlag: handoff.poConversionReentryReadiness === "blocked",
    poConversionReentryBlockedReason: handoff.poConversionReentryReadiness === "blocked" ? "PO Conversion Re-entry 조건 미충족" : null,
    poConversionReentryDraftObjectId: null,
    paymentTerm: "", billingReference: "", deliveryTarget: "", shipToReference: "", receivingInstruction: "", internalNote: "", supplierNote: "",
  };
}

// ── Field Plan ──
export interface PoConvReentryFieldPlan { lockedFieldIds: string[]; editableFieldIds: string[]; reusedOperationalFieldIds: string[]; resetOperationalFieldIds: string[]; fieldCarryForwardRiskSummary: string; blockingIssues: string[]; warnings: string[]; }
export function buildPoConversionReentryFieldPlan(state: PoConversionReentryState): PoConvReentryFieldPlan {
  const locked = ["vendor", "quote_lineage", "line_coverage", "qty_basis", "price_basis"];
  const editable = ["paymentTerm", "billingReference", "deliveryTarget", "shipToReference", "receivingInstruction", "internalNote", "supplierNote"];
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (!state.paymentTerm) warnings.push("결제 조건 미입력");
  if (!state.shipToReference) warnings.push("배송지 미입력");
  return { lockedFieldIds: locked, editableFieldIds: editable, reusedOperationalFieldIds: [], resetOperationalFieldIds: editable, fieldCarryForwardRiskSummary: "전체 운영 필드 재입력 필요", blockingIssues: blocking, warnings };
}

// ── Prior Draft Overlap ──
export interface PriorDraftReentryPlan { activePriorDraftIds: string[]; stalePriorDraftIds: string[]; duplicateDraftRisk: boolean; allowedCarryForwardFieldIds: string[]; resetRequiredFieldIds: string[]; draftConflictSummary: string; blockingIssues: string[]; warnings: string[]; }
export function buildPriorPoDraftReentryPlan(state: PoConversionReentryState): PriorDraftReentryPlan {
  return { activePriorDraftIds: [], stalePriorDraftIds: [], duplicateDraftRisk: false, allowedCarryForwardFieldIds: [], resetRequiredFieldIds: ["paymentTerm", "billingReference", "deliveryTarget", "shipToReference", "receivingInstruction"], draftConflictSummary: state.priorDraftOverlapCount > 0 ? "이전 draft 충돌 있음" : "충돌 없음", blockingIssues: [], warnings: state.priorDraftOverlapCount > 0 ? ["이전 draft 정리 필요"] : [] };
}

// ── Operational Delta ──
export interface PoConvReentryOperationalDelta { paymentTermDelta: string; billingDelta: string; deliveryDelta: string; shipToDelta: string; receivingInstructionDelta: string; supplierFacingMessageDelta: string; blockingIssues: string[]; warnings: string[]; }
export function buildPoConversionReentryOperationalDelta(state: PoConversionReentryState): PoConvReentryOperationalDelta {
  const warnings: string[] = [];
  if (!state.paymentTerm) warnings.push("결제 조건 필요");
  if (!state.deliveryTarget) warnings.push("납품 요청일 필요");
  if (!state.receivingInstruction) warnings.push("입고 지시 필요");
  return { paymentTermDelta: state.paymentTerm || "미입력", billingDelta: state.billingReference || "미입력", deliveryDelta: state.deliveryTarget || "미입력", shipToDelta: state.shipToReference || "미입력", receivingInstructionDelta: state.receivingInstruction || "미입력", supplierFacingMessageDelta: state.supplierNote || "미입력", blockingIssues: [], warnings };
}

// ── Validator ──
export interface PoConvReentryValidation { canRecordPoConversionReentry: boolean; canOpenPoCreatedReentry: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validatePoConversionReentryBeforeRecord(state: PoConversionReentryState): PoConvReentryValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.poConversionReentryBlockedFlag) blocking.push(state.poConversionReentryBlockedReason || "차단됨");
  if (state.approvedCandidateIds.length === 0) blocking.push("승인 후보 없음");
  const fieldPlan = buildPoConversionReentryFieldPlan(state);
  fieldPlan.warnings.forEach(w => { warnings.push(w); missing.push(w); });
  const overlap = buildPriorPoDraftReentryPlan(state);
  overlap.blockingIssues.forEach(b => blocking.push(b));
  overlap.warnings.forEach(w => warnings.push(w));
  const canRecord = blocking.length === 0;
  const canCreated = canRecord && !fieldPlan.warnings.some(w => w.includes("결제") || w.includes("배송"));
  return { canRecordPoConversionReentry: canRecord, canOpenPoCreatedReentry: canCreated, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : !canCreated ? "필수 운영 필드 입력 후 진행" : "PO Created Re-entry로 보내기" };
}

// ── Decision Options ──
export interface PoConvReentryDecisionOptions { canRecordConversion: boolean; canOpenPoCreatedReentry: boolean; canHold: boolean; canReturnApprovalReentry: boolean; decisionReasonSummary: string; }
export function buildPoConversionReentryDecisionOptions(state: PoConversionReentryState): PoConvReentryDecisionOptions {
  const v = validatePoConversionReentryBeforeRecord(state);
  return { canRecordConversion: v.canRecordPoConversionReentry, canOpenPoCreatedReentry: v.canOpenPoCreatedReentry, canHold: v.missingItems.length > 0, canReturnApprovalReentry: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Object ──
export interface PoConversionReentryDraftObject { id: string; approvalReentryDecisionObjectId: string; approvedCandidateIds: string[]; lockedApprovalFieldSummary: string; editableOperationalFieldSummary: string; priorDraftOverlapSummary: string; operationalDeltaSummary: string; draftCarryForwardSummary: string; recordedAt: string; recordedBy: string; }
export function buildPoConversionReentryDraftObject(state: PoConversionReentryState): PoConversionReentryDraftObject {
  const delta = buildPoConversionReentryOperationalDelta(state);
  return { id: `poconvreentry_${Date.now().toString(36)}`, approvalReentryDecisionObjectId: state.approvalReentryDecisionObjectId, approvedCandidateIds: state.approvedCandidateIds, lockedApprovalFieldSummary: `${state.lockedApprovalFieldCount}개 잠김`, editableOperationalFieldSummary: `Payment: ${delta.paymentTermDelta}, Ship: ${delta.shipToDelta}, Delivery: ${delta.deliveryDelta}`, priorDraftOverlapSummary: state.priorDraftOverlapCount > 0 ? "충돌 있음" : "충돌 없음", operationalDeltaSummary: `${delta.warnings.length}개 미입력`, draftCarryForwardSummary: "전체 재입력", recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── PO Created Re-entry Handoff ──
export interface PoCreatedReentryHandoff { poConversionReentryDraftObjectId: string; approvedCandidateIds: string[]; lockedApprovalFieldSummary: string; operationalDeltaSummary: string; poCreatedReentryReadiness: "ready" | "pending" | "blocked"; }
export function buildPoCreatedReentryHandoff(obj: PoConversionReentryDraftObject): PoCreatedReentryHandoff {
  return { poConversionReentryDraftObjectId: obj.id, approvedCandidateIds: obj.approvedCandidateIds, lockedApprovalFieldSummary: obj.lockedApprovalFieldSummary, operationalDeltaSummary: obj.operationalDeltaSummary, poCreatedReentryReadiness: obj.operationalDeltaSummary.includes("0개 미입력") ? "ready" : "pending" };
}
