/**
 * Send Execution Workspace v2 — canonical control workbench surface contract
 *
 * 고정 규칙:
 * 1. SendExecutionGateV2 + upstream truths = 입력 source.
 * 2. preview only / entry enabled / execution in progress / execution ready 분리.
 * 3. center = execution decision canvas, rail = supplier-facing preview, dock = action gate.
 * 4. actual send 직전 확인 단위가 section state로 명확 정의.
 * 5. payload integrity / exclusion guard / audit readiness는 독립 확인 축.
 * 6. Batch 1: execute_supplier_send / mark_dispatched 금지.
 * 7. execution ready ≠ dispatched.
 * 8. local UI state ≠ canonical workspace state.
 */

import type { SendExecutionGateV2, SendExecutionGateStatus, SendExecutionEntryCandidateV2 } from "./send-execution-gate-v2-engine";
import type { DispatchPreparationHandoffPackageV2, InternalOnlyExcludedFlag } from "./dispatch-preparation-handoff-gate-v2-engine";
import type { LaneProvenance } from "./sourcing-result-workbench-v2-triage-engine";

// ── Status / Mode ──
export type SendExecWorkspaceStatus = "locked_preview_only" | "entry_enabled" | "execution_required" | "execution_in_progress" | "execution_hold" | "execution_review_pending" | "execution_ready_pending_actual_send";
export type SendExecWorkspaceMode = "preview_only" | "execution_review" | "final_readiness_resolution" | "policy_review" | "ready_pending_actual_send";

// ── Section Key / Status ──
export type SendExecSectionKey = "recipient_execution_block" | "payload_integrity_execution_block" | "reference_instruction_execution_block" | "exclusion_guard_execution_block" | "execution_audit_readiness_block" | "execution_completion_gate_review";
export type SendExecSectionStatus = "ready" | "partial" | "warning" | "blocked" | "attention_required" | "reviewed";

// ── Check Section ──
export interface SendExecutionCheckSectionStateV2 {
  sectionKey: SendExecSectionKey; sectionTitle: string; sectionStatus: SendExecSectionStatus; priorityRank: number;
  executionIntent: string; whyThisMatters: string;
  requiredExecutionInputs: string[]; resolvedInputs: string[]; unresolvedOrAmbiguousInputs: string[]; warnings: string[];
  operatorActionRequired: string; canResolveInPlace: boolean; requiresReturnToSendConfirmation: boolean; requiresReturnToValidationOrDraftIfAny: boolean;
  nextBestActionLabel: string; derivedFromConfirmationResolution: string; payloadIntegrityBasis: string; exclusionGuardBasis: string; auditReadinessBasis: string;
}

// ── Center Canvas ──
export interface ExecFieldGroup { groupKey: string; groupLabel: string; sourceMapping: string; resolved: boolean; value: string; unresolved: boolean; excluded: boolean; }
export interface SendExecutionCenterCanvasStateV2 { activeSectionKey: SendExecSectionKey | null; decisionQuestion: string; executionContext: string; sourceInputSummary: string; unresolvedOrConflictingInputs: string[]; fieldGroups: ExecFieldGroup[]; riskSummary: string; resolutionOptions: string[]; blockedDownstreamActions: string[]; completionRuleForSection: string; }

// ── Right Rail Preview ──
export type ExecPreviewMode = "locked_preview" | "execution_candidate_preview" | "warning_preview" | "review_preview";
export interface SendExecutionRightRailPreviewStateV2 { previewMode: ExecPreviewMode; recipientPreview: { vendorId: string; contactVisible: boolean }; payloadIntegrityPreview: { lineCount: number; amountSummary: string; scopeIntact: boolean }; referenceInstructionPreview: { quoteVisible: boolean; poVisible: boolean; shipToVisible: boolean; receivingVisible: boolean }; excludedInternalOnlyPreview: InternalOnlyExcludedFlag[]; executionAuditPreview: { provenanceComplete: boolean; lineageIntact: boolean }; previewCautionSummary: string; provenancePreview: { candidateId: string; lane: string }[]; }

