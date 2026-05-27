/**
 * Dispatch Preparation Workbench v2 Engine — canonical preparation state model
 *
 * 고정 규칙:
 * 1. DispatchPreparationCaseV2 + DispatchPreparationHandoffPackageV2 = 단일 입력 source.
 * 2. handoff seed ≠ operator review state. workbench는 decision layer만 추가.
 * 3. center / rail / dock 정보 분리 — 같은 정보를 세 surface에 중복 넣지 않음.
 * 4. blocker / warning / correction route / action gate 명확 분리.
 * 5. internal-only contamination exclusion과 reference visibility는 독립 검토 축.
 * 6. Batch 1: draft/send execution 전부 금지.
 * 7. "준비 검토 완료"와 "실제 발송 가능"은 다른 상태.
 * 8. operator focus ordering 필수.
 */

import type {
  DispatchPreparationHandoffPackageV2,
  DispatchPreparationCaseV2,
  DispatchPrepPrecheckFlag,
  DispatchPrepExceptionFlag,
  InternalOnlyExcludedFlag,
} from "./dispatch-preparation-handoff-gate-v2-engine";
import type { PoDraftLineItem } from "./po-conversion-entry-v2-draft-engine";
import type { LaneProvenance } from "./sourcing-result-workbench-v2-triage-engine";
import type { ScopeRationale } from "./approval-workbench-review-engine";

// ══════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════

// ── Workbench Status ──
export type DispatchPrepWorkbenchStatus =
  | "intake_blocked"
  | "preparation_required"
  | "correction_required"
  | "ready_for_preparation_review"
  | "preparation_in_progress"
  | "preparation_hold"
  | "preparation_complete_pending_next_gate";

// ── Workbench Mode ──
export type DispatchPrepWorkbenchMode = "review" | "correction" | "hold" | "completed";

// ── Dispatch Readiness Class ──
export type DispatchReadinessClass = "blocked" | "warning" | "ready" | "complete_pending";

// ── Section Key ──
export type DispatchPrepSectionKey =
  | "scope_review"
  | "vendor_contact_review"
  | "reference_visibility_review"
  | "shipment_instruction_review"
  | "internal_exclusion_review"
  | "prep_intake_review";

// ── Section Status ──
export type DispatchPrepSectionStatus = "ready" | "warning" | "blocked" | "attention_required";

// ── Section State ──
export interface DispatchPreparationWorkbenchSectionStateV2 {
  sectionKey: DispatchPrepSectionKey;
  status: DispatchPrepSectionStatus;
  blockers: string[];
  warnings: string[];
  operatorFocusReason: string;
  correctionRouteIfAny: string | null;
  canResolveInPlace: boolean;
  requiresReturnToPriorStage: boolean;
}

// ── Correction Route ──
export type CorrectionRouteKey = "created_review_return" | "vendor_contact_correction" | "internal_separation_correction" | "reference_correction";

export interface WorkbenchCorrectionRoute {
  routeKey: CorrectionRouteKey;
  routeLabel: string;
  routeReason: string;
  blockingLevel: "blocker" | "warning";
  recommendedOwner: string;
  canResolveInCurrentWorkbench: boolean;
  requiresPriorStageReturn: boolean;
}

// ── Action Gate ──
export interface DispatchPreparationWorkbenchActionGateV2 {
  canContinuePreparation: boolean;
  canRequestCorrection: boolean;
  canReturnToCreatedReview: boolean;
  canResolveReferenceGap: boolean;
  canResolveVendorContactGap: boolean;
  canResolveInternalSeparationGap: boolean;
  // Batch 1 — explicitly forbidden
  canGenerateDispatchDraft: false;
  canSendToSupplier: false;
  canMarkDispatched: false;
}

// ── Center Payload ──
export interface CenterWorkWindowPayload {
  decisionHeader: {
    caseId: string;
    handoffPackageId: string;
    workbenchStatus: DispatchPrepWorkbenchStatus;
    dispatchReadinessClass: DispatchReadinessClass;
    nextRequiredAction: string;
  };
  blockerSummary: string[];
  warningSummary: string[];
  sectionStates: DispatchPreparationWorkbenchSectionStateV2[];
  correctionRoutes: WorkbenchCorrectionRoute[];
  operatorFocusOrder: DispatchPrepSectionKey[];
}

