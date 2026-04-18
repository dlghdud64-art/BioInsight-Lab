/**
 * Dispatch Draft Workspace v2 — canonical workspace state contract
 *
 * 고정 규칙:
 * 1. DispatchDraftEnablementGateV2 + upstream truths = 입력 source.
 * 2. preview only / entry enabled / assembly in progress / assembly complete 분리.
 * 3. center = decision/assembly canvas, rail = supplier-facing preview, dock = action gate.
 * 4. vendor-facing 조립 단위가 section state로 명확 정의.
 * 5. internal exclusion / reference visibility / instruction은 독립 조립 축.
 * 6. Batch 1: final draft generation / send execution 금지.
 * 7. assembly complete ≠ send ready.
 * 8. local UI edit state ≠ canonical workspace state.
 */

import type { DispatchDraftEnablementGateV2, DraftEnablementGateStatus, DispatchDraftEntryCandidateV2, DispatchDraftEntryActionGateV2 } from "./dispatch-draft-enablement-gate-v2-engine";
import type { DispatchPreparationHandoffPackageV2, InternalOnlyExcludedFlag } from "./dispatch-preparation-handoff-gate-v2-engine";
import type { PoDraftLineItem } from "./po-conversion-entry-v2-draft-engine";
import type { LaneProvenance } from "./sourcing-result-workbench-v2-triage-engine";

// ══════════════════════════════════════════════
// Workspace Status / Mode
// ══════════════════════════════════════════════

export type DraftWorkspaceStatus = "locked_preview_only" | "entry_enabled" | "assembly_required" | "assembly_in_progress" | "assembly_hold" | "assembly_review_pending" | "assembly_complete_pending_validation";

export type DraftWorkspaceMode = "preview_only" | "assembly_review" | "field_resolution" | "instruction_review" | "completion_pending_validation";

// ══════════════════════════════════════════════
// Section Key / Status
// ══════════════════════════════════════════════

export type DraftAssemblySectionKey = "vendor_recipient_block" | "dispatch_scope_block" | "reference_and_attachment_block" | "instruction_block" | "internal_exclusion_guard" | "draft_completion_gate_review";

export type DraftAssemblySectionStatus = "ready" | "partial" | "warning" | "blocked" | "attention_required" | "reviewed";

// ══════════════════════════════════════════════
// Assembly Section State
// ══════════════════════════════════════════════

export interface DispatchDraftAssemblySectionStateV2 {
  sectionKey: DraftAssemblySectionKey;
  sectionTitle: string;
  sectionStatus: DraftAssemblySectionStatus;
  priorityRank: number;
  assemblyIntent: string;
  whyThisMatters: string;
  requiredSourceInputs: string[];
  resolvedInputs: string[];
  missingInputs: string[];
  warnings: string[];
  operatorActionRequired: string;
  canResolveInPlace: boolean;
  requiresReturnToPreparation: boolean;
  nextBestActionLabel: string;
  derivedFromHandoffSection: string;
  derivedFromReviewResolution: string;
  internalExclusionBasis: string;
  visibilityBasis: string;
}

// ══════════════════════════════════════════════
// Center Canvas State
// ══════════════════════════════════════════════

export interface DraftFieldGroup {
  groupKey: string;
  groupLabel: string;
  sourceMapping: string;
  populated: boolean;
  value: string;
  missing: boolean;
  excluded: boolean;
}

export interface DispatchDraftCenterCanvasStateV2 {
  activeSectionKey: DraftAssemblySectionKey | null;
  decisionQuestion: string;
  assemblyContext: string;
  sourceInputSummary: string;
  missingOrAmbiguousInputs: string[];
  fieldGroups: DraftFieldGroup[];
  riskSummary: string;
  resolutionOptions: string[];
  blockedDownstreamActions: string[];
  completionRuleForSection: string;
}

// ══════════════════════════════════════════════
// Right Rail Preview
// ══════════════════════════════════════════════

export type DraftPreviewMode = "seed_preview" | "locked_preview" | "assembly_preview" | "warning_preview";