// ── Sticky Dock ──
export interface SendExecutionStickyDockStateV2 { primaryAction: { label: string; enabled: boolean; reason: string }; secondaryActions: { label: string; enabled: boolean; reason: string }[]; disabledActions: { label: string; reason: string }[]; blockedActionReasons: Record<string, string>; requiredResolutionBeforeProgress: string | null; workspaceCompletionLabel: string; actualSendLockLabel: string; }

// ── Workspace Header ──
export interface SendExecutionWorkspaceHeaderV2 { title: string; statusChip: string; entryStatusLabel: string; entryStatusReason: string; executionScopeLabel: string; currentGateLabel: string; nextGateLabel: string; operatorMandate: string; lockInterpretation: string; actualSendLockReason: string; }

// ── Top-Level State ──
export interface SendExecutionWorkspaceStateV2 {
  workspaceId: string; caseId: string; handoffPackageId: string; confirmationSessionId: string; sendExecutionGateId: string;
  workspaceStatus: SendExecWorkspaceStatus; workspaceMode: SendExecWorkspaceMode;
  workspaceHeader: SendExecutionWorkspaceHeaderV2; entryLockSummary: string;
  checkSectionStates: SendExecutionCheckSectionStateV2[]; activeSectionKey: SendExecSectionKey | null;
  centerCanvasState: SendExecutionCenterCanvasStateV2; rightRailPreview: SendExecutionRightRailPreviewStateV2; stickyDock: SendExecutionStickyDockStateV2;
  operatorFocusOrder: SendExecSectionKey[]; provenance: { candidateId: string; lane: string }[]; generatedAt: string;
}

// ── Section Meta ──
const META: Record<SendExecSectionKey, { title: string; intent: string; risk: string; question: string }> = {
  recipient_execution_block: { title: "수신자 실행 확인", intent: "Supplier recipient/contact가 actual send 직전까지 확정적으로 확인됨", risk: "수신자 오류 시 오발송 및 운영 사고", question: "Supplier 수신자가 actual send 준비에 모호함 없이 확정되었습니까?" },
  payload_integrity_execution_block: { title: "Payload Integrity 확인", intent: "Supplier-facing payload가 validated/confirmed source와 정합성을 유지하는지 확인", risk: "Payload 불일치 시 공급사 confusion 및 주문 착오", question: "Supplier-facing payload가 confirmed source basis와 정합적입니까?" },
  reference_instruction_execution_block: { title: "Reference / Instruction 확인", intent: "Reference / instruction visibility가 execution 직전까지 정합적인지 확인", risk: "Reference mismatch 또는 instruction 누락 시 배송/입고 착오", question: "Reference와 instruction이 supplier-facing payload와 정합적입니까?" },
  exclusion_guard_execution_block: { title: "Exclusion Guard 최종 확인", intent: "Internal-only 문맥이 actual send payload에서 완전히 제외되었는지 최종 확인", risk: "Internal context 유출 시 기밀 및 운영 신뢰도 훼손", question: "Internal-only 문맥이 actual send payload에서 완전히 제외되었습니까?" },
  execution_audit_readiness_block: { title: "실행 Audit 준비 확인", intent: "Actual send 전 추적/증적 관점에서 lineage와 provenance가 확인됨", risk: "Audit gap 시 발송 사후 추적 불가", question: "Lineage와 provenance가 actual send audit에 충분합니까?" },
  execution_completion_gate_review: { title: "실행 완결성 확인", intent: "모든 execution block이 완결되었는지 최종 검토", risk: "미확인 상태로 actual send로 넘어가면 복구 불가", question: "모든 execution block이 완결되어 actual send 준비가 되었습니까?" },
};

