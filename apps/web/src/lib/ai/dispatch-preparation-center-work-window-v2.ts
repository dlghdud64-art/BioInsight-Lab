/**
 * Dispatch Preparation Center Work Window v2 — canonical center decision surface contract
 *
 * 고정 규칙:
 * 1. truth of readiness = DispatchPreparationWorkbenchStateV2
 * 2. truth of source payload = DispatchPreparationHandoffPackageV2
 * 3. center = decision-oriented projection, rail = preview projection, dock = action gate projection
 * 4. local UI state (selection/expand/tab) ≠ canonical business truth
 * 5. header / blocker panel / decision section / active section / dock / rail은 각각 다른 역할
 * 6. operator focus order가 active section 기본 선택에 반영
 * 7. "준비 검토 완료" ≠ "실제 발송 가능" — completion과 send readiness 분리
 * 8. Batch 1: draft/send/dispatched 전부 잠금
 */

import type {
  DispatchPreparationWorkbenchStateV2,
  DispatchPreparationWorkbenchSectionStateV2,
  DispatchPreparationWorkbenchActionGateV2,
  DispatchPrepWorkbenchStatus,
  DispatchPrepSectionKey,
  DispatchReadinessClass,
  WorkbenchCorrectionRoute,
  CorrectionRouteKey,
  RightRailPreviewPayload,
} from "./dispatch-preparation-workbench-v2-engine";

// ══════════════════════════════════════════════
// View / Phase Types
// ══════════════════════════════════════════════

export type CenterViewMode = "readiness_review" | "correction_routing" | "section_resolution" | "completion_pending_next_gate";

export type DecisionPhase = "blocked" | "review_required" | "correction_required" | "ready_for_review" | "review_in_progress" | "review_complete_pending_next_gate";

// ══════════════════════════════════════════════
// Decision Header
// ══════════════════════════════════════════════

export interface DispatchPreparationDecisionHeaderV2 {
  title: string;
  statusChip: string;
  primaryReadinessLabel: string;
  primaryReadinessReason: string;
  secondaryContext: string;
  currentGateLabel: string;
  nextGateLabel: string;
  operatorMandate: string;
  completionInterpretation: string;
  sendLockedReason: string;
}

function deriveDecisionHeader(wb: DispatchPreparationWorkbenchStateV2): DispatchPreparationDecisionHeaderV2 {
  const hasBlocker = wb.blockingSummary.length > 0;
  const hasWarning = wb.warningSummary.length > 0;

  const statusChip =
    wb.workbenchStatus === "preparation_complete_pending_next_gate" ? "검토 완료 — 다음 게이트 대기"
    : wb.workbenchStatus === "correction_required" ? "보정 필요"
    : hasBlocker ? "차단됨"
    : hasWarning ? "주의 필요"
    : "검토 가능";

  const primaryLabel =
    hasBlocker ? "발송 준비 차단됨"
    : hasWarning ? "주의 사항 존재"
    : wb.workbenchStatus === "preparation_complete_pending_next_gate" ? "발송 준비 검토 완료"
    : "발송 준비 검토 가능";

  const primaryReason = hasBlocker ? wb.blockingSummary[0] : hasWarning ? wb.warningSummary[0] : "모든 섹션 검토 가능";

  const mandate =
    hasBlocker ? `차단 원인을 해소하세요: ${wb.blockingSummary[0]}`
    : wb.workbenchStatus === "correction_required" ? "보정 경로를 확인하고 수정하세요"
    : wb.workbenchStatus === "preparation_complete_pending_next_gate" ? "발송 준비 검토가 완료되었습니다. 다음 게이트 활성화를 기다리세요."
    : "각 섹션을 순서대로 검토하세요";

  return {
    title: `Dispatch Preparation — ${wb.poRecordId}`,
    statusChip,
    primaryReadinessLabel: primaryLabel,
    primaryReadinessReason: primaryReason,
    secondaryContext: `Vendor: ${wb.vendorSeedSummary} | ${wb.referenceVisibilitySummary}`,
    currentGateLabel: "Dispatch Preparation",
    nextGateLabel: "Drafting / Send Gate (Locked — Batch 1)",
    operatorMandate: mandate,
    completionInterpretation: wb.workbenchStatus === "preparation_complete_pending_next_gate"
      ? "Preparation review complete — 실제 발송 가능 상태가 아님"
      : "Preparation review 진행 중",
    sendLockedReason: "Batch 1: Dispatch draft 생성, supplier 발송, dispatched 처리는 현재 범위 밖입니다",
  };
}

