/**
 * Actual Supplier Send Action Workspace v2 — irreversible send control surface contract
 *
 * 고정 규칙:
 * 1. ActualSupplierSendActionGateV2 + upstream truths = 입력 source.
 * 2. preview only / entry enabled / arming in progress / arming complete 분리.
 * 3. center = arming decision canvas, rail = final candidate preview, dock = action gate.
 * 4. irreversible send 직전 마지막 확인 단위가 section state로 명확 정의.
 * 5. payload integrity / exclusion guard / actor trace / audit chain은 독립 확인 축.
 * 6. Batch 1: execute_actual_send / mark_dispatched 금지.
 * 7. arming complete ≠ actual send executed.
 * 8. local UI state ≠ canonical workspace state.
 */

import type { ActualSupplierSendActionGateV2, ActualSendGateStatus, ActualSupplierSendCandidateV2 } from "./actual-supplier-send-action-gate-v2-engine";
import type { DispatchPreparationHandoffPackageV2, InternalOnlyExcludedFlag } from "./dispatch-preparation-handoff-gate-v2-engine";
import type { LaneProvenance } from "./sourcing-result-workbench-v2-triage-engine";

// ── Status / Mode ──
export type ArmingWorkspaceStatus = "locked_preview_only" | "entry_enabled" | "arming_required" | "arming_in_progress" | "arming_hold" | "arming_review_pending" | "arming_complete_pending_actual_send_transaction";
export type ArmingWorkspaceMode = "preview_only" | "arming_review" | "irreversible_action_check" | "policy_review" | "complete_pending_actual_send_transaction";

// ── Section Key / Status ──
export type ArmingSectionKey = "recipient_final_arming_block" | "payload_integrity_final_arming_block" | "reference_instruction_final_arming_block" | "exclusion_guard_final_arming_block" | "actor_and_audit_final_arming_block" | "arming_completion_gate_review";
export type ArmingSectionStatus = "ready" | "partial" | "warning" | "blocked" | "attention_required" | "reviewed";

// ── Section State ──
export interface ActualSupplierSendActionCheckSectionStateV2 {
  sectionKey: ArmingSectionKey; sectionTitle: string; sectionStatus: ArmingSectionStatus; priorityRank: number;
  armingIntent: string; whyThisMatters: string;
  requiredArmingInputs: string[]; resolvedInputs: string[]; unresolvedOrAmbiguousInputs: string[]; warnings: string[];
  operatorActionRequired: string; canResolveInPlace: boolean; requiresReturnToExecutionReview: boolean; requiresReturnToConfirmationOrValidationIfAny: boolean;
  nextBestActionLabel: string;
  derivedFromExecutionResolution: string; payloadIntegrityBasis: string; exclusionGuardBasis: string; actorTraceBasis: string; auditChainBasis: string; irreversibleActionBasis: string;
}

// ── Canvas / Rail / Dock ──
export interface ArmingFieldGroup { groupKey: string; groupLabel: string; sourceMapping: string; resolved: boolean; value: string; unresolved: boolean; excluded: boolean; }
export interface ActualSupplierSendActionCenterCanvasStateV2 { activeSectionKey: ArmingSectionKey | null; decisionQuestion: string; armingContext: string; sourceInputSummary: string; unresolvedOrConflictingInputs: string[]; fieldGroups: ArmingFieldGroup[]; riskSummary: string; resolutionOptions: string[]; blockedDownstreamActions: string[]; completionRuleForSection: string; }

export type ArmingPreviewMode = "locked_preview" | "arming_candidate_preview" | "warning_preview" | "review_preview";
export interface ActualSupplierSendActionRightRailPreviewStateV2 { previewMode: ArmingPreviewMode; recipientPreview: { vendorId: string; contactVisible: boolean }; payloadIntegrityPreview: { lineCount: number; amountSummary: string; scopeIntact: boolean }; referenceInstructionPreview: { quoteVisible: boolean; poVisible: boolean; shipToVisible: boolean; receivingVisible: boolean }; excludedInternalOnlyPreview: InternalOnlyExcludedFlag[]; actorAuditPreview: { actorTraceComplete: boolean; auditChainIntact: boolean }; previewCautionSummary: string; provenancePreview: { candidateId: string; lane: string }[]; }