// ── Rail Payload ──
export interface RightRailPreviewPayload {
  vendorFacingSeedPreview: {
    vendorId: string;
    vendorContactVisible: boolean;
    supplierFacingNoteSeed: string;
  };
  visibleReferenceSummary: {
    quoteVisible: boolean;
    poVisible: boolean;
    attachmentSeedVisible: boolean;
  };
  visibleInstructionSummary: {
    shipToVisible: boolean;
    billToVisible: boolean;
    receivingInstructionVisible: boolean;
  };
  excludedInternalOnlyFields: InternalOnlyExcludedFlag[];
  provenanceSnapshot: LaneProvenance[];
}

// ── Dock Payload ──
export interface StickyDockPayload {
  allowedActions: string[];
  blockedActions: string[];
  whyBlocked: string[];
  nextRequiredRoute: string | null;
  actionGate: DispatchPreparationWorkbenchActionGateV2;
}

// ── Top-Level Workbench State ──
export interface DispatchPreparationWorkbenchStateV2 {
  caseId: string;
  handoffPackageId: string;
  poRecordId: string;
  workbenchStatus: DispatchPrepWorkbenchStatus;
  workbenchMode: DispatchPrepWorkbenchMode;
  dispatchReadinessClass: DispatchReadinessClass;
  blockingSummary: string[];
  warningSummary: string[];
  correctionSummary: WorkbenchCorrectionRoute[];
  vendorSeedSummary: string;
  referenceVisibilitySummary: string;
  instructionVisibilitySummary: string;
  internalExclusionSummary: string;
  sectionStates: DispatchPreparationWorkbenchSectionStateV2[];
  actionGate: DispatchPreparationWorkbenchActionGateV2;
  operatorFocusOrder: DispatchPrepSectionKey[];
  centerPayload: CenterWorkWindowPayload;
  railPayload: RightRailPreviewPayload;
  dockPayload: StickyDockPayload;
  provenance: LaneProvenance[];
  generatedAt: string;
}

// ══════════════════════════════════════════════
// Section Derivation
// ══════════════════════════════════════════════

function deriveScopeReviewSection(pkg: DispatchPreparationHandoffPackageV2): DispatchPreparationWorkbenchSectionStateV2 {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!pkg.dispatchEligibleScope) blockers.push("Dispatch eligible scope 비어 있음");
  if (pkg.createdLineItems.length === 0) blockers.push("Created line items 비어 있음");
  if (!pkg.createdAmountSummary) warnings.push("Amount summary 누락");

  return {
    sectionKey: "scope_review",
    status: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready",
    blockers,
    warnings,
    operatorFocusReason: blockers.length > 0 ? "발송 대상 scope 확인 필요" : "발송 scope 검토 가능",
    correctionRouteIfAny: blockers.length > 0 ? "created_review_return" : null,
    canResolveInPlace: false,
    requiresReturnToPriorStage: blockers.length > 0,
  };
}

function deriveVendorContactSection(pkg: DispatchPreparationHandoffPackageV2): DispatchPreparationWorkbenchSectionStateV2 {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!pkg.createdVendorId) blockers.push("Vendor ID 누락");
  if (!pkg.vendorContactReferenceVisible) blockers.push("Vendor contact reference 비활성");

  return {
    sectionKey: "vendor_contact_review",
    status: blockers.length > 0 ? "blocked" : "ready",
    blockers,
    warnings,
    operatorFocusReason: blockers.length > 0 ? "Vendor contact 확인 필요" : "Vendor contact 준비됨",
    correctionRouteIfAny: blockers.length > 0 ? "vendor_contact_correction" : null,
    canResolveInPlace: false,
    requiresReturnToPriorStage: blockers.length > 0,
  };
}