// ══════════════════════════════════════════════
// Blocker Panel
// ══════════════════════════════════════════════

export interface DispatchPreparationBlockerPanelStateV2 {
  hasBlockers: boolean;
  hasWarnings: boolean;
  blockerCount: number;
  warningCount: number;
  topBlockers: string[];
  topWarnings: string[];
  primaryCorrectionRoute: CorrectionRouteKey | null;
  requiresPriorStageReturn: boolean;
  summaryLabel: string;
  summaryExplainer: string;
}

function deriveBlockerPanel(wb: DispatchPreparationWorkbenchStateV2): DispatchPreparationBlockerPanelStateV2 {
  const topBlockers = wb.blockingSummary.slice(0, 3);
  const topWarnings = wb.warningSummary.slice(0, 3);
  const primaryRoute = wb.correctionSummary.length > 0 ? wb.correctionSummary[0].routeKey : null;
  const requiresReturn = wb.correctionSummary.some(r => r.requiresPriorStageReturn);

  const label =
    topBlockers.length > 0 ? `${topBlockers.length}건 차단 사항`
    : topWarnings.length > 0 ? `${topWarnings.length}건 주의 사항`
    : "차단 사항 없음";

  const explainer =
    topBlockers.length > 0 ? "아래 차단 원인을 해소해야 preparation review를 진행할 수 있습니다"
    : topWarnings.length > 0 ? "주의 사항이 있으나 검토는 진행 가능합니다"
    : "모든 검토 조건이 충족되었습니다";

  return {
    hasBlockers: topBlockers.length > 0,
    hasWarnings: topWarnings.length > 0,
    blockerCount: wb.blockingSummary.length,
    warningCount: wb.warningSummary.length,
    topBlockers,
    topWarnings,
    primaryCorrectionRoute: primaryRoute,
    requiresPriorStageReturn: requiresReturn,
    summaryLabel: label,
    summaryExplainer: explainer,
  };
}

// ══════════════════════════════════════════════
// Decision Section
// ══════════════════════════════════════════════

export type DecisionSectionKey = "vendor_contact" | "internal_separation" | "reference_visibility" | "shipment_and_receiving_instruction" | "prep_intake" | "completion_gate_review";

export interface DispatchPreparationDecisionSectionV2 {
  sectionKey: DecisionSectionKey;
  sectionTitle: string;
  sectionStatus: string;
  priorityRank: number;
  decisionIntent: string;
  whyThisMatters: string;
  blockers: string[];
  warnings: string[];
  visibleSummary: string;
  requiredOperatorAction: string;
  correctionRouteIfAny: CorrectionRouteKey | null;
  canResolveInPlace: boolean;
  requiresPriorStageReturn: boolean;
  nextBestActionLabel: string;
}

const SECTION_MAPPING: Record<DispatchPrepSectionKey, DecisionSectionKey> = {
  scope_review: "completion_gate_review",
  vendor_contact_review: "vendor_contact",
  reference_visibility_review: "reference_visibility",
  shipment_instruction_review: "shipment_and_receiving_instruction",
  internal_exclusion_review: "internal_separation",
  prep_intake_review: "prep_intake",
};

