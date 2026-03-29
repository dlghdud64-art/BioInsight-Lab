/**
 * Supplier Confirmation Governance Engine
 *
 * "보냈다" ≠ "공급사가 수락했다".
 * sent (execution terminal) → supplier response snapshot 수신 → operator review → downstream 반영.
 *
 * 기존 supplier-confirmation-engine.ts의 field-level 모델 위에
 * delta-first governance + operator review + upstream reopen 경로를 추가.
 *
 * IMMUTABLE RULES:
 * 1. supplier response는 internal truth를 바로 덮지 않음
 * 2. supplier response snapshot으로 먼저 수신 → operator review → downstream truth 반영
 * 3. price/quantity/ETA/term 변경은 delta-first로 보여줌
 * 4. confirmed ≠ received — receiving은 별도 downstream chain
 * 5. supplier_change_requested가 있으면 operator가 accept/reject/reopen 결정
 * 6. response snapshot과 sent payload snapshot 비교가 canonical delta source
 */

import { getStatusLabel } from "./governance-grammar-registry";

// ══════════════════════════════════════════════
// Supplier Response Status (governance layer)
// ══════════════════════════════════════════════

export type SupplierResponseStatus =
  | "awaiting_response"
  | "response_received"
  | "confirmed"
  | "partially_confirmed"
  | "change_requested"
  | "rejected"
  | "expired"
  | "cancelled";

/** Terminal states */
export const RESPONSE_TERMINAL: readonly SupplierResponseStatus[] = ["confirmed", "rejected", "cancelled"] as const;

/** Valid transitions */
const RESPONSE_TRANSITIONS: Record<SupplierResponseStatus, SupplierResponseStatus[]> = {
  awaiting_response: ["response_received", "expired", "cancelled"],
  response_received: ["confirmed", "partially_confirmed", "change_requested", "rejected", "cancelled"],
  confirmed: [], // terminal
  partially_confirmed: ["confirmed", "change_requested", "rejected", "cancelled"],
  change_requested: ["awaiting_response", "confirmed", "rejected", "cancelled"], // awaiting_response = correction sent back
  rejected: [], // terminal
  expired: ["awaiting_response", "cancelled"], // re-request
  cancelled: [], // terminal
};

// ══════════════════════════════════════════════
// Supplier Response Snapshot — 공급사 응답 원본
// ══════════════════════════════════════════════

export interface SupplierResponseSnapshot {
  snapshotId: string;
  receivedAt: string;
  respondedBy: string;
  responseChannel: "email" | "portal" | "phone" | "manual_entry";
  overallAcceptance: "accepted" | "accepted_with_changes" | "rejected" | "partial";
  supplierMessage: string;
  lineResponses: SupplierLineResponse[];
  proposedChanges: SupplierProposedChange[];
  confirmedDeliveryDate: string | null;
  originalDeliveryDate: string | null;
  deliveryDateChanged: boolean;
}

export interface SupplierLineResponse {
  lineId: string;
  itemName: string;
  originalQuantity: number;
  confirmedQuantity: number;
  originalUnitPrice: number;
  confirmedUnitPrice: number;
  acceptance: "accepted" | "changed" | "rejected" | "backordered";
  supplierNote: string;
}

export interface SupplierProposedChange {
  field: string;
  originalValue: string;
  proposedValue: string;
  changeReason: string;
  severity: "minor" | "major" | "critical";
}

// ══════════════════════════════════════════════
// Supplier Confirmation Governance State
// ══════════════════════════════════════════════