// ── Section Builder ──
function buildExecSection(key: SendExecSectionKey, rank: number, pkg: DispatchPreparationHandoffPackageV2, resolved: string[], unresolved: string[], warnings: string[]): SendExecutionCheckSectionStateV2 {
  const m = META[key]; const status: SendExecSectionStatus = unresolved.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready";
  return { sectionKey: key, sectionTitle: m.title, sectionStatus: status, priorityRank: rank, executionIntent: m.intent, whyThisMatters: m.risk, requiredExecutionInputs: [...resolved, ...unresolved], resolvedInputs: resolved, unresolvedOrAmbiguousInputs: unresolved, warnings, operatorActionRequired: unresolved.length > 0 ? `${m.title} 미확인 해소 필요` : warnings.length > 0 ? `${m.title} 주의 검토` : `${m.title} 확인 가능`, canResolveInPlace: unresolved.length === 0, requiresReturnToSendConfirmation: unresolved.length > 0, requiresReturnToValidationOrDraftIfAny: false, nextBestActionLabel: unresolved.length > 0 ? `${m.title} 해소` : `${m.title} 확인`, derivedFromConfirmationResolution: key, payloadIntegrityBasis: key === "payload_integrity_execution_block" ? "direct" : "inherited", exclusionGuardBasis: key === "exclusion_guard_execution_block" ? "direct" : "inherited", auditReadinessBasis: key === "execution_audit_readiness_block" ? "direct" : "inherited" };
}

function deriveSections(pkg: DispatchPreparationHandoffPackageV2): SendExecutionCheckSectionStateV2[] {
  const secs: SendExecutionCheckSectionStateV2[] = [];
  // Recipient
  const rR: string[] = []; const rU: string[] = [];
  if (pkg.createdVendorId) rR.push("vendorId"); else rU.push("vendorId");
  if (pkg.vendorContactReferenceVisible) rR.push("contact"); else rU.push("contact");
  secs.push(buildExecSection("recipient_execution_block", 1, pkg, rR, rU, []));
  // Payload integrity
  const pR: string[] = []; const pU: string[] = []; const pW: string[] = [];
  if (pkg.createdLineItems.length > 0) pR.push("lineItems"); else pU.push("lineItems");
  if (pkg.createdAmountSummary) pR.push("amount"); else pW.push("amount 누락");
  if (pkg.dispatchEligibleScope) pR.push("scope"); else pU.push("scope");
  secs.push(buildExecSection("payload_integrity_execution_block", 2, pkg, pR, pU, pW));
  // Reference/instruction
  const refR: string[] = []; const refU: string[] = []; const refW: string[] = [];
  if (pkg.quoteReferenceVisible) refR.push("quote"); else refW.push("quote ref 비활성");
  if (pkg.poReferenceVisible) refR.push("PO"); else refW.push("PO ref 비활성");
  if (pkg.shipToVisible) refR.push("ship-to"); else refU.push("ship-to");
  if (pkg.receivingInstructionVisible) refR.push("receiving"); else refW.push("receiving 비활성");
  secs.push(buildExecSection("reference_instruction_execution_block", 3, pkg, refR, refU, refW));
  // Exclusion guard
  const eR: string[] = []; const eU: string[] = []; const eW: string[] = [];
  if (pkg.internalOnlyExcludedFlags.length > 0) eR.push(`${pkg.internalOnlyExcludedFlags.length}건 제외`);
  const seedLower = (pkg.supplierFacingNoteSeed || "").toLowerCase();
  if (["budget", "governance", "internal", "approval"].some(kw => seedLower.includes(kw))) eU.push("contamination risk");
  if (pkg.internalOnlyExcludedFlags.length === 0 && pkg.supplierFacingNoteSeed) eW.push("exclusion flag 없이 note seed 존재");
  secs.push(buildExecSection("exclusion_guard_execution_block", 4, pkg, eR, eU, eW));
  // Audit readiness
  const aR: string[] = ["provenance", "lineage"]; const aW: string[] = [];
  if (pkg.provenanceByLine.length === 0) aW.push("provenance 누락");
  secs.push(buildExecSection("execution_audit_readiness_block", 5, pkg, aR, [], aW));
  // Completion gate
  const blocked = secs.filter(s => s.sectionStatus === "blocked"); const warned = secs.filter(s => s.sectionStatus === "warning");
  secs.push(buildExecSection("execution_completion_gate_review", 6, pkg, secs.filter(s => s.sectionStatus === "ready" || s.sectionStatus === "reviewed").map(s => s.sectionKey), blocked.map(s => `${s.sectionTitle} blocked`), warned.map(s => `${s.sectionTitle} warning`)));
  return secs;
}

