/**
 * Governance Audit Engine — chain-level decision log + compliance snapshot
 *
 * 모든 governance 판단(status 전이, blocker 해소, irreversible action 실행)을
 * 감사 추적 가능한 형태로 기록하고, compliance snapshot을 생성.
 *
 * CORE CONTRACT:
 * 1. audit record는 append-only — 수정/삭제 불가
 * 2. 모든 label/severity/status 참조는 grammar registry에서 resolve
 * 3. compliance snapshot은 "시점의 truth" — 현재 truth 계산은 engine이, 기록은 audit가
 * 4. decision log는 governance event bus의 이벤트를 소비하되, 추가 context 부착
 * 5. irreversible action 실행 전 compliance gate 통과 기록 필수
 *
 * IMMUTABLE RULES:
 * - audit record 삭제/수정 금지
 * - audit는 truth를 변경하지 않음 — read-only projection
 * - grammar registry 외 label 하드코딩 금지
 * - compliance snapshot은 engine 결과를 snapshot하는 것이지, 독립 계산하지 않음
 */

import type { GovernanceDomain, GovernanceEvent, GovernanceEventBus } from "./governance-event-bus";
import type { QuoteChainStage } from "./quote-approval-governance-engine";
import {
  getStageLabel,
  getStatusLabel,
  getPanelLabel,
  BLOCKER_SEVERITY_SPEC,
  SEVERITY_SPEC,
  DOCK_ACTION_GRAMMAR,
  CHAIN_STAGE_GRAMMAR,
  type BlockerSeverity,
  type UnifiedSeverity,
  type ActionRisk,
  type StatusCategory,
} from "./governance-grammar-registry";

// ══════════════════════════════════════════════════════
// 1. Decision Log — governance 판단 기록
// ══════════════════════════════════════════════════════

/**
 * 단일 governance 판단 기록.
 * event bus의 GovernanceEvent에 감사 context를 부착한 형태.
 */
export interface DecisionLogEntry {
  /** Unique log entry ID */
  logId: string;
  /** Originating event ID */
  sourceEventId: string;
  /** When this log entry was created */
  loggedAt: string;
  /** Domain */
  domain: GovernanceDomain;
  /** Chain stage (resolved from grammar) */
  chainStage: QuoteChainStage | null;
  /** Case ID */
  caseId: string;
  /** PO number */
  poNumber: string;

  // ── Decision detail ──
  /** What type of decision was made */
  decisionType: DecisionType;
  /** What changed — status transition, blocker resolution, action execution */
  fromStatus: string;
  toStatus: string;
  /** Resolved labels from grammar registry */
  fromStatusLabel: string;
  toStatusLabel: string;
  /** Who made the decision */
  actor: string;
  /** Human-readable detail from the event */
  detail: string;
  /** Was this an irreversible action */
  irreversible: boolean;
  /** Severity of the originating event */
  severity: UnifiedSeverity;
  /** Severity label from grammar */
  severityLabel: string;

  // ── Compliance context ──
  /** Were any blockers active when this decision was made */
  blockersActiveAtDecision: BlockerSnapshot[];
  /** Was a compliance gate passed for this decision */
  complianceGatePassed: boolean;
  /** Compliance gate details (if applicable) */
  complianceGateDetail: string | null;
}

export type DecisionType =
  | "status_transition"
  | "blocker_resolved"
  | "blocker_added"
  | "irreversible_action"
  | "reversible_action"
  | "snapshot_invalidation"
  | "handoff"
  | "reopen"
  | "cancellation";

export interface BlockerSnapshot {
  blockerType: string;
  severity: BlockerSeverity;
  severityLabel: string;
  detail: string;
  resolvedAt: string | null;
}

// ── Decision Log Store ──

export interface DecisionLogStore {
  append: (entry: DecisionLogEntry) => void;
  getEntries: (filter?: DecisionLogFilter) => DecisionLogEntry[];
  getEntryCount: () => number;
  getEntriesByCaseId: (caseId: string) => DecisionLogEntry[];
  getEntriesByPONumber: (poNumber: string) => DecisionLogEntry[];
  getIrreversibleEntries: (filter?: DecisionLogFilter) => DecisionLogEntry[];
}

