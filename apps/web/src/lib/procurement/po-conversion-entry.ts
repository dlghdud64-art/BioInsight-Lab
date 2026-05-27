/**
 * PO Conversion Entry — line normalization + create pipeline + readiness
 *
 * 고정 규칙:
 * 1. approved = 승인 결정. po_conversion = PO draft 검토 중. po_created = operator create 완료.
 * 2. line normalization이 center work window의 핵심 작업.
 * 3. field-level patch만 허용. whole draft replace 금지.
 * 4. create PO는 explicit confirm pipeline. auto-create 금지.
 * 5. internal PO creation ≠ external supplier transmission. 섞지 않는다.
 * 6. center/rail/dock 모두 동일 POCreationReadiness truth 사용.
 */

import type { ProcurementCase, ProcurementStage } from "./procurement-case";
import type { ExtendedPOConversionDraft, PODraftStatus } from "./approval-decision-pipeline";
import { createAuditEvent, type ApprovalAuditEvent } from "./approval-post-decision";

// ══════════════════════════════════════════════════════════════════════════════
// PO Conversion Line Draft
// ══════════════════════════════════════════════════════════════════════════════

export interface POConversionLineDraft {
  lineId: string;
  itemId: string;
  productName: string;
  quantity: number | null;
  unitOfMeasure: string | null;
  unitPrice: number | null;
  currency: string | null;
  leadTimeDays: number | null;
  partialShipAllowed: boolean;
  buyerLineNote: string | null;
}

let _lineCounter = 0;
function lineUid(): string { return `pol_${Date.now()}_${++_lineCounter}`; }

