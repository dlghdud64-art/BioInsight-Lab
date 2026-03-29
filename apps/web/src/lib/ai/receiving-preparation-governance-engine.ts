/**
 * Receiving Preparation Governance Engine
 *
 * confirmed supplier confirmation → receiving preparation → receiving execution
 *
 * IMMUTABLE RULES:
 * 1. handoff source는 confirmed supplier confirmation만 허용
 * 2. receiving_prep는 "받을 준비가 됐는가"를 판단하는 governance layer
 * 3. received ≠ usable stock — receiving truth와 inventory available truth 분리
 * 4. inbound blocker가 있으면 receiving execution 진입 불가
 * 5. expected lines/qty/docs 기준은 confirmed supplier response에서만 도출
 */

import type { ReceivingPrepGovernanceHandoff, SupplierLineResponse, SupplierProposedChange } from "./supplier-confirmation-governance-engine";

// ══════════════════════════════════════════════
// Receiving Preparation Readiness
// ══════════════════════════════════════════════

export type ReceivingPrepReadiness =
  | "not_evaluated"
  | "blocked"
  | "needs_review"
  | "ready_to_receive"
  | "scheduled"
  | "cancelled";

// ══════════════════════════════════════════════
// Inbound Blocker
// ══════════════════════════════════════════════

export type InboundBlockerType =
  | "missing_shipment_reference"
  | "missing_packing_document"
  | "missing_compliance_document"
  | "partial_shipment_declared"
  | "destination_site_mismatch"
  | "cold_chain_requirement"
  | "hazard_handling_requirement"
  | "receiving_window_invalid"
  | "supplier_confirmation_incomplete"
  | "storage_capacity_unavailable";

export interface InboundBlocker {
  type: InboundBlockerType;
  severity: "hard" | "soft";
  detail: string;
  remediationAction: string;
}

// ══════════════════════════════════════════════
// Expected Receipt Line — confirmed 응답에서 도출
// ══════════════════════════════════════════════

export interface ExpectedReceiptLine {
  lineId: string;
  itemName: string;
  expectedQuantity: number;
  expectedUnitPrice: number;
  acceptance: "accepted" | "changed" | "backordered";
  supplierNote: string;
}

// ══════════════════════════════════════════════
// Receiving Preparation Governance State
// ══════════════════════════════════════════════

export interface ReceivingPreparationGovernanceState {
  stateId: string;
  caseId: string;
  poNumber: string;
  readiness: ReceivingPrepReadiness;
  // Expected receipt basis (from confirmed supplier response)
  expectedLines: ExpectedReceiptLine[];
  expectedDeliveryDate: string | null;
  expectedTotalAmount: number;
  // Blockers
  hardBlockers: InboundBlocker[];
  softBlockers: InboundBlocker[];
  totalBlockerCount: number;
  // Shipment tracking
  shipmentReference: string;
  trackingNumber: string;
  carrier: string;
  // Site / destination
  receivingSite: string;
  storageLocation: string;
  // Handling requirements
  requiresColdChain: boolean;
  requiresHazardHandling: boolean;
  handlingInstructions: string;
  // Documents
  requiredDocuments: string[];
  receivedDocuments: string[];
  missingDocuments: string[];
  // Confirmation checklist
  confirmationChecklist: ReceivingConfirmationItem[];
  allConfirmed: boolean;
  // Schedule
  scheduledReceiveDate: string | null;
  receivingWindowStart: string | null;
  receivingWindowEnd: string | null;
  // Linkage (upstream chain)
  confirmationGovernanceId: string;
  executionId: string;
  payloadSnapshotId: string;
  poCreatedObjectId: string;
  approvalDecisionObjectId: string;
  // Audit
  evaluatedAt: string;
  evaluatedBy: string;
}

export interface ReceivingConfirmationItem {
  key: string;
  label: string;
  confirmed: boolean;
  required: boolean;
}

// ══════════════════════════════════════════════
// Create from Handoff
// ══════════════════════════════════════════════