export interface DecisionLogFilter {
  domain?: GovernanceDomain;
  caseId?: string;
  poNumber?: string;
  decisionType?: DecisionType;
  actor?: string;
  since?: string;
  until?: string;
  irreversibleOnly?: boolean;
  limit?: number;
}

const MAX_LOG_ENTRIES = 2000;

export function createDecisionLogStore(): DecisionLogStore {
  let entries: DecisionLogEntry[] = [];

  function applyFilter(list: DecisionLogEntry[], filter?: DecisionLogFilter): DecisionLogEntry[] {
    if (!filter) return list;
    let result = list;
    if (filter.domain) result = result.filter(e => e.domain === filter.domain);
    if (filter.caseId) result = result.filter(e => e.caseId === filter.caseId);
    if (filter.poNumber) result = result.filter(e => e.poNumber === filter.poNumber);
    if (filter.decisionType) result = result.filter(e => e.decisionType === filter.decisionType);
    if (filter.actor) result = result.filter(e => e.actor === filter.actor);
    if (filter.since) result = result.filter(e => e.loggedAt >= filter.since!);
    if (filter.until) result = result.filter(e => e.loggedAt <= filter.until!);
    if (filter.irreversibleOnly) result = result.filter(e => e.irreversible);
    const limit = filter.limit ?? MAX_LOG_ENTRIES;
    return result.slice(-limit);
  }

  return {
    append(entry: DecisionLogEntry) {
      entries.push(Object.freeze({ ...entry }));
      if (entries.length > MAX_LOG_ENTRIES) {
        entries = entries.slice(-MAX_LOG_ENTRIES);
      }
    },
    getEntries(filter?: DecisionLogFilter) {
      return applyFilter(entries, filter);
    },
    getEntryCount() {
      return entries.length;
    },
    getEntriesByCaseId(caseId: string) {
      return entries.filter(e => e.caseId === caseId);
    },
    getEntriesByPONumber(poNumber: string) {
      return entries.filter(e => e.poNumber === poNumber);
    },
    getIrreversibleEntries(filter?: DecisionLogFilter) {
      return applyFilter(entries.filter(e => e.irreversible), filter);
    },
  };
}

// ── Event → Decision Log Entry 변환 ──

/**
 * GovernanceEvent를 DecisionLogEntry로 변환.
 * label은 모두 grammar registry에서 resolve.
 */