const SECTION_TITLES: Record<DecisionSectionKey, string> = {
  vendor_contact: "Vendor Contact 확인",
  internal_separation: "Internal-Only 분리 확인",
  reference_visibility: "Reference Visibility 확인",
  shipment_and_receiving_instruction: "Ship-to / Receiving 확인",
  prep_intake: "Preparation Intake 확인",
  completion_gate_review: "Completion Gate 확인",
};

const SECTION_INTENTS: Record<DecisionSectionKey, string> = {
  vendor_contact: "Vendor contact reference가 dispatch preparation에 충분한지 확인",
  internal_separation: "Supplier-facing seed에 internal-only 문맥이 혼입되지 않았는지 확인",
  reference_visibility: "Quote / PO / attachment reference carry-forward가 적절한지 확인",
  shipment_and_receiving_instruction: "Ship-to, bill-to, receiving instruction이 downstream에 전달 가능한지 확인",
  prep_intake: "Preparation intake 조건이 모두 충족되었는지 확인",
  completion_gate_review: "Dispatch preparation scope가 완결되었는지 최종 확인",
};

const WHY_THIS_MATTERS: Record<DecisionSectionKey, string> = {
  vendor_contact: "Vendor contact 누락 시 dispatch payload 조립 불가 — 공급사 발송 실패 위험",
  internal_separation: "Internal-only 문맥이 supplier-facing으로 유출되면 기밀 및 운영 신뢰도 훼손",
  reference_visibility: "Reference visibility가 불명확하면 downstream attach/exclude 판단이 흐려짐",
  shipment_and_receiving_instruction: "Ship-to/receiving 누락 시 배송 오류 및 입고 착오 위험",
  prep_intake: "Intake 조건 미충족 시 preparation review 자체가 차단됨",
  completion_gate_review: "Scope 미완결 시 다음 dispatch gate로 넘길 수 없음",
};

function deriveDecisionSections(wb: DispatchPreparationWorkbenchStateV2): DispatchPreparationDecisionSectionV2[] {
  const focusOrder = wb.operatorFocusOrder;
  const sections: DispatchPreparationDecisionSectionV2[] = [];

  for (let rank = 0; rank < focusOrder.length; rank++) {
    const engineKey = focusOrder[rank];
    const decisionKey = SECTION_MAPPING[engineKey];
    const engineSection = wb.sectionStates.find(s => s.sectionKey === engineKey);
    if (!engineSection) continue;

    const nextAction =
      engineSection.status === "blocked" ? `${SECTION_TITLES[decisionKey]} 차단 원인을 해소하세요`
      : engineSection.status === "attention_required" ? `${SECTION_TITLES[decisionKey]} 주의 사항을 확인하세요`
      : engineSection.status === "warning" ? `${SECTION_TITLES[decisionKey]} 경고 항목을 검토하세요`
      : `${SECTION_TITLES[decisionKey]} 검토 완료 가능`;

    sections.push({
      sectionKey: decisionKey,
      sectionTitle: SECTION_TITLES[decisionKey],
      sectionStatus: engineSection.status,
      priorityRank: rank + 1,
      decisionIntent: SECTION_INTENTS[decisionKey],
      whyThisMatters: WHY_THIS_MATTERS[decisionKey],
      blockers: engineSection.blockers,
      warnings: engineSection.warnings,
      visibleSummary: engineSection.operatorFocusReason,
      requiredOperatorAction: nextAction,
      correctionRouteIfAny: engineSection.correctionRouteIfAny as CorrectionRouteKey | null,
      canResolveInPlace: engineSection.canResolveInPlace,
      requiresPriorStageReturn: engineSection.requiresReturnToPriorStage,
      nextBestActionLabel: nextAction,
    });
  }

  return sections;
}

// ══════════════════════════════════════════════
// Active Section Body
// ══════════════════════════════════════════════

export interface ActiveSectionBody {
  sectionKey: DecisionSectionKey;
  decisionQuestion: string;
  decisionContext: string;
  evidenceSummary: string;
  riskSummary: string;
  routeOptions: string[];
  inPlaceResolutionOptions: string[];
  blockedActionsIfUnresolved: string[];
  resolutionCompletionRule: string;
}