function deriveReferenceVisibilitySection(pkg: DispatchPreparationHandoffPackageV2): DispatchPreparationWorkbenchSectionStateV2 {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!pkg.quoteReferenceVisible && !pkg.poReferenceVisible && !pkg.attachmentSeedVisible) {
    warnings.push("Reference visibility가 모두 비활성 — dispatch context 약함");
  }
  if (pkg.exceptionFlags.includes("stale_quote_reference")) warnings.push("Quote reference stale 가능성");

  return {
    sectionKey: "reference_visibility_review",
    status: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready",
    blockers,
    warnings,
    operatorFocusReason: warnings.length > 0 ? "Reference visibility 확인 필요" : "Reference visibility 준비됨",
    correctionRouteIfAny: warnings.length > 0 ? "reference_correction" : null,
    canResolveInPlace: true,
    requiresReturnToPriorStage: false,
  };
}

function deriveShipmentInstructionSection(pkg: DispatchPreparationHandoffPackageV2): DispatchPreparationWorkbenchSectionStateV2 {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!pkg.shipToVisible) blockers.push("Ship-to visibility 비활성");
  if (!pkg.receivingInstructionVisible) warnings.push("Receiving instruction visibility 비활성");
  if (!pkg.billToVisible) warnings.push("Bill-to visibility 비활성");

  return {
    sectionKey: "shipment_instruction_review",
    status: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready",
    blockers,
    warnings,
    operatorFocusReason: blockers.length > 0 ? "Ship-to/receiving 확인 필요" : "Shipment instruction 검토 가능",
    correctionRouteIfAny: blockers.length > 0 ? "created_review_return" : null,
    canResolveInPlace: false,
    requiresReturnToPriorStage: blockers.length > 0,
  };
}

function deriveInternalExclusionSection(pkg: DispatchPreparationHandoffPackageV2): DispatchPreparationWorkbenchSectionStateV2 {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (pkg.internalOnlyExcludedFlags.length === 0 && pkg.supplierFacingNoteSeed) {
    warnings.push("Internal-only exclusion flag 없이 supplier-facing note seed 존재 — contamination 확인 필요");
  }

  // Check if supplier-facing seed might contain internal-only content
  const internalKeywords = ["budget", "governance", "internal", "approval"];
  const seedLower = (pkg.supplierFacingNoteSeed || "").toLowerCase();
  const suspectedContamination = internalKeywords.some(kw => seedLower.includes(kw));
  if (suspectedContamination) {
    blockers.push("Supplier-facing note seed에 internal-only 키워드 감지 — contamination 위험");
  }

  return {
    sectionKey: "internal_exclusion_review",
    status: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "attention_required" : "ready",
    blockers,
    warnings,
    operatorFocusReason: blockers.length > 0 ? "Internal-only 분리 확인 필수" : "Internal exclusion 확인 가능",
    correctionRouteIfAny: blockers.length > 0 ? "internal_separation_correction" : null,
    canResolveInPlace: true,
    requiresReturnToPriorStage: false,
  };
}

function derivePrepIntakeSection(pkg: DispatchPreparationHandoffPackageV2, caseV2: DispatchPreparationCaseV2): DispatchPreparationWorkbenchSectionStateV2 {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (caseV2.status !== "opened" && caseV2.status !== "hydrating" && caseV2.status !== "ready_for_dispatch_preparation") {
    blockers.push(`Case 상태가 preparation 가능한 상태가 아님: ${caseV2.status}`);
  }

  if (pkg.exceptionFlags.includes("equivalent_heavy_dispatch")) {
    warnings.push("Equivalent 비중 높은 dispatch — supplier-facing clarification 필요");
  }
  if (pkg.exceptionFlags.includes("vendor_facing_note_insufficient")) {
    warnings.push("Vendor-facing note 보강 필요");
  }

  return {
    sectionKey: "prep_intake_review",
    status: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready",
    blockers,
    warnings,
    operatorFocusReason: blockers.length > 0 ? "Preparation intake 조건 미충족" : "Preparation 검토 가능",
    correctionRouteIfAny: null,
    canResolveInPlace: blockers.length === 0,
    requiresReturnToPriorStage: blockers.length > 0,
  };
}

