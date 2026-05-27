/**
 * Send Confirmation Workspace v2 — canonical workspace state contract
 *
 * 고정 규칙:
 * 1. SendConfirmationGateV2 + upstream truths = 입력 source.
 * 2. preview only / entry enabled / confirmation in progress / confirmation complete 분리.
 * 3. center = confirmation decision canvas, rail = supplier-facing preview, dock = action gate.
 * 4. supplier-facing 최종 확인 단위가 section state로 명확 정의.
 * 5. exclusion guard / reference visibility / instruction은 독립 확인 축.
 * 6. Batch 1: send execution / mark dispatched 금지.
 * 7. confirmation complete ≠ send execution ready.
 * 8. local UI state ≠ canonical workspace state.
 */

import type { SendConfirmationGateV2, SendConfirmationGateStatus, SendConfirmationEntryCandidateV2 } from "./send-confirmation-gate-v2-engine";
import type { DispatchPreparationHandoffPackageV2, InternalOnlyExcludedFlag } from "./dispatch-preparation-handoff-gate-v2-engine";
import type { LaneProvenance } from "./sourcing-result-workbench-v2-triage-engine";

// ══════════════════════════════════════════════
// Workspace Status / Mode
// ══════════════════════════════════════════════

export type SendConfirmationWorkspaceStatus = "locked_preview_only" | "entry_enabled" | "confirmation_required" | "confirmation_in_progress" | "confirmation_hold" | "confirmation_review_pending" | "confirmation_complete_pending_send_execution_gate";

export type SendConfirmationWorkspaceMode = "preview_only" | "confirmation_review" | "final_check_resolution" | "policy_review" | "completion_pending_send_execution_gate";

// ══════════════════════════════════════════════
// Section Key / Status
// ══════════════════════════════════════════════

export type SendConfirmationSectionKey = "recipient_confirmation_block" | "scope_confirmation_block" | "reference_visibility_confirmation_block" | "instruction_confirmation_block" | "exclusion_guard_confirmation_block" | "confirmation_completion_gate_review";

export type SendConfirmationSectionStatus = "ready" | "partial" | "warning" | "blocked" | "attention_required" | "confirmed";

// ══════════════════════════════════════════════
// Check Section State
// ══════════════════════════════════════════════

export interface SendConfirmationCheckSectionStateV2 {
  sectionKey: SendConfirmationSectionKey;
  sectionTitle: string;
  sectionStatus: SendConfirmationSectionStatus;
  priorityRank: number;
  confirmationIntent: string;
  whyThisMatters: string;
  requiredConfirmationInputs: string[];
  confirmedInputs: string[];
  unconfirmedOrAmbiguousInputs: string[];
  warnings: string[];
  operatorActionRequired: string;
  canResolveInPlace: boolean;
  requiresReturnToValidation: boolean;
  requiresReturnToDraftAssembly: boolean;
  nextBestActionLabel: string;
  derivedFromValidationRuleResolution: string;
  derivedFromHandoffPackageSection: string;
  exclusionGuardBasis: string;
  visibilityBasis: string;
}

// ══════════════════════════════════════════════
// Center Canvas State
// ══════════════════════════════════════════════

export interface ConfirmationFieldGroup { groupKey: string; groupLabel: string; sourceMapping: string; confirmed: boolean; value: string; unconfirmed: boolean; excluded: boolean; }

export interface SendConfirmationCenterCanvasStateV2 {
  activeSectionKey: SendConfirmationSectionKey | null;
  decisionQuestion: string;
  confirmationContext: string;
  sourceInputSummary: string;
  unconfirmedOrConflictingInputs: string[];
  fieldGroups: ConfirmationFieldGroup[];
  riskSummary: string;
  resolutionOptions: string[];
  blockedDownstreamActions: string[];
  completionRuleForSection: string;
}

// ══════════════════════════════════════════════
// Right Rail Preview
// ══════════════════════════════════════════════

