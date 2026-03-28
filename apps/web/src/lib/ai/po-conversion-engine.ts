/**
 * PO Conversion Engine — PO 전환 상태 모델 + locked/editable 분리 + validator + draft object + handoff
 *
 * 고정 규칙:
 * 1. PO conversion = approval 결과를 실제 발주 객체로 전환하는 canonical gate.
 * 2. approval 기준값(vendor/qty/price)은 locked — conversion에서 임의 수정 불가.
 * 3. PO entry 운영 필드(payment/billing/receiving)는 editable.
 * 4. canonical PO conversion draft object 없이 PO created 진행 금지.
 * 5. locked field 변경 필요 시 approval로 return.
 */

import type { ApprovalWorkbenchHandoff } from "./quote-compare-review-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Conversion Status
// ══════════════════════════════════════════════════════════════════════════════

export type PoConversionStatus =
  | "po_conversion_open"
  | "po_conversion_in_progress"
  | "po_draft_recorded";

export type PoConversionSubstatus =
  | "awaiting_po_header_fields"
  | "awaiting_commercial_completion"
  | "awaiting_receiving_billing_fields"
  | "conversion_blocked"
  | "ready_for_po_created_handoff";

// ══════════════════════════════════════════════════════════════════════════════
// Conversion State
// ══════════════════════════════════════════════════════════════════════════════

export interface PoConversionState {
  poConversionStatus: PoConversionStatus;
  substatus: PoConversionSubstatus;
  poConversionOpenedAt: string;
  poConversionOpenedBy: "approval_handoff" | "manual";
  approvalDecisionObjectId: string;
  requestSubmissionEventId: string;
  approvedVendorIds: string[];
  approvedLineCount: number;
  lockedFields: LockedApprovalField[];
  editableFields: EditablePoEntryFields;
  missingFieldCount: number;
  conversionBlockedFlag: boolean;
  conversionBlockedReason: string | null;
  poConversionDraftObjectId: string | null;
}