// ══════════════════════════════════════════════
// Blocker / Warning Aggregation
// ══════════════════════════════════════════════

function aggregateBlockersAndWarnings(sections: DispatchPreparationWorkbenchSectionStateV2[]): { blockers: string[]; warnings: string[] } {
  const blockers: string[] = [];
  const warnings: string[] = [];
  for (const s of sections) {
    blockers.push(...s.blockers);
    warnings.push(...s.warnings);
  }
  return { blockers, warnings };
}

// ══════════════════════════════════════════════
// Correction Route Derivation
// ══════════════════════════════════════════════

function deriveCorrectionRoutes(sections: DispatchPreparationWorkbenchSectionStateV2[]): WorkbenchCorrectionRoute[] {
  const routes: WorkbenchCorrectionRoute[] = [];
  const seen = new Set<string>();

  for (const s of sections) {
    if (s.correctionRouteIfAny && !seen.has(s.correctionRouteIfAny)) {
      seen.add(s.correctionRouteIfAny);
      const key = s.correctionRouteIfAny as CorrectionRouteKey;

      routes.push({
        routeKey: key,
        routeLabel: correctionRouteLabels[key] || key,
        routeReason: s.blockers[0] || s.warnings[0] || "확인 필요",
        blockingLevel: s.status === "blocked" ? "blocker" : "warning",
        recommendedOwner: "operator",
        canResolveInCurrentWorkbench: s.canResolveInPlace,
        requiresPriorStageReturn: s.requiresReturnToPriorStage,
      });
    }
  }

  return routes;
}

const correctionRouteLabels: Record<CorrectionRouteKey, string> = {
  created_review_return: "Created Review로 복귀",
  vendor_contact_correction: "Vendor Contact 보정",
  internal_separation_correction: "Internal-Only 분리 보정",
  reference_correction: "Reference Visibility 보정",
};

// ══════════════════════════════════════════════
// Action Gate Derivation
// ══════════════════════════════════════════════

function deriveActionGate(sections: DispatchPreparationWorkbenchSectionStateV2[], blockers: string[]): DispatchPreparationWorkbenchActionGateV2 {
  const hasBlocker = blockers.length > 0;
  const hasCorrection = sections.some(s => s.correctionRouteIfAny !== null);

  return {
    canContinuePreparation: !hasBlocker,
    canRequestCorrection: hasCorrection,
    canReturnToCreatedReview: true,
    canResolveReferenceGap: sections.some(s => s.sectionKey === "reference_visibility_review" && s.canResolveInPlace),
    canResolveVendorContactGap: false, // vendor contact는 current workbench에서 resolve 불가
    canResolveInternalSeparationGap: sections.some(s => s.sectionKey === "internal_exclusion_review" && s.canResolveInPlace),
    // Batch 1 — explicitly forbidden
    canGenerateDispatchDraft: false as const,
    canSendToSupplier: false as const,
    canMarkDispatched: false as const,
  };
}

// ══════════════════════════════════════════════
// Operator Focus Ordering
// ══════════════════════════════════════════════

const FOCUS_PRIORITY: DispatchPrepSectionKey[] = [
  "vendor_contact_review",
  "internal_exclusion_review",
  "reference_visibility_review",
  "shipment_instruction_review",
  "prep_intake_review",
  "scope_review",
];

function deriveOperatorFocusOrder(sections: DispatchPreparationWorkbenchSectionStateV2[]): DispatchPrepSectionKey[] {
  const blockedFirst = FOCUS_PRIORITY.filter(key => {
    const s = sections.find(sec => sec.sectionKey === key);
    return s && (s.status === "blocked" || s.status === "attention_required");
  });
  const warningNext = FOCUS_PRIORITY.filter(key => {
    const s = sections.find(sec => sec.sectionKey === key);
    return s && s.status === "warning" && !blockedFirst.includes(key);
  });
  const readyLast = FOCUS_PRIORITY.filter(key => !blockedFirst.includes(key) && !warningNext.includes(key));

  return [...blockedFirst, ...warningNext, ...readyLast];
}

// ══════════════════════════════════════════════
// Workbench Status Derivation
// ══════════════════════════════════════════════