export interface ActualSupplierSendActionStickyDockStateV2 { primaryAction: { label: string; enabled: boolean; reason: string }; secondaryActions: { label: string; enabled: boolean; reason: string }[]; disabledActions: { label: string; reason: string }[]; blockedActionReasons: Record<string, string>; requiredResolutionBeforeProgress: string | null; workspaceCompletionLabel: string; actualSendTransactionLockLabel: string; }

export interface ActualSupplierSendActionWorkspaceHeaderV2 { title: string; statusChip: string; entryStatusLabel: string; entryStatusReason: string; irreversibleActionScopeLabel: string; currentGateLabel: string; nextGateLabel: string; operatorMandate: string; lockInterpretation: string; actualSendTransactionLockReason: string; }

// ── Top-Level State ──
export interface ActualSupplierSendActionWorkspaceStateV2 {
  workspaceId: string; caseId: string; handoffPackageId: string; executionSessionId: string; actualSendActionGateId: string;
  workspaceStatus: ArmingWorkspaceStatus; workspaceMode: ArmingWorkspaceMode;
  workspaceHeader: ActualSupplierSendActionWorkspaceHeaderV2; entryLockSummary: string;
  checkSectionStates: ActualSupplierSendActionCheckSectionStateV2[]; activeSectionKey: ArmingSectionKey | null;
  centerCanvasState: ActualSupplierSendActionCenterCanvasStateV2; rightRailPreview: ActualSupplierSendActionRightRailPreviewStateV2; stickyDock: ActualSupplierSendActionStickyDockStateV2;
  operatorFocusOrder: ArmingSectionKey[]; provenance: { candidateId: string; lane: string }[]; generatedAt: string;
}

// ── Meta ──
const META: Record<ArmingSectionKey, { title: string; intent: string; risk: string; question: string }> = {
  recipient_final_arming_block: { title: "수신자 최종 Arming 확인", intent: "Irreversible send 직전 수신자 확정", risk: "수신자 오류 시 되돌릴 수 없는 오발송", question: "수신자가 irreversible send action에 모호함 없이 확정되었습니까?" },
  payload_integrity_final_arming_block: { title: "Payload Integrity 최종 확인", intent: "최종 supplier-facing payload 정합성 확인", risk: "Payload 불일치 시 되돌릴 수 없는 주문 착오", question: "Supplier-facing payload가 최종 basis와 정합적입니까?" },
  reference_instruction_final_arming_block: { title: "Reference / Instruction 최종 확인", intent: "Reference/instruction이 최종 basis와 정합적인지 확인", risk: "Reference/instruction 오류 시 배송/입고 착오", question: "Reference와 instruction이 최종 validated basis와 정합적입니까?" },
  exclusion_guard_final_arming_block: { title: "Exclusion Guard 최종 Arming 확인", intent: "Internal-only 문맥이 최종 send candidate에서 완전 제외 확인", risk: "Internal context 유출 시 기밀 훼손 — 되돌릴 수 없음", question: "Internal-only 문맥이 actual send candidate에서 완전히 제외되었습니까?" },
  actor_and_audit_final_arming_block: { title: "Actor / Audit 최종 확인", intent: "Irreversible action actor trace + audit chain 확인", risk: "Actor trace / audit chain gap 시 사후 추적 불가", question: "Actor trace와 audit chain이 irreversible action에 충분합니까?" },
  arming_completion_gate_review: { title: "Arming 완결성 확인", intent: "모든 arming block 완결 최종 검토", risk: "미확인 상태에서 actual send transaction 진입 시 복구 불가", question: "모든 arming block이 완결되어 actual send transaction 준비가 되었습니까?" },
};

