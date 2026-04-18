/**
 * Actual Send Run Workspace v2 — final irreversible run control surface
 *
 * 고정 규칙: run ready ≠ sent ≠ dispatched. center/rail/dock 분리.
 * Batch 1: execute_actual_send / mark_sent / mark_dispatched 금지.
 * Dispatch v2 chain terminal workspace.
 */

import type { ActualSendRunGateV2, RunGateStatus, ActualSendRunCandidateV2 } from "./actual-send-run-gate-v2-engine";
import type { DispatchPreparationHandoffPackageV2, InternalOnlyExcludedFlag } from "./dispatch-preparation-handoff-gate-v2-engine";

export type RunWorkspaceStatus = "locked_preview_only" | "entry_enabled" | "run_review_required" | "run_review_in_progress" | "run_hold" | "run_review_pending" | "run_ready_pending_execute";
export type RunWorkspaceMode = "preview_only" | "run_review" | "irreversible_run_check" | "policy_review" | "ready_pending_execute";
export type RunSectionKey = "recipient_run_final_block" | "payload_integrity_run_final_block" | "reference_instruction_run_final_block" | "exclusion_guard_run_final_block" | "actor_authorization_audit_run_final_block" | "run_completion_gate_review";
export type RunSectionStatus = "ready" | "partial" | "warning" | "blocked" | "attention_required" | "reviewed";

export interface ActualSendRunCheckSectionStateV2 { sectionKey: RunSectionKey; sectionTitle: string; sectionStatus: RunSectionStatus; priorityRank: number; runIntent: string; whyThisMatters: string; requiredRunInputs: string[]; resolvedInputs: string[]; unresolvedOrAmbiguousInputs: string[]; warnings: string[]; operatorActionRequired: string; canResolveInPlace: boolean; requiresReturnToActualSendExecutionReview: boolean; requiresReturnToCommitOrTransactionIfAny: boolean; nextBestActionLabel: string; payloadIntegrityBasis: string; exclusionGuardBasis: string; actorAuthorizationBasis: string; auditChainBasis: string; irreversibleRunBasis: string; }

export interface RunFieldGroup { groupKey: string; groupLabel: string; sourceMapping: string; resolved: boolean; value: string; unresolved: boolean; excluded: boolean; }
export interface ActualSendRunCenterCanvasStateV2 { activeSectionKey: RunSectionKey | null; decisionQuestion: string; runContext: string; sourceInputSummary: string; unresolvedOrConflictingInputs: string[]; fieldGroups: RunFieldGroup[]; riskSummary: string; resolutionOptions: string[]; blockedDownstreamActions: string[]; completionRuleForSection: string; }

export type RunPreviewMode = "locked_preview" | "run_candidate_preview" | "warning_preview" | "review_preview";
export interface ActualSendRunRightRailPreviewStateV2 { previewMode: RunPreviewMode; recipientPreview: { vendorId: string; contactVisible: boolean }; payloadIntegrityPreview: { lineCount: number; amountSummary: string; scopeIntact: boolean }; referenceInstructionPreview: { quoteVisible: boolean; poVisible: boolean; shipToVisible: boolean; receivingVisible: boolean }; excludedInternalOnlyPreview: InternalOnlyExcludedFlag[]; actorAuthorizationAuditPreview: { actorTraceComplete: boolean; authorizationConfirmed: boolean; auditChainIntact: boolean }; previewCautionSummary: string; provenancePreview: { candidateId: string; lane: string }[]; }

export interface ActualSendRunStickyDockStateV2 { primaryAction: { label: string; enabled: boolean; reason: string }; secondaryActions: { label: string; enabled: boolean; reason: string }[]; disabledActions: { label: string; reason: string }[]; blockedActionReasons: Record<string, string>; requiredResolutionBeforeProgress: string | null; workspaceCompletionLabel: string; actualSendExecuteLockLabel: string; }

export interface ActualSendRunWorkspaceHeaderV2 { title: string; statusChip: string; entryStatusLabel: string; entryStatusReason: string; runScopeLabel: string; currentGateLabel: string; nextGateLabel: string; operatorMandate: string; lockInterpretation: string; actualSendExecuteLockReason: string; }