// ── Derivation ──
function deriveStatus(gate: SendExecutionGateV2, secs: SendExecutionCheckSectionStateV2[]): SendExecWorkspaceStatus {
  if (gate.gateStatus !== "eligible_for_send_execution_entry" && gate.gateStatus !== "send_execution_entry_opened") return "locked_preview_only";
  const hasB = secs.some(s => s.sectionStatus === "blocked"); const hasW = secs.some(s => s.sectionStatus === "warning" || s.sectionStatus === "attention_required"); const allDone = secs.every(s => s.sectionStatus === "ready" || s.sectionStatus === "reviewed");
  if (allDone) return "execution_ready_pending_actual_send"; if (hasB) return "execution_required"; if (hasW) return "execution_in_progress"; return "entry_enabled";
}
function deriveMode(s: SendExecWorkspaceStatus): SendExecWorkspaceMode { switch (s) { case "locked_preview_only": return "preview_only"; case "entry_enabled": case "execution_required": return "execution_review"; case "execution_in_progress": return "final_readiness_resolution"; case "execution_hold": return "policy_review"; case "execution_review_pending": return "execution_review"; case "execution_ready_pending_actual_send": return "ready_pending_actual_send"; } }

const FOCUS: SendExecSectionKey[] = ["recipient_execution_block", "payload_integrity_execution_block", "reference_instruction_execution_block", "exclusion_guard_execution_block", "execution_audit_readiness_block", "execution_completion_gate_review"];
function deriveFocus(secs: SendExecutionCheckSectionStateV2[]): SendExecSectionKey[] { const b = FOCUS.filter(k => secs.find(s => s.sectionKey === k)?.sectionStatus === "blocked"); const w = FOCUS.filter(k => { const s = secs.find(x => x.sectionKey === k); return s && (s.sectionStatus === "warning" || s.sectionStatus === "attention_required") && !b.includes(k); }); const r = FOCUS.filter(k => !b.includes(k) && !w.includes(k)); return [...b, ...w, ...r]; }

function deriveHeader(gate: SendExecutionGateV2, status: SendExecWorkspaceStatus, secs: SendExecutionCheckSectionStateV2[]): SendExecutionWorkspaceHeaderV2 {
  const isLocked = status === "locked_preview_only"; const isReady = status === "execution_ready_pending_actual_send"; const hasB = secs.some(s => s.sectionStatus === "blocked");
  const mandate = isLocked ? "Preview only 상태입니다." : hasB ? "실행 전 미확인 항목을 해소하세요" : isReady ? "실행 준비 완료 — actual send action 활성화를 기다리세요." : "Actual send 직전 각 항목을 확인하세요";
  return { title: `Send Execution — ${gate.caseId}`, statusChip: isLocked ? "Preview Only" : isReady ? "실행 준비 — Send 대기" : hasB ? "차단됨" : "실행 검토 가능", entryStatusLabel: isLocked ? "Entry Locked" : "Entry Enabled", entryStatusReason: isLocked ? gate.entryCandidate.candidateReason : "Execution 가능", executionScopeLabel: gate.entryCandidate.supplierPayloadIntegritySnapshot, currentGateLabel: "Send Execution Workspace", nextGateLabel: "Actual Supplier Send Action (Locked — Batch 1)", operatorMandate: mandate, lockInterpretation: isReady ? "Execution review complete — actual send는 아직 범위 밖" : isLocked ? "Entry gate 조건 미충족" : "Execution 진행 가능", actualSendLockReason: "Batch 1: Supplier 발송 실행, dispatched 처리는 현재 범위 밖입니다" };
}

