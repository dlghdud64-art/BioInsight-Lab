/**
 * PO Dispatch Governance Engine — PO Created → Dispatch Preparation governance layer
 *
 * PO created는 종료가 아니라 dispatch 실행의 시작점.
 * 기존 dispatch-preparation-engine 위에 governance grammar 적용.
 *
 * SOURCE OF TRUTH 분리:
 * - POCreatedTruth → 내부 canonical record
 * - SupplierFacingPayload → 외부 송신 대상 (preview 아님)
 * - DispatchPreparationState → 발송 가능 여부/차단/확정 필드
 *
 * ready_to_send ≠ sent. sent는 실제 action/event 이후에만.
 */

// ══════════════════════════════════════════════
// Dispatch Readiness Status
// ══════════════════════════════════════════════

export type DispatchGovernanceReadiness = "not_evaluated" | "blocked" | "needs_review" | "ready_to_send" | "scheduled" | "sent" | "cancelled";

// ══════════════════════════════════════════════
// Dispatch Blocker
// ══════════════════════════════════════════════

export type DispatchBlockerType =
  | "snapshot_invalidated"
  | "supplier_mismatch"
  | "commercial_terms_missing"
  | "shipping_contact_incomplete"
  | "billing_contact_incomplete"
  | "required_document_missing"
  | "policy_hold_active"
  | "approval_expired"
  | "po_data_changed_after_approval"
  | "supplier_profile_changed";

export interface DispatchBlocker {
  type: DispatchBlockerType;
  severity: "hard" | "soft";
  detail: string;
  remediationAction: string;
}

// ══════════════════════════════════════════════
// Dispatch Preparation State
// ══════════════════════════════════════════════

export interface DispatchPreparationGovernanceState {
  stateId: string;
  caseId: string;
  poNumber: string;
  readiness: DispatchGovernanceReadiness;
  // Blockers
  hardBlockers: DispatchBlocker[];
  softBlockers: DispatchBlocker[];
  totalBlockerCount: number;
  // Snapshot validity
  approvalSnapshotValid: boolean;
  conversionSnapshotValid: boolean;
  snapshotInvalidationReason: string;
  // Supplier-facing payload
  supplierFacingPayloadComplete: boolean;
  supplierFacingPayloadDelta: string[]; // changes since approval
  // Locked fields
  lockedFields: string[];
  editableFields: string[];
  // Confirmation checklist
  confirmationChecklist: ConfirmationItem[];
  allConfirmed: boolean;
  // Schedule
  scheduledSendDate: string | null;
  // Audit
  evaluatedAt: string;
  evaluatedBy: string;
}

export interface ConfirmationItem {
  key: string;
  label: string;
  confirmed: boolean;
  required: boolean;
}

// ══════════════════════════════════════════════
// Evaluate Dispatch Governance
// ══════════════════════════════════════════════

export interface DispatchGovernanceInput {
  caseId: string;
  poNumber: string;
  // Snapshot validity
  approvalSnapshotValid: boolean;
  conversionSnapshotValid: boolean;
  snapshotInvalidationReason: string;
  // Supplier data
  supplierContactEmail: string;
  supplierContactName: string;
  shippingAddress: string;
  billingAddress: string;
  // Commercial terms
  paymentTerms: string;
  deliveryTerms: string;
  // Documents
  requiredDocuments: string[];
  attachedDocuments: string[];
  // Policy
  policyHoldActive: boolean;
  policyHoldReason: string;
  // Changes since approval
  dataChangedAfterApproval: boolean;
  changeDetails: string[];
  supplierProfileChanged: boolean;
  supplierProfileChangeDetail: string;
  // Locked fields
  lockedFields: string[];
  actor: string;
}