const DECISION_QUESTIONS: Record<DecisionSectionKey, string> = {
  vendor_contact: "Vendor-facing contact reference가 dispatch preparation에 충분합니까?",
  internal_separation: "Supplier-facing seed가 internal-only contamination 위험 없이 진행 가능합니까?",
  reference_visibility: "Reference와 visibility carry-forward 규칙이 다음 gate 검토에 충분히 명확합니까?",
  shipment_and_receiving_instruction: "Ship-to, bill-to, receiving instruction이 downstream 전달에 충분합니까?",
  prep_intake: "Preparation intake 조건이 모두 충족되었습니까?",
  completion_gate_review: "Dispatch preparation scope가 완결되었고 다음 gate로 넘길 준비가 되었습니까?",
};

function deriveActiveSectionBody(section: DispatchPreparationDecisionSectionV2, wb: DispatchPreparationWorkbenchStateV2): ActiveSectionBody {
  const routeOpts: string[] = [];
  if (section.correctionRouteIfAny) routeOpts.push(`Correction: ${section.correctionRouteIfAny}`);
  if (section.requiresPriorStageReturn) routeOpts.push("Prior stage return");

  const inPlaceOpts: string[] = [];
  if (section.canResolveInPlace) inPlaceOpts.push("현재 workbench에서 해결 가능");

  const blockedIfUnresolved: string[] = [];
  if (section.blockers.length > 0) blockedIfUnresolved.push("preparation_continue", "completion_gate");
  blockedIfUnresolved.push("generate_dispatch_draft", "send_to_supplier", "mark_dispatched");

  const completionRule =
    section.blockers.length > 0 ? "모든 blocker 해소 후 section reviewed 가능"
    : section.warnings.length > 0 ? "Warning 확인 후 section reviewed 가능"
    : "즉시 reviewed 가능";

  return {
    sectionKey: section.sectionKey,
    decisionQuestion: DECISION_QUESTIONS[section.sectionKey],
    decisionContext: section.visibleSummary,
    evidenceSummary: [...section.blockers, ...section.warnings].join("; ") || "이슈 없음",
    riskSummary: WHY_THIS_MATTERS[section.sectionKey],
    routeOptions: routeOpts,
    inPlaceResolutionOptions: inPlaceOpts,
    blockedActionsIfUnresolved: blockedIfUnresolved,
    resolutionCompletionRule: completionRule,
  };
}

// ══════════════════════════════════════════════
// Sticky Dock
// ══════════════════════════════════════════════

export interface DispatchPreparationStickyDockStateV2 {
  primaryAction: { label: string; enabled: boolean; reason: string };
  secondaryActions: { label: string; enabled: boolean; reason: string }[];
  disabledActions: { label: string; reason: string }[];
  blockedActionReasons: Record<string, string>;
  requiredRouteBeforeProgress: string | null;
  completionStateLabel: string;
  progressionLockLabel: string;
}