export type ConfirmationPreviewMode = "locked_preview" | "confirmation_preview" | "warning_preview" | "candidate_preview";

export interface SendConfirmationRightRailPreviewStateV2 {
  previewMode: ConfirmationPreviewMode;
  recipientPreview: { vendorId: string; contactVisible: boolean };
  scopePreview: { lineCount: number; amountSummary: string };
  referencePreview: { quoteVisible: boolean; poVisible: boolean; attachmentSeedVisible: boolean };
  instructionPreview: { shipToVisible: boolean; billToVisible: boolean; receivingVisible: boolean };
  excludedInternalOnlyPreview: InternalOnlyExcludedFlag[];
  previewCautionSummary: string;
  provenancePreview: { candidateId: string; lane: string }[];
}

// ══════════════════════════════════════════════
// Sticky Dock
// ══════════════════════════════════════════════

export interface SendConfirmationStickyDockStateV2 {
  primaryAction: { label: string; enabled: boolean; reason: string };
  secondaryActions: { label: string; enabled: boolean; reason: string }[];
  disabledActions: { label: string; reason: string }[];
  blockedActionReasons: Record<string, string>;
  requiredResolutionBeforeProgress: string | null;
  workspaceCompletionLabel: string;
  nextGateLockLabel: string;
}

// ══════════════════════════════════════════════
// Workspace Header
// ══════════════════════════════════════════════

export interface SendConfirmationWorkspaceHeaderV2 {
  title: string;
  statusChip: string;
  entryStatusLabel: string;
  entryStatusReason: string;
  confirmationScopeLabel: string;
  currentGateLabel: string;
  nextGateLabel: string;
  operatorMandate: string;
  lockInterpretation: string;
  sendExecutionLockReason: string;
}

// ══════════════════════════════════════════════
// Top-Level Workspace State
// ══════════════════════════════════════════════

export interface SendConfirmationWorkspaceStateV2 {
  workspaceId: string;
  caseId: string;
  handoffPackageId: string;
  validationSessionId: string;
  sendConfirmationGateId: string;
  workspaceStatus: SendConfirmationWorkspaceStatus;
  workspaceMode: SendConfirmationWorkspaceMode;
  workspaceHeader: SendConfirmationWorkspaceHeaderV2;
  entryLockSummary: string;
  checkSectionStates: SendConfirmationCheckSectionStateV2[];
  activeSectionKey: SendConfirmationSectionKey | null;
  centerCanvasState: SendConfirmationCenterCanvasStateV2;
  rightRailPreview: SendConfirmationRightRailPreviewStateV2;
  stickyDock: SendConfirmationStickyDockStateV2;
  operatorFocusOrder: SendConfirmationSectionKey[];
  provenance: { candidateId: string; lane: string }[];
  generatedAt: string;
}

// ══════════════════════════════════════════════
// Section Meta
// ══════════════════════════════════════════════

const SECTION_META: Record<SendConfirmationSectionKey, { title: string; intent: string; risk: string; question: string }> = {
  recipient_confirmation_block: { title: "수신자 최종 확인", intent: "Supplier recipient / contact가 올바른지 최종 확인", risk: "수신자 오류 시 오발송 및 dispatch 실패", question: "Supplier 수신자 정보가 발송 대상과 정확히 일치합니까?" },
  scope_confirmation_block: { title: "발송 범위 최종 확인", intent: "Dispatch 대상 line / qty / amount가 올바른지 확인", risk: "범위 오해 시 공급사 confusion 및 주문 착오", question: "발송 대상 범위(line/qty/amount)가 승인된 범위와 일치합니까?" },
  reference_visibility_confirmation_block: { title: "Reference Visibility 최종 확인", intent: "Quote / PO / attachment reference가 올바르게 노출되는지 확인", risk: "잘못된 reference 노출 시 PO 식별 오류 또는 기밀 유출", question: "Reference와 attachment visibility가 supplier-facing payload에 적절하게 매핑되었습니까?" },
  instruction_confirmation_block: { title: "Instruction 최종 확인", intent: "Ship-to / receiving / delivery instruction이 올바른지 확인", risk: "Instruction 오류 시 배송 착오 및 입고 실패", question: "Ship-to, receiving instruction이 internal context 유출 없이 전달 가능합니까?" },
  exclusion_guard_confirmation_block: { title: "Internal 제외 최종 확인", intent: "Internal-only 문맥이 supplier-facing에서 완전히 제외되었는지 최종 확인", risk: "Internal context 유출 시 기밀 및 운영 신뢰도 훼손", question: "Internal-only 문맥이 supplier-facing payload에서 완전히 제외되었습니까?" },
  confirmation_completion_gate_review: { title: "Confirmation 완결성 확인", intent: "모든 확인 블록이 완료되었는지 최종 검토", risk: "미확인 상태로 send gate에 넘어가면 보정 면으로 전락", question: "모든 확인 블록이 완료되어 send execution gate로 넘길 준비가 되었습니까?" },
};