function deriveDock(status: SendExecWorkspaceStatus, secs: SendExecutionCheckSectionStateV2[]): SendExecutionStickyDockStateV2 {
  const isLocked = status === "locked_preview_only"; const isReady = status === "execution_ready_pending_actual_send"; const hasB = secs.some(s => s.sectionStatus === "blocked");
  const primary = isLocked ? { label: "Preview Only", enabled: false, reason: "Entry locked" } : isReady ? { label: "실행 준비 완료 — Send 대기", enabled: false, reason: "Actual send 활성화 대기" } : hasB ? { label: "미확인 해소", enabled: true, reason: "" } : { label: "Execution 검토 계속", enabled: true, reason: "" };
  return { primaryAction: primary, secondaryActions: [{ label: "Send Confirmation으로 복귀", enabled: true, reason: "" }, { label: "Hold 전환", enabled: true, reason: "" }, { label: "Section 확인 완료", enabled: !isLocked && !hasB, reason: hasB ? "Blocker 해소 필요" : "" }], disabledActions: [{ label: "Supplier 발송 실행", reason: "Batch 1 범위 밖" }, { label: "Dispatched 처리", reason: "Batch 1 범위 밖" }, { label: "Transport Payload Freeze", reason: "Batch 1 범위 밖" }, { label: "Delivery Tracking 생성", reason: "Batch 1 범위 밖" }], blockedActionReasons: { execute_supplier_send: "Batch 1 금지", mark_dispatched: "Batch 1 금지", freeze_final_transport_payload: "Batch 1 금지", create_delivery_tracking_record: "Batch 1 금지" }, requiredResolutionBeforeProgress: hasB ? secs.find(s => s.sectionStatus === "blocked")?.sectionTitle ?? null : null, workspaceCompletionLabel: isReady ? "Execution review 완료 — actual send 대기" : "Execution review 진행 중", actualSendLockLabel: "Actual Supplier Send — Batch 1 locked" };
}

function deriveRail(pkg: DispatchPreparationHandoffPackageV2, status: SendExecWorkspaceStatus): SendExecutionRightRailPreviewStateV2 {
  const mode: ExecPreviewMode = status === "locked_preview_only" ? "locked_preview" : status === "execution_ready_pending_actual_send" ? "execution_candidate_preview" : "review_preview";
  const cautions: string[] = [];
  if (!pkg.vendorContactReferenceVisible) cautions.push("Vendor contact 비활성");
  if (!pkg.quoteReferenceVisible && !pkg.poReferenceVisible) cautions.push("Quote/PO ref 모두 비활성");
  if (pkg.internalOnlyExcludedFlags.length > 0) cautions.push(`${pkg.internalOnlyExcludedFlags.length}건 internal-only 제외`);
  if (!pkg.shipToVisible) cautions.push("Ship-to 비활성");
  return { previewMode: mode, recipientPreview: { vendorId: pkg.createdVendorId, contactVisible: pkg.vendorContactReferenceVisible }, payloadIntegrityPreview: { lineCount: pkg.createdLineItems.length, amountSummary: pkg.createdAmountSummary, scopeIntact: !!pkg.dispatchEligibleScope }, referenceInstructionPreview: { quoteVisible: pkg.quoteReferenceVisible, poVisible: pkg.poReferenceVisible, shipToVisible: pkg.shipToVisible, receivingVisible: pkg.receivingInstructionVisible }, excludedInternalOnlyPreview: pkg.internalOnlyExcludedFlags, executionAuditPreview: { provenanceComplete: pkg.provenanceByLine.length > 0, lineageIntact: true }, previewCautionSummary: cautions.length > 0 ? cautions.join("; ") : "이슈 없음", provenancePreview: pkg.provenanceByLine.map(p => ({ candidateId: p.candidateId, lane: p.originalLane })) };
}