export interface CreateReceivingPrepInput {
  handoff: ReceivingPrepGovernanceHandoff;
  // Site info
  receivingSite: string;
  storageLocation: string;
  // Handling
  requiresColdChain: boolean;
  requiresHazardHandling: boolean;
  handlingInstructions: string;
  // Shipment
  shipmentReference: string;
  trackingNumber: string;
  carrier: string;
  // Documents
  requiredDocuments: string[];
  receivedDocuments: string[];
  // Receiving window
  receivingWindowStart: string | null;
  receivingWindowEnd: string | null;
  // Actor
  actor: string;
}

export function createReceivingPreparationState(input: CreateReceivingPrepInput): ReceivingPreparationGovernanceState | null {
  // Only from confirmed handoff
  if (input.handoff.handoffReadiness !== "ready") return null;

  const expectedLines: ExpectedReceiptLine[] = input.handoff.confirmedLineItems.map(line => ({
    lineId: line.lineId,
    itemName: line.itemName,
    expectedQuantity: line.confirmedQuantity,
    expectedUnitPrice: line.confirmedUnitPrice,
    acceptance: line.acceptance === "rejected" ? "backordered" : line.acceptance === "accepted" ? "accepted" : "changed",
    supplierNote: line.supplierNote,
  }));

  const expectedTotal = expectedLines.reduce((sum, l) => sum + l.expectedQuantity * l.expectedUnitPrice, 0);

  const now = new Date().toISOString();
  const missingDocs = input.requiredDocuments.filter(d => !input.receivedDocuments.includes(d));

  return {
    stateId: `rpgov_${Date.now().toString(36)}`,
    caseId: input.handoff.caseId,
    poNumber: input.handoff.poNumber,
    readiness: "not_evaluated",
    expectedLines,
    expectedDeliveryDate: input.handoff.confirmedDeliveryDate,
    expectedTotalAmount: expectedTotal,
    hardBlockers: [],
    softBlockers: [],
    totalBlockerCount: 0,
    shipmentReference: input.shipmentReference,
    trackingNumber: input.trackingNumber,
    carrier: input.carrier,
    receivingSite: input.receivingSite,
    storageLocation: input.storageLocation,
    requiresColdChain: input.requiresColdChain,
    requiresHazardHandling: input.requiresHazardHandling,
    handlingInstructions: input.handlingInstructions,
    requiredDocuments: input.requiredDocuments,
    receivedDocuments: input.receivedDocuments,
    missingDocuments: missingDocs,
    confirmationChecklist: [],
    allConfirmed: false,
    scheduledReceiveDate: null,
    receivingWindowStart: input.receivingWindowStart,
    receivingWindowEnd: input.receivingWindowEnd,
    confirmationGovernanceId: input.handoff.governanceId,
    executionId: input.handoff.executionId,
    payloadSnapshotId: input.handoff.payloadSnapshotId,
    poCreatedObjectId: input.handoff.poCreatedObjectId,
    approvalDecisionObjectId: input.handoff.governanceId, // upstream
    evaluatedAt: now,
    evaluatedBy: input.actor,
  };
}

// ══════════════════════════════════════════════
// Evaluate Inbound Readiness
// ══════════════════════════════════════════════

export interface EvaluateReceivingPrepInput {
  state: ReceivingPreparationGovernanceState;
  // Current status checks
  supplierConfirmationComplete: boolean;
  destinationSiteValid: boolean;
  storageCapacityAvailable: boolean;
  isPartialShipment: boolean;
  // Current time for window check
  currentTime?: string;
  actor: string;
}