// ══════════════════════════════════════════════
// Section Derivation
// ══════════════════════════════════════════════

function buildConfirmationSection(key: SendConfirmationSectionKey, rank: number, pkg: DispatchPreparationHandoffPackageV2, confirmed: string[], unconfirmed: string[], warnings: string[]): SendConfirmationCheckSectionStateV2 {
  const meta = SECTION_META[key];
  const status: SendConfirmationSectionStatus = unconfirmed.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready";
  return {
    sectionKey: key, sectionTitle: meta.title, sectionStatus: status, priorityRank: rank,
    confirmationIntent: meta.intent, whyThisMatters: meta.risk,
    requiredConfirmationInputs: [...confirmed, ...unconfirmed], confirmedInputs: confirmed,
    unconfirmedOrAmbiguousInputs: unconfirmed, warnings,
    operatorActionRequired: unconfirmed.length > 0 ? `${meta.title} 미확인 항목 해소 필요` : warnings.length > 0 ? `${meta.title} 주의 항목 검토` : `${meta.title} 확인 가능`,
    canResolveInPlace: unconfirmed.length === 0, requiresReturnToValidation: unconfirmed.length > 0, requiresReturnToDraftAssembly: false,
    nextBestActionLabel: unconfirmed.length > 0 ? `${meta.title} 미확인 해소` : `${meta.title} 확인 진행`,
    derivedFromValidationRuleResolution: key, derivedFromHandoffPackageSection: key,
    exclusionGuardBasis: key === "exclusion_guard_confirmation_block" ? "direct" : "inherited",
    visibilityBasis: key === "reference_visibility_confirmation_block" ? "direct" : "inherited",
  };
}