function deriveWorkbenchStatus(sections: DispatchPreparationWorkbenchSectionStateV2[], caseStatus: string): DispatchPrepWorkbenchStatus {
  const hasBlocker = sections.some(s => s.status === "blocked");
  const hasAttention = sections.some(s => s.status === "attention_required");
  const hasWarning = sections.some(s => s.status === "warning");
  const allReady = sections.every(s => s.status === "ready");
  const hasCorrection = sections.some(s => s.correctionRouteIfAny !== null && (s.status === "blocked" || s.status === "attention_required"));

  if (caseStatus === "on_hold") return "preparation_hold";
  if (hasBlocker && sections.some(s => s.sectionKey === "prep_intake_review" && s.status === "blocked")) return "intake_blocked";
  if (hasCorrection) return "correction_required";
  if (hasBlocker || hasAttention) return "preparation_required";
  if (hasWarning) return "ready_for_preparation_review";
  if (allReady) return "preparation_complete_pending_next_gate";
  return "preparation_in_progress";
}

function deriveWorkbenchMode(status: DispatchPrepWorkbenchStatus): DispatchPrepWorkbenchMode {
  switch (status) {
    case "intake_blocked":
    case "preparation_required":
    case "ready_for_preparation_review":
    case "preparation_in_progress":
      return "review";
    case "correction_required":
      return "correction";
    case "preparation_hold":
      return "hold";
    case "preparation_complete_pending_next_gate":
      return "completed";
  }
}

function deriveReadinessClass(status: DispatchPrepWorkbenchStatus): DispatchReadinessClass {
  switch (status) {
    case "intake_blocked":
    case "preparation_required":
    case "correction_required":
      return "blocked";
    case "ready_for_preparation_review":
    case "preparation_in_progress":
      return "warning";
    case "preparation_hold":
      return "blocked";
    case "preparation_complete_pending_next_gate":
      return "complete_pending";
  }
}

// ══════════════════════════════════════════════
// Surface Payload Builders
// ══════════════════════════════════════════════

function buildCenterPayload(
  caseId: string,
  handoffId: string,
  workbenchStatus: DispatchPrepWorkbenchStatus,
  readinessClass: DispatchReadinessClass,
  blockers: string[],
  warnings: string[],
  sections: DispatchPreparationWorkbenchSectionStateV2[],
  corrections: WorkbenchCorrectionRoute[],
  focusOrder: DispatchPrepSectionKey[],
): CenterWorkWindowPayload {
  const nextAction = blockers.length > 0 ? blockers[0] : warnings.length > 0 ? warnings[0] : "모든 섹션 검토 가능";
  return {
    decisionHeader: { caseId, handoffPackageId: handoffId, workbenchStatus, dispatchReadinessClass: readinessClass, nextRequiredAction: nextAction },
    blockerSummary: blockers,
    warningSummary: warnings,
    sectionStates: sections,
    correctionRoutes: corrections,
    operatorFocusOrder: focusOrder,
  };
}

function buildRailPayload(pkg: DispatchPreparationHandoffPackageV2): RightRailPreviewPayload {
  return {
    vendorFacingSeedPreview: {
      vendorId: pkg.createdVendorId,
      vendorContactVisible: pkg.vendorContactReferenceVisible,
      supplierFacingNoteSeed: pkg.supplierFacingNoteSeed,
    },
    visibleReferenceSummary: {
      quoteVisible: pkg.quoteReferenceVisible,
      poVisible: pkg.poReferenceVisible,
      attachmentSeedVisible: pkg.attachmentSeedVisible,
    },
    visibleInstructionSummary: {
      shipToVisible: pkg.shipToVisible,
      billToVisible: pkg.billToVisible,
      receivingInstructionVisible: pkg.receivingInstructionVisible,
    },
    excludedInternalOnlyFields: pkg.internalOnlyExcludedFlags,
    provenanceSnapshot: pkg.provenanceByLine,
  };
}

