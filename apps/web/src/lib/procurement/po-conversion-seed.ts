/**
 * PO Conversion Seed — 정규화된 approval snapshot seed 구조
 *
 * 원칙:
 * 1. entry 화면은 이 seed를 읽기 전용 기준 데이터로 사용.
 * 2. 수정값은 별도 draftPatch로 관리.
 * 3. 화면 총액은 seed + patch 계산 결과만 노출.
 * 4. live quote 재조회 결과로 seed를 덮어쓰지 않음.
 */

// ══════════════════════════════════════════════════════════════════════════════
// Canonical Seed Structure
// ══════════════════════════════════════════════════════════════════════════════

export interface PoConversionSeedVendor {
  vendorId: string;
  vendorName: string;
  paymentTerm?: string | null;
  currency: string;
}

export interface PoConversionSeedRequester {
  requesterId: string;
  requesterName: string;
  department?: string | null;
}

export interface PoConversionSeedBudget {
  costCenterId?: string | null;
  costCenterName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
}

export interface PoConversionSeedLine {
  quoteLineId: string;
  itemId?: string | null;
  itemName: string;
  catalogNo?: string | null;
  specification?: string | null;
  qtyApproved: number;
  unitPriceApproved: number;
  lineTotalApproved: number;
  leadTimeDays?: number | null;
  supplierNote?: string | null;
}

export interface PoConversionSeedCommercial {
  shippingCost?: number | null;
  taxAmount?: number | null;
  discountAmount?: number | null;
  currency: string;
  subtotal: number;
  grandTotal: number;
}

export interface PoConversionSeedRationale {
  approvalReasonSummary?: string | null;
  selectedVendorReason?: string | null;
  riskNote?: string | null;
}

export interface PoConversionSeed {
  // ── Linkage IDs ──
  requestId: string;
  requestSubmissionId: string;
  quoteSetId: string;
  approvalDecisionId: string;
  approvalSnapshotId: string;
  procurementCaseId: string;

  // ── Structured data ──
  vendor: PoConversionSeedVendor;
  requester: PoConversionSeedRequester;
  budget: PoConversionSeedBudget;
  lines: PoConversionSeedLine[];
  commercial: PoConversionSeedCommercial;
  rationale: PoConversionSeedRationale;

  // ── Metadata ──
  createdAt: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Seed Builder
// ══════════════════════════════════════════════════════════════════════════════

export interface BuildPoConversionSeedInput {
  procurementCaseId: string;
  requestId: string;
  requestSubmissionId: string;
  quoteSetId: string;
  approvalDecisionId: string;
  approvalSnapshotId: string;

  vendorId: string;
  vendorName: string;
  vendorPaymentTerm?: string | null;
  currency: string;

  requesterId: string;
  requesterName: string;
  requesterDepartment?: string | null;

  costCenterId?: string | null;
  costCenterName?: string | null;
  projectId?: string | null;
  projectName?: string | null;

  lines: Array<{
    quoteLineId: string;
    itemId?: string | null;
    itemName: string;
    catalogNo?: string | null;
    specification?: string | null;
    qtyApproved: number;
    unitPriceApproved: number;
    leadTimeDays?: number | null;
    supplierNote?: string | null;
  }>;

  shippingCost?: number | null;
  taxAmount?: number | null;
  discountAmount?: number | null;

  approvalReasonSummary?: string | null;
  selectedVendorReason?: string | null;
  riskNote?: string | null;
}

export function buildPoConversionSeedFromApprovalSnapshot(
  input: BuildPoConversionSeedInput
): PoConversionSeed {
  const lines: PoConversionSeedLine[] = input.lines.map(l => ({
    ...l,
    lineTotalApproved: l.qtyApproved * l.unitPriceApproved,
  }));

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotalApproved, 0);
  const shipping = input.shippingCost ?? 0;
  const tax = input.taxAmount ?? 0;
  const discount = input.discountAmount ?? 0;
  const grandTotal = subtotal + shipping + tax - discount;