function deriveSections(pkg: DispatchPreparationHandoffPackageV2): SendConfirmationCheckSectionStateV2[] {
  const sections: SendConfirmationCheckSectionStateV2[] = [];

  // Recipient
  const rConf: string[] = []; const rUnc: string[] = [];
  if (pkg.createdVendorId) rConf.push("vendorId"); else rUnc.push("vendorId");
  if (pkg.vendorContactReferenceVisible) rConf.push("contact"); else rUnc.push("contact");
  sections.push(buildConfirmationSection("recipient_confirmation_block", 1, pkg, rConf, rUnc, []));

  // Scope
  const sConf: string[] = []; const sUnc: string[] = []; const sWarn: string[] = [];
  if (pkg.createdLineItems.length > 0) sConf.push("lineItems"); else sUnc.push("lineItems");
  if (pkg.createdAmountSummary) sConf.push("amount"); else sWarn.push("amount 누락");
  if (pkg.dispatchEligibleScope) sConf.push("scope"); else sUnc.push("scope");
  sections.push(buildConfirmationSection("scope_confirmation_block", 2, pkg, sConf, sUnc, sWarn));

  // Reference
  const refConf: string[] = []; const refWarn: string[] = [];
  if (pkg.quoteReferenceVisible) refConf.push("quote"); else refWarn.push("quote reference 비활성");
  if (pkg.poReferenceVisible) refConf.push("PO"); else refWarn.push("PO reference 비활성");
  if (pkg.attachmentSeedVisible) refConf.push("attachment"); else refWarn.push("attachment seed 비활성");
  if (pkg.exceptionFlags.includes("stale_quote_reference")) refWarn.push("stale quote");
  sections.push(buildConfirmationSection("reference_visibility_confirmation_block", 3, pkg, refConf, [], refWarn));

  // Instruction
  const iConf: string[] = []; const iUnc: string[] = []; const iWarn: string[] = [];
  if (pkg.shipToVisible) iConf.push("ship-to"); else iUnc.push("ship-to");
  if (pkg.billToVisible) iConf.push("bill-to"); else iWarn.push("bill-to 비활성");
  if (pkg.receivingInstructionVisible) iConf.push("receiving"); else iWarn.push("receiving 비활성");
  sections.push(buildConfirmationSection("instruction_confirmation_block", 4, pkg, iConf, iUnc, iWarn));

  // Exclusion guard
  const eConf: string[] = []; const eUnc: string[] = []; const eWarn: string[] = [];
  if (pkg.internalOnlyExcludedFlags.length > 0) eConf.push(`${pkg.internalOnlyExcludedFlags.length}건 제외`);
  const seedLower = (pkg.supplierFacingNoteSeed || "").toLowerCase();
  if (["budget", "governance", "internal", "approval"].some(kw => seedLower.includes(kw))) eUnc.push("contamination risk");
  if (pkg.internalOnlyExcludedFlags.length === 0 && pkg.supplierFacingNoteSeed) eWarn.push("exclusion flag 없이 note seed 존재");
  sections.push(buildConfirmationSection("exclusion_guard_confirmation_block", 5, pkg, eConf, eUnc, eWarn));

  // Completion gate
  const blocked = sections.filter(s => s.sectionStatus === "blocked");
  const warned = sections.filter(s => s.sectionStatus === "warning");
  sections.push(buildConfirmationSection("confirmation_completion_gate_review", 6, pkg,
    sections.filter(s => s.sectionStatus === "ready" || s.sectionStatus === "confirmed").map(s => s.sectionKey),
    blocked.map(s => `${s.sectionTitle} blocked`),
    warned.map(s => `${s.sectionTitle} warning`),
  ));

  return sections;
}

// ══════════════════════════════════════════════
// Derivation Helpers
// ══════════════════════════════════════════════

function deriveWorkspaceStatus(gate: SendConfirmationGateV2, sections: SendConfirmationCheckSectionStateV2[]): SendConfirmationWorkspaceStatus {
  if (gate.gateStatus !== "eligible_for_send_confirmation_entry" && gate.gateStatus !== "send_confirmation_entry_opened") return "locked_preview_only";
  const hasBlocker = sections.some(s => s.sectionStatus === "blocked");
  const hasWarning = sections.some(s => s.sectionStatus === "warning" || s.sectionStatus === "attention_required");
  const allDone = sections.every(s => s.sectionStatus === "ready" || s.sectionStatus === "confirmed");
  if (allDone) return "confirmation_complete_pending_send_execution_gate";
  if (hasBlocker) return "confirmation_required";
  if (hasWarning) return "confirmation_in_progress";
  return "entry_enabled";
}

function deriveWorkspaceMode(status: SendConfirmationWorkspaceStatus): SendConfirmationWorkspaceMode {
  switch (status) {
    case "locked_preview_only": return "preview_only";
    case "entry_enabled": case "confirmation_required": return "confirmation_review";
    case "confirmation_in_progress": return "final_check_resolution";
    case "confirmation_hold": return "policy_review";
    case "confirmation_review_pending": return "confirmation_review";
    case "confirmation_complete_pending_send_execution_gate": return "completion_pending_send_execution_gate";
  }
}