// ── Section Builder ──
function buildArmingSection(key: ArmingSectionKey, rank: number, pkg: DispatchPreparationHandoffPackageV2, resolved: string[], unresolved: string[], warnings: string[]): ActualSupplierSendActionCheckSectionStateV2 {
  const m = META[key]; const status: ArmingSectionStatus = unresolved.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready";
  return { sectionKey: key, sectionTitle: m.title, sectionStatus: status, priorityRank: rank, armingIntent: m.intent, whyThisMatters: m.risk, requiredArmingInputs: [...resolved, ...unresolved], resolvedInputs: resolved, unresolvedOrAmbiguousInputs: unresolved, warnings, operatorActionRequired: unresolved.length > 0 ? `${m.title} 해소 필요` : warnings.length > 0 ? `${m.title} 검토` : `${m.title} 확인 가능`, canResolveInPlace: unresolved.length === 0, requiresReturnToExecutionReview: unresolved.length > 0, requiresReturnToConfirmationOrValidationIfAny: false, nextBestActionLabel: unresolved.length > 0 ? `${m.title} 해소` : `${m.title} 확인`, derivedFromExecutionResolution: key, payloadIntegrityBasis: key === "payload_integrity_final_arming_block" ? "direct" : "inherited", exclusionGuardBasis: key === "exclusion_guard_final_arming_block" ? "direct" : "inherited", actorTraceBasis: key === "actor_and_audit_final_arming_block" ? "direct" : "inherited", auditChainBasis: key === "actor_and_audit_final_arming_block" ? "direct" : "inherited", irreversibleActionBasis: "arming_review" };
}

function deriveSections(pkg: DispatchPreparationHandoffPackageV2): ActualSupplierSendActionCheckSectionStateV2[] {
  const s: ActualSupplierSendActionCheckSectionStateV2[] = [];
  const rR: string[] = []; const rU: string[] = [];
  if (pkg.createdVendorId) rR.push("vendorId"); else rU.push("vendorId");
  if (pkg.vendorContactReferenceVisible) rR.push("contact"); else rU.push("contact");
  s.push(buildArmingSection("recipient_final_arming_block", 1, pkg, rR, rU, []));
  const pR: string[] = []; const pU: string[] = []; const pW: string[] = [];
  if (pkg.createdLineItems.length > 0) pR.push("lineItems"); else pU.push("lineItems");
  if (pkg.createdAmountSummary) pR.push("amount"); else pW.push("amount 누락");
  if (pkg.dispatchEligibleScope) pR.push("scope"); else pU.push("scope");
  s.push(buildArmingSection("payload_integrity_final_arming_block", 2, pkg, pR, pU, pW));
  const refR: string[] = []; const refU: string[] = []; const refW: string[] = [];
  if (pkg.quoteReferenceVisible) refR.push("quote"); else refW.push("quote 비활성");
  if (pkg.poReferenceVisible) refR.push("PO"); else refW.push("PO 비활성");
  if (pkg.shipToVisible) refR.push("ship-to"); else refU.push("ship-to");
  if (pkg.receivingInstructionVisible) refR.push("receiving"); else refW.push("receiving 비활성");
  s.push(buildArmingSection("reference_instruction_final_arming_block", 3, pkg, refR, refU, refW));
  const eR: string[] = []; const eU: string[] = []; const eW: string[] = [];
  if (pkg.internalOnlyExcludedFlags.length > 0) eR.push(`${pkg.internalOnlyExcludedFlags.length}건 제외`);
  const seedLower = (pkg.supplierFacingNoteSeed || "").toLowerCase();
  if (["budget", "governance", "internal", "approval"].some(kw => seedLower.includes(kw))) eU.push("contamination risk");
  if (pkg.internalOnlyExcludedFlags.length === 0 && pkg.supplierFacingNoteSeed) eW.push("exclusion flag 없이 note seed 존재");
  s.push(buildArmingSection("exclusion_guard_final_arming_block", 4, pkg, eR, eU, eW));
  const aR = ["actor_trace", "audit_chain"]; const aW: string[] = [];
  if (pkg.provenanceByLine.length === 0) aW.push("provenance 누락");
  s.push(buildArmingSection("actor_and_audit_final_arming_block", 5, pkg, aR, [], aW));
  const blocked = s.filter(x => x.sectionStatus === "blocked"); const warned = s.filter(x => x.sectionStatus === "warning");
  s.push(buildArmingSection("arming_completion_gate_review", 6, pkg, s.filter(x => x.sectionStatus === "ready" || x.sectionStatus === "reviewed").map(x => x.sectionKey), blocked.map(x => `${x.sectionTitle} blocked`), warned.map(x => `${x.sectionTitle} warning`)));
  return s;
}