export function evaluateDispatchGovernance(input: DispatchGovernanceInput): DispatchPreparationGovernanceState {
  const hardBlockers: DispatchBlocker[] = [];
  const softBlockers: DispatchBlocker[] = [];
  const now = new Date().toISOString();

  // Hard blockers
  if (!input.approvalSnapshotValid) {
    hardBlockers.push({ type: "snapshot_invalidated", severity: "hard", detail: input.snapshotInvalidationReason || "승인 snapshot 무효", remediationAction: "재승인 요청" });
  }
  if (!input.conversionSnapshotValid) {
    hardBlockers.push({ type: "snapshot_invalidated", severity: "hard", detail: "PO 전환 snapshot 무효", remediationAction: "PO 전환 재실행" });
  }
  if (!input.supplierContactEmail) {
    hardBlockers.push({ type: "shipping_contact_incomplete", severity: "hard", detail: "공급사 연락처 이메일 미입력", remediationAction: "공급사 연락처 입력" });
  }
  if (!input.shippingAddress) {
    hardBlockers.push({ type: "shipping_contact_incomplete", severity: "hard", detail: "배송 주소 미입력", remediationAction: "배송 주소 입력" });
  }
  if (!input.paymentTerms) {
    hardBlockers.push({ type: "commercial_terms_missing", severity: "hard", detail: "결제 조건 미입력", remediationAction: "결제 조건 설정" });
  }
  if (input.policyHoldActive) {
    hardBlockers.push({ type: "policy_hold_active", severity: "hard", detail: input.policyHoldReason || "정책 보류 활성", remediationAction: "정책 보류 해제 요청" });
  }

  const missingDocs = input.requiredDocuments.filter(d => !input.attachedDocuments.includes(d));
  if (missingDocs.length > 0) {
    hardBlockers.push({ type: "required_document_missing", severity: "hard", detail: `필수 첨부서류 누락: ${missingDocs.join(", ")}`, remediationAction: "서류 첨부" });
  }

  if (input.dataChangedAfterApproval) {
    hardBlockers.push({ type: "po_data_changed_after_approval", severity: "hard", detail: `승인 이후 데이터 변경: ${input.changeDetails.join(", ")}`, remediationAction: "재승인 또는 PO 전환 재실행" });
  }

  // Soft blockers
  if (!input.billingAddress) {
    softBlockers.push({ type: "billing_contact_incomplete", severity: "soft", detail: "청구 주소 미입력 — 권장", remediationAction: "청구 주소 입력" });
  }
  if (!input.deliveryTerms) {
    softBlockers.push({ type: "commercial_terms_missing", severity: "soft", detail: "납품 조건 미입력 — 권장", remediationAction: "납품 조건 설정" });
  }
  if (input.supplierProfileChanged) {
    softBlockers.push({ type: "supplier_profile_changed", severity: "soft", detail: input.supplierProfileChangeDetail || "공급사 정보 변경됨", remediationAction: "변경 사항 확인" });
  }

  // Readiness
  let readiness: DispatchGovernanceReadiness;
  if (hardBlockers.length > 0) {
    readiness = "blocked";
  } else if (softBlockers.length > 0) {
    readiness = "needs_review";
  } else {
    readiness = "ready_to_send";
  }

  // Confirmation checklist
  const checklist: ConfirmationItem[] = [
    { key: "supplier_contact", label: "공급사 연락처 확인", confirmed: !!input.supplierContactEmail, required: true },
    { key: "shipping_address", label: "배송 주소 확인", confirmed: !!input.shippingAddress, required: true },
    { key: "payment_terms", label: "결제 조건 확인", confirmed: !!input.paymentTerms, required: true },
    { key: "delivery_terms", label: "납품 조건 확인", confirmed: !!input.deliveryTerms, required: false },
    { key: "documents", label: "첨부서류 완료", confirmed: missingDocs.length === 0, required: input.requiredDocuments.length > 0 },
    { key: "approval_valid", label: "승인 유효성 확인", confirmed: input.approvalSnapshotValid && input.conversionSnapshotValid, required: true },
    { key: "no_data_change", label: "승인 이후 변경 없음", confirmed: !input.dataChangedAfterApproval, required: true },
  ];

  const editableFields = ["billingAddress", "deliveryTerms", "requestedDeliveryDate", "internalNote", "attachedDocuments"];

  return {
    stateId: `dpgov_${Date.now().toString(36)}`,
    caseId: input.caseId, poNumber: input.poNumber,
    readiness,
    hardBlockers, softBlockers,
    totalBlockerCount: hardBlockers.length + softBlockers.length,
    approvalSnapshotValid: input.approvalSnapshotValid,
    conversionSnapshotValid: input.conversionSnapshotValid,
    snapshotInvalidationReason: input.snapshotInvalidationReason,
    supplierFacingPayloadComplete: hardBlockers.length === 0,
    supplierFacingPayloadDelta: input.changeDetails,
    lockedFields: input.lockedFields,
    editableFields,
    confirmationChecklist: checklist,
    allConfirmed: checklist.filter(c => c.required).every(c => c.confirmed),
    scheduledSendDate: null,
    evaluatedAt: now, evaluatedBy: input.actor,
  };
}