function deriveStickyDock(wb: DispatchPreparationWorkbenchStateV2): DispatchPreparationStickyDockStateV2 {
  const gate = wb.actionGate;
  const hasBlocker = wb.blockingSummary.length > 0;
  const isComplete = wb.workbenchStatus === "preparation_complete_pending_next_gate";

  const primaryAction = hasBlocker
    ? { label: "차단 원인 해소", enabled: gate.canRequestCorrection, reason: hasBlocker ? wb.blockingSummary[0] : "" }
    : isComplete
    ? { label: "검토 완료 — 다음 게이트 대기", enabled: false, reason: "다음 dispatch gate 활성화 대기 중" }
    : { label: "Preparation 검토 계속", enabled: gate.canContinuePreparation, reason: "" };

  const secondaryActions = [
    { label: "Created Review로 복귀", enabled: gate.canReturnToCreatedReview, reason: "" },
    { label: "Reference Gap 해소", enabled: gate.canResolveReferenceGap, reason: "" },
    { label: "Internal 분리 해소", enabled: gate.canResolveInternalSeparationGap, reason: "" },
  ];

  const disabledActions = [
    { label: "Dispatch Draft 생성", reason: "Batch 1: Dispatch draft 생성은 현재 범위 밖입니다" },
    { label: "Supplier 발송", reason: "Batch 1: Supplier 발송은 현재 범위 밖입니다" },
    { label: "Dispatched 처리", reason: "Batch 1: Dispatched 처리는 현재 범위 밖입니다" },
  ];

  const blockedActionReasons: Record<string, string> = {
    generate_dispatch_draft: "Batch 1 정책: dispatch draft 생성 금지",
    send_to_supplier: "Batch 1 정책: supplier 발송 금지",
    mark_dispatched: "Batch 1 정책: dispatched 처리 금지",
  };

  const requiredRoute = wb.correctionSummary.length > 0 ? wb.correctionSummary[0].routeKey : null;

  return {
    primaryAction,
    secondaryActions,
    disabledActions,
    blockedActionReasons,
    requiredRouteBeforeProgress: requiredRoute,
    completionStateLabel: isComplete ? "Preparation review 완료 — 다음 gate 대기" : "Preparation review 진행 중",
    progressionLockLabel: "Drafting / Send Gate는 Batch 1 범위 밖입니다",
  };
}

// ══════════════════════════════════════════════
// Right Rail Preview
// ══════════════════════════════════════════════

export interface DispatchPreparationRightRailPreviewStateV2 {
  vendorSeedPreview: { vendorId: string; contactVisible: boolean; noteSeed: string };
  referencePreview: { quoteVisible: boolean; poVisible: boolean; attachmentVisible: boolean };
  instructionPreview: { shipToVisible: boolean; billToVisible: boolean; receivingVisible: boolean };
  excludedInternalOnlyPreview: string[];
  provenancePreview: { candidateId: string; lane: string }[];
  visibilityCautionSummary: string;
}

function deriveRightRailPreview(wb: DispatchPreparationWorkbenchStateV2): DispatchPreparationRightRailPreviewStateV2 {
  const rail = wb.railPayload;

  const cautions: string[] = [];
  if (!rail.vendorFacingSeedPreview.vendorContactVisible) cautions.push("Vendor contact 비활성");
  if (!rail.visibleReferenceSummary.quoteVisible && !rail.visibleReferenceSummary.poVisible) cautions.push("Quote/PO reference 모두 비활성");
  if (rail.excludedInternalOnlyFields.length > 0) cautions.push(`${rail.excludedInternalOnlyFields.length}건 internal-only 제외됨`);

  return {
    vendorSeedPreview: {
      vendorId: rail.vendorFacingSeedPreview.vendorId,
      contactVisible: rail.vendorFacingSeedPreview.vendorContactVisible,
      noteSeed: rail.vendorFacingSeedPreview.supplierFacingNoteSeed,
    },
    referencePreview: {
      quoteVisible: rail.visibleReferenceSummary.quoteVisible,
      poVisible: rail.visibleReferenceSummary.poVisible,
      attachmentVisible: rail.visibleReferenceSummary.attachmentSeedVisible,
    },
    instructionPreview: {
      shipToVisible: rail.visibleInstructionSummary.shipToVisible,
      billToVisible: rail.visibleInstructionSummary.billToVisible,
      receivingVisible: rail.visibleInstructionSummary.receivingInstructionVisible,
    },
    excludedInternalOnlyPreview: rail.excludedInternalOnlyFields,
    provenancePreview: rail.provenanceSnapshot.map(p => ({ candidateId: p.candidateId, lane: p.originalLane })),
    visibilityCautionSummary: cautions.length > 0 ? cautions.join("; ") : "Visibility 이슈 없음",
  };
}

// ══════════════════════════════════════════════
// State Transition Events
// ══════════════════════════════════════════════