export function evaluateReceivingPreparation(input: EvaluateReceivingPrepInput): ReceivingPreparationGovernanceState {
  const hardBlockers: InboundBlocker[] = [];
  const softBlockers: InboundBlocker[] = [];
  const now = input.currentTime || new Date().toISOString();

  // Hard blockers
  if (!input.supplierConfirmationComplete) {
    hardBlockers.push({
      type: "supplier_confirmation_incomplete",
      severity: "hard",
      detail: "공급사 확인 미완료",
      remediationAction: "공급사 확인 완료 대기",
    });
  }

  if (!input.state.shipmentReference) {
    hardBlockers.push({
      type: "missing_shipment_reference",
      severity: "hard",
      detail: "배송 참조번호 미입력",
      remediationAction: "배송 참조번호 입력",
    });
  }

  if (input.state.missingDocuments.length > 0) {
    const hasPacking = input.state.missingDocuments.some(d => d.toLowerCase().includes("packing"));
    const hasCompliance = input.state.missingDocuments.some(d => d.toLowerCase().includes("compliance") || d.toLowerCase().includes("certificate"));
    if (hasPacking) {
      hardBlockers.push({
        type: "missing_packing_document",
        severity: "hard",
        detail: `포장 명세서 누락`,
        remediationAction: "포장 명세서 수령/첨부",
      });
    }
    if (hasCompliance) {
      hardBlockers.push({
        type: "missing_compliance_document",
        severity: "hard",
        detail: `인증/적합성 서류 누락`,
        remediationAction: "인증서 수령/첨부",
      });
    }
    // Other missing docs as hard blocker
    const otherMissing = input.state.missingDocuments.filter(
      d => !d.toLowerCase().includes("packing") && !d.toLowerCase().includes("compliance") && !d.toLowerCase().includes("certificate")
    );
    if (otherMissing.length > 0) {
      hardBlockers.push({
        type: "missing_packing_document",
        severity: "hard",
        detail: `필수 서류 누락: ${otherMissing.join(", ")}`,
        remediationAction: "서류 수령/첨부",
      });
    }
  }

  if (!input.destinationSiteValid) {
    hardBlockers.push({
      type: "destination_site_mismatch",
      severity: "hard",
      detail: "수령 사이트 불일치 또는 무효",
      remediationAction: "수령 사이트 확인/수정",
    });
  }

  if (input.state.requiresColdChain) {
    hardBlockers.push({
      type: "cold_chain_requirement",
      severity: "hard",
      detail: "콜드체인 요건 — 특수 수령 절차 필요",
      remediationAction: "콜드체인 수령 절차 확인",
    });
  }

  if (input.state.requiresHazardHandling) {
    hardBlockers.push({
      type: "hazard_handling_requirement",
      severity: "hard",
      detail: "위험물 취급 요건 — 안전 절차 필요",
      remediationAction: "위험물 취급 절차 확인",
    });
  }

  // Receiving window check
  if (input.state.receivingWindowStart && input.state.receivingWindowEnd) {
    const windowStart = new Date(input.state.receivingWindowStart).getTime();
    const windowEnd = new Date(input.state.receivingWindowEnd).getTime();
    const nowMs = new Date(now).getTime();
    if (nowMs < windowStart || nowMs > windowEnd) {
      // Soft blocker if window not yet active, hard if expired
      if (nowMs > windowEnd) {
        hardBlockers.push({
          type: "receiving_window_invalid",
          severity: "hard",
          detail: "수령 윈도우 만료",
          remediationAction: "수령 윈도우 재설정",
        });
      }
    }
  }

  // Soft blockers
  if (input.isPartialShipment) {
    softBlockers.push({
      type: "partial_shipment_declared",
      severity: "soft",
      detail: "부분 배송 선언됨 — 분할 수령 주의",
      remediationAction: "부분 수령 계획 확인",
    });
  }

  if (!input.storageCapacityAvailable) {
    softBlockers.push({
      type: "storage_capacity_unavailable",
      severity: "soft",
      detail: "보관 공간 확인 필요",
      remediationAction: "보관 공간 확보",
    });
  }

  if (!input.state.trackingNumber) {
    softBlockers.push({
      type: "missing_shipment_reference",
      severity: "soft",
      detail: "운송장 번호 미입력 — 추적 불가",
      remediationAction: "운송장 번호 입력",
    });
  }

  // Readiness
  let readiness: ReceivingPrepReadiness;
  if (hardBlockers.length > 0) {
    readiness = "blocked";
  } else if (softBlockers.length > 0) {
    readiness = "needs_review";
  } else {
    readiness = "ready_to_receive";
  }

  // Confirmation checklist
  const checklist: ReceivingConfirmationItem[] = [
    { key: "supplier_confirmed", label: "공급사 확인 완료", confirmed: input.supplierConfirmationComplete, required: true },
    { key: "shipment_ref", label: "배송 참조번호 입력", confirmed: !!input.state.shipmentReference, required: true },
    { key: "documents_complete", label: "필수 서류 수령", confirmed: input.state.missingDocuments.length === 0, required: input.state.requiredDocuments.length > 0 },
    { key: "site_valid", label: "수령 사이트 확인", confirmed: input.destinationSiteValid, required: true },
    { key: "storage_ready", label: "보관 공간 확인", confirmed: input.storageCapacityAvailable, required: false },
    { key: "handling_confirmed", label: "특수 취급 확인", confirmed: !input.state.requiresColdChain && !input.state.requiresHazardHandling, required: input.state.requiresColdChain || input.state.requiresHazardHandling },
  ];

  const allConfirmed = checklist.filter(c => c.required).every(c => c.confirmed);

  return {
    ...input.state,
    readiness,
    hardBlockers,
    softBlockers,
    totalBlockerCount: hardBlockers.length + softBlockers.length,
    confirmationChecklist: checklist,
    allConfirmed,
    evaluatedAt: now,
    evaluatedBy: input.actor,
  };
}

