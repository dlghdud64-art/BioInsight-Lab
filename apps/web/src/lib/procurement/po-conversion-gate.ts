/**
 * PO Conversion Gate — seed integrity + validation + idempotency + create transaction
 *
 * 고정 규칙:
 * 1. PO entry는 오직 approval status=approved인 항목만 진입.
 * 2. approved snapshot seed가 유일한 source of truth. live 재조회 금지.
 * 3. vendor/line 자유 수정 금지. 보정 가능 필드만 draftPatch로 관리.
 * 4. validate → create → single canonical draft. double submit 차단.
 * 5. approved → po_conversion_in_progress → po_draft_created 단방향.
 */

import type { FullPOConversionDraft, POConversionLineDraft, PurchaseOrderRecord } from "./po-conversion-entry";
import { commitPOCreateFromConversion, computePOCreationReadiness } from "./po-conversion-entry";
import type { POConversionHandoffPayload } from "./po-conversion-batch2";
import { createAuditEvent } from "./approval-post-decision";

// ══════════════════════════════════════════════════════════════════════════════
// Seed Integrity Check
// ══════════════════════════════════════════════════════════════════════════════

export interface SeedIntegrityResult {
  valid: boolean;
  issues: string[];
}

export function checkSeedIntegrity(
  payload: POConversionHandoffPayload | null,
  draft: FullPOConversionDraft | null
): SeedIntegrityResult {
  const issues: string[] = [];

  if (!payload) {
    issues.push("approval_snapshot_missing");
    return { valid: false, issues };
  }

  if (!payload.selectedSupplierId) issues.push("approved_vendor_missing");
  if (!payload.approvalSnapshot.approvalDraftId) issues.push("approval_draft_id_missing");
  if (!payload.approvalSnapshot.decisionRecordId) issues.push("decision_record_id_missing");
  if (!payload.procurementCaseId) issues.push("procurement_case_id_missing");
  if (!payload.sourceRequestAssemblyId) issues.push("request_assembly_id_missing");
  if (payload.lineSnapshots.length === 0) issues.push("no_approved_line_items");

  // Draft와 payload 정합성
  if (draft) {
    if (draft.selectedSupplierId !== payload.selectedSupplierId) {
      issues.push("vendor_mismatch_between_seed_and_draft");
    }
    if (draft.procurementCaseId !== payload.procurementCaseId) {
      issues.push("case_id_mismatch");
    }
  }

  return { valid: issues.length === 0, issues };
}

// ══════════════════════════════════════════════════════════════════════════════
// Validation Gate (create 전 필수 검증)
// ══════════════════════════════════════════════════════════════════════════════

export interface ValidationIssue {
  code: string;
  message: string;
  field?: string;
}

export interface PoConversionValidationResult {
  canCreate: boolean;
  blockingIssues: ValidationIssue[];
  warnings: ValidationIssue[];
}