const FOCUS_PRIORITY: SendConfirmationSectionKey[] = ["recipient_confirmation_block", "scope_confirmation_block", "reference_visibility_confirmation_block", "instruction_confirmation_block", "exclusion_guard_confirmation_block", "confirmation_completion_gate_review"];

function deriveFocusOrder(sections: SendConfirmationCheckSectionStateV2[]): SendConfirmationSectionKey[] {
  const blocked = FOCUS_PRIORITY.filter(k => sections.find(s => s.sectionKey === k)?.sectionStatus === "blocked");
  const warning = FOCUS_PRIORITY.filter(k => { const s = sections.find(sec => sec.sectionKey === k); return s && (s.sectionStatus === "warning" || s.sectionStatus === "attention_required") && !blocked.includes(k); });
  const rest = FOCUS_PRIORITY.filter(k => !blocked.includes(k) && !warning.includes(k));
  return [...blocked, ...warning, ...rest];
}

function deriveHeader(gate: SendConfirmationGateV2, status: SendConfirmationWorkspaceStatus, sections: SendConfirmationCheckSectionStateV2[]): SendConfirmationWorkspaceHeaderV2 {
  const isLocked = status === "locked_preview_only";
  const isComplete = status === "confirmation_complete_pending_send_execution_gate";
  const hasBlocker = sections.some(s => s.sectionStatus === "blocked");
  const mandate = isLocked ? "Preview only 상태입니다. Entry 조건을 확인하세요."
    : hasBlocker ? "미확인 항목을 해소하세요"
    : isComplete ? "Send confirmation 확인이 완료되었습니다. Send execution gate를 기다리세요."
    : "Supplier-facing payload를 최종 확인하세요";

  return {
    title: `Send Confirmation — ${gate.caseId}`, statusChip: isLocked ? "Preview Only" : isComplete ? "확인 완료 — Send Execution 대기" : hasBlocker ? "차단됨" : "확인 진행 가능",
    entryStatusLabel: isLocked ? "Entry Locked" : "Entry Enabled", entryStatusReason: isLocked ? gate.entryCandidate.candidateReason : "Confirmation 가능",
    confirmationScopeLabel: gate.entryCandidate.supplierPayloadReadinessSnapshot, currentGateLabel: "Send Confirmation Workspace",
    nextGateLabel: "Send Execution Gate (Locked — Batch 1)", operatorMandate: mandate,
    lockInterpretation: isComplete ? "Confirmation complete — send execution은 아직 범위 밖" : isLocked ? "Entry gate 조건 미충족" : "Confirmation 진행 가능",
    sendExecutionLockReason: "Batch 1: Supplier 발송 실행, dispatched 처리는 현재 범위 밖입니다",
  };
}

function deriveDock(status: SendConfirmationWorkspaceStatus, sections: SendConfirmationCheckSectionStateV2[]): SendConfirmationStickyDockStateV2 {
  const isLocked = status === "locked_preview_only";
  const isComplete = status === "confirmation_complete_pending_send_execution_gate";
  const hasBlocker = sections.some(s => s.sectionStatus === "blocked");

  const primary = isLocked ? { label: "Preview Only", enabled: false, reason: "Entry gate locked" }
    : isComplete ? { label: "확인 완료 — Send Execution 대기", enabled: false, reason: "다음 gate 대기 중" }
    : hasBlocker ? { label: "미확인 항목 해소", enabled: true, reason: "" }
    : { label: "Confirmation 검토 계속", enabled: true, reason: "" };

  return {
    primaryAction: primary,
    secondaryActions: [
      { label: "Validation Review로 복귀", enabled: true, reason: "" },
      { label: "Draft Assembly로 복귀", enabled: true, reason: "" },
      { label: "Hold 전환", enabled: true, reason: "" },
      { label: "Section 확인 완료", enabled: !isLocked && !hasBlocker, reason: hasBlocker ? "Blocker 해소 필요" : "" },
    ],
    disabledActions: [
      { label: "Send Execution Package 생성", reason: "Batch 1 범위 밖" },
      { label: "Supplier 발송 실행", reason: "Batch 1 범위 밖" },
      { label: "Dispatched 처리", reason: "Batch 1 범위 밖" },
      { label: "Transport Payload Freeze", reason: "Batch 1 범위 밖" },
    ],
    blockedActionReasons: { compute_send_execution_package: "Batch 1 금지", execute_supplier_send: "Batch 1 금지", mark_dispatched: "Batch 1 금지", freeze_final_transport_payload: "Batch 1 금지" },
    requiredResolutionBeforeProgress: hasBlocker ? sections.find(s => s.sectionStatus === "blocked")?.sectionTitle ?? null : null,
    workspaceCompletionLabel: isComplete ? "Send confirmation 완료 — send execution gate 대기" : "Confirmation 진행 중",
    nextGateLockLabel: "Send Execution Gate — Batch 1 locked",
  };
}