export interface SupplierConfirmationGovernanceState {
  governanceId: string;
  caseId: string;
  poNumber: string;
  status: SupplierResponseStatus;
  // Response tracking
  responseSnapshot: SupplierResponseSnapshot | null;
  responseReceivedAt: string | null;
  // Delta flags
  hasLineChanges: boolean;
  hasPriceChanges: boolean;
  hasQuantityChanges: boolean;
  hasDeliveryDateChange: boolean;
  hasTermChanges: boolean;
  totalChangeCount: number;
  criticalChangeCount: number;
  // Operator review
  operatorReviewStatus: "not_started" | "in_progress" | "completed";
  operatorDecision: "pending" | "accepted" | "accepted_with_modifications" | "rejected" | "escalated";
  operatorNotes: string;
  // Linkage (upstream chain)
  executionId: string;
  payloadSnapshotId: string;
  poCreatedObjectId: string;
  approvalDecisionObjectId: string;
  // Expiry
  responseDeadline: string | null;
  isOverdue: boolean;
  // Audit
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

// ══════════════════════════════════════════════
// Create Initial State
// ══════════════════════════════════════════════

export interface CreateConfirmationGovernanceInput {
  caseId: string;
  poNumber: string;
  executionId: string;
  payloadSnapshotId: string;
  poCreatedObjectId: string;
  approvalDecisionObjectId: string;
  responseDeadlineDays: number;
  actor: string;
}

export function createConfirmationGovernanceState(input: CreateConfirmationGovernanceInput): SupplierConfirmationGovernanceState {
  const now = new Date().toISOString();
  const deadline = new Date(Date.now() + input.responseDeadlineDays * 86400000).toISOString();

  return {
    governanceId: `scgov_${Date.now().toString(36)}`,
    caseId: input.caseId,
    poNumber: input.poNumber,
    status: "awaiting_response",
    responseSnapshot: null,
    responseReceivedAt: null,
    hasLineChanges: false,
    hasPriceChanges: false,
    hasQuantityChanges: false,
    hasDeliveryDateChange: false,
    hasTermChanges: false,
    totalChangeCount: 0,
    criticalChangeCount: 0,
    operatorReviewStatus: "not_started",
    operatorDecision: "pending",
    operatorNotes: "",
    executionId: input.executionId,
    payloadSnapshotId: input.payloadSnapshotId,
    poCreatedObjectId: input.poCreatedObjectId,
    approvalDecisionObjectId: input.approvalDecisionObjectId,
    responseDeadline: deadline,
    isOverdue: false,
    createdAt: now,
    updatedAt: now,
    updatedBy: input.actor,
  };
}

// ══════════════════════════════════════════════
// Transition Validation
// ══════════════════════════════════════════════

function validateTransition(from: SupplierResponseStatus, to: SupplierResponseStatus): string | null {
  if (RESPONSE_TERMINAL.includes(from)) {
    return `Cannot transition from terminal status '${from}'`;
  }
  if (!RESPONSE_TRANSITIONS[from].includes(to)) {
    return `Invalid transition: ${from} → ${to}. Allowed: ${RESPONSE_TRANSITIONS[from].join(", ") || "none"}`;
  }
  return null;
}

export interface GovernanceTransitionResult {
  success: boolean;
  state: SupplierConfirmationGovernanceState;
  error: string | null;
}

// ══════════════════════════════════════════════
// Receive Supplier Response
// ══════════════════════════════════════════════

export function receiveSupplierResponse(
  state: SupplierConfirmationGovernanceState,
  response: SupplierResponseSnapshot,
  actor: string,
): GovernanceTransitionResult {
  // Must be in awaiting_response to receive
  const receiveError = validateTransition(state.status, "response_received");
  if (receiveError) return { success: false, state, error: receiveError };

  const now = new Date().toISOString();

  // Analyze delta
  const hasLineChanges = response.lineResponses.some(
    l => l.acceptance !== "accepted"
  );
  const hasPriceChanges = response.lineResponses.some(
    l => l.confirmedUnitPrice !== l.originalUnitPrice
  );
  const hasQuantityChanges = response.lineResponses.some(
    l => l.confirmedQuantity !== l.originalQuantity
  );
  const hasTermChanges = response.proposedChanges.length > 0;
  const criticalCount = response.proposedChanges.filter(c => c.severity === "critical").length;
  const totalChanges = response.proposedChanges.length
    + response.lineResponses.filter(l => l.acceptance !== "accepted").length
    + (response.deliveryDateChanged ? 1 : 0);

  // Determine next status based on response
  let resolvedStatus: SupplierResponseStatus;
  if (response.overallAcceptance === "accepted" && !hasLineChanges && !hasTermChanges && !response.deliveryDateChanged) {
    resolvedStatus = "confirmed";
  } else if (response.overallAcceptance === "rejected") {
    resolvedStatus = "rejected";
  } else if (response.overallAcceptance === "partial") {
    resolvedStatus = "partially_confirmed";
  } else {
    resolvedStatus = "change_requested";
  }

  // First transition to response_received, then resolve
  // (For clean response → confirmed, we skip response_received and go straight)
  if (resolvedStatus === "confirmed" || resolvedStatus === "rejected") {
    // Direct terminal from awaiting — allowed in transitions
    // Actually awaiting_response → confirmed is NOT in transitions, we need response_received first
    // So we always go to response_received first
  }

  return {
    success: true,
    state: {
      ...state,
      status: "response_received",
      responseSnapshot: response,
      responseReceivedAt: now,
      hasLineChanges,
      hasPriceChanges,
      hasQuantityChanges,
      hasDeliveryDateChange: response.deliveryDateChanged,
      hasTermChanges,
      totalChangeCount: totalChanges,
      criticalChangeCount: criticalCount,
      operatorReviewStatus: "not_started",
      operatorDecision: "pending",
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Operator Review — 응답 수신 후 판단
// ══════════════════════════════════════════════

/** Accept — response_received/partially_confirmed/change_requested → confirmed */
export function operatorAccept(
  state: SupplierConfirmationGovernanceState,
  withModifications: boolean,
  notes: string,
  actor: string,
): GovernanceTransitionResult {
  const error = validateTransition(state.status, "confirmed");
  if (error) return { success: false, state, error };

  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      status: "confirmed",
      operatorReviewStatus: "completed",
      operatorDecision: withModifications ? "accepted_with_modifications" : "accepted",
      operatorNotes: notes,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

/** Reject — operator rejects supplier response */
export function operatorReject(
  state: SupplierConfirmationGovernanceState,
  notes: string,
  actor: string,
): GovernanceTransitionResult {
  const error = validateTransition(state.status, "rejected");
  if (error) return { success: false, state, error };

  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      status: "rejected",
      operatorReviewStatus: "completed",
      operatorDecision: "rejected",
      operatorNotes: notes,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

/** Request correction — back to awaiting_response for new supplier response */
export function operatorRequestCorrection(
  state: SupplierConfirmationGovernanceState,
  correctionNotes: string,
  actor: string,
): GovernanceTransitionResult {
  const error = validateTransition(state.status, "awaiting_response");
  // This path: change_requested → awaiting_response
  if (error) {
    // Try from response_received path — not valid, so check current
    if (state.status !== "change_requested" && state.status !== "expired") {
      return { success: false, state, error: `현재 상태 '${state.status}'에서 보정 요청 불가 — change_requested 또는 expired 필요` };
    }
  }

  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      status: "awaiting_response",
      operatorReviewStatus: "completed",
      operatorDecision: "rejected",
      operatorNotes: correctionNotes,
      responseSnapshot: null, // clear for new cycle
      responseReceivedAt: null,
      hasLineChanges: false,
      hasPriceChanges: false,
      hasQuantityChanges: false,
      hasDeliveryDateChange: false,
      hasTermChanges: false,
      totalChangeCount: 0,
      criticalChangeCount: 0,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

/** Escalate to partial confirmation — mark as partially_confirmed */
export function markPartiallyConfirmed(
  state: SupplierConfirmationGovernanceState,
  notes: string,
  actor: string,
): GovernanceTransitionResult {
  const error = validateTransition(state.status, "partially_confirmed");
  if (error) return { success: false, state, error };

  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      status: "partially_confirmed",
      operatorReviewStatus: "in_progress",
      operatorNotes: notes,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

/** Mark change requested — supplier wants terms changed */
export function markChangeRequested(
  state: SupplierConfirmationGovernanceState,
  actor: string,
): GovernanceTransitionResult {
  const error = validateTransition(state.status, "change_requested");
  if (error) return { success: false, state, error };

  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      status: "change_requested",
      operatorReviewStatus: "not_started",
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

/** Cancel */
export function cancelConfirmationGovernance(
  state: SupplierConfirmationGovernanceState,
  reason: string,
  actor: string,
): GovernanceTransitionResult {
  const error = validateTransition(state.status, "cancelled");
  if (error) return { success: false, state, error };

  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      status: "cancelled",
      operatorNotes: reason,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

/** Mark expired */
export function markResponseExpired(
  state: SupplierConfirmationGovernanceState,
  actor: string,
): GovernanceTransitionResult {
  const error = validateTransition(state.status, "expired");
  if (error) return { success: false, state, error };

  const now = new Date().toISOString();
  return {
    success: true,
    state: {
      ...state,
      status: "expired",
      isOverdue: true,
      updatedAt: now,
      updatedBy: actor,
    },
    error: null,
  };
}

// ══════════════════════════════════════════════
// Delta Analysis — delta-first 화면용
// ══════════════════════════════════════════════

export interface ResponseDelta {
  lineDeltas: LineDelta[];
  termDeltas: SupplierProposedChange[];
  deliveryDelta: { original: string | null; confirmed: string | null; changed: boolean } | null;
  totalDeltaCount: number;
  hasCriticalDelta: boolean;
  summaryMessage: string;
}

export interface LineDelta {
  lineId: string;
  itemName: string;
  field: "quantity" | "price" | "acceptance";
  original: string;
  confirmed: string;
  direction: "increased" | "decreased" | "changed" | "rejected";
}

export function buildResponseDelta(state: SupplierConfirmationGovernanceState): ResponseDelta | null {
  if (!state.responseSnapshot) return null;

  const response = state.responseSnapshot;
  const lineDeltas: LineDelta[] = [];

  for (const line of response.lineResponses) {
    if (line.confirmedQuantity !== line.originalQuantity) {
      lineDeltas.push({
        lineId: line.lineId, itemName: line.itemName, field: "quantity",
        original: String(line.originalQuantity), confirmed: String(line.confirmedQuantity),
        direction: line.confirmedQuantity > line.originalQuantity ? "increased" : line.confirmedQuantity === 0 ? "rejected" : "decreased",
      });
    }
    if (line.confirmedUnitPrice !== line.originalUnitPrice) {
      lineDeltas.push({
        lineId: line.lineId, itemName: line.itemName, field: "price",
        original: String(line.originalUnitPrice), confirmed: String(line.confirmedUnitPrice),
        direction: line.confirmedUnitPrice > line.originalUnitPrice ? "increased" : "decreased",
      });
    }
    if (line.acceptance === "rejected") {
      lineDeltas.push({
        lineId: line.lineId, itemName: line.itemName, field: "acceptance",
        original: "requested", confirmed: "rejected", direction: "rejected",
      });
    }
  }

  const deliveryDelta = response.deliveryDateChanged
    ? { original: response.originalDeliveryDate, confirmed: response.confirmedDeliveryDate, changed: true }
    : null;

  const totalCount = lineDeltas.length + response.proposedChanges.length + (deliveryDelta ? 1 : 0);
  const hasCritical = response.proposedChanges.some(c => c.severity === "critical") || lineDeltas.some(d => d.direction === "rejected");

  return {
    lineDeltas,
    termDeltas: response.proposedChanges,
    deliveryDelta,
    totalDeltaCount: totalCount,
    hasCriticalDelta: hasCritical,
    summaryMessage: totalCount === 0
      ? "변경 없음 — 원안 수락"
      : `${totalCount}건 변경 (${hasCritical ? "주요 변경 포함" : "경미한 변경"})`,
  };
}

// ══════════════════════════════════════════════
// Confirmation Surface — UI 투사
// ══════════════════════════════════════════════

export interface ConfirmationGovernanceSurface {
  status: SupplierResponseStatus;
  statusLabel: string;
  statusColor: "slate" | "blue" | "amber" | "emerald" | "red";
  isTerminal: boolean;
  primaryMessage: string;
  nextAction: string;
  delta: ResponseDelta | null;
  // Dock actions
  canAccept: boolean;
  canRequestCorrection: boolean;
  canReopenApproval: boolean;
  canReopenConversion: boolean;
  canCancel: boolean;
  // Deadline
  deadlineMessage: string | null;
  isOverdue: boolean;
}

/** Status labels — grammar registry 직접 소비. 하드코딩 금지. */
function getSupplierStatusLabel(status: SupplierResponseStatus): string {
  return getStatusLabel("supplier_confirmation", status);
}

const STATUS_COLORS: Record<SupplierResponseStatus, ConfirmationGovernanceSurface["statusColor"]> = {
  awaiting_response: "blue",
  response_received: "amber",
  confirmed: "emerald",
  partially_confirmed: "amber",
  change_requested: "amber",
  rejected: "red",
  expired: "red",
  cancelled: "slate",
};

export function buildConfirmationGovernanceSurface(state: SupplierConfirmationGovernanceState): ConfirmationGovernanceSurface {
  const isTerminal = RESPONSE_TERMINAL.includes(state.status);
  const delta = buildResponseDelta(state);
  const now = Date.now();
  const isOverdue = !!state.responseDeadline && new Date(state.responseDeadline).getTime() < now && state.status === "awaiting_response";

  const needsReview = state.status === "response_received" || state.status === "partially_confirmed" || state.status === "change_requested";

  const primaryMessage = state.status === "awaiting_response"
    ? isOverdue ? "공급사 응답 기한 초과" : "공급사 확인 대기 중"
    : state.status === "response_received"
      ? `공급사 응답 수신 — ${delta?.totalDeltaCount ?? 0}건 변경 검토 필요`
    : state.status === "confirmed"
      ? "공급사 PO 확인 완료 — Receiving Preparation 진입 가능"
    : state.status === "partially_confirmed"
      ? `부분 확인 — ${delta?.totalDeltaCount ?? 0}건 변경, 추가 검토 필요`
    : state.status === "change_requested"
      ? `공급사 조건 변경 요청 — ${state.criticalChangeCount}건 주요 변경`
    : state.status === "rejected"
      ? "공급사 PO 거부 — 재처리 필요"
    : state.status === "expired"
      ? "응답 기한 만료 — 재요청 또는 취소"
    : "취소됨";

  const nextAction = state.status === "awaiting_response"
    ? isOverdue ? "기한 만료 처리 또는 재요청" : "공급사 응답 대기"
    : state.status === "response_received"
      ? "변경 사항 검토 후 수락/보정/거부"
    : state.status === "confirmed"
      ? "Receiving Preparation으로 진행"
    : state.status === "partially_confirmed"
      ? "추가 검토 후 최종 수락/보정/거부"
    : state.status === "change_requested"
      ? "변경 요청 검토 → 수락 / 보정 요청 / 거부"
    : state.status === "rejected"
      ? "PO 재발행 또는 공급사 변경"
    : state.status === "expired"
      ? "확인 재요청 또는 취소"
    : "재시작 필요";

  let deadlineMessage: string | null = null;
  if (state.responseDeadline && state.status === "awaiting_response") {
    const remaining = Math.ceil((new Date(state.responseDeadline).getTime() - now) / 86400000);
    deadlineMessage = remaining > 0 ? `응답 기한 ${remaining}일 남음` : `기한 ${Math.abs(remaining)}일 초과`;
  }

  return {
    status: state.status,
    statusLabel: getSupplierStatusLabel(state.status),
    statusColor: STATUS_COLORS[state.status],
    isTerminal,
    primaryMessage,
    nextAction,
    delta,
    canAccept: needsReview,
    canRequestCorrection: state.status === "change_requested",
    canReopenApproval: needsReview && (delta?.hasCriticalDelta ?? false),
    canReopenConversion: state.status === "rejected",
    canCancel: !isTerminal,
    deadlineMessage,
    isOverdue,
  };
}

// ══════════════════════════════════════════════
// Receiving Preparation Handoff
// ══════════════════════════════════════════════

export interface ReceivingPrepGovernanceHandoff {
  governanceId: string;
  caseId: string;
  poNumber: string;
  executionId: string;
  payloadSnapshotId: string;
  poCreatedObjectId: string;
  confirmedLineItems: SupplierLineResponse[];
  confirmedDeliveryDate: string | null;
  acceptedChanges: SupplierProposedChange[];
  handoffReadiness: "ready" | "pending" | "blocked";
}

export function buildReceivingPrepGovernanceHandoff(
  state: SupplierConfirmationGovernanceState,
): ReceivingPrepGovernanceHandoff | null {
  if (state.status !== "confirmed") return null;
  if (!state.responseSnapshot) return null;

  return {
    governanceId: state.governanceId,
    caseId: state.caseId,
    poNumber: state.poNumber,
    executionId: state.executionId,
    payloadSnapshotId: state.payloadSnapshotId,
    poCreatedObjectId: state.poCreatedObjectId,
    confirmedLineItems: state.responseSnapshot.lineResponses,
    confirmedDeliveryDate: state.responseSnapshot.confirmedDeliveryDate,
    acceptedChanges: state.responseSnapshot.proposedChanges,
    handoffReadiness: "ready",
  };
}

// ══════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════

export type ConfirmationGovernanceEventType =
  | "confirmation_governance_created"
  | "supplier_response_received"
  | "operator_accepted"
  | "operator_accepted_with_modifications"
  | "operator_requested_correction"
  | "operator_rejected"
  | "change_requested_by_supplier"
  | "confirmation_expired"
  | "confirmation_cancelled"
  | "receiving_handoff_created";

export interface ConfirmationGovernanceEvent {
  type: ConfirmationGovernanceEventType;
  governanceId: string;
  caseId: string;
  poNumber: string;
  fromStatus: SupplierResponseStatus;
  toStatus: SupplierResponseStatus;
  actor: string;
  timestamp: string;
  detail: string;
}
