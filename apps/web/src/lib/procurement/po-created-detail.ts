/**
 * PO Created Detail — post-create operating surface
 *
 * 고정 규칙:
 * 1. PO draft 생성 직후 단일 landing surface. success toast로 끝나지 않음.
 * 2. readiness gate가 send 전 필수 검증. blocking issue 있으면 진행 금지.
 * 3. locked field / editable field 분리. vendor/line identity 자유 수정 금지.
 * 4. po_draft_created → po_ready_for_send 단방향.
 * 5. lineage/rationale/activity가 detail 안에서 확인 가능.
 * 6. actual send는 이번 batch 범위 밖. Mark Ready for Send까지만.
 */

import type { PurchaseOrderRecord, PurchaseOrderLineItem } from "./po-conversion-entry";

// ══════════════════════════════════════════════════════════════════════════════
// PO Draft State
// ══════════════════════════════════════════════════════════════════════════════

export type PODraftState =
  | "po_draft_created"
  | "po_ready_for_send"
  | "po_sent"
  | "po_acknowledged"
  | "supplier_confirmed"
  | "receiving_prepared"
  | "receiving_in_progress"
  | "received_recorded"
  | "inventory_intake_in_progress"
  | "stocked_recorded"
  | "stock_release_in_progress"
  | "stock_available_recorded"
  | "po_cancelled";

export const PO_DRAFT_STATE_LABELS: Record<PODraftState, string> = {
  po_draft_created: "Draft 생성됨",
  po_ready_for_send: "전송 준비 완료",
  po_sent: "전송됨",
  po_acknowledged: "공급사 확인",
  supplier_confirmed: "공급 확정",
  receiving_prepared: "입고 준비 완료",
  receiving_in_progress: "입고 진행 중",
  received_recorded: "입고 기록 완료",
  inventory_intake_in_progress: "재고 반영 진행 중",
  stocked_recorded: "재고 반영 완료",
  stock_release_in_progress: "가용 전환 진행 중",
  stock_available_recorded: "가용 재고 전환 완료",
  po_cancelled: "취소됨",
};

// ══════════════════════════════════════════════════════════════════════════════
// PO Detail Model (canonical object)
// ══════════════════════════════════════════════════════════════════════════════

export interface PODetailModel {
  purchaseOrderId: string;
  procurementCaseId: string;
  sourcePOConversionDraftId: string;

  // ── Vendor ──
  supplierId: string;
  supplierName: string;

  // ── Lines ──
  lineItems: PurchaseOrderLineItem[];
  lineCount: number;

  // ── Commercial ──
  subtotal: number;
  grandTotal: number;
  currency: string;
  paymentTerms: string | null;
  shippingTerms: string | null;
  incoterms: string | null;

  // ── Routing ──
  deliveryLocationId: string | null;
  billingEntityId: string | null;
  costCenterId: string | null;
  requestedBy: string | null;

  // ── Editable fields ──
  internalNote: string | null;
  supplierMemo: string | null;
  requestedDeliveryDate: string | null;
  receivingInstruction: string | null;
  dispatchPreparationNote: string | null;

  // ── State ──
  draftState: PODraftState;
  createdAt: string;
  createdBy: string | null;

  // ── Lineage ──
  lineage: PODetailLineage;
}

export interface PODetailLineage {
  requestAssemblyId: string | null;
  compareSessionId: string | null;
  approvalDecisionId: string | null;
  approvalSnapshotId: string | null;
  quoteSetId: string | null;
  approvalRationale: string | null;
  selectedVendorReason: string | null;
}