// ── Derivation ──
function deriveStatus(gate: ActualSupplierSendActionGateV2, secs: ActualSupplierSendActionCheckSectionStateV2[]): ArmingWorkspaceStatus {
  if (gate.gateStatus !== "eligible_for_actual_send_action" && gate.gateStatus !== "actual_send_action_armed") return "locked_preview_only";
  const hasB = secs.some(x => x.sectionStatus === "blocked"); const hasW = secs.some(x => x.sectionStatus === "warning" || x.sectionStatus === "attention_required"); const allDone = secs.every(x => x.sectionStatus === "ready" || x.sectionStatus === "reviewed");
  if (allDone) return "arming_complete_pending_actual_send_transaction"; if (hasB) return "arming_required"; if (hasW) return "arming_in_progress"; return "entry_enabled";
}
function deriveMode(s: ArmingWorkspaceStatus): ArmingWorkspaceMode { switch (s) { case "locked_preview_only": return "preview_only"; case "entry_enabled": case "arming_required": return "arming_review"; case "arming_in_progress": return "irreversible_action_check"; case "arming_hold": return "policy_review"; case "arming_review_pending": return "arming_review"; case "arming_complete_pending_actual_send_transaction": return "complete_pending_actual_send_transaction"; } }
const FOCUS: ArmingSectionKey[] = ["recipient_final_arming_block", "payload_integrity_final_arming_block", "reference_instruction_final_arming_block", "exclusion_guard_final_arming_block", "actor_and_audit_final_arming_block", "arming_completion_gate_review"];
function deriveFocus(secs: ActualSupplierSendActionCheckSectionStateV2[]): ArmingSectionKey[] { const b = FOCUS.filter(k => secs.find(x => x.sectionKey === k)?.sectionStatus === "blocked"); const w = FOCUS.filter(k => { const x = secs.find(s => s.sectionKey === k); return x && (x.sectionStatus === "warning" || x.sectionStatus === "attention_required") && !b.includes(k); }); const r = FOCUS.filter(k => !b.includes(k) && !w.includes(k)); return [...b, ...w, ...r]; }

function deriveHeader(gate: ActualSupplierSendActionGateV2, status: ArmingWorkspaceStatus, secs: ActualSupplierSendActionCheckSectionStateV2[]): ActualSupplierSendActionWorkspaceHeaderV2 {
  const isLocked = status === "locked_preview_only"; const isComplete = status === "arming_complete_pending_actual_send_transaction"; const hasB = secs.some(x => x.sectionStatus === "blocked");
  const mandate = isLocked ? "Preview only 상태입니다." : hasB ? "Arming 미확인 항목을 해소하세요" : isComplete ? "Arming 완료 — actual send transaction 활성화를 기다리세요." : "Irreversible send 직전 각 항목을 확인하세요";
  return { title: `Actual Send Action Control — ${gate.caseId}`, statusChip: isLocked ? "Preview Only" : isComplete ? "Arming 완료 — Transaction 대기" : hasB ? "차단됨" : "Arming 검토 가능", entryStatusLabel: isLocked ? "Entry Locked" : "Entry Enabled", entryStatusReason: isLocked ? gate.candidate.candidateReason : "Arming 가능", irreversibleActionScopeLabel: gate.candidate.payloadIntegritySnapshot, currentGateLabel: "Actual Supplier Send Action Control", nextGateLabel: "Actual Send Transaction (Locked — Batch 1)", operatorMandate: mandate, lockInterpretation: isComplete ? "Arming complete — actual send transaction은 아직 범위 밖" : isLocked ? "Entry gate 조건 미충족" : "Arming 진행 가능", actualSendTransactionLockReason: "Batch 1: Actual send transaction, dispatched 처리는 현재 범위 밖입니다" };
}