export function eventToDecisionLogEntry(
  event: GovernanceEvent,
  context: {
    decisionType: DecisionType;
    blockersActiveAtDecision: BlockerSnapshot[];
    complianceGatePassed: boolean;
    complianceGateDetail: string | null;
  },
): DecisionLogEntry {
  const isIrreversible = classifyEventIrreversibility(event);

  return {
    logId: `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    sourceEventId: event.eventId,
    loggedAt: new Date().toISOString(),
    domain: event.domain,
    chainStage: event.chainStage,
    caseId: event.caseId,
    poNumber: event.poNumber,
    decisionType: context.decisionType,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    fromStatusLabel: getStatusLabel(event.domain, event.fromStatus),
    toStatusLabel: getStatusLabel(event.domain, event.toStatus),
    actor: event.actor,
    detail: event.detail,
    irreversible: isIrreversible,
    severity: event.severity as UnifiedSeverity,
    severityLabel: SEVERITY_SPEC[event.severity as UnifiedSeverity]?.label ?? event.severity,
    blockersActiveAtDecision: context.blockersActiveAtDecision,
    complianceGatePassed: context.complianceGatePassed,
    complianceGateDetail: context.complianceGateDetail,
  };
}

/**
 * 이벤트의 irreversibility 판정.
 * dock action grammar에서 해당 이벤트가 irreversible action에 해당하는지 확인.
 */
export function classifyEventIrreversibility(event: GovernanceEvent): boolean {
  const matchingAction = DOCK_ACTION_GRAMMAR.find(
    a => a.domain === event.domain && a.actionKey === event.eventType,
  );
  if (matchingAction) return matchingAction.risk === "irreversible";

  // status transition to terminal → irreversible by nature
  const terminalEventTypes = ["sent", "confirmed", "received", "released", "cancelled"];
  if (terminalEventTypes.some(t => event.toStatus.includes(t))) return true;

  return false;
}

// ── Event Bus → Decision Log 자동 연결 ──

/**
 * Event bus를 decision log store에 자동 연결.
 * bus의 모든 이벤트를 decision log entry로 변환하여 append.
 */
export function attachAuditToEventBus(
  bus: GovernanceEventBus,
  store: DecisionLogStore,
  resolveContext?: (event: GovernanceEvent) => {
    decisionType: DecisionType;
    blockersActiveAtDecision: BlockerSnapshot[];
    complianceGatePassed: boolean;
    complianceGateDetail: string | null;
  },
): string {
  return bus.subscribe({
    domains: [],
    chainStages: [],
    caseId: null,
    poNumber: null,
    severities: [],
    handler(event: GovernanceEvent) {
      const context = resolveContext
        ? resolveContext(event)
        : inferDecisionContext(event);
      const entry = eventToDecisionLogEntry(event, context);
      store.append(entry);
    },
  });
}

/**
 * 기본 decision context 추론.
 * resolveContext가 제공되지 않았을 때 event 내용으로 추론.
 */
export function inferDecisionContext(event: GovernanceEvent): {
  decisionType: DecisionType;
  blockersActiveAtDecision: BlockerSnapshot[];
  complianceGatePassed: boolean;
  complianceGateDetail: string | null;
} {
  let decisionType: DecisionType = "status_transition";

  if (event.eventType.includes("cancel")) decisionType = "cancellation";
  else if (event.eventType.includes("reopen")) decisionType = "reopen";
  else if (event.eventType.includes("handoff")) decisionType = "handoff";
  else if (event.eventType.includes("invalidat")) decisionType = "snapshot_invalidation";
  else if (event.eventType.includes("blocker_resolved")) decisionType = "blocker_resolved";
  else if (event.eventType.includes("blocker_added")) decisionType = "blocker_added";
  else {
    const isIrreversible = classifyEventIrreversibility(event);
    decisionType = isIrreversible ? "irreversible_action" : "status_transition";
  }

  return {
    decisionType,
    blockersActiveAtDecision: [],
    complianceGatePassed: decisionType !== "irreversible_action",
    complianceGateDetail: null,
  };
}

// ══════════════════════════════════════════════════════
// 2. Compliance Snapshot — 시점의 governance 상태 캡처
// ══════════════════════════════════════════════════════

/**
 * 특정 시점의 governance chain 상태를 캡처.
 * "이 시점에 chain이 이 상태였다"를 증명하는 문서.
 */
export interface ComplianceSnapshot {
  /** Unique snapshot ID */
  snapshotId: string;
  /** When captured */
  capturedAt: string;
  /** Why captured (trigger) */
  trigger: ComplianceTrigger;
  /** Who/what triggered */
  triggeredBy: string;

  // ── Chain state ──
  /** PO number */
  poNumber: string;
  /** Case ID */
  caseId: string;
  /** Current stage (label from grammar) */
  currentStage: QuoteChainStage;
  currentStageLabel: string;
  /** Per-domain status at capture time */
  domainStatuses: DomainStatusSnapshot[];
  /** Active blockers at capture time */
  activeBlockers: BlockerSnapshot[];
  /** Hard blocker count */
  hardBlockerCount: number;
  /** Soft blocker count */
  softBlockerCount: number;

  // ── Compliance evaluation ──
  /** Overall compliance verdict */
  verdict: ComplianceVerdict;
  /** Reasons for the verdict */
  verdictReasons: string[];
  /** Was an irreversible action taken in this snapshot window */
  irreversibleActionTaken: boolean;
  /** Compliance gate status */
  complianceGateStatus: "passed" | "failed" | "not_required";
  /** Recent decision count in snapshot window */
  recentDecisionCount: number;
}

export type ComplianceTrigger =
  | "irreversible_action_pre"
  | "irreversible_action_post"
  | "stage_transition"
  | "blocker_resolution"
  | "periodic_audit"
  | "manual_request"
  | "chain_completion";

export type ComplianceVerdict = "compliant" | "non_compliant" | "needs_review";

export interface DomainStatusSnapshot {
  domain: GovernanceDomain;
  status: string;
  statusLabel: string;
  statusCategory: StatusCategory;
  isTerminal: boolean;
}

// ── Compliance Snapshot Builder ──

export function createComplianceSnapshot(params: {
  trigger: ComplianceTrigger;
  triggeredBy: string;
  poNumber: string;
  caseId: string;
  currentStage: QuoteChainStage;
  domainStatuses: Array<{
    domain: GovernanceDomain;
    status: string;
    category: StatusCategory;
    isTerminal: boolean;
  }>;
  activeBlockers: BlockerSnapshot[];
  recentDecisions: DecisionLogEntry[];
}): ComplianceSnapshot {
  const stageLabel = getStageLabel(params.currentStage);
  const hardBlockers = params.activeBlockers.filter(b => b.severity === "hard");
  const softBlockers = params.activeBlockers.filter(b => b.severity === "soft");

  const domainStatuses: DomainStatusSnapshot[] = params.domainStatuses.map(ds => ({
    domain: ds.domain,
    status: ds.status,
    statusLabel: getStatusLabel(ds.domain, ds.status),
    statusCategory: ds.category,
    isTerminal: ds.isTerminal,
  }));

  const irreversibleActionTaken = params.recentDecisions.some(d => d.irreversible);
  const verdict = evaluateCompliance(hardBlockers, irreversibleActionTaken, params.trigger);
  const verdictReasons = buildVerdictReasons(hardBlockers, softBlockers, irreversibleActionTaken, params.trigger);

  let complianceGateStatus: "passed" | "failed" | "not_required" = "not_required";
  if (params.trigger === "irreversible_action_pre") {
    complianceGateStatus = hardBlockers.length === 0 ? "passed" : "failed";
  }

  return {
    snapshotId: `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    capturedAt: new Date().toISOString(),
    trigger: params.trigger,
    triggeredBy: params.triggeredBy,
    poNumber: params.poNumber,
    caseId: params.caseId,
    currentStage: params.currentStage,
    currentStageLabel: stageLabel,
    domainStatuses,
    activeBlockers: params.activeBlockers,
    hardBlockerCount: hardBlockers.length,
    softBlockerCount: softBlockers.length,
    verdict,
    verdictReasons,
    irreversibleActionTaken,
    complianceGateStatus,
    recentDecisionCount: params.recentDecisions.length,
  };
}

