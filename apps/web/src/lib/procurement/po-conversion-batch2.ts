/**
 * PO Conversion Entry Batch 2 — handoff payload 무결성 + field architecture + drift guard
 *
 * 고정 규칙:
 * 1. approval-approved selection만 PO conversion entry로 진입. bypass 금지.
 * 2. request/quote/approval/po draft 간 source id 연결 불변.
 * 3. preview 값과 actual draft 값 분리 금지 — draft가 유일한 truth.
 * 4. quote snapshot 기반 seed. live 값 참조 금지.
 * 5. approval 결과와 다른 vendor/line으로 틀어지는 것 감지.
 * 6. editable vs readonly field 명시적 분리.
 */

import type { FullPOConversionDraft, POConversionLineDraft } from "./po-conversion-entry";
import type { ApprovalDraft } from "./approval-workbench";
import type { SupplierQuoteResponse } from "./procurement-case";

// ══════════════════════════════════════════════════════════════════════════════
// Handoff Payload (approval → PO conversion)
// ══════════════════════════════════════════════════════════════════════════════

export interface POConversionHandoffPayload {
  /** approval에서 확정된 공급사 */
  selectedSupplierId: string;
  selectedSupplierName: string;

  /** 승인 근거 snapshot (live 참조 금지) */
  approvalSnapshot: {
    approvedAt: string;
    approvedBy: string | null;
    rationale: string | null;
    approvalDraftId: string;
    decisionRecordId: string;
  };

  /** quote response snapshot (live 참조 금지) */
  quoteSnapshot: {
    quotedTotal: number | null;
    leadTimeDays: number | null;
    substituteOffered: boolean | null;
    termsNotes: string | null;
    receivedAt: string | null;
  };

  /** line item snapshot from approved quote */
  lineSnapshots: POConversionLineSnapshot[];

  /** source linkage */
  sourceRequestAssemblyId: string;
  sourceCompareSessionId: string | null;
  procurementCaseId: string;
}

export interface POConversionLineSnapshot {
  itemId: string;
  productName: string;
  approvedQuantity: number | null;
  quotedUnitPrice: number | null;
  currency: string | null;
  leadTimeDays: number | null;
}