export function buildPODetailModel(input: {
  po: PurchaseOrderRecord;
  supplierName: string;
  lineage: PODetailLineage;
  editableFields?: Partial<PODetailEditableFields>;
}): PODetailModel {
  const subtotal = input.po.lineItems.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  return {
    purchaseOrderId: input.po.purchaseOrderId,
    procurementCaseId: input.po.procurementCaseId,
    sourcePOConversionDraftId: input.po.sourcePOConversionDraftId,
    supplierId: input.po.supplierId,
    supplierName: input.supplierName,
    lineItems: input.po.lineItems,
    lineCount: input.po.lineItems.length,
    subtotal,
    grandTotal: subtotal, // shipping/tax는 future enhancement
    currency: input.po.lineItems[0]?.currency ?? "KRW",
    paymentTerms: input.po.paymentTerms,
    shippingTerms: input.po.shippingTerms,
    incoterms: input.po.incoterms,
    deliveryLocationId: input.po.deliveryLocationId,
    billingEntityId: input.po.billingEntityId,
    costCenterId: input.po.costCenterId,
    requestedBy: null,
    internalNote: input.editableFields?.internalNote ?? null,
    supplierMemo: input.editableFields?.supplierMemo ?? null,
    requestedDeliveryDate: input.editableFields?.requestedDeliveryDate ?? null,
    receivingInstruction: input.editableFields?.receivingInstruction ?? null,
    dispatchPreparationNote: input.editableFields?.dispatchPreparationNote ?? null,
    draftState: "po_draft_created",
    createdAt: input.po.createdAt,
    createdBy: input.po.createdBy,
    lineage: input.lineage,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Editable Fields (locked source 위에 operator가 보정)
// ══════════════════════════════════════════════════════════════════════════════

export interface PODetailEditableFields {
  internalNote: string | null;
  supplierMemo: string | null;
  requestedDeliveryDate: string | null;
  receivingInstruction: string | null;
  dispatchPreparationNote: string | null;
  billingReference: string | null;
  contactPerson: string | null;
}

export type PODetailEditableFieldKey = keyof PODetailEditableFields;

export const PO_DETAIL_LOCKED_FIELDS = [
  "purchaseOrderId",
  "procurementCaseId",
  "supplierId",
  "supplierName",
  "lineItems",
  "subtotal",
  "grandTotal",
  "lineage",
  "createdAt",
  "createdBy",
  "sourcePOConversionDraftId",
] as const;

export const PO_DETAIL_EDITABLE_FIELDS: PODetailEditableFieldKey[] = [
  "internalNote",
  "supplierMemo",
  "requestedDeliveryDate",
  "receivingInstruction",
  "dispatchPreparationNote",
  "billingReference",
  "contactPerson",
];

// ══════════════════════════════════════════════════════════════════════════════
// Send Readiness Gate
// ══════════════════════════════════════════════════════════════════════════════

export interface POSendReadinessIssue {
  code: string;
  message: string;
  field?: string;
}

export interface POSendReadiness {
  isReadyToSend: boolean;
  blockingIssues: POSendReadinessIssue[];
  warnings: POSendReadinessIssue[];
  recommendedNextAction: string | null;
}

export function evaluatePoSendReadiness(detail: PODetailModel): POSendReadiness {
  const blockingIssues: POSendReadinessIssue[] = [];
  const warnings: POSendReadinessIssue[] = [];

  // Vendor
  if (!detail.supplierId) blockingIssues.push({ code: "vendor_missing", message: "공급사 정보가 없습니다." });

  // Lines
  if (detail.lineCount === 0) blockingIssues.push({ code: "no_lines", message: "발주 품목이 없습니다." });
  for (const line of detail.lineItems) {
    if (!line.quantity || line.quantity <= 0) {
      blockingIssues.push({ code: "line_qty_missing", message: `품목 ${line.itemId}: 수량 누락`, field: `line.${line.lineId}` });
    }
    if (!line.unitPrice || line.unitPrice <= 0) {
      blockingIssues.push({ code: "line_price_missing", message: `품목 ${line.itemId}: 단가 누락`, field: `line.${line.lineId}` });
    }
  }

  // Commercial
  if (detail.grandTotal <= 0) blockingIssues.push({ code: "total_invalid", message: "총액을 계산할 수 없습니다." });
  if (!detail.currency) blockingIssues.push({ code: "currency_missing", message: "통화 정보가 없습니다." });

  // Routing
  if (!detail.costCenterId) blockingIssues.push({ code: "cost_center_missing", message: "비용센터가 지정되지 않았습니다.", field: "costCenterId" });
  if (!detail.deliveryLocationId) warnings.push({ code: "delivery_location_empty", message: "납품지가 설정되지 않았습니다.", field: "deliveryLocationId" });
  if (!detail.billingEntityId) warnings.push({ code: "billing_entity_empty", message: "청구 법인이 설정되지 않았습니다.", field: "billingEntityId" });

  // Payment
  if (!detail.paymentTerms) warnings.push({ code: "payment_terms_empty", message: "결제 조건이 입력되지 않았습니다.", field: "paymentTerms" });

  // Lineage
  if (!detail.lineage.approvalDecisionId) blockingIssues.push({ code: "approval_lineage_missing", message: "승인 결정 참조가 없습니다." });

  // Duplicate guard
  if (detail.draftState === "po_ready_for_send") warnings.push({ code: "already_ready", message: "이미 전송 준비 완료 상태입니다." });
  if (detail.draftState === "po_sent") blockingIssues.push({ code: "already_sent", message: "이미 전송된 발주입니다." });

  // Recommended action
  let recommendedNextAction: string | null = null;
  if (blockingIssues.length > 0) {
    recommendedNextAction = `${blockingIssues.length}개 필수 항목 해결 필요`;
  } else if (warnings.length > 0) {
    recommendedNextAction = "전송 준비 완료 표시 가능 (경고 항목 확인)";
  } else {
    recommendedNextAction = "전송 준비 완료 표시";
  }

  return {
    isReadyToSend: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    recommendedNextAction,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Mark Ready for Send (state transition)
// ══════════════════════════════════════════════════════════════════════════════

export interface MarkReadyResult {
  success: boolean;
  newState: PODraftState;
  reason: string | null;
}

export function markPoReadyForSend(detail: PODetailModel): MarkReadyResult {
  // Guard: 현재 상태 확인
  if (detail.draftState !== "po_draft_created") {
    return { success: false, newState: detail.draftState, reason: "현재 상태에서 전송 준비 표시를 할 수 없습니다." };
  }

  // Guard: readiness 확인
  const readiness = evaluatePoSendReadiness(detail);
  if (!readiness.isReadyToSend) {
    return { success: false, newState: detail.draftState, reason: `${readiness.blockingIssues.length}개 필수 항목이 해결되지 않았습니다.` };
  }

  return { success: true, newState: "po_ready_for_send", reason: null };
}

// ══════════════════════════════════════════════════════════════════════════════
// Activity Events
// ══════════════════════════════════════════════════════════════════════════════

export type PODetailActivityType =
  | "po_draft_created"
  | "po_draft_updated"
  | "po_readiness_evaluated"
  | "po_ready_for_send_marked"
  | "po_detail_viewed";

export interface PODetailActivity {
  type: PODetailActivityType;
  at: string;
  actorId: string | null;
  summary: string;
}

export function createPODetailActivity(input: {
  type: PODetailActivityType;
  actorId?: string;
  summary: string;
}): PODetailActivity {
  return {
    type: input.type,
    at: new Date().toISOString(),
    actorId: input.actorId ?? null,
    summary: input.summary,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Workbench ViewModel (center + rail + dock 공통 truth)
// ══════════════════════════════════════════════════════════════════════════════

export interface POCreatedDetailWorkbenchModel {
  detail: PODetailModel | null;
  sendReadiness: POSendReadiness;
  activities: PODetailActivity[];
  shouldRender: boolean;

  // ── Dock CTA ──
  canMarkReady: boolean;
  markReadyLabel: string;
  backLabel: string;

  // ── Header ──
  stateBadge: string;
  identitySummary: string;
}

export function buildPOCreatedDetailWorkbenchModel(input: {
  detail: PODetailModel | null;
  activities: PODetailActivity[];
}): POCreatedDetailWorkbenchModel {
  if (!input.detail) {
    return {
      detail: null,
      sendReadiness: { isReadyToSend: false, blockingIssues: [{ code: "no_detail", message: "PO 정보를 불러올 수 없습니다." }], warnings: [], recommendedNextAction: null },
      activities: [],
      shouldRender: false,
      canMarkReady: false,
      markReadyLabel: "전송 준비 완료",
      backLabel: "운영 허브로 돌아가기",
      stateBadge: "—",
      identitySummary: "",
    };
  }

  const readiness = evaluatePoSendReadiness(input.detail);
  const canMarkReady = readiness.isReadyToSend && input.detail.draftState === "po_draft_created";

  return {
    detail: input.detail,
    sendReadiness: readiness,
    activities: input.activities,
    shouldRender: true,
    canMarkReady,
    markReadyLabel: canMarkReady ? "전송 준비 완료 표시" : readiness.recommendedNextAction ?? "전송 준비 완료",
    backLabel: "운영 허브로 돌아가기",
    stateBadge: PO_DRAFT_STATE_LABELS[input.detail.draftState] ?? input.detail.draftState,
    identitySummary: `${input.detail.supplierName} · ${input.detail.lineCount}건 · ${input.detail.currency} ${input.detail.grandTotal.toLocaleString()}`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Queue Row Badge (operations hub list 연결)
// ══════════════════════════════════════════════════════════════════════════════

export interface POQueueRowBadge {
  purchaseOrderId: string;
  supplierName: string;
  stateBadge: string;
  stateColor: "emerald" | "blue" | "amber" | "slate" | "red";
  blockingCount: number;
  warningCount: number;
  nextAction: string;
}

export function buildPOQueueRowBadge(detail: PODetailModel): POQueueRowBadge {
  const readiness = evaluatePoSendReadiness(detail);

  let stateColor: POQueueRowBadge["stateColor"];
  switch (detail.draftState) {
    case "po_ready_for_send": stateColor = "emerald"; break;
    case "po_sent": stateColor = "blue"; break;
    case "po_cancelled": stateColor = "red"; break;
    default: stateColor = readiness.blockingIssues.length > 0 ? "amber" : "slate";
  }

  let nextAction: string;
  if (detail.draftState === "po_ready_for_send") nextAction = "전송 대기";
  else if (detail.draftState === "po_sent") nextAction = "전송 완료";
  else if (readiness.blockingIssues.length > 0) nextAction = `필수 항목 ${readiness.blockingIssues.length}건 해결 필요`;
  else nextAction = "전송 준비 완료 표시 가능";

  return {
    purchaseOrderId: detail.purchaseOrderId,
    supplierName: detail.supplierName,
    stateBadge: PO_DRAFT_STATE_LABELS[detail.draftState] ?? detail.draftState,
    stateColor,
    blockingCount: readiness.blockingIssues.length,
    warningCount: readiness.warnings.length,
    nextAction,
  };
}
