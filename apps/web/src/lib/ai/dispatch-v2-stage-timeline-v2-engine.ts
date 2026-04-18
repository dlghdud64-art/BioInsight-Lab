/**
 * Dispatch v2 Stage Timeline / Audit Engine
 *
 * 전체 post-fire chain의 stage transition을 canonical timeline으로 기록.
 * - stage transition trace
 * - recovery/re-entry trace
 * - invariant breach attempt logging
 * - why blocked / why routed explanation
 * - idempotency/retry audit
 */

// ── Stage Transition Entry ──
export type StageTransitionType = "normal_advance" | "gate_blocked" | "gate_passed" | "return_to_upstream" | "recovery_re_entry" | "followup_loop" | "exception_routed" | "invariant_breach_attempt" | "idempotency_blocked" | "retry_attempted" | "hold_set" | "hold_released";

export interface StageTransitionEntry {
  entryId: string;
  caseId: string;
  sentStateRecordId: string | null;
  fromStage: string;
  toStage: string;
  transitionType: StageTransitionType;
  gateId: string | null;
  sessionId: string | null;
  actor: string;
  timestamp: string;
  reason: string;
  blockerSummary: string[];
  warningSummary: string[];
  invariantChecked: string | null;
  invariantResult: "pass" | "fail" | "not_applicable";
  lineRefsAffected: string[];
  recoveryRecordId: string | null;
}

// ── Stage Timeline ──
export interface DispatchV2StageTimeline {
  timelineId: string;
  caseId: string;
  entries: StageTransitionEntry[];
  currentStage: string;
  currentStatus: string;
  totalTransitions: number;
  totalBlockedAttempts: number;
  totalRecoveryReEntries: number;
  totalInvariantBreachAttempts: number;
  createdAt: string;
  lastUpdatedAt: string;
}

// ── Timeline Builder ──
export function createStageTimeline(caseId: string): DispatchV2StageTimeline {
  return { timelineId: `tmln_${Date.now().toString(36)}`, caseId, entries: [], currentStage: "initial", currentStatus: "created", totalTransitions: 0, totalBlockedAttempts: 0, totalRecoveryReEntries: 0, totalInvariantBreachAttempts: 0, createdAt: new Date().toISOString(), lastUpdatedAt: new Date().toISOString() };
}

export function addTransitionEntry(timeline: DispatchV2StageTimeline, entry: Omit<StageTransitionEntry, "entryId">): DispatchV2StageTimeline {
  const fullEntry: StageTransitionEntry = { ...entry, entryId: `tent_${Date.now().toString(36)}_${timeline.entries.length}` };
  const updated = { ...timeline, entries: [...timeline.entries, fullEntry], lastUpdatedAt: entry.timestamp, currentStage: entry.toStage, totalTransitions: timeline.totalTransitions + 1 };

  if (entry.transitionType === "gate_blocked") updated.totalBlockedAttempts += 1;
  if (entry.transitionType === "recovery_re_entry") updated.totalRecoveryReEntries += 1;
  if (entry.transitionType === "invariant_breach_attempt") updated.totalInvariantBreachAttempts += 1;

  return updated;
}

// ── Invariant Check Logging ──
export type InvariantKey = "confirmed_neq_receiving_ready" | "receiving_neq_releasable" | "followup_neq_shortcut" | "recovery_neq_bypass" | "sent_neq_dispatched" | "fire_idempotency" | "line_identity_continuity";

export interface InvariantCheckLog {
  logId: string;
  caseId: string;
  invariantKey: InvariantKey;
  checkedAt: string;
  checkedBy: string;
  stage: string;
  result: "pass" | "fail";
  detail: string;
  breachPrevented: boolean;
}

export function logInvariantCheck(caseId: string, invariantKey: InvariantKey, stage: string, result: "pass" | "fail", detail: string, actor: string): InvariantCheckLog {
  return { logId: `invchk_${Date.now().toString(36)}`, caseId, invariantKey, checkedAt: new Date().toISOString(), checkedBy: actor, stage, result, detail, breachPrevented: result === "fail" };
}

// ── Timeline Query Helpers ──
export function getBlockedAttempts(timeline: DispatchV2StageTimeline): StageTransitionEntry[] {
  return timeline.entries.filter(e => e.transitionType === "gate_blocked");
}

export function getRecoveryReEntries(timeline: DispatchV2StageTimeline): StageTransitionEntry[] {
  return timeline.entries.filter(e => e.transitionType === "recovery_re_entry");
}

export function getInvariantBreachAttempts(timeline: DispatchV2StageTimeline): StageTransitionEntry[] {
  return timeline.entries.filter(e => e.transitionType === "invariant_breach_attempt");
}

export function getStageHistory(timeline: DispatchV2StageTimeline, stage: string): StageTransitionEntry[] {
  return timeline.entries.filter(e => e.fromStage === stage || e.toStage === stage);
}

export function getWhyBlocked(timeline: DispatchV2StageTimeline, stage: string): string[] {
  return timeline.entries.filter(e => e.toStage === stage && e.transitionType === "gate_blocked").flatMap(e => e.blockerSummary);
}

export function getWhyRouted(timeline: DispatchV2StageTimeline, stage: string): string[] {
  return timeline.entries.filter(e => e.fromStage === stage && (e.transitionType === "return_to_upstream" || e.transitionType === "exception_routed" || e.transitionType === "followup_loop")).map(e => e.reason);
}