export function createInitialPoConversionState(
  handoff: ApprovalWorkbenchHandoff,
): PoConversionState {
  const locked = resolveLockedApprovalFields(handoff);
  const editable = resolveEditablePoEntryFields();

  return {
    poConversionStatus: "po_conversion_open",
    substatus: "awaiting_po_header_fields",
    poConversionOpenedAt: new Date().toISOString(),
    poConversionOpenedBy: "approval_handoff",
    approvalDecisionObjectId: handoff.quoteCompareDecisionSnapshotId,
    requestSubmissionEventId: handoff.requestSubmissionEventId,
    approvedVendorIds: handoff.shortlistVendorIds,
    approvedLineCount: handoff.shortlistVendorIds.length,
    lockedFields: locked,
    editableFields: editable,
    missingFieldCount: countMissingEditableFields(editable),
    conversionBlockedFlag: handoff.approvalReadiness === "blocked",
    conversionBlockedReason: handoff.approvalReadiness === "blocked" ? "승인 상태가 blocked입니다" : null,
    poConversionDraftObjectId: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Locked Approval Fields
// ══════════════════════════════════════════════════════════════════════════════

export interface LockedApprovalField {
  fieldId: string;
  fieldLabel: string;
  fieldValue: string;
  lockedReason: string;
  category: "vendor" | "line" | "price" | "qty" | "rationale";
}

export function resolveLockedApprovalFields(
  handoff: ApprovalWorkbenchHandoff,
): LockedApprovalField[] {
  const fields: LockedApprovalField[] = [];

  handoff.shortlistVendorIds.forEach((vid, idx) => {
    fields.push({
      fieldId: `locked_vendor_${idx}`,
      fieldLabel: "승인 공급사",
      fieldValue: vid,
      lockedReason: "승인 결과에 의해 잠김",
      category: "vendor",
    });
  });

  fields.push({
    fieldId: "locked_rationale",
    fieldLabel: "승인 근거",
    fieldValue: handoff.compareRationaleSummary,
    lockedReason: "비교 판단 근거 — 수정 시 승인 검토로 되돌리기 필요",
    category: "rationale",
  });

  return fields;
}

// ══════════════════════════════════════════════════════════════════════════════
// Editable PO Entry Fields
// ══════════════════════════════════════════════════════════════════════════════

export interface EditablePoEntryFields {
  paymentTerm: string;
  billingReference: string;
  requestedDeliveryTarget: string;
  receivingInstruction: string;
  internalPoNote: string;
  supplierFacingNote: string;
  shipToReference: string;
  poHeaderMemo: string;
}

export function resolveEditablePoEntryFields(): EditablePoEntryFields {
  return {
    paymentTerm: "",
    billingReference: "",
    requestedDeliveryTarget: "",
    receivingInstruction: "",
    internalPoNote: "",
    supplierFacingNote: "",
    shipToReference: "",
    poHeaderMemo: "",
  };
}

function countMissingEditableFields(fields: EditablePoEntryFields): number {
  let count = 0;
  if (!fields.paymentTerm) count++;
  if (!fields.billingReference) count++;
  if (!fields.requestedDeliveryTarget) count++;
  if (!fields.receivingInstruction) count++;
  return count;
}

// ══════════════════════════════════════════════════════════════════════════════
// Commercial / Operational Completion
// ══════════════════════════════════════════════════════════════════════════════

export interface PoCompletionSummary {
  commercialComplete: boolean;
  commercialMissing: string[];
  operationalComplete: boolean;
  operationalMissing: string[];
  overallComplete: boolean;
}

export function buildPoCompletionSummary(
  state: PoConversionState,
): PoCompletionSummary {
  const commercialMissing: string[] = [];
  const operationalMissing: string[] = [];

  if (!state.editableFields.paymentTerm) commercialMissing.push("결제 조건");
  if (!state.editableFields.billingReference) commercialMissing.push("청구 참조");

  if (!state.editableFields.requestedDeliveryTarget) operationalMissing.push("납품 요청일");
  if (!state.editableFields.receivingInstruction) operationalMissing.push("입고 지시");
  if (!state.editableFields.shipToReference) operationalMissing.push("배송지 참조");

  return {
    commercialComplete: commercialMissing.length === 0,
    commercialMissing,
    operationalComplete: operationalMissing.length === 0,
    operationalMissing,
    overallComplete: commercialMissing.length === 0 && operationalMissing.length === 0,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// PO Conversion Validator
// ══════════════════════════════════════════════════════════════════════════════

export interface PoConversionValidation {
  canRecordPoConversionDraft: boolean;
  blockingIssues: string[];
  warnings: string[];
  missingItems: string[];
  recommendedNextAction: string;
}

export function validatePoConversionBeforeDraft(
  state: PoConversionState,
): PoConversionValidation {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const missingItems: string[] = [];

  if (!state.approvalDecisionObjectId) {
    blockingIssues.push("승인 결정 객체가 없습니다");
  }

  if (state.approvedVendorIds.length === 0) {
    blockingIssues.push("승인 공급사가 없습니다");
  }

  if (state.conversionBlockedFlag) {
    blockingIssues.push(state.conversionBlockedReason || "전환이 차단되었습니다");
  }

  const completion = buildPoCompletionSummary(state);

  if (!completion.commercialComplete) {
    warnings.push(`상업 필드 누락: ${completion.commercialMissing.join(", ")}`);
    completion.commercialMissing.forEach((f) => missingItems.push(f));
  }

  if (!completion.operationalComplete) {
    warnings.push(`운영 필드 누락: ${completion.operationalMissing.join(", ")}`);
    completion.operationalMissing.forEach((f) => missingItems.push(f));
  }

  // Locked field integrity
  if (state.lockedFields.length === 0) {
    blockingIssues.push("잠긴 승인 필드가 없습니다 — 승인 무결성 문제");
  }

  return {
    canRecordPoConversionDraft: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    missingItems,
    recommendedNextAction: blockingIssues.length > 0
      ? "차단 사항을 먼저 해결하세요"
      : warnings.length > 0
        ? "누락 필드를 채우고 PO 전환 초안을 저장하세요"
        : "PO 전환 초안을 저장하세요",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Decision Options
// ══════════════════════════════════════════════════════════════════════════════

export interface PoConversionDecisionOptions {
  canRecordDraft: boolean;
  canSendBackApproval: boolean;
  canHold: boolean;
  decisionReasonSummary: string;
}

export function buildPoConversionDecisionOptions(
  state: PoConversionState,
): PoConversionDecisionOptions {
  const validation = validatePoConversionBeforeDraft(state);
  return {
    canRecordDraft: validation.canRecordPoConversionDraft,
    canSendBackApproval: true,
    canHold: validation.missingItems.length > 0 && validation.blockingIssues.length === 0,
    decisionReasonSummary: validation.recommendedNextAction,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Canonical PO Conversion Draft Object
// ══════════════════════════════════════════════════════════════════════════════

export interface PoConversionDraftObject {
  id: string;
  approvalDecisionObjectId: string;
  requestSubmissionEventId: string;
  approvedVendorIds: string[];
  approvedLineCoverageSummary: string;
  lockedFieldSummary: LockedApprovalField[];
  editablePoEntryFieldValues: EditablePoEntryFields;
  commercialCompletionSummary: string;
  operationalCompletionSummary: string;
  recordedAt: string;
  recordedBy: string;
}

export function buildPoConversionDraftObject(
  state: PoConversionState,
): PoConversionDraftObject {
  const completion = buildPoCompletionSummary(state);
  return {
    id: `poconv_${Date.now().toString(36)}`,
    approvalDecisionObjectId: state.approvalDecisionObjectId,
    requestSubmissionEventId: state.requestSubmissionEventId,
    approvedVendorIds: state.approvedVendorIds,
    approvedLineCoverageSummary: `${state.approvedVendorIds.length}개 공급사, ${state.approvedLineCount}개 라인`,
    lockedFieldSummary: state.lockedFields,
    editablePoEntryFieldValues: state.editableFields,
    commercialCompletionSummary: completion.commercialComplete ? "완료" : `누락: ${completion.commercialMissing.join(", ")}`,
    operationalCompletionSummary: completion.operationalComplete ? "완료" : `누락: ${completion.operationalMissing.join(", ")}`,
    recordedAt: new Date().toISOString(),
    recordedBy: "operator",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// PO Created Handoff
// ══════════════════════════════════════════════════════════════════════════════

export interface PoCreatedHandoff {
  poConversionDraftObjectId: string;
  approvalDecisionObjectId: string;
  approvedVendorIds: string[];
  approvedLineCoverageSummary: string;
  commercialSummary: string;
  operationalSummary: string;
  poCreatedReadiness: "ready" | "incomplete" | "blocked";
}

export function buildPoCreatedHandoff(
  draft: PoConversionDraftObject,
): PoCreatedHandoff {
  const isComplete = draft.commercialCompletionSummary === "완료" && draft.operationalCompletionSummary === "완료";
  return {
    poConversionDraftObjectId: draft.id,
    approvalDecisionObjectId: draft.approvalDecisionObjectId,
    approvedVendorIds: draft.approvedVendorIds,
    approvedLineCoverageSummary: draft.approvedLineCoverageSummary,
    commercialSummary: draft.commercialCompletionSummary,
    operationalSummary: draft.operationalCompletionSummary,
    poCreatedReadiness: isComplete ? "ready" : "incomplete",
  };
}