export type CenterWorkWindowTransitionEvent =
  | "open_section"
  | "resolve_in_place"
  | "route_to_correction"
  | "return_to_prior_stage"
  | "mark_section_reviewed"
  | "mark_preparation_review_complete";

export interface CenterWorkWindowTransition {
  event: CenterWorkWindowTransitionEvent;
  sectionKey: DecisionSectionKey | null;
  previousPhase: DecisionPhase;
  nextPhase: DecisionPhase;
  timestamp: string;
  actor: string;
}

export function canMarkPreparationReviewComplete(wb: DispatchPreparationWorkbenchStateV2): boolean {
  return wb.blockingSummary.length === 0 && wb.workbenchStatus !== "intake_blocked" && wb.workbenchStatus !== "correction_required";
}

// ══════════════════════════════════════════════
// Top-Level Center State
// ══════════════════════════════════════════════

export interface DispatchPreparationCenterWorkWindowStateV2 {
  caseId: string;
  handoffPackageId: string;
  viewMode: CenterViewMode;
  decisionPhase: DecisionPhase;
  decisionHeader: DispatchPreparationDecisionHeaderV2;
  blockerPanel: DispatchPreparationBlockerPanelStateV2;
  decisionSections: DispatchPreparationDecisionSectionV2[];
  activeSectionKey: DecisionSectionKey | null;
  activeSectionBody: ActiveSectionBody | null;
  stickyDock: DispatchPreparationStickyDockStateV2;
  rightRailPreview: DispatchPreparationRightRailPreviewStateV2;
  operatorFocusOrder: DecisionSectionKey[];
  provenance: { candidateId: string; lane: string }[];
  generatedAt: string;
}

function deriveViewMode(wb: DispatchPreparationWorkbenchStateV2): CenterViewMode {
  if (wb.workbenchStatus === "preparation_complete_pending_next_gate") return "completion_pending_next_gate";
  if (wb.workbenchStatus === "correction_required") return "correction_routing";
  if (wb.blockingSummary.length > 0) return "section_resolution";
  return "readiness_review";
}

function deriveDecisionPhase(wb: DispatchPreparationWorkbenchStateV2): DecisionPhase {
  switch (wb.workbenchStatus) {
    case "intake_blocked": return "blocked";
    case "preparation_required": return "review_required";
    case "correction_required": return "correction_required";
    case "ready_for_preparation_review": return "ready_for_review";
    case "preparation_in_progress": return "review_in_progress";
    case "preparation_hold": return "blocked";
    case "preparation_complete_pending_next_gate": return "review_complete_pending_next_gate";
  }
}

export function buildDispatchPreparationCenterWorkWindowStateV2(
  wb: DispatchPreparationWorkbenchStateV2,
): DispatchPreparationCenterWorkWindowStateV2 {
  const header = deriveDecisionHeader(wb);
  const blockerPanel = deriveBlockerPanel(wb);
  const decisionSections = deriveDecisionSections(wb);
  const stickyDock = deriveStickyDock(wb);
  const rightRailPreview = deriveRightRailPreview(wb);

  const focusOrder = decisionSections.map(s => s.sectionKey);
  const activeKey = focusOrder.length > 0 ? focusOrder[0] : null;
  const activeSection = activeKey ? decisionSections.find(s => s.sectionKey === activeKey) ?? null : null;
  const activeBody = activeSection ? deriveActiveSectionBody(activeSection, wb) : null;

  return {
    caseId: wb.caseId,
    handoffPackageId: wb.handoffPackageId,
    viewMode: deriveViewMode(wb),
    decisionPhase: deriveDecisionPhase(wb),
    decisionHeader: header,
    blockerPanel,
    decisionSections,
    activeSectionKey: activeKey,
    activeSectionBody: activeBody,
    stickyDock,
    rightRailPreview,
    operatorFocusOrder: focusOrder,
    provenance: wb.provenance.map(p => ({ candidateId: p.candidateId, lane: p.originalLane })),
    generatedAt: new Date().toISOString(),
  };
}