export interface ActualSendRunWorkspaceStateV2 {
  workspaceId: string; caseId: string; handoffPackageId: string; actualSendExecutionSessionId: string; actualSendRunGateId: string;
  workspaceStatus: RunWorkspaceStatus; workspaceMode: RunWorkspaceMode;
  workspaceHeader: ActualSendRunWorkspaceHeaderV2; entryLockSummary: string;
  checkSectionStates: ActualSendRunCheckSectionStateV2[]; activeSectionKey: RunSectionKey | null;
  centerCanvasState: ActualSendRunCenterCanvasStateV2; rightRailPreview: ActualSendRunRightRailPreviewStateV2; stickyDock: ActualSendRunStickyDockStateV2;
  operatorFocusOrder: RunSectionKey[]; provenance: { candidateId: string; lane: string }[]; generatedAt: string;
}

const META: Record<RunSectionKey, { title: string; intent: string; risk: string; question: string }> = {
  recipient_run_final_block: { title: "수신자 Run 최종 확인", intent: "Irreversible run 직전 수신자 확정", risk: "되돌릴 수 없는 오발송", question: "수신자가 irreversible run에 모호함 없이 확정되었습니까?" },
  payload_integrity_run_final_block: { title: "Payload Integrity Run 최종 확인", intent: "최종 payload 정합성 확인", risk: "되돌릴 수 없는 주문 착오", question: "Payload가 최종 execution basis와 정합적입니까?" },
  reference_instruction_run_final_block: { title: "Reference / Instruction Run 최종 확인", intent: "Reference/instruction 최종 정합성", risk: "배송/입고 착오", question: "Reference와 instruction이 최종 basis와 정합적입니까?" },
  exclusion_guard_run_final_block: { title: "Exclusion Guard Run 최종 확인", intent: "Internal-only 최종 제외 확인", risk: "기밀 유출 — 되돌릴 수 없음", question: "Internal-only 문맥이 run candidate에서 완전 제외되었습니까?" },
  actor_authorization_audit_run_final_block: { title: "Actor / Authorization / Audit Run 최종 확인", intent: "Run actor authorization + audit chain 확인", risk: "Actor trace / audit chain gap 시 사후 추적 불가", question: "Actor authorization과 audit chain이 irreversible run에 충분합니까?" },
  run_completion_gate_review: { title: "Run 완결성 확인", intent: "모든 run block 완결 최종 검토", risk: "미확인 상태에서 execute 시 복구 불가", question: "모든 run block이 완결되어 execute 준비가 되었습니까?" },
};

function buildRunSection(key: RunSectionKey, rank: number, pkg: DispatchPreparationHandoffPackageV2, resolved: string[], unresolved: string[], warnings: string[]): ActualSendRunCheckSectionStateV2 {
  const m = META[key]; const status: RunSectionStatus = unresolved.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready";
  return { sectionKey: key, sectionTitle: m.title, sectionStatus: status, priorityRank: rank, runIntent: m.intent, whyThisMatters: m.risk, requiredRunInputs: [...resolved, ...unresolved], resolvedInputs: resolved, unresolvedOrAmbiguousInputs: unresolved, warnings, operatorActionRequired: unresolved.length > 0 ? `${m.title} 해소 필요` : warnings.length > 0 ? `${m.title} 검토` : `${m.title} 확인 가능`, canResolveInPlace: unresolved.length === 0, requiresReturnToActualSendExecutionReview: unresolved.length > 0, requiresReturnToCommitOrTransactionIfAny: false, nextBestActionLabel: unresolved.length > 0 ? `${m.title} 해소` : `${m.title} 확인`, payloadIntegrityBasis: key === "payload_integrity_run_final_block" ? "direct" : "inherited", exclusionGuardBasis: key === "exclusion_guard_run_final_block" ? "direct" : "inherited", actorAuthorizationBasis: key === "actor_authorization_audit_run_final_block" ? "direct" : "inherited", auditChainBasis: key === "actor_authorization_audit_run_final_block" ? "direct" : "inherited", irreversibleRunBasis: "run_review" };
}