function deriveDock(status: ArmingWorkspaceStatus, secs: ActualSupplierSendActionCheckSectionStateV2[]): ActualSupplierSendActionStickyDockStateV2 {
  const isLocked = status === "locked_preview_only"; const isComplete = status === "arming_complete_pending_actual_send_transaction"; const hasB = secs.some(x => x.sectionStatus === "blocked");
  const primary = isLocked ? { label: "Preview Only", enabled: false, reason: "Entry locked" } : isComplete ? { label: "Arming 완료 — Transaction 대기", enabled: false, reason: "Actual send transaction 대기" } : hasB ? { label: "미확인 해소", enabled: true, reason: "" } : { label: "Arming 검토 계속", enabled: true, reason: "" };
  return { primaryAction: primary, secondaryActions: [{ label: "Execution Review로 복귀", enabled: true, reason: "" }, { label: "Hold 전환", enabled: true, reason: "" }, { label: "Section 확인 완료", enabled: !isLocked && !hasB, reason: hasB ? "Blocker 해소 필요" : "" }], disabledActions: [{ label: "Actual Send 실행", reason: "Batch 1 범위 밖" }, { label: "Dispatched 처리", reason: "Batch 1 범위 밖" }, { label: "Transport Payload Freeze", reason: "Batch 1 범위 밖" }, { label: "Delivery Tracking 생성", reason: "Batch 1 범위 밖" }], blockedActionReasons: { execute_actual_send: "Batch 1 금지", mark_dispatched: "Batch 1 금지", freeze_transport_payload: "Batch 1 금지", create_delivery_tracking_record: "Batch 1 금지" }, requiredResolutionBeforeProgress: hasB ? secs.find(x => x.sectionStatus === "blocked")?.sectionTitle ?? null : null, workspaceCompletionLabel: isComplete ? "Arming review 완료 — actual send transaction 대기" : "Arming review 진행 중", actualSendTransactionLockLabel: "Actual Send Transaction — Batch 1 locked" };
}

function deriveRail(pkg: DispatchPreparationHandoffPackageV2, status: ArmingWorkspaceStatus): ActualSupplierSendActionRightRailPreviewStateV2 {
  const mode: ArmingPreviewMode = status === "locked_preview_only" ? "locked_preview" : status === "arming_complete_pending_actual_send_transaction" ? "arming_candidate_preview" : "review_preview";
  const cautions: string[] = [];
  if (!pkg.vendorContactReferenceVisible) cautions.push("Vendor contact 비활성");
  if (!pkg.quoteReferenceVisible && !pkg.poReferenceVisible) cautions.push("Quote/PO ref 모두 비활성");
  if (pkg.internalOnlyExcludedFlags.length > 0) cautions.push(`${pkg.internalOnlyExcludedFlags.length}건 internal-only 제외`);
  return { previewMode: mode, recipientPreview: { vendorId: pkg.createdVendorId, contactVisible: pkg.vendorContactReferenceVisible }, payloadIntegrityPreview: { lineCount: pkg.createdLineItems.length, amountSummary: pkg.createdAmountSummary, scopeIntact: !!pkg.dispatchEligibleScope }, referenceInstructionPreview: { quoteVisible: pkg.quoteReferenceVisible, poVisible: pkg.poReferenceVisible, shipToVisible: pkg.shipToVisible, receivingVisible: pkg.receivingInstructionVisible }, excludedInternalOnlyPreview: pkg.internalOnlyExcludedFlags, actorAuditPreview: { actorTraceComplete: pkg.provenanceByLine.length > 0, auditChainIntact: true }, previewCautionSummary: cautions.length > 0 ? cautions.join("; ") : "이슈 없음", provenancePreview: pkg.provenanceByLine.map(p => ({ candidateId: p.candidateId, lane: p.originalLane })) };
}