// ══════════════════════════════════════════════
// Schedule Receiving
// ══════════════════════════════════════════════

export function scheduleReceiving(
  state: ReceivingPreparationGovernanceState,
  scheduledDate: string,
  actor: string,
): ReceivingPreparationGovernanceState | null {
  if (state.readiness !== "ready_to_receive" && state.readiness !== "needs_review") return null;

  return {
    ...state,
    readiness: "scheduled",
    scheduledReceiveDate: scheduledDate,
    evaluatedAt: new Date().toISOString(),
    evaluatedBy: actor,
  };
}

// ══════════════════════════════════════════════
// Cancel Preparation
// ══════════════════════════════════════════════

export function cancelReceivingPreparation(
  state: ReceivingPreparationGovernanceState,
  actor: string,
): ReceivingPreparationGovernanceState | null {
  if (state.readiness === "cancelled") return null;

  return {
    ...state,
    readiness: "cancelled",
    evaluatedAt: new Date().toISOString(),
    evaluatedBy: actor,
  };
}

// ══════════════════════════════════════════════
// Receiving Preparation Surface — UI 투사
// ══════════════════════════════════════════════

export interface ReceivingPrepSurface {
  readiness: ReceivingPrepReadiness;
  statusBadge: "allowed" | "blocked" | "needs_review" | "scheduled" | "cancelled";
  statusColor: "emerald" | "red" | "amber" | "blue" | "slate";
  primaryMessage: string;
  nextAction: string;
  // Blockers
  blockerMessages: string[];
  warningMessages: string[];
  // Expected receipt summary
  expectedLineCount: number;
  expectedTotalAmount: number;
  expectedDeliveryDate: string | null;
  // Checklist
  checklistComplete: boolean;
  checklistProgress: string;
  // Dock actions
  canStartReceiving: boolean;
  canSchedule: boolean;
  canCancel: boolean;
  canReopenConfirmation: boolean;
  canRequestCorrection: boolean;
}