function deriveRailPreview(pkg: DispatchPreparationHandoffPackageV2, status: SendConfirmationWorkspaceStatus): SendConfirmationRightRailPreviewStateV2 {
  const mode: ConfirmationPreviewMode = status === "locked_preview_only" ? "locked_preview" : status === "confirmation_complete_pending_send_execution_gate" ? "confirmation_preview" : "candidate_preview";
  const cautions: string[] = [];
  if (!pkg.vendorContactReferenceVisible) cautions.push("Vendor contact 비활성");
  if (!pkg.quoteReferenceVisible && !pkg.poReferenceVisible) cautions.push("Quote/PO reference 모두 비활성");
  if (pkg.internalOnlyExcludedFlags.length > 0) cautions.push(`${pkg.internalOnlyExcludedFlags.length}건 internal-only 제외`);
  if (!pkg.shipToVisible) cautions.push("Ship-to 비활성");

  return {
    previewMode: mode,
    recipientPreview: { vendorId: pkg.createdVendorId, contactVisible: pkg.vendorContactReferenceVisible },
    scopePreview: { lineCount: pkg.createdLineItems.length, amountSummary: pkg.createdAmountSummary },
    referencePreview: { quoteVisible: pkg.quoteReferenceVisible, poVisible: pkg.poReferenceVisible, attachmentSeedVisible: pkg.attachmentSeedVisible },
    instructionPreview: { shipToVisible: pkg.shipToVisible, billToVisible: pkg.billToVisible, receivingVisible: pkg.receivingInstructionVisible },
    excludedInternalOnlyPreview: pkg.internalOnlyExcludedFlags,
    previewCautionSummary: cautions.length > 0 ? cautions.join("; ") : "Visibility 이슈 없음",
    provenancePreview: pkg.provenanceByLine.map(p => ({ candidateId: p.candidateId, lane: p.originalLane })),
  };
}

function deriveCenterCanvas(sections: SendConfirmationCheckSectionStateV2[], focusOrder: SendConfirmationSectionKey[]): SendConfirmationCenterCanvasStateV2 {
  const activeKey = focusOrder.length > 0 ? focusOrder[0] : null;
  const active = activeKey ? sections.find(s => s.sectionKey === activeKey) : null;

  if (!active) return { activeSectionKey: null, decisionQuestion: "", confirmationContext: "", sourceInputSummary: "", unconfirmedOrConflictingInputs: [], fieldGroups: [], riskSummary: "", resolutionOptions: [], blockedDownstreamActions: ["execute_supplier_send", "mark_dispatched"], completionRuleForSection: "" };

  const meta = SECTION_META[activeKey!];
  const fieldGroups: ConfirmationFieldGroup[] = active.requiredConfirmationInputs.map(input => ({
    groupKey: input, groupLabel: input, sourceMapping: active.derivedFromHandoffPackageSection,
    confirmed: active.confirmedInputs.includes(input), value: active.confirmedInputs.includes(input) ? "confirmed" : "",
    unconfirmed: active.unconfirmedOrAmbiguousInputs.includes(input), excluded: false,
  }));

  return {
    activeSectionKey: activeKey, decisionQuestion: meta.question, confirmationContext: active.confirmationIntent,
    sourceInputSummary: `${active.confirmedInputs.length} confirmed / ${active.unconfirmedOrAmbiguousInputs.length} unconfirmed`,
    unconfirmedOrConflictingInputs: [...active.unconfirmedOrAmbiguousInputs, ...active.warnings],
    fieldGroups, riskSummary: meta.risk,
    resolutionOptions: active.canResolveInPlace ? ["현재 workspace에서 확인 가능"] : active.requiresReturnToValidation ? ["Validation review로 복귀 필요"] : ["Draft assembly로 복귀 필요"],
    blockedDownstreamActions: ["execute_supplier_send", "mark_dispatched"],
    completionRuleForSection: active.unconfirmedOrAmbiguousInputs.length > 0 ? "미확인 항목 해소 후 confirmed 가능" : "즉시 confirmed 가능",
  };
}