function evaluateCompliance(
  hardBlockers: BlockerSnapshot[],
  irreversibleActionTaken: boolean,
  trigger: ComplianceTrigger,
): ComplianceVerdict {
  // irreversible action with hard blockers = non-compliant
  if (trigger === "irreversible_action_pre" && hardBlockers.length > 0) {
    return "non_compliant";
  }
  // any hard blocker present = needs review
  if (hardBlockers.length > 0) {
    return "needs_review";
  }
  return "compliant";
}

function buildVerdictReasons(
  hardBlockers: BlockerSnapshot[],
  softBlockers: BlockerSnapshot[],
  irreversibleActionTaken: boolean,
  trigger: ComplianceTrigger,
): string[] {
  const reasons: string[] = [];

  if (hardBlockers.length > 0) {
    reasons.push(`${hardBlockers.length}건의 ${BLOCKER_SEVERITY_SPEC.hard.label} 차단 조건 활성`);
  }
  if (softBlockers.length > 0) {
    reasons.push(`${softBlockers.length}건의 ${BLOCKER_SEVERITY_SPEC.soft.label} 조건 활성`);
  }
  if (trigger === "irreversible_action_pre" && hardBlockers.length > 0) {
    reasons.push("비가역 조치 실행 전 차단 조건 미해소");
  }
  if (irreversibleActionTaken) {
    reasons.push("비가역 조치가 이 기간에 실행됨");
  }
  if (reasons.length === 0) {
    reasons.push("모든 compliance 조건 충족");
  }

  return reasons;
}