export function buildReceivingPrepSurface(state: ReceivingPreparationGovernanceState): ReceivingPrepSurface {
  const requiredChecklist = state.confirmationChecklist.filter(c => c.required);
  const confirmedRequired = requiredChecklist.filter(c => c.confirmed);

  let statusBadge: ReceivingPrepSurface["statusBadge"];
  let statusColor: ReceivingPrepSurface["statusColor"];

  if (state.readiness === "blocked") {
    statusBadge = "blocked";
    statusColor = "red";
  } else if (state.readiness === "needs_review") {
    statusBadge = "needs_review";
    statusColor = "amber";
  } else if (state.readiness === "scheduled") {
    statusBadge = "scheduled";
    statusColor = "blue";
  } else if (state.readiness === "cancelled") {
    statusBadge = "cancelled";
    statusColor = "slate";
  } else {
    statusBadge = "allowed";
    statusColor = "emerald";
  }

  const primaryMessage = state.readiness === "ready_to_receive"
    ? `입고 준비 완료 — ${state.expectedLines.length}건 수령 가능`
    : state.readiness === "blocked"
      ? `입고 차단 — ${state.hardBlockers[0]?.detail || "차단 사유 확인"}`
    : state.readiness === "needs_review"
      ? `검토 필요 — ${state.softBlockers[0]?.detail || "검토 사항 확인"}`
    : state.readiness === "scheduled"
      ? `입고 예정 — ${state.scheduledReceiveDate ? new Date(state.scheduledReceiveDate).toLocaleDateString("ko-KR") : "일자 미정"}`
    : state.readiness === "cancelled"
      ? "입고 준비 취소됨"
    : "입고 준비 미평가";

  const nextAction = state.readiness === "ready_to_receive"
    ? "입고 실행 또는 예약"
    : state.readiness === "blocked"
      ? state.hardBlockers[0]?.remediationAction || "차단 해소 필요"
    : state.readiness === "needs_review"
      ? state.softBlockers[0]?.remediationAction || "검토 후 진행"
    : state.readiness === "scheduled"
      ? "예정일 대기 또는 즉시 입고"
    : state.readiness === "cancelled"
      ? "재시작하려면 공급사 확인 재진입"
    : "입고 준비 평가 필요";

  return {
    readiness: state.readiness,
    statusBadge,
    statusColor,
    primaryMessage,
    nextAction,
    blockerMessages: state.hardBlockers.map(b => `${b.detail} → ${b.remediationAction}`),
    warningMessages: state.softBlockers.map(b => `${b.detail} → ${b.remediationAction}`),
    expectedLineCount: state.expectedLines.length,
    expectedTotalAmount: state.expectedTotalAmount,
    expectedDeliveryDate: state.expectedDeliveryDate,
    checklistComplete: state.allConfirmed,
    checklistProgress: `${confirmedRequired.length}/${requiredChecklist.length}`,
    canStartReceiving: state.readiness === "ready_to_receive" || state.readiness === "scheduled",
    canSchedule: state.readiness === "ready_to_receive" || state.readiness === "needs_review",
    canCancel: state.readiness !== "cancelled",
    canReopenConfirmation: state.readiness === "blocked",
    canRequestCorrection: state.readiness === "blocked" && state.hardBlockers.some(b => b.type === "supplier_confirmation_incomplete"),
  };
}

// ══════════════════════════════════════════════
// Receiving Execution Handoff
// ══════════════════════════════════════════════

export interface ReceivingExecutionHandoff {
  stateId: string;
  caseId: string;
  poNumber: string;
  expectedLines: ExpectedReceiptLine[];
  expectedDeliveryDate: string | null;
  expectedTotalAmount: number;
  receivingSite: string;
  storageLocation: string;
  requiresColdChain: boolean;
  requiresHazardHandling: boolean;
  handlingInstructions: string;
  shipmentReference: string;
  trackingNumber: string;
  carrier: string;
  // Upstream linkage
  confirmationGovernanceId: string;
  executionId: string;
  payloadSnapshotId: string;
  poCreatedObjectId: string;
}

export function buildReceivingExecutionHandoff(
  state: ReceivingPreparationGovernanceState,
): ReceivingExecutionHandoff | null {
  if (state.readiness !== "ready_to_receive" && state.readiness !== "scheduled") return null;

  return {
    stateId: state.stateId,
    caseId: state.caseId,
    poNumber: state.poNumber,
    expectedLines: state.expectedLines,
    expectedDeliveryDate: state.expectedDeliveryDate,
    expectedTotalAmount: state.expectedTotalAmount,
    receivingSite: state.receivingSite,
    storageLocation: state.storageLocation,
    requiresColdChain: state.requiresColdChain,
    requiresHazardHandling: state.requiresHazardHandling,
    handlingInstructions: state.handlingInstructions,
    shipmentReference: state.shipmentReference,
    trackingNumber: state.trackingNumber,
    carrier: state.carrier,
    confirmationGovernanceId: state.confirmationGovernanceId,
    executionId: state.executionId,
    payloadSnapshotId: state.payloadSnapshotId,
    poCreatedObjectId: state.poCreatedObjectId,
  };
}

// ══════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════

export type ReceivingPrepEventType =
  | "receiving_prep_created"
  | "receiving_prep_evaluated"
  | "receiving_prep_blocked"
  | "receiving_prep_ready"
  | "receiving_prep_scheduled"
  | "receiving_prep_cancelled"
  | "receiving_execution_handoff_created";

export interface ReceivingPrepEvent {
  type: ReceivingPrepEventType;
  stateId: string;
  caseId: string;
  poNumber: string;
  readiness: ReceivingPrepReadiness;
  actor: string;
  timestamp: string;
  detail: string;
}