// ══════════════════════════════════════════════
// Main Builder
// ══════════════════════════════════════════════

export function buildSendConfirmationWorkspaceStateV2(gate: SendConfirmationGateV2, pkg: DispatchPreparationHandoffPackageV2): SendConfirmationWorkspaceStateV2 {
  const sections = deriveSections(pkg);
  const status = deriveWorkspaceStatus(gate, sections);
  const mode = deriveWorkspaceMode(status);
  const focusOrder = deriveFocusOrder(sections);
  const header = deriveHeader(gate, status, sections);
  const dock = deriveDock(status, sections);
  const rail = deriveRailPreview(pkg, status);
  const center = deriveCenterCanvas(sections, focusOrder);

  return {
    workspaceId: `sndcws_${Date.now().toString(36)}`,
    caseId: gate.caseId,
    handoffPackageId: gate.handoffPackageId,
    validationSessionId: gate.validationSessionId,
    sendConfirmationGateId: gate.sendConfirmationGateId,
    workspaceStatus: status, workspaceMode: mode,
    workspaceHeader: header,
    entryLockSummary: status === "locked_preview_only" ? `Entry locked: ${gate.entryCandidate.candidateReason}` : "Entry enabled",
    checkSectionStates: sections, activeSectionKey: focusOrder[0] || null,
    centerCanvasState: center, rightRailPreview: rail, stickyDock: dock,
    operatorFocusOrder: focusOrder,
    provenance: pkg.provenanceByLine.map(p => ({ candidateId: p.candidateId, lane: p.originalLane })),
    generatedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════
// Activity Events
// ══════════════════════════════════════════════

export type SendConfirmationWorkspaceEventType =
  | "send_confirmation_workspace_state_computed"
  | "send_confirmation_workspace_opened_preview_only"
  | "send_confirmation_workspace_entry_enabled"
  | "send_confirmation_workspace_section_focused"
  | "send_confirmation_workspace_section_review_started"
  | "send_confirmation_workspace_marked_in_progress"
  | "send_confirmation_workspace_marked_complete_pending_send_execution_gate";

export interface SendConfirmationWorkspaceEvent {
  type: SendConfirmationWorkspaceEventType;
  caseId: string; handoffPackageId: string; validationSessionId: string; sendConfirmationGateId: string; workspaceId: string;
  sectionKeyIfAny: SendConfirmationSectionKey | null; reason: string; actorOrSystem: string; timestamp: string;
}

export function createSendConfirmationWorkspaceEvent(type: SendConfirmationWorkspaceEventType, ws: SendConfirmationWorkspaceStateV2, sectionKey: SendConfirmationSectionKey | null, reason: string, actor: string): SendConfirmationWorkspaceEvent {
  return { type, caseId: ws.caseId, handoffPackageId: ws.handoffPackageId, validationSessionId: ws.validationSessionId, sendConfirmationGateId: ws.sendConfirmationGateId, workspaceId: ws.workspaceId, sectionKeyIfAny: sectionKey, reason, actorOrSystem: actor, timestamp: new Date().toISOString() };
}