export function createLineDraftFromItem(itemId: string, productName: string): POConversionLineDraft {
  return {
    lineId: lineUid(),
    itemId,
    productName,
    quantity: null,
    unitOfMeasure: null,
    unitPrice: null,
    currency: null,
    leadTimeDays: null,
    partialShipAllowed: false,
    buyerLineNote: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Full PO Conversion Draft (line drafts 포함)
// ══════════════════════════════════════════════════════════════════════════════

export interface FullPOConversionDraft extends ExtendedPOConversionDraft {
  deliveryLocationId: string | null;
  billingEntityId: string | null;
  costCenterId: string | null;
  expectedDeliveryDate: string | null;
  buyerNote: string | null;
  internalMemo: string | null;
  lineDrafts: POConversionLineDraft[];
}

let _fpc = 0;
function fpcUid(): string { return `fpo_${Date.now()}_${++_fpc}`; }

export function createFullPOConversionDraft(input: {
  base: ExtendedPOConversionDraft;
  itemIds: string[];
  productNames?: Record<string, string>;
}): FullPOConversionDraft {
  return {
    ...input.base,
    poConversionDraftId: input.base.poConversionDraftId || fpcUid(),
    deliveryLocationId: null,
    billingEntityId: null,
    costCenterId: null,
    expectedDeliveryDate: null,
    buyerNote: null,
    internalMemo: null,
    lineDrafts: input.itemIds.map(id =>
      createLineDraftFromItem(id, input.productNames?.[id] ?? id)
    ),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Field-Level Patch (whole replace 금지)
// ══════════════════════════════════════════════════════════════════════════════

export type PODraftPatchableField =
  | "currency"
  | "paymentTerms"
  | "incoterms"
  | "shippingTerms"
  | "requestedBy"
  | "deliveryLocationId"
  | "billingEntityId"
  | "costCenterId"
  | "expectedDeliveryDate"
  | "buyerNote"
  | "internalMemo";

export function patchPOConversionDraftField(
  draft: FullPOConversionDraft,
  field: PODraftPatchableField,
  value: unknown
): FullPOConversionDraft {
  return { ...draft, [field]: value, updatedAt: new Date().toISOString() };
}

export type POLinePatchableField =
  | "quantity"
  | "unitOfMeasure"
  | "unitPrice"
  | "currency"
  | "leadTimeDays"
  | "partialShipAllowed"
  | "buyerLineNote";

export function patchPOConversionLineDraft(
  draft: FullPOConversionDraft,
  lineId: string,
  field: POLinePatchableField,
  value: unknown
): FullPOConversionDraft {
  return {
    ...draft,
    lineDrafts: draft.lineDrafts.map(line =>
      line.lineId === lineId ? { ...line, [field]: value } : line
    ),
    updatedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// PO Creation Readiness (single truth for center/rail/dock)
// ══════════════════════════════════════════════════════════════════════════════

export interface POLineIssue {
  lineId: string;
  issues: string[];
}

export interface POCreationReadiness {
  canCreatePO: boolean;
  missingFields: string[];
  blockingIssues: string[];
  warningIssues: string[];
  lineIssues: POLineIssue[];
}

export function computePOCreationReadiness(draft: FullPOConversionDraft): POCreationReadiness {
  const missingFields: string[] = [];
  const blockingIssues: string[] = [];
  const warningIssues: string[] = [];
  const lineIssues: POLineIssue[] = [];

  // Draft-level checks
  if (!draft.selectedSupplierId) missingFields.push("selected_supplier");
  if (!draft.deliveryLocationId) missingFields.push("delivery_location");
  if (!draft.billingEntityId) missingFields.push("billing_entity");
  if (!draft.costCenterId) missingFields.push("cost_center");
  if (draft.lineDrafts.length === 0) blockingIssues.push("no_line_items");
  if (draft.draftStatus === "seeded") warningIssues.push("draft_not_reviewed");

  // Line-level checks
  for (const line of draft.lineDrafts) {
    const issues: string[] = [];
    if (!line.quantity || line.quantity <= 0) issues.push("quantity_missing");
    if (!line.unitPrice || line.unitPrice <= 0) issues.push("unit_price_missing");
    if (!line.currency) issues.push("currency_missing");
    if (!line.unitOfMeasure) issues.push("unit_of_measure_missing");
    if (issues.length > 0) lineIssues.push({ lineId: line.lineId, issues });
  }

  // Blocking line issues
  if (lineIssues.length > 0) blockingIssues.push(`line_issues_${lineIssues.length}`);

  // Warnings
  if (!draft.paymentTerms) warningIssues.push("payment_terms_empty");
  if (!draft.expectedDeliveryDate) warningIssues.push("delivery_date_empty");

  return {
    canCreatePO: missingFields.length === 0 && blockingIssues.length === 0,
    missingFields,
    blockingIssues,
    warningIssues,
    lineIssues,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Purchase Order Record
// ══════════════════════════════════════════════════════════════════════════════

export interface PurchaseOrderLineItem {
  lineId: string;
  itemId: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  currency: string;
}

export interface PurchaseOrderRecord {
  purchaseOrderId: string;
  procurementCaseId: string;
  sourcePOConversionDraftId: string;
  supplierId: string;
  lineItems: PurchaseOrderLineItem[];
  paymentTerms: string | null;
  incoterms: string | null;
  shippingTerms: string | null;
  deliveryLocationId: string | null;
  billingEntityId: string | null;
  costCenterId: string | null;
  status: "created";
  createdAt: string;
  createdBy: string | null;
}

let _poRec = 0;
function poRecUid(): string { return `po_rec_${Date.now()}_${++_poRec}`; }

// ══════════════════════════════════════════════════════════════════════════════
// Create PO Commit Pipeline
// ══════════════════════════════════════════════════════════════════════════════

export interface CreatePOResult {
  purchaseOrder: PurchaseOrderRecord;
  caseUpdate: Partial<ProcurementCase>;
  draftUpdate: Partial<FullPOConversionDraft>;
  auditEvent: ApprovalAuditEvent;
}

export function commitPOCreateFromConversion(input: {
  draft: FullPOConversionDraft;
  procurementCaseId: string;
  createdBy?: string;
}): CreatePOResult | null {
  const { draft, procurementCaseId, createdBy } = input;

  // Readiness validation
  const readiness = computePOCreationReadiness(draft);
  if (!readiness.canCreatePO) return null;

  const now = new Date().toISOString();

  const lineItems: PurchaseOrderLineItem[] = draft.lineDrafts
    .filter(l => l.quantity && l.quantity > 0 && l.unitPrice && l.unitPrice > 0 && l.currency && l.unitOfMeasure)
    .map(l => ({
      lineId: l.lineId,
      itemId: l.itemId,
      quantity: l.quantity!,
      unitOfMeasure: l.unitOfMeasure!,
      unitPrice: l.unitPrice!,
      currency: l.currency!,
    }));

  const purchaseOrder: PurchaseOrderRecord = {
    purchaseOrderId: poRecUid(),
    procurementCaseId,
    sourcePOConversionDraftId: draft.poConversionDraftId,
    supplierId: draft.selectedSupplierId,
    lineItems,
    paymentTerms: draft.paymentTerms,
    incoterms: draft.incoterms,
    shippingTerms: draft.shippingTerms,
    deliveryLocationId: draft.deliveryLocationId,
    billingEntityId: draft.billingEntityId,
    costCenterId: draft.costCenterId,
    status: "created",
    createdAt: now,
    createdBy: createdBy ?? null,
  };

  const caseUpdate: Partial<ProcurementCase> = {
    stage: "po_created" as ProcurementStage,
    updatedAt: now,
  };

  const draftUpdate: Partial<FullPOConversionDraft> = {
    draftStatus: "ready_for_po_creation" as PODraftStatus, // promotion 전 상태
  };

  const auditEvent = createAuditEvent({
    procurementCaseId,
    type: "po_conversion_draft_created", // reuse type for PO creation
    summary: `PO 생성 완료 — ${purchaseOrder.purchaseOrderId}`,
    actorId: createdBy,
    metadata: {
      purchaseOrderId: purchaseOrder.purchaseOrderId,
      lineCount: lineItems.length,
      supplierId: draft.selectedSupplierId,
    },
  });

  return { purchaseOrder, caseUpdate, draftUpdate, auditEvent };
}

// ══════════════════════════════════════════════════════════════════════════════
// Quote-to-PO Delta
// ══════════════════════════════════════════════════════════════════════════════

export interface QuoteToPODelta {
  field: string;
  quoteValue: string | null;
  poValue: string | null;
  changeType: "added" | "changed" | "removed" | "unchanged";
}

export function computeQuoteToPODelta(
  approvalSnapshot: { approvedAt: string; approvedBy: string | null; rationale: string | null },
  draft: FullPOConversionDraft
): QuoteToPODelta[] {
  const deltas: QuoteToPODelta[] = [];

  if (draft.deliveryLocationId) {
    deltas.push({ field: "delivery_location", quoteValue: null, poValue: draft.deliveryLocationId, changeType: "added" });
  }
  if (draft.costCenterId) {
    deltas.push({ field: "cost_center", quoteValue: null, poValue: draft.costCenterId, changeType: "added" });
  }
  if (draft.billingEntityId) {
    deltas.push({ field: "billing_entity", quoteValue: null, poValue: draft.billingEntityId, changeType: "added" });
  }
  if (draft.expectedDeliveryDate) {
    deltas.push({ field: "expected_delivery_date", quoteValue: null, poValue: draft.expectedDeliveryDate, changeType: "added" });
  }
  if (draft.paymentTerms) {
    deltas.push({ field: "payment_terms", quoteValue: null, poValue: draft.paymentTerms, changeType: "added" });
  }
  if (draft.incoterms) {
    deltas.push({ field: "incoterms", quoteValue: null, poValue: draft.incoterms, changeType: "added" });
  }
  if (draft.internalMemo) {
    deltas.push({ field: "internal_memo", quoteValue: null, poValue: "added", changeType: "added" });
  }
  if (draft.buyerNote) {
    deltas.push({ field: "buyer_note", quoteValue: null, poValue: "added", changeType: "added" });
  }

  return deltas;
}

// ══════════════════════════════════════════════════════════════════════════════
// PO Conversion Audit Events
// ══════════════════════════════════════════════════════════════════════════════

export type POConversionAuditEventType =
  | "po_conversion_seeded"
  | "po_conversion_updated"
  | "po_created";

export interface POConversionAuditEvent {
  type: POConversionAuditEventType;
  at: string;
  actorId: string | null;
  poConversionDraftId: string;
  purchaseOrderId?: string;
  changedFields?: string[];
  sourceApprovalDecisionId?: string;
}

export function createPOConversionAuditEvent(input: {
  type: POConversionAuditEventType;
  actorId?: string;
  poConversionDraftId: string;
  purchaseOrderId?: string;
  changedFields?: string[];
  sourceApprovalDecisionId?: string;
}): POConversionAuditEvent {
  return {
    type: input.type,
    at: new Date().toISOString(),
    actorId: input.actorId ?? null,
    poConversionDraftId: input.poConversionDraftId,
    purchaseOrderId: input.purchaseOrderId,
    changedFields: input.changedFields,
    sourceApprovalDecisionId: input.sourceApprovalDecisionId,
  };
}