export function validatePoConversionBeforeCreate(
  draft: FullPOConversionDraft,
  payload: POConversionHandoffPayload | null
): PoConversionValidationResult {
  const blockingIssues: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // ── Seed integrity ──
  const seedCheck = checkSeedIntegrity(payload, draft);
  if (!seedCheck.valid) {
    blockingIssues.push({
      code: "seed_integrity_failed",
      message: "승인 결과 스냅샷이 유효하지 않습니다. 다시 approval detail에서 진입하세요.",
    });
    return { canCreate: false, blockingIssues, warnings };
  }

  // ── Vendor ──
  if (!draft.selectedSupplierId) {
    blockingIssues.push({ code: "vendor_missing", message: "공급사 정보가 없습니다.", field: "selectedSupplierId" });
  }

  // ── Lines ──
  if (draft.lineDrafts.length === 0) {
    blockingIssues.push({ code: "no_lines", message: "발주 품목이 없습니다." });
  }

  for (const line of draft.lineDrafts) {
    if (!line.quantity || line.quantity <= 0) {
      blockingIssues.push({ code: "line_qty_missing", message: `${line.productName}: 수량 누락`, field: `line.${line.lineId}.quantity` });
    }
    if (!line.unitPrice || line.unitPrice <= 0) {
      blockingIssues.push({ code: "line_price_missing", message: `${line.productName}: 단가 누락`, field: `line.${line.lineId}.unitPrice` });
    }
    if (!line.currency) {
      blockingIssues.push({ code: "line_currency_missing", message: `${line.productName}: 통화 누락`, field: `line.${line.lineId}.currency` });
    }
    if (!line.unitOfMeasure) {
      warnings.push({ code: "line_uom_missing", message: `${line.productName}: 단위 미입력`, field: `line.${line.lineId}.unitOfMeasure` });
    }
  }

  // ── Routing ──
  if (!draft.costCenterId) {
    blockingIssues.push({ code: "cost_center_missing", message: "비용센터가 지정되지 않았습니다.", field: "costCenterId" });
  }
  if (!draft.deliveryLocationId) {
    blockingIssues.push({ code: "delivery_location_missing", message: "납품지가 지정되지 않았습니다.", field: "deliveryLocationId" });
  }
  if (!draft.billingEntityId) {
    blockingIssues.push({ code: "billing_entity_missing", message: "청구 법인이 지정되지 않았습니다.", field: "billingEntityId" });
  }

  // ── Commercial ──
  if (!draft.currency) {
    warnings.push({ code: "header_currency_empty", message: "헤더 통화가 설정되지 않았습니다.", field: "currency" });
  }
  if (!draft.paymentTerms) {
    warnings.push({ code: "payment_terms_empty", message: "결제 조건이 입력되지 않았습니다.", field: "paymentTerms" });
  }
  if (!draft.expectedDeliveryDate) {
    warnings.push({ code: "delivery_date_empty", message: "예상 납품일이 입력되지 않았습니다.", field: "expectedDeliveryDate" });
  }

  // ── Reference integrity ──
  if (!draft.sourceApprovalDecisionId) {
    blockingIssues.push({ code: "approval_ref_missing", message: "승인 결정 참조가 없습니다." });
  }
  if (!draft.sourceRequestAssemblyId) {
    blockingIssues.push({ code: "request_ref_missing", message: "요청 참조가 없습니다." });
  }

  return {
    canCreate: blockingIssues.length === 0,
    blockingIssues,
    warnings,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Idempotency Guard
// ══════════════════════════════════════════════════════════════════════════════

export interface IdempotencyGuardResult {
  allowed: boolean;
  reason: string | null;
}

export function checkCreateIdempotency(
  draft: FullPOConversionDraft,
  existingPOIds: string[]
): IdempotencyGuardResult {
  // Draft가 이미 created 상태
  if (draft.draftStatus === "ready_for_po_creation") {
    // 이미 PO가 존재하면 중복
    if (existingPOIds.length > 0) {
      return { allowed: false, reason: "이 승인 건에 대한 PO가 이미 생성되었습니다." };
    }
  }

  return { allowed: true, reason: null };
}

// ══════════════════════════════════════════════════════════════════════════════
// Create Transaction (single canonical draft creation)
// ══════════════════════════════════════════════════════════════════════════════

export interface CreatePOTransactionInput {
  draft: FullPOConversionDraft;
  payload: POConversionHandoffPayload;
  procurementCaseId: string;
  createdBy: string | null;
  existingPOIds: string[];
}

export interface CreatePOTransactionResult {
  success: boolean;
  purchaseOrder: PurchaseOrderRecord | null;
  validationResult: PoConversionValidationResult;
  idempotencyResult: IdempotencyGuardResult;
  auditEventSummary: string | null;
}

export function executeCreatePOTransaction(
  input: CreatePOTransactionInput
): CreatePOTransactionResult {
  const { draft, payload, procurementCaseId, createdBy, existingPOIds } = input;

  // Step 1: Validation
  const validationResult = validatePoConversionBeforeCreate(draft, payload);
  if (!validationResult.canCreate) {
    return {
      success: false,
      purchaseOrder: null,
      validationResult,
      idempotencyResult: { allowed: true, reason: null },
      auditEventSummary: null,
    };
  }

  // Step 2: Idempotency
  const idempotencyResult = checkCreateIdempotency(draft, existingPOIds);
  if (!idempotencyResult.allowed) {
    return {
      success: false,
      purchaseOrder: null,
      validationResult,
      idempotencyResult,
      auditEventSummary: null,
    };
  }

  // Step 3: Create
  const createResult = commitPOCreateFromConversion({
    draft,
    procurementCaseId,
    createdBy: createdBy ?? undefined,
  });

  if (!createResult) {
    return {
      success: false,
      purchaseOrder: null,
      validationResult,
      idempotencyResult,
      auditEventSummary: "PO 생성 실패 — readiness 미달",
    };
  }

  return {
    success: true,
    purchaseOrder: createResult.purchaseOrder,
    validationResult,
    idempotencyResult,
    auditEventSummary: `PO 생성 완료 — ${createResult.purchaseOrder.purchaseOrderId}`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Post-Create Handoff
// ══════════════════════════════════════════════════════════════════════════════

export interface PostCreateHandoff {
  purchaseOrderId: string;
  procurementCaseId: string;
  vendorName: string;
  totalLineCount: number;
  grandTotal: number | null;
  createdFromApprovalDecisionId: string;
  nextDestination: string;
  nextActionLabel: string;
}

export function buildPostCreateHandoff(
  po: PurchaseOrderRecord,
  payload: POConversionHandoffPayload
): PostCreateHandoff {
  const grandTotal = po.lineItems.reduce((sum, l) => sum + (l.unitPrice * l.quantity), 0);

  return {
    purchaseOrderId: po.purchaseOrderId,
    procurementCaseId: po.procurementCaseId,
    vendorName: payload.selectedSupplierName,
    totalLineCount: po.lineItems.length,
    grandTotal: grandTotal > 0 ? grandTotal : null,
    createdFromApprovalDecisionId: payload.approvalSnapshot.decisionRecordId,
    nextDestination: `/app/purchase-orders?po=${po.purchaseOrderId}`,
    nextActionLabel: "발주 상세 확인",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Status Transition (단방향만 허용)
// ══════════════════════════════════════════════════════════════════════════════

export type POConversionStage =
  | "approved"
  | "po_conversion_in_progress"
  | "po_draft_created";

export const PO_CONVERSION_STAGE_ORDER: POConversionStage[] = [
  "approved",
  "po_conversion_in_progress",
  "po_draft_created",
];

export function isForwardTransition(from: POConversionStage, to: POConversionStage): boolean {
  const fromIndex = PO_CONVERSION_STAGE_ORDER.indexOf(from);
  const toIndex = PO_CONVERSION_STAGE_ORDER.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return false;
  return toIndex > fromIndex;
}

// ══════════════════════════════════════════════════════════════════════════════
// Error States
// ══════════════════════════════════════════════════════════════════════════════

export interface POConversionEntryError {
  type: "seed_missing" | "seed_integrity_failed" | "approval_not_approved" | "duplicate_po";
  title: string;
  message: string;
  actionLabel: string;
  actionRoute: string;
}

export function buildEntryErrorState(
  errorType: POConversionEntryError["type"],
  procurementCaseId: string
): POConversionEntryError {
  switch (errorType) {
    case "seed_missing":
      return {
        type: "seed_missing",
        title: "승인 결과를 불러올 수 없습니다",
        message: "승인 결과 스냅샷을 불러오지 못했습니다. 다시 approval detail에서 진입하세요.",
        actionLabel: "승인 상세로 이동",
        actionRoute: `/app/approvals?case=${procurementCaseId}`,
      };
    case "seed_integrity_failed":
      return {
        type: "seed_integrity_failed",
        title: "승인 결과 검증 실패",
        message: "승인 결과와 현재 데이터 사이에 불일치가 있습니다. approval detail에서 다시 확인하세요.",
        actionLabel: "승인 상세로 이동",
        actionRoute: `/app/approvals?case=${procurementCaseId}`,
      };
    case "approval_not_approved":
      return {
        type: "approval_not_approved",
        title: "승인되지 않은 항목입니다",
        message: "이 항목은 아직 승인이 완료되지 않았습니다. 승인 완료 후 다시 진입하세요.",
        actionLabel: "승인 큐로 이동",
        actionRoute: `/app/approvals`,
      };
    case "duplicate_po":
      return {
        type: "duplicate_po",
        title: "이미 PO가 생성된 항목입니다",
        message: "이 승인 건에 대한 발주가 이미 생성되었습니다.",
        actionLabel: "발주 목록 보기",
        actionRoute: `/app/purchase-orders?case=${procurementCaseId}`,
      };
  }
}