// ── Compliance Snapshot Store ──

export interface ComplianceSnapshotStore {
  save: (snapshot: ComplianceSnapshot) => void;
  getSnapshots: (filter?: ComplianceSnapshotFilter) => ComplianceSnapshot[];
  getSnapshotCount: () => number;
  getLatestByPO: (poNumber: string) => ComplianceSnapshot | null;
  getNonCompliant: () => ComplianceSnapshot[];
}

export interface ComplianceSnapshotFilter {
  poNumber?: string;
  caseId?: string;
  trigger?: ComplianceTrigger;
  verdict?: ComplianceVerdict;
  since?: string;
  limit?: number;
}

const MAX_SNAPSHOTS = 1000;

export function createComplianceSnapshotStore(): ComplianceSnapshotStore {
  let snapshots: ComplianceSnapshot[] = [];

  return {
    save(snapshot: ComplianceSnapshot) {
      snapshots.push(Object.freeze({ ...snapshot }) as ComplianceSnapshot);
      if (snapshots.length > MAX_SNAPSHOTS) {
        snapshots = snapshots.slice(-MAX_SNAPSHOTS);
      }
    },
    getSnapshots(filter?: ComplianceSnapshotFilter) {
      let result = [...snapshots];
      if (filter?.poNumber) result = result.filter(s => s.poNumber === filter.poNumber);
      if (filter?.caseId) result = result.filter(s => s.caseId === filter.caseId);
      if (filter?.trigger) result = result.filter(s => s.trigger === filter.trigger);
      if (filter?.verdict) result = result.filter(s => s.verdict === filter.verdict);
      if (filter?.since) result = result.filter(s => s.capturedAt >= filter.since!);
      const limit = filter?.limit ?? MAX_SNAPSHOTS;
      return result.slice(-limit);
    },
    getSnapshotCount() {
      return snapshots.length;
    },
    getLatestByPO(poNumber: string) {
      const matching = snapshots.filter(s => s.poNumber === poNumber);
      return matching.length > 0 ? matching[matching.length - 1] : null;
    },
    getNonCompliant() {
      return snapshots.filter(s => s.verdict === "non_compliant");
    },
  };
}

// ══════════════════════════════════════════════════════
// 3. Chain Audit Summary — PO 단위 전체 감사 요약
// ══════════════════════════════════════════════════════

/**
 * 하나의 PO에 대한 전체 governance chain 감사 요약.
 * decision log + compliance snapshot을 결합하여 생성.
 */
export interface ChainAuditSummary {
  /** PO number */
  poNumber: string;
  /** Case ID */
  caseId: string;
  /** Generated at */
  generatedAt: string;

  // ── Timeline ──
  /** Total decision count */
  totalDecisions: number;
  /** Irreversible decision count */
  irreversibleDecisions: number;
  /** Decision type breakdown */
  decisionBreakdown: Record<DecisionType, number>;
  /** First decision timestamp */
  firstDecisionAt: string | null;
  /** Last decision timestamp */
  lastDecisionAt: string | null;
  /** Duration (ms) from first to last decision */
  chainDurationMs: number | null;

  // ── Stage progression ──
  /** Stages visited (in order) with labels from grammar */
  stagesVisited: Array<{ stage: QuoteChainStage; stageLabel: string; enteredAt: string }>;
  /** Current stage */
  currentStage: QuoteChainStage | null;
  currentStageLabel: string | null;

  // ── Compliance ──
  /** Total compliance snapshots taken */
  complianceSnapshotCount: number;
  /** Non-compliant snapshot count */
  nonCompliantCount: number;
  /** Latest compliance verdict */
  latestVerdict: ComplianceVerdict | null;
  /** Compliance score (compliant / total, 0-1) */
  complianceScore: number | null;