function deriveCenter(secs: SendExecutionCheckSectionStateV2[], focus: SendExecSectionKey[]): SendExecutionCenterCanvasStateV2 {
  const ak = focus[0] || null; const active = ak ? secs.find(s => s.sectionKey === ak) : null;
  if (!active) return { activeSectionKey: null, decisionQuestion: "", executionContext: "", sourceInputSummary: "", unresolvedOrConflictingInputs: [], fieldGroups: [], riskSummary: "", resolutionOptions: [], blockedDownstreamActions: ["execute_supplier_send", "mark_dispatched"], completionRuleForSection: "" };
  const m = META[ak!]; const fg: ExecFieldGroup[] = active.requiredExecutionInputs.map(i => ({ groupKey: i, groupLabel: i, sourceMapping: active.derivedFromConfirmationResolution, resolved: active.resolvedInputs.includes(i), value: active.resolvedInputs.includes(i) ? "resolved" : "", unresolved: active.unresolvedOrAmbiguousInputs.includes(i), excluded: false }));
  return { activeSectionKey: ak, decisionQuestion: m.question, executionContext: active.executionIntent, sourceInputSummary: `${active.resolvedInputs.length} resolved / ${active.unresolvedOrAmbiguousInputs.length} unresolved`, unresolvedOrConflictingInputs: [...active.unresolvedOrAmbiguousInputs, ...active.warnings], fieldGroups: fg, riskSummary: m.risk, resolutionOptions: active.canResolveInPlace ? ["현재 workspace에서 확인 가능"] : ["Send confirmation으로 복귀 필요"], blockedDownstreamActions: ["execute_supplier_send", "mark_dispatched"], completionRuleForSection: active.unresolvedOrAmbiguousInputs.length > 0 ? "미확인 해소 후 reviewed 가능" : "즉시 reviewed 가능" };
}

// ── Main Builder ──
export function buildSendExecutionWorkspaceStateV2(gate: SendExecutionGateV2, pkg: DispatchPreparationHandoffPackageV2): SendExecutionWorkspaceStateV2 {
  const secs = deriveSections(pkg); const status = deriveStatus(gate, secs); const mode = deriveMode(status); const focus = deriveFocus(secs);
  return { workspaceId: `sndexws_${Date.now().toString(36)}`, caseId: gate.caseId, handoffPackageId: gate.handoffPackageId, confirmationSessionId: gate.confirmationSessionId, sendExecutionGateId: gate.sendExecutionGateId, workspaceStatus: status, workspaceMode: mode, workspaceHeader: deriveHeader(gate, status, secs), entryLockSummary: status === "locked_preview_only" ? `Entry locked: ${gate.entryCandidate.candidateReason}` : "Entry enabled", checkSectionStates: secs, activeSectionKey: focus[0] || null, centerCanvasState: deriveCenter(secs, focus), rightRailPreview: deriveRail(pkg, status), stickyDock: deriveDock(status, secs), operatorFocusOrder: focus, provenance: pkg.provenanceByLine.map(p => ({ candidateId: p.candidateId, lane: p.originalLane })), generatedAt: new Date().toISOString() };
}

// ── Events ──
export type SendExecWorkspaceEventType = "send_execution_workspace_state_computed" | "send_execution_workspace_opened_preview_only" | "send_execution_workspace_entry_enabled" | "send_execution_workspace_section_focused" | "send_execution_workspace_section_review_started" | "send_execution_workspace_marked_in_progress" | "send_execution_workspace_marked_ready_pending_actual_send";
export interface SendExecWorkspaceEvent { type: SendExecWorkspaceEventType; caseId: string; handoffPackageId: string; confirmationSessionId: string; sendExecutionGateId: string; workspaceId: string; sectionKeyIfAny: SendExecSectionKey | null; reason: string; actorOrSystem: string; timestamp: string; }
export function createSendExecWorkspaceEvent(type: SendExecWorkspaceEventType, ws: SendExecutionWorkspaceStateV2, sectionKey: SendExecSectionKey | null, reason: string, actor: string): SendExecWorkspaceEvent { return { type, caseId: ws.caseId, handoffPackageId: ws.handoffPackageId, confirmationSessionId: ws.confirmationSessionId, sendExecutionGateId: ws.sendExecutionGateId, workspaceId: ws.workspaceId, sectionKeyIfAny: sectionKey, reason, actorOrSystem: actor, timestamp: new Date().toISOString() }; }