function deriveSections(pkg: DispatchPreparationHandoffPackageV2): ActualSendRunCheckSectionStateV2[] {
  const s: ActualSendRunCheckSectionStateV2[] = [];
  const rR: string[] = []; const rU: string[] = []; if (pkg.createdVendorId) rR.push("vendorId"); else rU.push("vendorId"); if (pkg.vendorContactReferenceVisible) rR.push("contact"); else rU.push("contact");
  s.push(buildRunSection("recipient_run_final_block", 1, pkg, rR, rU, []));
  const pR: string[] = []; const pU: string[] = []; const pW: string[] = []; if (pkg.createdLineItems.length > 0) pR.push("lineItems"); else pU.push("lineItems"); if (pkg.createdAmountSummary) pR.push("amount"); else pW.push("amount 누락"); if (pkg.dispatchEligibleScope) pR.push("scope"); else pU.push("scope");
  s.push(buildRunSection("payload_integrity_run_final_block", 2, pkg, pR, pU, pW));
  const refR: string[] = []; const refU: string[] = []; const refW: string[] = []; if (pkg.quoteReferenceVisible) refR.push("quote"); else refW.push("quote 비활성"); if (pkg.poReferenceVisible) refR.push("PO"); else refW.push("PO 비활성"); if (pkg.shipToVisible) refR.push("ship-to"); else refU.push("ship-to"); if (pkg.receivingInstructionVisible) refR.push("receiving"); else refW.push("receiving 비활성");
  s.push(buildRunSection("reference_instruction_run_final_block", 3, pkg, refR, refU, refW));
  const eR: string[] = []; const eU: string[] = []; const eW: string[] = []; if (pkg.internalOnlyExcludedFlags.length > 0) eR.push(`${pkg.internalOnlyExcludedFlags.length}건 제외`); const seedLower = (pkg.supplierFacingNoteSeed || "").toLowerCase(); if (["budget", "governance", "internal", "approval"].some(kw => seedLower.includes(kw))) eU.push("contamination risk"); if (pkg.internalOnlyExcludedFlags.length === 0 && pkg.supplierFacingNoteSeed) eW.push("exclusion flag 없이 note seed 존재");
  s.push(buildRunSection("exclusion_guard_run_final_block", 4, pkg, eR, eU, eW));
  const aR = ["actor_trace", "authorization", "audit_chain"]; const aW: string[] = []; if (pkg.provenanceByLine.length === 0) aW.push("provenance 누락");
  s.push(buildRunSection("actor_authorization_audit_run_final_block", 5, pkg, aR, [], aW));
  const blocked = s.filter(x => x.sectionStatus === "blocked"); const warned = s.filter(x => x.sectionStatus === "warning");
  s.push(buildRunSection("run_completion_gate_review", 6, pkg, s.filter(x => x.sectionStatus === "ready" || x.sectionStatus === "reviewed").map(x => x.sectionKey), blocked.map(x => `${x.sectionTitle} blocked`), warned.map(x => `${x.sectionTitle} warning`)));
  return s;
}

function deriveStatus(gate: ActualSendRunGateV2, secs: ActualSendRunCheckSectionStateV2[]): RunWorkspaceStatus {
  if (gate.gateStatus !== "eligible_for_actual_send_run" && gate.gateStatus !== "actual_send_run_opened") return "locked_preview_only";
  const hasB = secs.some(x => x.sectionStatus === "blocked"); const hasW = secs.some(x => x.sectionStatus === "warning" || x.sectionStatus === "attention_required"); const allDone = secs.every(x => x.sectionStatus === "ready" || x.sectionStatus === "reviewed");
  if (allDone) return "run_ready_pending_execute"; if (hasB) return "run_review_required"; if (hasW) return "run_review_in_progress"; return "entry_enabled";
}
function deriveMode(s: RunWorkspaceStatus): RunWorkspaceMode { switch (s) { case "locked_preview_only": return "preview_only"; case "entry_enabled": case "run_review_required": return "run_review"; case "run_review_in_progress": return "irreversible_run_check"; case "run_hold": return "policy_review"; case "run_review_pending": return "run_review"; case "run_ready_pending_execute": return "ready_pending_execute"; } }

const FOCUS: RunSectionKey[] = ["recipient_run_final_block", "payload_integrity_run_final_block", "reference_instruction_run_final_block", "exclusion_guard_run_final_block", "actor_authorization_audit_run_final_block", "run_completion_gate_review"];
function deriveFocus(secs: ActualSendRunCheckSectionStateV2[]): RunSectionKey[] { const b = FOCUS.filter(k => secs.find(x => x.sectionKey === k)?.sectionStatus === "blocked"); const w = FOCUS.filter(k => { const x = secs.find(s => s.sectionKey === k); return x && (x.sectionStatus === "warning" || x.sectionStatus === "attention_required") && !b.includes(k); }); const r = FOCUS.filter(k => !b.includes(k) && !w.includes(k)); return [...b, ...w, ...r]; }