  // ── Domain participation ──
  /** Which domains participated */
  domainsParticipated: GovernanceDomain[];
  /** Per-domain decision count */
  domainDecisionCounts: Partial<Record<GovernanceDomain, number>>;

  // ── Actor summary ──
  /** Unique actors involved */
  actors: string[];
  /** Per-actor decision count */
  actorDecisionCounts: Record<string, number>;
}

/**
 * PO 단위 전체 감사 요약 생성.
 * decision log + compliance snapshot store에서 데이터 수집.
 */
export function buildChainAuditSummary(
  poNumber: string,
  decisionStore: DecisionLogStore,
  complianceStore: ComplianceSnapshotStore,
): ChainAuditSummary {
  const decisions = decisionStore.getEntriesByPONumber(poNumber);
  const snapshots = complianceStore.getSnapshots({ poNumber });

  const caseId = decisions.length > 0 ? decisions[0].caseId : "";
  const firstDecision = decisions.length > 0 ? decisions[0] : null;
  const lastDecision = decisions.length > 0 ? decisions[decisions.length - 1] : null;

  // Decision type breakdown
  const decisionBreakdown: Record<DecisionType, number> = {
    status_transition: 0,
    blocker_resolved: 0,
    blocker_added: 0,
    irreversible_action: 0,
    reversible_action: 0,
    snapshot_invalidation: 0,
    handoff: 0,
    reopen: 0,
    cancellation: 0,
  };
  for (const d of decisions) {
    decisionBreakdown[d.decisionType]++;
  }

  // Stages visited (unique, in order of first appearance)
  const stagesVisited: Array<{ stage: QuoteChainStage; stageLabel: string; enteredAt: string }> = [];
  const seenStages = new Set<QuoteChainStage>();
  for (const d of decisions) {
    if (d.chainStage && !seenStages.has(d.chainStage)) {
      seenStages.add(d.chainStage);
      stagesVisited.push({
        stage: d.chainStage,
        stageLabel: getStageLabel(d.chainStage),
        enteredAt: d.loggedAt,
      });
    }
  }

  // Domain participation
  const domainDecisionCounts: Partial<Record<GovernanceDomain, number>> = {};
  for (const d of decisions) {
    domainDecisionCounts[d.domain] = (domainDecisionCounts[d.domain] ?? 0) + 1;
  }

  // Actor summary
  const actorDecisionCounts: Record<string, number> = {};
  for (const d of decisions) {
    actorDecisionCounts[d.actor] = (actorDecisionCounts[d.actor] ?? 0) + 1;
  }

  // Compliance
  const nonCompliant = snapshots.filter(s => s.verdict === "non_compliant");
  const compliant = snapshots.filter(s => s.verdict === "compliant");
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  let chainDurationMs: number | null = null;
  if (firstDecision && lastDecision) {
    chainDurationMs = new Date(lastDecision.loggedAt).getTime() - new Date(firstDecision.loggedAt).getTime();
  }

  return {
    poNumber,
    caseId,
    generatedAt: new Date().toISOString(),
    totalDecisions: decisions.length,
    irreversibleDecisions: decisions.filter(d => d.irreversible).length,
    decisionBreakdown,
    firstDecisionAt: firstDecision?.loggedAt ?? null,
    lastDecisionAt: lastDecision?.loggedAt ?? null,
    chainDurationMs,
    stagesVisited,
    currentStage: lastDecision?.chainStage ?? null,
    currentStageLabel: lastDecision?.chainStage ? getStageLabel(lastDecision.chainStage) : null,
    complianceSnapshotCount: snapshots.length,
    nonCompliantCount: nonCompliant.length,
    latestVerdict: latestSnapshot?.verdict ?? null,
    complianceScore: snapshots.length > 0 ? compliant.length / snapshots.length : null,
    domainsParticipated: Object.keys(domainDecisionCounts) as GovernanceDomain[],
    domainDecisionCounts,
    actors: Object.keys(actorDecisionCounts),
    actorDecisionCounts,
  };
}