function deriveCenter(secs: ActualSupplierSendActionCheckSectionStateV2[], focus: ArmingSectionKey[]): ActualSupplierSendActionCenterCanvasStateV2 {
  const ak = focus[0] || null; const active = ak ? secs.find(x => x.sectionKey === ak) : null;
  if (!active) return { activeSectionKey: null, decisionQuestion: "", armingContext: "", sourceInputSummary: "", unresolvedOrConflictingInputs: [], fieldGroups: [], riskSummary: "", resolutionOptions: [], blockedDownstreamActions: ["execute_actual_send", "mark_dispatched"], completionRuleForSection: "" };
  const m = META[ak!]; const fg: ArmingFieldGroup[] = active.requiredArmingInputs.map(i => ({ groupKey: i, groupLabel: i, sourceMapping: active.derivedFromExecutionResolution, resolved: active.resolvedInputs.includes(i), value: active.resolvedInputs.includes(i) ? "resolved" : "", unresolved: active.unresolvedOrAmbiguousInputs.includes(i), excluded: false }));
  return { activeSectionKey: ak, decisionQuestion: m.question, armingContext: active.armingIntent, sourceInputSummary: `${active.resolvedInputs.length} resolved / ${active.unresolvedOrAmbiguousInputs.length} unresolved`, unresolvedOrConflictingInputs: [...active.unresolvedOrAmbiguousInputs, ...active.warnings], fieldGroups: fg, riskSummary: m.risk, resolutionOptions: active.canResolveInPlace ? ["현재 workspace에서 확인 가능"] : ["Execution review로 복귀 필요"], blockedDownstreamActions: ["execute_actual_send", "mark_dispatched"], completionRuleForSection: active.unresolvedOrAmbiguousInputs.length > 0 ? "미확인 해소 후 reviewed 가능" : "즉시 reviewed 가능" };
}

// ── Main Builder ──
export function buildActualSupplierSendActionWorkspaceStateV2(gate: ActualSupplierSendActionGateV2, pkg: DispatchPreparationHandoffPackageV2): ActualSupplierSendActionWorkspaceStateV2 {
  const secs = deriveSections(pkg); const status = deriveStatus(gate, secs); const mode = deriveMode(status); const focus = deriveFocus(secs);
  return { workspaceId: `actsndws_${Date.now().toString(36)}`, caseId: gate.caseId, handoffPackageId: gate.handoffPackageId, executionSessionId: gate.executionSessionId, actualSendActionGateId: gate.actualSendActionGateId, workspaceStatus: status, workspaceMode: mode, workspaceHeader: deriveHeader(gate, status, secs), entryLockSummary: status === "locked_preview_only" ? `Entry locked: ${gate.candidate.candidateReason}` : "Entry enabled", checkSectionStates: secs, activeSectionKey: focus[0] || null, centerCanvasState: deriveCenter(secs, focus), rightRailPreview: deriveRail(pkg, status), stickyDock: deriveDock(status, secs), operatorFocusOrder: focus, provenance: pkg.provenanceByLine.map(p => ({ candidateId: p.candidateId, lane: p.originalLane })), generatedAt: new Date().toISOString() };
}

// ── Events ──
export type ArmingWorkspaceEventType = "actual_supplier_send_action_workspace_state_computed" | "actual_supplier_send_action_workspace_opened_preview_only" | "actual_supplier_send_action_workspace_entry_enabled" | "actual_supplier_send_action_workspace_section_focused" | "actual_supplier_send_action_workspace_section_review_started" | "actual_supplier_send_action_workspace_marked_in_progress" | "actual_supplier_send_action_workspace_marked_complete_pending_transaction";
export interface ArmingWorkspaceEvent { type: ArmingWorkspaceEventType; caseId: string; handoffPackageId: string; executionSessionId: string; actualSendActionGateId: string; workspaceId: string; sectionKeyIfAny: ArmingSectionKey | null; reason: string; actorOrSystem: string; timestamp: string; }
export function createArmingWorkspaceEvent(type: ArmingWorkspaceEventType, ws: ActualSupplierSendActionWorkspaceStateV2, sectionKey: ArmingSectionKey | null, reason: string, actor: string): ArmingWorkspaceEvent { return { type, caseId: ws.caseId, handoffPackageId: ws.handoffPackageId, executionSessionId: ws.executionSessionId, actualSendActionGateId: ws.actualSendActionGateId, workspaceId: ws.workspaceId, sectionKeyIfAny: sectionKey, reason, actorOrSystem: actor, timestamp: new Date().toISOString() }; }