export function buildActualSendRunWorkspaceStateV2(gate: ActualSendRunGateV2, pkg: DispatchPreparationHandoffPackageV2): ActualSendRunWorkspaceStateV2 {
  const secs = deriveSections(pkg); const status = deriveStatus(gate, secs); const mode = deriveMode(status); const focus = deriveFocus(secs);
  const isLocked = status === "locked_preview_only"; const isReady = status === "run_ready_pending_execute"; const hasB = secs.some(x => x.sectionStatus === "blocked");
  const header: ActualSendRunWorkspaceHeaderV2 = { title: `Actual Send Run — ${gate.caseId}`, statusChip: isLocked ? "Preview Only" : isReady ? "Run Ready — Execute 대기" : hasB ? "차단됨" : "Run 검토 가능", entryStatusLabel: isLocked ? "Entry Locked" : "Entry Enabled", entryStatusReason: isLocked ? gate.candidate.candidateReason : "Run 가능", runScopeLabel: gate.candidate.payloadIntegrityFinalSnapshot, currentGateLabel: "Actual Send Run Control", nextGateLabel: "Actual Send Execute (Locked — Batch 1)", operatorMandate: isLocked ? "Preview only." : hasB ? "Run 미확인 항목 해소 필요" : isReady ? "Run ready — execute 활성화를 기다리세요." : "Run 직전 각 항목 확인", lockInterpretation: isReady ? "Run ready — execute는 아직 범위 밖" : isLocked ? "Gate 조건 미충족" : "Run 검토 가능", actualSendExecuteLockReason: "Batch 1: Actual send execute, sent, dispatched 처리는 현재 범위 밖입니다" };
  const dock: ActualSendRunStickyDockStateV2 = { primaryAction: isLocked ? { label: "Preview Only", enabled: false, reason: "Entry locked" } : isReady ? { label: "Run Ready — Execute 대기", enabled: false, reason: "Execute 활성화 대기" } : hasB ? { label: "미확인 해소", enabled: true, reason: "" } : { label: "Run 검토 계속", enabled: true, reason: "" }, secondaryActions: [{ label: "Execution Review로 복귀", enabled: true, reason: "" }, { label: "Hold 전환", enabled: true, reason: "" }, { label: "Section 확인 완료", enabled: !isLocked && !hasB, reason: hasB ? "Blocker 해소 필요" : "" }], disabledActions: [{ label: "Actual Send Execute", reason: "Batch 1 범위 밖" }, { label: "Mark Sent", reason: "Batch 1 범위 밖" }, { label: "Mark Dispatched", reason: "Batch 1 범위 밖" }, { label: "Delivery Tracking", reason: "Batch 1 범위 밖" }], blockedActionReasons: { execute_actual_send_execute: "Batch 1 금지", mark_sent: "Batch 1 금지", mark_dispatched: "Batch 1 금지", create_delivery_tracking: "Batch 1 금지" }, requiredResolutionBeforeProgress: hasB ? secs.find(x => x.sectionStatus === "blocked")?.sectionTitle ?? null : null, workspaceCompletionLabel: isReady ? "Run ready — execute 대기" : "Run 검토 진행 중", actualSendExecuteLockLabel: "Actual Send Execute — Batch 1 locked" };
  const previewMode: RunPreviewMode = isLocked ? "locked_preview" : isReady ? "run_candidate_preview" : "review_preview";
  const cautions: string[] = []; if (!pkg.vendorContactReferenceVisible) cautions.push("Vendor contact 비활성"); if (!pkg.quoteReferenceVisible && !pkg.poReferenceVisible) cautions.push("Quote/PO 비활성"); if (pkg.internalOnlyExcludedFlags.length > 0) cautions.push(`${pkg.internalOnlyExcludedFlags.length}건 internal-only 제외`);
  const rail: ActualSendRunRightRailPreviewStateV2 = { previewMode, recipientPreview: { vendorId: pkg.createdVendorId, contactVisible: pkg.vendorContactReferenceVisible }, payloadIntegrityPreview: { lineCount: pkg.createdLineItems.length, amountSummary: pkg.createdAmountSummary, scopeIntact: !!pkg.dispatchEligibleScope }, referenceInstructionPreview: { quoteVisible: pkg.quoteReferenceVisible, poVisible: pkg.poReferenceVisible, shipToVisible: pkg.shipToVisible, receivingVisible: pkg.receivingInstructionVisible }, excludedInternalOnlyPreview: pkg.internalOnlyExcludedFlags, actorAuthorizationAuditPreview: { actorTraceComplete: pkg.provenanceByLine.length > 0, authorizationConfirmed: true, auditChainIntact: true }, previewCautionSummary: cautions.length > 0 ? cautions.join("; ") : "이슈 없음", provenancePreview: pkg.provenanceByLine.map(p => ({ candidateId: p.candidateId, lane: p.originalLane })) };
  const ak = focus[0] || null; const active = ak ? secs.find(x => x.sectionKey === ak) : null;
  const center: ActualSendRunCenterCanvasStateV2 = active ? { activeSectionKey: ak, decisionQuestion: META[ak!].question, runContext: active.runIntent, sourceInputSummary: `${active.resolvedInputs.length} resolved / ${active.unresolvedOrAmbiguousInputs.length} unresolved`, unresolvedOrConflictingInputs: [...active.unresolvedOrAmbiguousInputs, ...active.warnings], fieldGroups: active.requiredRunInputs.map(i => ({ groupKey: i, groupLabel: i, sourceMapping: "run", resolved: active.resolvedInputs.includes(i), value: active.resolvedInputs.includes(i) ? "resolved" : "", unresolved: active.unresolvedOrAmbiguousInputs.includes(i), excluded: false })), riskSummary: META[ak!].risk, resolutionOptions: active.canResolveInPlace ? ["현재 workspace에서 확인 가능"] : ["Execution review로 복귀 필요"], blockedDownstreamActions: ["execute_actual_send_execute", "mark_sent", "mark_dispatched"], completionRuleForSection: active.unresolvedOrAmbiguousInputs.length > 0 ? "미확인 해소 후 reviewed 가능" : "즉시 reviewed 가능" } : { activeSectionKey: null, decisionQuestion: "", runContext: "", sourceInputSummary: "", unresolvedOrConflictingInputs: [], fieldGroups: [], riskSummary: "", resolutionOptions: [], blockedDownstreamActions: ["execute_actual_send_execute", "mark_sent", "mark_dispatched"], completionRuleForSection: "" };

  return { workspaceId: `runws_${Date.now().toString(36)}`, caseId: gate.caseId, handoffPackageId: gate.handoffPackageId, actualSendExecutionSessionId: gate.actualSendExecutionSessionId, actualSendRunGateId: gate.actualSendRunGateId, workspaceStatus: status, workspaceMode: mode, workspaceHeader: header, entryLockSummary: isLocked ? `Entry locked: ${gate.candidate.candidateReason}` : "Entry enabled", checkSectionStates: secs, activeSectionKey: ak, centerCanvasState: center, rightRailPreview: rail, stickyDock: dock, operatorFocusOrder: focus, provenance: pkg.provenanceByLine.map(p => ({ candidateId: p.candidateId, lane: p.originalLane })), generatedAt: new Date().toISOString() };
}