// ══════════════════════════════════════════════
// Dispatch Policy Surface
// ══════════════════════════════════════════════

export interface DispatchPolicySurface {
  readiness: DispatchGovernanceReadiness;
  statusBadge: "allowed" | "approval_needed" | "blocked" | "reapproval_needed";
  statusColor: "emerald" | "blue" | "red" | "amber";
  primaryMessage: string;
  blockerMessages: string[];
  warningMessages: string[];
  nextAction: string;
  lockedFields: string[];
  editableFields: string[];
  checklistComplete: boolean;
  checklistProgress: string;
}

export function buildDispatchPolicySurface(state: DispatchPreparationGovernanceState): DispatchPolicySurface {
  const checkedRequired = state.confirmationChecklist.filter(c => c.required);
  const confirmedRequired = checkedRequired.filter(c => c.confirmed);

  let statusBadge: DispatchPolicySurface["statusBadge"];
  let statusColor: DispatchPolicySurface["statusColor"];

  if (state.readiness === "blocked") {
    statusBadge = !state.approvalSnapshotValid || !state.conversionSnapshotValid ? "reapproval_needed" : "blocked";
    statusColor = "red";
  } else if (state.readiness === "needs_review") {
    statusBadge = "approval_needed";
    statusColor = "amber";
  } else {
    statusBadge = "allowed";
    statusColor = "emerald";
  }

  return {
    readiness: state.readiness,
    statusBadge, statusColor,
    primaryMessage: state.readiness === "ready_to_send" ? "발송 준비 완료 — 발송 가능"
      : state.readiness === "blocked" ? `발송 차단 — ${state.hardBlockers[0]?.detail || "차단 사유 확인"}`
      : state.readiness === "needs_review" ? `검토 필요 — ${state.softBlockers[0]?.detail || "검토 사항 확인"}`
      : "발송 준비 미평가",
    blockerMessages: state.hardBlockers.map(b => `${b.detail} → ${b.remediationAction}`),
    warningMessages: state.softBlockers.map(b => `${b.detail} → ${b.remediationAction}`),
    nextAction: state.readiness === "ready_to_send" ? "발송 실행 가능"
      : state.readiness === "blocked" ? state.hardBlockers[0]?.remediationAction || "차단 해소 필요"
      : state.softBlockers[0]?.remediationAction || "검토 완료 후 발송",
    lockedFields: state.lockedFields,
    editableFields: state.editableFields,
    checklistComplete: state.allConfirmed,
    checklistProgress: `${confirmedRequired.length}/${checkedRequired.length}`,
  };
}

// ══════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════

export type DispatchGovernanceEventType = "dispatch_governance_evaluated" | "dispatch_blocked" | "dispatch_ready" | "dispatch_scheduled" | "dispatch_hold_applied" | "dispatch_snapshot_invalidated" | "dispatch_data_changed";
export interface DispatchGovernanceEvent { type: DispatchGovernanceEventType; caseId: string; poNumber: string; readiness: DispatchGovernanceReadiness; reason: string; timestamp: string; }