function buildDockPayload(actionGate: DispatchPreparationWorkbenchActionGateV2, blockers: string[], corrections: WorkbenchCorrectionRoute[]): StickyDockPayload {
  const allowed: string[] = [];
  const blocked: string[] = [];

  if (actionGate.canContinuePreparation) allowed.push("preparation_continue");
  else blocked.push("preparation_continue");
  if (actionGate.canRequestCorrection) allowed.push("request_correction");
  if (actionGate.canReturnToCreatedReview) allowed.push("return_to_created_review");
  if (actionGate.canResolveReferenceGap) allowed.push("resolve_reference_gap");
  if (actionGate.canResolveInternalSeparationGap) allowed.push("resolve_internal_separation");

  blocked.push("generate_dispatch_draft", "send_to_supplier", "mark_dispatched");

  const nextRoute = corrections.length > 0 ? corrections[0].routeKey : null;

  return { allowedActions: allowed, blockedActions: blocked, whyBlocked: blockers, nextRequiredRoute: nextRoute, actionGate };
}

// ══════════════════════════════════════════════
// Main Builder
// ══════════════════════════════════════════════

export function buildDispatchPreparationWorkbenchStateV2(
  caseV2: DispatchPreparationCaseV2,
  pkg: DispatchPreparationHandoffPackageV2,
): DispatchPreparationWorkbenchStateV2 {
  // 1. Section derivation
  const sections: DispatchPreparationWorkbenchSectionStateV2[] = [
    deriveScopeReviewSection(pkg),
    deriveVendorContactSection(pkg),
    deriveReferenceVisibilitySection(pkg),
    deriveShipmentInstructionSection(pkg),
    deriveInternalExclusionSection(pkg),
    derivePrepIntakeSection(pkg, caseV2),
  ];

  // 2. Blocker/warning aggregation
  const { blockers, warnings } = aggregateBlockersAndWarnings(sections);

  // 3. Correction routes
  const corrections = deriveCorrectionRoutes(sections);

  // 4. Action gate
  const actionGate = deriveActionGate(sections, blockers);

  // 5. Focus ordering
  const focusOrder = deriveOperatorFocusOrder(sections);

  // 6. Status derivation
  const workbenchStatus = deriveWorkbenchStatus(sections, caseV2.status);
  const workbenchMode = deriveWorkbenchMode(workbenchStatus);
  const readinessClass = deriveReadinessClass(workbenchStatus);

  // 7. Surface payloads
  const centerPayload = buildCenterPayload(caseV2.id, pkg.id, workbenchStatus, readinessClass, blockers, warnings, sections, corrections, focusOrder);
  const railPayload = buildRailPayload(pkg);
  const dockPayload = buildDockPayload(actionGate, blockers, corrections);

  // 8. Summary strings
  const vendorSeedSummary = `Vendor: ${pkg.createdVendorId}, contact: ${pkg.vendorContactReferenceVisible ? "visible" : "hidden"}`;
  const referenceVisibilitySummary = `quote:${pkg.quoteReferenceVisible}, PO:${pkg.poReferenceVisible}, attachment:${pkg.attachmentSeedVisible}`;
  const instructionVisibilitySummary = `ship-to:${pkg.shipToVisible}, bill-to:${pkg.billToVisible}, receiving:${pkg.receivingInstructionVisible}`;
  const internalExclusionSummary = pkg.internalOnlyExcludedFlags.length > 0
    ? `${pkg.internalOnlyExcludedFlags.length}건 internal-only 제외됨`
    : "Internal-only exclusion 없음";

  return {
    caseId: caseV2.id,
    handoffPackageId: pkg.id,
    poRecordId: pkg.poRecordId,
    workbenchStatus,
    workbenchMode,
    dispatchReadinessClass: readinessClass,
    blockingSummary: blockers,
    warningSummary: warnings,
    correctionSummary: corrections,
    vendorSeedSummary,
    referenceVisibilitySummary,
    instructionVisibilitySummary,
    internalExclusionSummary,
    sectionStates: sections,
    actionGate,
    operatorFocusOrder: focusOrder,
    centerPayload,
    railPayload,
    dockPayload,
    provenance: pkg.provenanceByLine,
    generatedAt: new Date().toISOString(),
  };
}