export type RunWorkspaceEventType = "actual_send_run_workspace_state_computed" | "actual_send_run_workspace_opened_preview_only" | "actual_send_run_workspace_entry_enabled" | "actual_send_run_workspace_section_focused" | "actual_send_run_workspace_section_review_started" | "actual_send_run_workspace_marked_in_progress" | "actual_send_run_workspace_marked_ready_pending_execute";
export interface RunWorkspaceEvent { type: RunWorkspaceEventType; caseId: string; handoffPackageId: string; actualSendExecutionSessionId: string; actualSendRunGateId: string; workspaceId: string; sectionKeyIfAny: RunSectionKey | null; reason: string; actorOrSystem: string; timestamp: string; }
export function createRunWorkspaceEvent(type: RunWorkspaceEventType, ws: ActualSendRunWorkspaceStateV2, sectionKey: RunSectionKey | null, reason: string, actor: string): RunWorkspaceEvent { return { type, caseId: ws.caseId, handoffPackageId: ws.handoffPackageId, actualSendExecutionSessionId: ws.actualSendExecutionSessionId, actualSendRunGateId: ws.actualSendRunGateId, workspaceId: ws.workspaceId, sectionKeyIfAny: sectionKey, reason, actorOrSystem: actor, timestamp: new Date().toISOString() }; }