export interface DispatchDraftRightRailPreviewStateV2 {
  previewMode: DraftPreviewMode;
  vendorRecipientPreview: { vendorId: string; contactVisible: boolean };
  dispatchScopePreview: { lineCount: number; amountSummary: string };
  referencePreview: { quoteVisible: boolean; poVisible: boolean; attachmentSeedVisible: boolean };
  instructionPreview: { shipToVisible: boolean; billToVisible: boolean; receivingVisible: boolean };
  excludedInternalOnlyPreview: InternalOnlyExcludedFlag[];
  previewCautionSummary: string;
  provenancePreview: { candidateId: string; lane: string }[];
}

// ══════════════════════════════════════════════
// Sticky Dock
// ══════════════════════════════════════════════

export interface DispatchDraftStickyDockStateV2 {
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

export interface DispatchDraftWorkspaceHeaderV2 {
  title: string;
  statusChip: string;
  entryStatusLabel: string;
  entryStatusReason: string;
  draftScopeLabel: string;
  currentGateLabel: string;
  nextGateLabel: string;
  operatorMandate: string;
  lockInterpretation: string;
  sendLockReason: string;
}

// ══════════════════════════════════════════════
// Top-Level Workspace State
// ══════════════════════════════════════════════

export interface DispatchDraftWorkspaceStateV2 {
  workspaceId: string;
  caseId: string;
  handoffPackageId: string;
  reviewSessionId: string;
  draftEnablementGateId: string;
  workspaceStatus: DraftWorkspaceStatus;
  workspaceMode: DraftWorkspaceMode;
  workspaceHeader: DispatchDraftWorkspaceHeaderV2;
  entryLockSummary: string;
  assemblySectionStates: DispatchDraftAssemblySectionStateV2[];
  activeSectionKey: DraftAssemblySectionKey | null;
  centerCanvasState: DispatchDraftCenterCanvasStateV2;
  rightRailPreview: DispatchDraftRightRailPreviewStateV2;
  stickyDock: DispatchDraftStickyDockStateV2;
  operatorFocusOrder: DraftAssemblySectionKey[];
  provenance: { candidateId: string; lane: string }[];
  generatedAt: string;
}

// ══════════════════════════════════════════════
// Section Titles / Intents / Risks
// ══════════════════════════════════════════════

const SECTION_META: Record<DraftAssemblySectionKey, { title: string; intent: string; risk: string }> = {
  vendor_recipient_block: {
    title: "Vendor 수신자 블록",
    intent: "Vendor recipient와 contact reference를 supplier-facing draft에 조립",
    risk: "Vendor contact 오발송 또는 누락 시 dispatch 실패",
  },
  dispatch_scope_block: {
    title: "발송 범위 블록",
    intent: "Dispatch 대상 line / qty / amount를 draft scope으로 조립",
    risk: "Scope 모호 시 supplier confusion 및 배송 착오",
  },
  reference_and_attachment_block: {
    title: "Reference / Attachment 블록",
    intent: "Quote / PO / attachment reference를 vendor-facing draft에 매핑",
    risk: "Reference 누락 시 supplier가 PO 식별 불가, 잘못된 첨부 시 기밀 유출 위험",
  },
  instruction_block: {
    title: "Instruction 블록",
    intent: "Ship-to / receiving / delivery instruction을 supplier-facing draft에 조립",
    risk: "Instruction 누락 시 배송 오류 및 입고 착오",
  },
  internal_exclusion_guard: {
    title: "Internal-Only 제외 확인",
    intent: "Internal memo / budget note / governance note가 supplier-facing draft에 유출되지 않는지 확인",
    risk: "Internal context supplier 유출 시 기밀 및 운영 신뢰도 훼손",
  },
  draft_completion_gate_review: {
    title: "Draft 완결성 확인",
    intent: "모든 조립 블록이 완결되었는지 최종 검토",
    risk: "미완결 draft가 validation gate로 넘어가면 보정 면으로 전락",
  },
};

// ══════════════════════════════════════════════
// Section Derivation
// ══════════════════════════════════════════════

function deriveVendorRecipientSection(pkg: DispatchPreparationHandoffPackageV2): DispatchDraftAssemblySectionStateV2 {
  const resolved: string[] = [];
  const missing: string[] = [];
  if (pkg.createdVendorId) resolved.push("vendorId"); else missing.push("vendorId");
  if (pkg.vendorContactReferenceVisible) resolved.push("contact reference"); else missing.push("contact reference");

  return buildSection("vendor_recipient_block", 1, pkg, resolved, missing, []);
}

function deriveDispatchScopeSection(pkg: DispatchPreparationHandoffPackageV2): DispatchDraftAssemblySectionStateV2 {
  const resolved: string[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];
  if (pkg.createdLineItems.length > 0) resolved.push("lineItems"); else missing.push("lineItems");
  if (pkg.createdAmountSummary) resolved.push("amount"); else warnings.push("amount summary 누락");
  if (pkg.dispatchEligibleScope) resolved.push("scope"); else missing.push("dispatch scope");

  return buildSection("dispatch_scope_block", 2, pkg, resolved, missing, warnings);
}

function deriveReferenceAttachmentSection(pkg: DispatchPreparationHandoffPackageV2): DispatchDraftAssemblySectionStateV2 {
  const resolved: string[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];
  if (pkg.quoteReferenceVisible) resolved.push("quote ref"); else warnings.push("quote reference 비활성");
  if (pkg.poReferenceVisible) resolved.push("PO ref"); else warnings.push("PO reference 비활성");
  if (pkg.attachmentSeedVisible) resolved.push("attachment seed"); else warnings.push("attachment seed 비활성");
  if (pkg.exceptionFlags.includes("stale_quote_reference")) warnings.push("stale quote reference");

  return buildSection("reference_and_attachment_block", 3, pkg, resolved, missing, warnings);
}

function deriveInstructionSection(pkg: DispatchPreparationHandoffPackageV2): DispatchDraftAssemblySectionStateV2 {
  const resolved: string[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];
  if (pkg.shipToVisible) resolved.push("ship-to"); else missing.push("ship-to");
  if (pkg.billToVisible) resolved.push("bill-to"); else warnings.push("bill-to 비활성");
  if (pkg.receivingInstructionVisible) resolved.push("receiving instruction"); else warnings.push("receiving instruction 비활성");

  return buildSection("instruction_block", 4, pkg, resolved, missing, warnings);
}

function deriveInternalExclusionSection(pkg: DispatchPreparationHandoffPackageV2): DispatchDraftAssemblySectionStateV2 {
  const resolved: string[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];

  if (pkg.internalOnlyExcludedFlags.length > 0) {
    resolved.push(`${pkg.internalOnlyExcludedFlags.length}건 internal-only 제외됨`);
  }

  const seedLower = (pkg.supplierFacingNoteSeed || "").toLowerCase();
  if (["budget", "governance", "internal", "approval"].some(kw => seedLower.includes(kw))) {
    missing.push("supplier-facing seed에 internal 키워드 감지 — contamination 위험");
  }

  if (pkg.internalOnlyExcludedFlags.length === 0 && pkg.supplierFacingNoteSeed) {
    warnings.push("Exclusion flag 없이 supplier note seed 존재 — 검토 필요");
  }

  return buildSection("internal_exclusion_guard", 5, pkg, resolved, missing, warnings);
}

function deriveDraftCompletionSection(sections: DispatchDraftAssemblySectionStateV2[]): DispatchDraftAssemblySectionStateV2 {
  const blockedSections = sections.filter(s => s.sectionStatus === "blocked");
  const warningSections = sections.filter(s => s.sectionStatus === "warning" || s.sectionStatus === "attention_required");
  const missing = blockedSections.map(s => `${s.sectionTitle} blocked`);
  const warnings = warningSections.map(s => `${s.sectionTitle} warning`);

  const meta = SECTION_META["draft_completion_gate_review"];
  const status: DraftAssemblySectionStatus = missing.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready";

  return {
    sectionKey: "draft_completion_gate_review",
    sectionTitle: meta.title,
    sectionStatus: status,
    priorityRank: 6,
    assemblyIntent: meta.intent,
    whyThisMatters: meta.risk,
    requiredSourceInputs: ["all prior sections"],
    resolvedInputs: sections.filter(s => s.sectionStatus === "ready" || s.sectionStatus === "reviewed").map(s => s.sectionKey),
    missingInputs: missing,
    warnings,
    operatorActionRequired: missing.length > 0 ? "차단된 section을 해소하세요" : "Draft 완결성 최종 확인",
    canResolveInPlace: false,
    requiresReturnToPreparation: missing.length > 0,
    nextBestActionLabel: missing.length > 0 ? "차단 section 해소" : "Draft 완결성 확인",
    derivedFromHandoffSection: "all",
    derivedFromReviewResolution: "all",
    internalExclusionBasis: "aggregate",
    visibilityBasis: "aggregate",
  };
}

function buildSection(
  key: DraftAssemblySectionKey, rank: number, pkg: DispatchPreparationHandoffPackageV2,
  resolved: string[], missing: string[], warnings: string[],
): DispatchDraftAssemblySectionStateV2 {
  const meta = SECTION_META[key];
  const status: DraftAssemblySectionStatus = missing.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready";

  return {
    sectionKey: key,
    sectionTitle: meta.title,
    sectionStatus: status,
    priorityRank: rank,
    assemblyIntent: meta.intent,
    whyThisMatters: meta.risk,
    requiredSourceInputs: [...resolved, ...missing],
    resolvedInputs: resolved,
    missingInputs: missing,
    warnings,
    operatorActionRequired: missing.length > 0 ? `${meta.title} 누락 항목 해소 필요` : warnings.length > 0 ? `${meta.title} 주의 항목 검토` : `${meta.title} 검토 가능`,
    canResolveInPlace: missing.length === 0,
    requiresReturnToPreparation: missing.length > 0,
    nextBestActionLabel: missing.length > 0 ? `${meta.title} 누락 해소` : `${meta.title} 검토 진행`,
    derivedFromHandoffSection: key,
    derivedFromReviewResolution: key,
    internalExclusionBasis: key === "internal_exclusion_guard" ? "direct" : "inherited",
    visibilityBasis: key === "reference_and_attachment_block" ? "direct" : "inherited",
  };
}

// ══════════════════════════════════════════════
// Header / Dock / Rail Derivation
// ══════════════════════════════════════════════

function deriveHeader(gate: DispatchDraftEnablementGateV2, status: DraftWorkspaceStatus, sections: DispatchDraftAssemblySectionStateV2[]): DispatchDraftWorkspaceHeaderV2 {
  const isLocked = status === "locked_preview_only";
  const isComplete = status === "assembly_complete_pending_validation";
  const hasBlocker = sections.some(s => s.sectionStatus === "blocked");

  const mandate = isLocked ? "Workspace는 preview only 상태입니다. Entry 조건을 확인하세요."
    : hasBlocker ? "조립 블록의 누락 항목을 해소하세요"
    : isComplete ? "Draft 조립 검토가 완료되었습니다. Validation gate를 기다리세요."
    : "Vendor-facing dispatch payload를 조립/검토하세요";

  return {
    title: `Dispatch Draft Workspace — ${gate.caseId}`,
    statusChip: isLocked ? "Preview Only" : isComplete ? "조립 완료 — Validation 대기" : hasBlocker ? "차단됨" : "조립 진행 가능",
    entryStatusLabel: isLocked ? "Entry Locked" : "Entry Enabled",
    entryStatusReason: isLocked ? gate.entryCandidate.candidateReason : "Draft assembly 가능",
    draftScopeLabel: `${gate.entryCandidate.requiredResolutionSnapshot}`,
    currentGateLabel: "Dispatch Draft Workspace",
    nextGateLabel: "Draft Validation / Send Confirmation Gate (Locked — Batch 1)",
    operatorMandate: mandate,
    lockInterpretation: isComplete ? "Assembly review complete — validation/send는 아직 범위 밖" : isLocked ? "Entry gate 조건 미충족" : "Assembly 진행 가능",
    sendLockReason: "Batch 1: Final vendor draft 생성, supplier 발송, dispatched 처리는 현재 범위 밖입니다",
  };
}

function deriveDock(status: DraftWorkspaceStatus, sections: DispatchDraftAssemblySectionStateV2[]): DispatchDraftStickyDockStateV2 {
  const isLocked = status === "locked_preview_only";
  const isComplete = status === "assembly_complete_pending_validation";
  const hasBlocker = sections.some(s => s.sectionStatus === "blocked");

  const primary = isLocked
    ? { label: "Preview Only — Entry 조건 확인 필요", enabled: false, reason: "Entry gate locked" }
    : isComplete
    ? { label: "조립 검토 완료 — Validation 대기", enabled: false, reason: "다음 gate 활성화 대기 중" }
    : hasBlocker
    ? { label: "차단 원인 해소", enabled: true, reason: "" }
    : { label: "Draft 조립 검토 계속", enabled: true, reason: "" };

  return {
    primaryAction: primary,
    secondaryActions: [
      { label: "Preparation Review로 복귀", enabled: true, reason: "" },
      { label: "Section 검토 완료 처리", enabled: !isLocked && !hasBlocker, reason: hasBlocker ? "Blocker 해소 필요" : "" },
      { label: "Hold 전환", enabled: true, reason: "" },
    ],
    disabledActions: [
      { label: "Final Vendor Draft 생성", reason: "Batch 1 범위 밖" },
      { label: "Supplier 발송", reason: "Batch 1 범위 밖" },
      { label: "Dispatched 처리", reason: "Batch 1 범위 밖" },
      { label: "Attachment 최종 확정", reason: "Batch 1 범위 밖" },
    ],
    blockedActionReasons: {
      generate_final_vendor_dispatch_draft: "Batch 1 정책: vendor draft 생성 금지",
      send_to_supplier: "Batch 1 정책: supplier 발송 금지",
      mark_dispatched: "Batch 1 정책: dispatched 처리 금지",
      finalize_attachment_send_package: "Batch 1 정책: attachment 최종 확정 금지",
    },
    requiredResolutionBeforeProgress: hasBlocker ? sections.find(s => s.sectionStatus === "blocked")?.sectionTitle ?? null : null,
    workspaceCompletionLabel: isComplete ? "Draft assembly review 완료 — validation 대기" : "Draft assembly 진행 중",
    nextGateLockLabel: "Draft Validation / Send Confirmation Gate — Batch 1 locked",
  };
}

function deriveRailPreview(pkg: DispatchPreparationHandoffPackageV2, status: DraftWorkspaceStatus): DispatchDraftRightRailPreviewStateV2 {
  const mode: DraftPreviewMode = status === "locked_preview_only" ? "locked_preview"
    : status === "assembly_complete_pending_validation" ? "assembly_preview"
    : "seed_preview";

  const cautions: string[] = [];
  if (!pkg.vendorContactReferenceVisible) cautions.push("Vendor contact 비활성");
  if (!pkg.quoteReferenceVisible && !pkg.poReferenceVisible) cautions.push("Quote/PO reference 모두 비활성");
  if (pkg.internalOnlyExcludedFlags.length > 0) cautions.push(`${pkg.internalOnlyExcludedFlags.length}건 internal-only 제외`);
  if (!pkg.shipToVisible) cautions.push("Ship-to 비활성");

  return {
    previewMode: mode,
    vendorRecipientPreview: { vendorId: pkg.createdVendorId, contactVisible: pkg.vendorContactReferenceVisible },
    dispatchScopePreview: { lineCount: pkg.createdLineItems.length, amountSummary: pkg.createdAmountSummary },
    referencePreview: { quoteVisible: pkg.quoteReferenceVisible, poVisible: pkg.poReferenceVisible, attachmentSeedVisible: pkg.attachmentSeedVisible },
    instructionPreview: { shipToVisible: pkg.shipToVisible, billToVisible: pkg.billToVisible, receivingVisible: pkg.receivingInstructionVisible },
    excludedInternalOnlyPreview: pkg.internalOnlyExcludedFlags,
    previewCautionSummary: cautions.length > 0 ? cautions.join("; ") : "Visibility 이슈 없음",
    provenancePreview: pkg.provenanceByLine.map(p => ({ candidateId: p.candidateId, lane: p.originalLane })),
  };
}

function deriveCenterCanvas(sections: DispatchDraftAssemblySectionStateV2[], focusOrder: DraftAssemblySectionKey[]): DispatchDraftCenterCanvasStateV2 {
  const activeKey = focusOrder.length > 0 ? focusOrder[0] : null;
  const active = activeKey ? sections.find(s => s.sectionKey === activeKey) : null;

  const QUESTIONS: Record<DraftAssemblySectionKey, string> = {
    vendor_recipient_block: "Vendor 수신자 블록이 supplier-facing dispatch draft에 충분합니까?",
    dispatch_scope_block: "발송 대상 범위가 draft scope으로 명확하게 조립되었습니까?",
    reference_and_attachment_block: "Reference와 attachment seed가 vendor-facing draft에 적절히 매핑되었습니까?",
    instruction_block: "Ship-to / receiving instruction이 internal context 유출 없이 전달 가능합니까?",
    internal_exclusion_guard: "Internal-only 문맥이 supplier-facing draft에서 완전히 제외되었습니까?",
    draft_completion_gate_review: "모든 조립 블록이 완결되어 validation gate로 넘길 준비가 되었습니까?",
  };

  if (!active) {
    return {
      activeSectionKey: null, decisionQuestion: "", assemblyContext: "", sourceInputSummary: "",
      missingOrAmbiguousInputs: [], fieldGroups: [], riskSummary: "", resolutionOptions: [],
      blockedDownstreamActions: ["generate_final_vendor_dispatch_draft", "send_to_supplier", "mark_dispatched"],
      completionRuleForSection: "",
    };
  }

  const fieldGroups: DraftFieldGroup[] = active.requiredSourceInputs.map(input => ({
    groupKey: input, groupLabel: input, sourceMapping: active.derivedFromHandoffSection,
    populated: active.resolvedInputs.includes(input), value: active.resolvedInputs.includes(input) ? "resolved" : "",
    missing: active.missingInputs.includes(input), excluded: false,
  }));

  return {
    activeSectionKey: activeKey,
    decisionQuestion: QUESTIONS[activeKey!] || "",
    assemblyContext: active.assemblyIntent,
    sourceInputSummary: `${active.resolvedInputs.length} resolved / ${active.missingInputs.length} missing`,
    missingOrAmbiguousInputs: [...active.missingInputs, ...active.warnings],
    fieldGroups,
    riskSummary: active.whyThisMatters,
    resolutionOptions: active.canResolveInPlace ? ["현재 workspace에서 해결 가능"] : ["Preparation review로 복귀 필요"],
    blockedDownstreamActions: ["generate_final_vendor_dispatch_draft", "send_to_supplier", "mark_dispatched"],
    completionRuleForSection: active.missingInputs.length > 0 ? "누락 항목 해소 후 reviewed 가능" : "즉시 reviewed 가능",
  };
}

// ══════════════════════════════════════════════
// Status / Mode / Focus Derivation
// ══════════════════════════════════════════════

function deriveWorkspaceStatus(gate: DispatchDraftEnablementGateV2, sections: DispatchDraftAssemblySectionStateV2[]): DraftWorkspaceStatus {
  if (gate.gateStatus !== "eligible_for_draft_entry" && gate.gateStatus !== "draft_entry_opened") return "locked_preview_only";
  const hasBlocker = sections.some(s => s.sectionStatus === "blocked");
  const hasWarning = sections.some(s => s.sectionStatus === "warning" || s.sectionStatus === "attention_required");
  const allReady = sections.every(s => s.sectionStatus === "ready" || s.sectionStatus === "reviewed");
  if (allReady) return "assembly_complete_pending_validation";
  if (hasBlocker) return "assembly_required";
  if (hasWarning) return "assembly_in_progress";
  return "entry_enabled";
}

function deriveWorkspaceMode(status: DraftWorkspaceStatus): DraftWorkspaceMode {
  switch (status) {
    case "locked_preview_only": return "preview_only";
    case "entry_enabled": case "assembly_required": return "assembly_review";
    case "assembly_in_progress": return "field_resolution";
    case "assembly_hold": return "assembly_review";
    case "assembly_review_pending": return "instruction_review";
    case "assembly_complete_pending_validation": return "completion_pending_validation";
  }
}

const FOCUS_PRIORITY: DraftAssemblySectionKey[] = [
  "vendor_recipient_block", "dispatch_scope_block", "reference_and_attachment_block",
  "instruction_block", "internal_exclusion_guard", "draft_completion_gate_review",
];

function deriveFocusOrder(sections: DispatchDraftAssemblySectionStateV2[]): DraftAssemblySectionKey[] {
  const blocked = FOCUS_PRIORITY.filter(k => sections.find(s => s.sectionKey === k)?.sectionStatus === "blocked");
  const warning = FOCUS_PRIORITY.filter(k => { const s = sections.find(sec => sec.sectionKey === k); return s && (s.sectionStatus === "warning" || s.sectionStatus === "attention_required") && !blocked.includes(k); });
  const rest = FOCUS_PRIORITY.filter(k => !blocked.includes(k) && !warning.includes(k));
  return [...blocked, ...warning, ...rest];
}

// ══════════════════════════════════════════════
// Main Builder
// ══════════════════════════════════════════════

export function buildDispatchDraftWorkspaceStateV2(
  gate: DispatchDraftEnablementGateV2,
  pkg: DispatchPreparationHandoffPackageV2,
): DispatchDraftWorkspaceStateV2 {
  const baseSections = [
    deriveVendorRecipientSection(pkg),
    deriveDispatchScopeSection(pkg),
    deriveReferenceAttachmentSection(pkg),
    deriveInstructionSection(pkg),
    deriveInternalExclusionSection(pkg),
  ];
  const completionSection = deriveDraftCompletionSection(baseSections);
  const sections = [...baseSections, completionSection];

  const status = deriveWorkspaceStatus(gate, sections);
  const mode = deriveWorkspaceMode(status);
  const focusOrder = deriveFocusOrder(sections);
  const header = deriveHeader(gate, status, sections);
  const dock = deriveDock(status, sections);
  const rail = deriveRailPreview(pkg, status);
  const center = deriveCenterCanvas(sections, focusOrder);

  const entryLock = status === "locked_preview_only"
    ? `Entry locked: ${gate.entryCandidate.candidateReason}`
    : "Entry enabled";

  return {
    workspaceId: `dftws_${Date.now().toString(36)}`,
    caseId: gate.caseId,
    handoffPackageId: gate.handoffPackageId,
    reviewSessionId: gate.reviewSessionId,
    draftEnablementGateId: gate.draftEnablementGateId,
    workspaceStatus: status,
    workspaceMode: mode,
    workspaceHeader: header,
    entryLockSummary: entryLock,
    assemblySectionStates: sections,
    activeSectionKey: focusOrder[0] || null,
    centerCanvasState: center,
    rightRailPreview: rail,
    stickyDock: dock,
    operatorFocusOrder: focusOrder,
    provenance: pkg.provenanceByLine.map(p => ({ candidateId: p.candidateId, lane: p.originalLane })),
    generatedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════
// Activity Events
// ══════════════════════════════════════════════

export type DraftWorkspaceEventType =
  | "dispatch_draft_workspace_state_computed"
  | "dispatch_draft_workspace_opened_preview_only"
  | "dispatch_draft_workspace_entry_enabled"
  | "dispatch_draft_workspace_section_focused"
  | "dispatch_draft_workspace_section_review_started"
  | "dispatch_draft_workspace_marked_in_progress"
  | "dispatch_draft_workspace_marked_complete_pending_validation";

export interface DraftWorkspaceEvent {
  type: DraftWorkspaceEventType;
  caseId: string;
  handoffPackageId: string;
  reviewSessionId: string;
  draftEnablementGateId: string;
  workspaceId: string;
  sectionKeyIfAny: DraftAssemblySectionKey | null;
  reason: string;
  actorOrSystem: string;
  timestamp: string;
}

export function createDraftWorkspaceEvent(
  type: DraftWorkspaceEventType,
  ws: DispatchDraftWorkspaceStateV2,
  sectionKey: DraftAssemblySectionKey | null,
  reason: string,
  actor: string,
): DraftWorkspaceEvent {
  return {
    type, caseId: ws.caseId, handoffPackageId: ws.handoffPackageId, reviewSessionId: ws.reviewSessionId,
    draftEnablementGateId: ws.draftEnablementGateId, workspaceId: ws.workspaceId,
    sectionKeyIfAny: sectionKey, reason, actorOrSystem: actor, timestamp: new Date().toISOString(),
  };
}