  return {
    requestId: input.requestId,
    requestSubmissionId: input.requestSubmissionId,
    quoteSetId: input.quoteSetId,
    approvalDecisionId: input.approvalDecisionId,
    approvalSnapshotId: input.approvalSnapshotId,
    procurementCaseId: input.procurementCaseId,

    vendor: {
      vendorId: input.vendorId,
      vendorName: input.vendorName,
      paymentTerm: input.vendorPaymentTerm,
      currency: input.currency,
    },

    requester: {
      requesterId: input.requesterId,
      requesterName: input.requesterName,
      department: input.requesterDepartment,
    },

    budget: {
      costCenterId: input.costCenterId,
      costCenterName: input.costCenterName,
      projectId: input.projectId,
      projectName: input.projectName,
    },

    lines,

    commercial: {
      shippingCost: input.shippingCost,
      taxAmount: input.taxAmount,
      discountAmount: input.discountAmount,
      currency: input.currency,
      subtotal,
      grandTotal,
    },

    rationale: {
      approvalReasonSummary: input.approvalReasonSummary,
      selectedVendorReason: input.selectedVendorReason,
      riskNote: input.riskNote,
    },

    createdAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Draft Patch (seed 위에 operator가 보정한 값만 관리)
// ══════════════════════════════════════════════════════════════════════════════

export interface PoConversionDraftPatch {
  paymentTerm?: string | null;
  costCenterId?: string | null;
  costCenterName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  shippingCost?: number | null;
  taxAmount?: number | null;
  discountAmount?: number | null;
  expectedDeliveryDate?: string | null;
  internalNote?: string | null;
  supplierMemo?: string | null;
  receivingInstruction?: string | null;
  billingReference?: string | null;
  deliveryLocationId?: string | null;
}

export function createEmptyDraftPatch(): PoConversionDraftPatch {
  return {};
}

// ══════════════════════════════════════════════════════════════════════════════
// Computed Totals (seed + patch 기반)
// ══════════════════════════════════════════════════════════════════════════════

export interface PoConversionComputedTotals {
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
  currency: string;
}

export function computeTotalsFromSeedAndPatch(
  seed: PoConversionSeed,
  patch: PoConversionDraftPatch
): PoConversionComputedTotals {
  const subtotal = seed.commercial.subtotal;
  const shipping = patch.shippingCost ?? seed.commercial.shippingCost ?? 0;
  const tax = patch.taxAmount ?? seed.commercial.taxAmount ?? 0;
  const discount = patch.discountAmount ?? seed.commercial.discountAmount ?? 0;
  const grandTotal = subtotal + shipping + tax - discount;

  return {
    subtotal,
    shippingCost: shipping,
    taxAmount: tax,
    discountAmount: discount,
    grandTotal,
    currency: seed.commercial.currency,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Seed Integrity Check
// ══════════════════════════════════════════════════════════════════════════════

export interface SeedIntegrityCheckResult {
  valid: boolean;
  issues: string[];
}

export function checkPoConversionSeedIntegrity(
  seed: PoConversionSeed | null
): SeedIntegrityCheckResult {
  if (!seed) return { valid: false, issues: ["seed_null"] };

  const issues: string[] = [];
  if (!seed.requestId) issues.push("request_id_missing");
  if (!seed.approvalDecisionId) issues.push("approval_decision_id_missing");
  if (!seed.approvalSnapshotId) issues.push("approval_snapshot_id_missing");
  if (!seed.vendor.vendorId) issues.push("vendor_id_missing");
  if (!seed.vendor.vendorName) issues.push("vendor_name_missing");
  if (!seed.vendor.currency) issues.push("currency_missing");
  if (seed.lines.length === 0) issues.push("no_lines");
  if (!seed.requester.requesterId) issues.push("requester_id_missing");

  for (const line of seed.lines) {
    if (!line.qtyApproved || line.qtyApproved <= 0) issues.push(`line_${line.quoteLineId}_qty_invalid`);
    if (!line.unitPriceApproved || line.unitPriceApproved <= 0) issues.push(`line_${line.quoteLineId}_price_invalid`);
  }

  return { valid: issues.length === 0, issues };
}