export function buildPOConversionHandoffPayload(input: {
  approvalDraft: ApprovalDraft;
  supplierResponse: SupplierQuoteResponse | null;
  supplierName: string;
  decisionRecordId: string;
  itemNames: Record<string, string>;
  sourceRequestAssemblyId: string;
  sourceCompareSessionId: string | null;
  procurementCaseId: string;
}): POConversionHandoffPayload {
  const { approvalDraft, supplierResponse, supplierName } = input;

  return {
    selectedSupplierId: approvalDraft.selectedSupplierId!,
    selectedSupplierName: supplierName,
    approvalSnapshot: {
      approvedAt: new Date().toISOString(),
      approvedBy: null, // caller에서 설정
      rationale: approvalDraft.reviewRationale,
      approvalDraftId: approvalDraft.approvalDraftId,
      decisionRecordId: input.decisionRecordId,
    },
    quoteSnapshot: {
      quotedTotal: supplierResponse?.quotedTotal ?? null,
      leadTimeDays: supplierResponse?.leadTimeDays ?? null,
      substituteOffered: supplierResponse?.substituteOffered ?? null,
      termsNotes: supplierResponse?.termsNotes ?? null,
      receivedAt: supplierResponse?.receivedAt ?? null,
    },
    lineSnapshots: (supplierResponse?.quotedUnitPrices ?? []).map(p => ({
      itemId: p.itemId,
      productName: input.itemNames[p.itemId] ?? p.itemId,
      approvedQuantity: p.quantity,
      quotedUnitPrice: p.unitPrice,
      currency: null,
      leadTimeDays: supplierResponse?.leadTimeDays ?? null,
    })),
    sourceRequestAssemblyId: input.sourceRequestAssemblyId,
    sourceCompareSessionId: input.sourceCompareSessionId,
    procurementCaseId: input.procurementCaseId,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Seed PO Draft from Handoff Payload (quote snapshot 기반)
// ══════════════════════════════════════════════════════════════════════════════

let _b2c = 0;
function b2Uid(prefix: string): string { return `${prefix}_${Date.now()}_${++_b2c}`; }

export function seedPOConversionDraftFromPayload(
  payload: POConversionHandoffPayload
): FullPOConversionDraft {
  const now = new Date().toISOString();

  const lineDrafts: POConversionLineDraft[] = payload.lineSnapshots.map(snap => ({
    lineId: b2Uid("pol"),
    itemId: snap.itemId,
    productName: snap.productName,
    quantity: snap.approvedQuantity,
    unitOfMeasure: null,
    unitPrice: snap.quotedUnitPrice,
    currency: snap.currency,
    leadTimeDays: snap.leadTimeDays,
    partialShipAllowed: false,
    buyerLineNote: null,
  }));

  // FullPOConversionDraft에 필요한 ExtendedPOConversionDraft 필드 포함
  return {
    poConversionDraftId: b2Uid("fpo"),
    procurementCaseId: payload.procurementCaseId,
    sourceApprovalDecisionId: payload.approvalSnapshot.decisionRecordId,
    sourceRequestAssemblyId: payload.sourceRequestAssemblyId,
    sourceCompareSessionId: payload.sourceCompareSessionId,
    selectedSupplierId: payload.selectedSupplierId,
    selectedQuoteId: null,
    itemIds: payload.lineSnapshots.map(l => l.itemId),
    currency: null,
    paymentTerms: null,
    incoterms: null,
    shippingTerms: null,
    requestedBy: null,
    approvalSnapshot: {
      approvedAt: payload.approvalSnapshot.approvedAt,
      approvedBy: payload.approvalSnapshot.approvedBy,
      rationale: payload.approvalSnapshot.rationale,
    },
    draftStatus: "seeded",
    createdAt: now,
    updatedAt: now,
    // FullPOConversionDraft 확장 필드
    deliveryLocationId: null,
    billingEntityId: null,
    costCenterId: null,
    expectedDeliveryDate: null,
    buyerNote: null,
    internalMemo: null,
    lineDrafts,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Editable vs Readonly Field Classification
// ══════════════════════════════════════════════════════════════════════════════

export type FieldEditability = "editable" | "readonly" | "derived";

export interface POFieldClassification {
  field: string;
  editability: FieldEditability;
  reason: string;
}

/** PO conversion draft의 필드별 편집 가능 여부 */
export const PO_FIELD_CLASSIFICATIONS: POFieldClassification[] = [
  // Readonly — approval/quote에서 넘어온 확정값
  { field: "selectedSupplierId", editability: "readonly", reason: "승인된 공급사. 변경 시 재승인 필요." },
  { field: "sourceApprovalDecisionId", editability: "readonly", reason: "승인 결정 linkage." },
  { field: "sourceRequestAssemblyId", editability: "readonly", reason: "요청 출처 linkage." },
  { field: "approvalSnapshot", editability: "readonly", reason: "승인 시점 snapshot." },
  { field: "procurementCaseId", editability: "readonly", reason: "case linkage." },

  // Editable — operator가 PO 생성 전 보정
  { field: "currency", editability: "editable", reason: "통화 설정." },
  { field: "paymentTerms", editability: "editable", reason: "결제 조건." },
  { field: "incoterms", editability: "editable", reason: "무역 조건." },
  { field: "shippingTerms", editability: "editable", reason: "배송 조건." },
  { field: "requestedBy", editability: "editable", reason: "요청자." },
  { field: "deliveryLocationId", editability: "editable", reason: "납품지." },
  { field: "billingEntityId", editability: "editable", reason: "청구 법인." },
  { field: "costCenterId", editability: "editable", reason: "비용센터." },
  { field: "expectedDeliveryDate", editability: "editable", reason: "예상 납품일." },
  { field: "buyerNote", editability: "editable", reason: "구매자 메모." },
  { field: "internalMemo", editability: "editable", reason: "내부 메모." },

  // Derived — selector에서 재계산
  { field: "draftStatus", editability: "derived", reason: "readiness 기반 자동 계산." },
  { field: "totalAmount", editability: "derived", reason: "line items 합계." },
];

export const PO_LINE_FIELD_CLASSIFICATIONS: POFieldClassification[] = [
  { field: "itemId", editability: "readonly", reason: "승인된 품목. 변경 시 재승인 필요." },
  { field: "productName", editability: "readonly", reason: "품목명." },
  { field: "quantity", editability: "editable", reason: "발주 수량 (승인 수량에서 보정 가능)." },
  { field: "unitOfMeasure", editability: "editable", reason: "단위." },
  { field: "unitPrice", editability: "editable", reason: "단가 (견적 단가에서 보정 가능)." },
  { field: "currency", editability: "editable", reason: "통화." },
  { field: "leadTimeDays", editability: "editable", reason: "리드타임 (견적 기준에서 보정 가능)." },
  { field: "partialShipAllowed", editability: "editable", reason: "분할 납품 허용." },
  { field: "buyerLineNote", editability: "editable", reason: "라인별 메모." },
];

// ══════════════════════════════════════════════════════════════════════════════
// Vendor/Line Drift Guard
// ══════════════════════════════════════════════════════════════════════════════

export interface DriftDetection {
  hasDrift: boolean;
  drifts: DriftItem[];
}

export interface DriftItem {
  field: string;
  approvedValue: string | null;
  currentValue: string | null;
  severity: "blocking" | "warning";
}

export function detectVendorLineDrift(
  payload: POConversionHandoffPayload,
  currentDraft: FullPOConversionDraft
): DriftDetection {
  const drifts: DriftItem[] = [];

  // Vendor drift — blocking
  if (currentDraft.selectedSupplierId !== payload.selectedSupplierId) {
    drifts.push({
      field: "selectedSupplierId",
      approvedValue: payload.selectedSupplierId,
      currentValue: currentDraft.selectedSupplierId,
      severity: "blocking",
    });
  }

  // Line item count drift — warning
  if (currentDraft.lineDrafts.length !== payload.lineSnapshots.length) {
    drifts.push({
      field: "lineCount",
      approvedValue: String(payload.lineSnapshots.length),
      currentValue: String(currentDraft.lineDrafts.length),
      severity: "warning",
    });
  }

  // Line item ID drift — warning per missing item
  const approvedItemIds = new Set(payload.lineSnapshots.map(l => l.itemId));
  const currentItemIds = new Set(currentDraft.lineDrafts.map(l => l.itemId));

  for (const id of approvedItemIds) {
    if (!currentItemIds.has(id)) {
      drifts.push({
        field: `line_missing_${id}`,
        approvedValue: id,
        currentValue: null,
        severity: "warning",
      });
    }
  }

  for (const id of currentItemIds) {
    if (!approvedItemIds.has(id)) {
      drifts.push({
        field: `line_added_${id}`,
        approvedValue: null,
        currentValue: id,
        severity: "warning",
      });
    }
  }

  return { hasDrift: drifts.length > 0, drifts };
}

// ══════════════════════════════════════════════════════════════════════════════
// Stage Reversal Guard (po_conversion → approval 역전 방지)
// ══════════════════════════════════════════════════════════════════════════════

export const FORBIDDEN_PO_STAGE_REVERSALS = [
  "po_conversion → approval_ready",
  "po_conversion → approval_in_progress",
  "po_conversion → quote_review",
  "po_conversion → quote_collection",
  "po_created → po_conversion",
  "po_created → approved",
  "po_created → approval_in_progress",
] as const;

export function isStageReversalForbidden(from: string, to: string): boolean {
  const key = `${from} → ${to}`;
  return FORBIDDEN_PO_STAGE_REVERSALS.some(r => r === key);
}

// ══════════════════════════════════════════════════════════════════════════════
// PO Conversion Workbench ViewModel (batch 2 확장)
// ══════════════════════════════════════════════════════════════════════════════

export interface POConversionWorkbenchViewModelB2 {
  draft: FullPOConversionDraft | null;
  handoffPayload: POConversionHandoffPayload | null;
  driftDetection: DriftDetection | null;
  fieldClassifications: POFieldClassification[];
  lineFieldClassifications: POFieldClassification[];
  editableFieldCount: number;
  readonlyFieldCount: number;
  shouldRender: boolean;
}

export function buildPOConversionWorkbenchViewModelB2(input: {
  draft: FullPOConversionDraft | null;
  payload: POConversionHandoffPayload | null;
}): POConversionWorkbenchViewModelB2 {
  if (!input.draft) {
    return {
      draft: null,
      handoffPayload: null,
      driftDetection: null,
      fieldClassifications: PO_FIELD_CLASSIFICATIONS,
      lineFieldClassifications: PO_LINE_FIELD_CLASSIFICATIONS,
      editableFieldCount: 0,
      readonlyFieldCount: 0,
      shouldRender: false,
    };
  }

  const driftDetection = input.payload
    ? detectVendorLineDrift(input.payload, input.draft)
    : null;

  return {
    draft: input.draft,
    handoffPayload: input.payload,
    driftDetection,
    fieldClassifications: PO_FIELD_CLASSIFICATIONS,
    lineFieldClassifications: PO_LINE_FIELD_CLASSIFICATIONS,
    editableFieldCount: PO_FIELD_CLASSIFICATIONS.filter(f => f.editability === "editable").length,
    readonlyFieldCount: PO_FIELD_CLASSIFICATIONS.filter(f => f.editability === "readonly").length,
    shouldRender: true,
  };
}
