/**
 * Governance Event Bus — 전체 governance chain의 이벤트 중앙 허브
 *
 * Quote → Approval → PO → Dispatch → Supplier Confirmation → Receiving → Stock Release → Reorder Decision
 * 전 체인에 걸쳐 이벤트 발행/구독/targeted invalidation을 관리.
 *
 * IMMUTABLE RULES:
 * 1. event bus는 truth를 변경하지 않음 — 변경은 각 engine 함수에서만
 * 2. bus는 "무슨 일이 일어났다"를 전파하고, listener가 재계산을 trigger
 * 3. broad global refresh 금지 — targeted invalidation만 허용
 * 4. 각 engine의 event type을 통합하되, engine import는 type-only
 * 5. subscriber는 관심 있는 stage/scope만 구독
 * 6. event는 불변 — 발행 후 수정 불가
 * 7. 동기 dispatch — side effect는 subscriber 책임
 */

import type { QuoteChainStage } from "./quote-approval-governance-engine";

// ══════════════════════════════════════════════
// Governance Domain — 각 engine의 governance 영역
// ══════════════════════════════════════════════

export type GovernanceDomain =
  | "quote_chain"         // quote-approval-governance-engine
  | "dispatch_prep"       // po-dispatch-governance-engine
  | "dispatch_execution"  // dispatch-execution-engine
  | "supplier_confirmation" // supplier-confirmation-governance-engine
  | "receiving_prep"      // receiving-preparation-governance-engine
  | "receiving_execution" // receiving-execution-governance-engine
  | "stock_release"       // stock-release-governance-engine
  | "reorder_decision";   // reorder-decision-governance-engine

// ══════════════════════════════════════════════
// Unified Governance Event
// ══════════════════════════════════════════════

export type GovernanceEventSeverity = "info" | "warning" | "critical";

export interface GovernanceEvent {
  /** Unique event ID */
  eventId: string;
  /** Which governance domain emitted this */
  domain: GovernanceDomain;
  /** Specific event type string from the originating engine */
  eventType: string;
  /** Case this event belongs to */
  caseId: string;
  /** PO number for chain-wide correlation */
  poNumber: string;
  /** Status before the change */
  fromStatus: string;
  /** Status after the change */
  toStatus: string;
  /** Who triggered this */
  actor: string;
  /** When */
  timestamp: string;
  /** Human-readable detail */
  detail: string;
  /** Severity for prioritization */
  severity: GovernanceEventSeverity;
  /** Which chain stage this maps to (if applicable) */
  chainStage: QuoteChainStage | null;
  /** Specific object IDs affected — for targeted invalidation */
  affectedObjectIds: string[];
  /** Payload — engine-specific data (opaque to bus) */
  payload: Record<string, unknown>;
}

// ══════════════════════════════════════════════
// Subscription — 관심 영역만 구독
// ══════════════════════════════════════════════

export interface EventSubscription {
  subscriptionId: string;
  /** Filter by domain (empty = all) */
  domains: GovernanceDomain[];
  /** Filter by chain stage (empty = all) */
  chainStages: QuoteChainStage[];
  /** Filter by case ID (null = all) */
  caseId: string | null;
  /** Filter by PO number (null = all) */
  poNumber: string | null;
  /** Filter by severity (empty = all) */
  severities: GovernanceEventSeverity[];
  /** Callback */
  handler: (event: GovernanceEvent) => void;
}

// ══════════════════════════════════════════════
// Event Bus — 발행/구독 허브
// ══════════════════════════════════════════════

export interface GovernanceEventBus {
  /** Publish an event to all matching subscribers */
  publish: (event: GovernanceEvent) => void;
  /** Subscribe to events matching the filter */
  subscribe: (filter: Omit<EventSubscription, "subscriptionId">) => string;
  /** Unsubscribe */
  unsubscribe: (subscriptionId: string) => void;
  /** Get event history (bounded) */
  getHistory: (filter?: EventHistoryFilter) => GovernanceEvent[];
  /** Clear history */
  clearHistory: () => void;
  /** Get subscription count */
  getSubscriptionCount: () => number;
}

export interface EventHistoryFilter {
  domain?: GovernanceDomain;
  caseId?: string;
  poNumber?: string;
  chainStage?: QuoteChainStage;
  limit?: number;
  since?: string;
}

/** Default history limit */
const MAX_HISTORY = 500;

export function createGovernanceEventBus(): GovernanceEventBus {
  let subscriptions: EventSubscription[] = [];
  let history: GovernanceEvent[] = [];
  let nextSubId = 1;

  function matchesSubscription(event: GovernanceEvent, sub: EventSubscription): boolean {
    if (sub.domains.length > 0 && !sub.domains.includes(event.domain)) return false;
    if (sub.chainStages.length > 0 && event.chainStage && !sub.chainStages.includes(event.chainStage)) return false;
    if (sub.caseId && event.caseId !== sub.caseId) return false;
    if (sub.poNumber && event.poNumber !== sub.poNumber) return false;
    if (sub.severities.length > 0 && !sub.severities.includes(event.severity)) return false;
    return true;
  }

  return {
    publish(event: GovernanceEvent) {
      // Freeze the event — immutable after publish
      const frozenEvent = Object.freeze({ ...event });

      // Store in history (bounded)
      history.push(frozenEvent);
      if (history.length > MAX_HISTORY) {
        history = history.slice(-MAX_HISTORY);
      }

      // Dispatch to matching subscribers
      for (const sub of subscriptions) {
        if (matchesSubscription(frozenEvent, sub)) {
          try {
            sub.handler(frozenEvent);
          } catch {
            // subscriber error doesn't break bus
          }
        }
      }
    },

    subscribe(filter) {
      const subscriptionId = `sub_${nextSubId++}`;
      subscriptions.push({ subscriptionId, ...filter });
      return subscriptionId;
    },

    unsubscribe(subscriptionId: string) {
      subscriptions = subscriptions.filter(s => s.subscriptionId !== subscriptionId);
    },

    getHistory(filter?: EventHistoryFilter) {
      let result = [...history];
      if (filter?.domain) result = result.filter(e => e.domain === filter.domain);
      if (filter?.caseId) result = result.filter(e => e.caseId === filter.caseId);
      if (filter?.poNumber) result = result.filter(e => e.poNumber === filter.poNumber);
      if (filter?.chainStage) result = result.filter(e => e.chainStage === filter.chainStage);
      if (filter?.since) result = result.filter(e => e.timestamp >= filter.since!);
      const limit = filter?.limit ?? MAX_HISTORY;
      return result.slice(-limit);
    },

    clearHistory() {
      history = [];
    },

    getSubscriptionCount() {
      return subscriptions.length;
    },
  };
}

// ══════════════════════════════════════════════
// Global Singleton — cross-domain 공유 버스
//
// 여러 engine이 동일 bus instance를 공유해야 publish/subscribe가 실제로 연결된다.
// 모듈 별로 개별 singleton을 만들면 listener가 이벤트를 받지 못한다.
// ══════════════════════════════════════════════

let _globalBus: GovernanceEventBus | null = null;

/** 프로세스 전역 governance event bus. 모든 publisher/subscriber가 공유 */
export function getGlobalGovernanceEventBus(): GovernanceEventBus {
  if (!_globalBus) {
    _globalBus = createGovernanceEventBus();
  }
  return _globalBus;
}

/** 테스트 전용: 전역 bus 리셋 */
export function resetGlobalGovernanceEventBus(): void {
  if (_globalBus) {
    _globalBus.clearHistory();
  }
  _globalBus = null;
}

// ══════════════════════════════════════════════
// Event Factory — 각 domain에서 GovernanceEvent 생성 도우미
// ══════════════════════════════════════════════

export function createGovernanceEvent(
  domain: GovernanceDomain,
  eventType: string,
  params: {
    caseId: string;
    poNumber: string;
    fromStatus: string;
    toStatus: string;
    actor: string;
    detail: string;
    severity?: GovernanceEventSeverity;
    chainStage?: QuoteChainStage | null;
    affectedObjectIds?: string[];
    payload?: Record<string, unknown>;
  },
): GovernanceEvent {
  return {
    eventId: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    domain,
    eventType,
    caseId: params.caseId,
    poNumber: params.poNumber,
    fromStatus: params.fromStatus,
    toStatus: params.toStatus,
    actor: params.actor,
    timestamp: new Date().toISOString(),
    detail: params.detail,
    severity: params.severity ?? "info",
    chainStage: params.chainStage ?? null,
    affectedObjectIds: params.affectedObjectIds ?? [],
    payload: params.payload ?? {},
  };
}

// ══════════════════════════════════════════════
// Targeted Invalidation — 이벤트에 의한 downstream refresh 규칙
// ══════════════════════════════════════════════

/**
 * InvalidationScope:
 * - "surface_only" — UI surface만 재계산 (readiness, blocker, dock actions)
 * - "readiness_recompute" — readiness/blocker/checklist 재계산 + surface
 * - "state_transition_check" — 상태 전이 필요 여부까지 확인
 * - "handoff_invalidate" — 기존 handoff 무효화
 */
export type InvalidationScope =
  | "surface_only"
  | "readiness_recompute"
  | "state_transition_check"
  | "handoff_invalidate";

export interface InvalidationTarget {
  /** Which domain needs invalidation */
  targetDomain: GovernanceDomain;
  /** Which chain stage */
  targetStage: QuoteChainStage | null;
  /** How deep the invalidation goes */
  scope: InvalidationScope;
  /** Reason for invalidation */
  reason: string;
}

export interface InvalidationRule {
  /** Which domain/event triggers this rule */
  sourceDomain: GovernanceDomain;
  /** Which event types trigger (empty = all from this domain) */
  sourceEventTypes: string[];
  /** What gets invalidated */
  targets: InvalidationTarget[];
}

/**
 * Canonical invalidation rules — upstream → downstream 관계 매핑
 *
 * 규칙: 각 행은 "source에서 이 이벤트가 나오면, target의 이 범위를 invalidate"
 */
export const GOVERNANCE_INVALIDATION_RULES: InvalidationRule[] = [
  // ── Smart Sourcing → Quote Chain (AI 분석 결과 handoff) ──
  {
    sourceDomain: "quote_chain",
    sourceEventTypes: ["comparison_handed_off"],
    targets: [
      { targetDomain: "quote_chain", targetStage: "quote_review", scope: "state_transition_check", reason: "AI 견적 비교 결과 → 견적 요청 handoff" },
    ],
  },
  {
    sourceDomain: "quote_chain",
    sourceEventTypes: ["bom_registered_to_queue"],
    targets: [
      { targetDomain: "quote_chain", targetStage: "quote_review", scope: "surface_only", reason: "BOM 품목 발주 대기열 등록" },
    ],
  },
  {
    sourceDomain: "quote_chain",
    sourceEventTypes: ["context_stale_detected"],
    targets: [
      { targetDomain: "quote_chain", targetStage: "quote_review", scope: "surface_only", reason: "AI 분석 입력 변경 → 결과 stale" },
    ],
  },
  // ── D-3: Sourcing → Quote Workqueue (request submission lifecycle) ──
  {
    sourceDomain: "quote_chain",
    sourceEventTypes: ["request_submission_executed"],
    targets: [
      { targetDomain: "quote_chain", targetStage: "quote_review", scope: "surface_only", reason: "견적 요청 제출 실행 → workqueue surface 재계산" },
    ],
  },
  {
    sourceDomain: "quote_chain",
    sourceEventTypes: ["request_submission_handed_off_to_workqueue"],
    targets: [
      { targetDomain: "quote_chain", targetStage: "quote_review", scope: "state_transition_check", reason: "견적 요청이 워크큐로 진입" },
    ],
  },

  // ── Quote/Approval chain → Dispatch ──
  {
    sourceDomain: "quote_chain",
    sourceEventTypes: ["approval_snapshot_invalidated", "po_conversion_reopened"],
    targets: [
      { targetDomain: "dispatch_prep", targetStage: "dispatch_prep", scope: "readiness_recompute", reason: "approval/conversion snapshot 변경" },
    ],
  },

  // ── Dispatch Prep self-invalidation: PO 본문 사후 변경 (B2-h publish 결선) ──
  {
    sourceDomain: "dispatch_prep",
    sourceEventTypes: ["po_data_changed_after_approval"],
    targets: [
      { targetDomain: "dispatch_prep", targetStage: "dispatch_prep", scope: "readiness_recompute", reason: "approval 이후 PO 본문 변경 — readiness/blocker 재계산" },
      { targetDomain: "dispatch_execution", targetStage: "sent", scope: "state_transition_check", reason: "발송 직전 데이터 변경 — irreversible action lock" },
    ],
  },

  // ── Dispatch Prep → Dispatch Execution ──
  {
    sourceDomain: "dispatch_prep",
    sourceEventTypes: ["dispatch_prep_readiness_changed", "dispatch_prep_blocked", "dispatch_prep_send_scheduled", "dispatch_prep_cancelled"],
    targets: [
      { targetDomain: "dispatch_execution", targetStage: "sent", scope: "state_transition_check", reason: "dispatch prep 상태 변경" },
    ],
  },

  // ── Dispatch Execution → Supplier Confirmation ──
  {
    sourceDomain: "dispatch_execution",
    sourceEventTypes: ["dispatch_sent", "dispatch_delivery_confirmed", "dispatch_failed"],
    targets: [
      { targetDomain: "supplier_confirmation", targetStage: "supplier_confirmed", scope: "readiness_recompute", reason: "outbound execution 상태 변경" },
    ],
  },

  // ── Supplier Confirmation → Receiving Prep ──
  {
    sourceDomain: "supplier_confirmation",
    sourceEventTypes: [
      "confirmation_gov_confirmed", "confirmation_gov_partially_confirmed",
      "confirmation_gov_change_requested", "confirmation_gov_correction_submitted",
      "supplier_profile_changed",
    ],
    targets: [
      { targetDomain: "receiving_prep", targetStage: "receiving_prep", scope: "readiness_recompute", reason: "supplier confirmation 변경" },
    ],
  },

  // ── Receiving Prep → Receiving Execution ──
  {
    sourceDomain: "receiving_prep",
    sourceEventTypes: [
      "receiving_prep_created", "receiving_prep_readiness_changed",
      "receiving_prep_scheduled", "receiving_prep_cancelled",
    ],
    targets: [
      { targetDomain: "receiving_execution", targetStage: null, scope: "state_transition_check", reason: "receiving prep 상태 변경" },
    ],
  },

  // ── Receiving Execution → Stock Release ──
  {
    sourceDomain: "receiving_execution",
    sourceEventTypes: [
      "receiving_gov_received", "receiving_gov_partially_received",
      "receiving_gov_discrepancy", "receiving_gov_quarantined",
      "discrepancy_resolved",
    ],
    targets: [
      { targetDomain: "stock_release", targetStage: "stock_release", scope: "readiness_recompute", reason: "receiving execution 변경" },
    ],
  },

  // ── Stock Release → Reorder Decision ──
  {
    sourceDomain: "stock_release",
    sourceEventTypes: [
      "stock_release_full", "stock_release_partial",
      "stock_release_hold_placed", "stock_release_hold_resolved",
      "stock_release_line_evaluated",
    ],
    targets: [
      { targetDomain: "reorder_decision", targetStage: "reorder_decision", scope: "readiness_recompute", reason: "stock release 변경" },
    ],
  },

  // ── Reorder Decision → Quote Chain (re-entry) ──
  {
    sourceDomain: "reorder_decision",
    sourceEventTypes: [
      "reorder_procurement_reentry_ready",
      "procurement_reentry_handoff_created",
    ],
    targets: [
      { targetDomain: "quote_chain", targetStage: "quote_review", scope: "state_transition_check", reason: "procurement re-entry 시작" },
    ],
  },

  // ── Cross-cutting: Supplier Profile 변경은 Dispatch + Confirmation + Receiving에 영향 ──
  {
    sourceDomain: "supplier_confirmation",
    sourceEventTypes: ["supplier_profile_changed"],
    targets: [
      { targetDomain: "dispatch_prep", targetStage: "dispatch_prep", scope: "readiness_recompute", reason: "supplier master 변경" },
      { targetDomain: "receiving_prep", targetStage: "receiving_prep", scope: "readiness_recompute", reason: "supplier master 변경" },
    ],
  },

  // ── Cross-cutting: Policy hold 변경은 Dispatch + Stock Release에 영향 ──
  {
    sourceDomain: "quote_chain",
    sourceEventTypes: ["policy_hold_changed"],
    targets: [
      { targetDomain: "dispatch_prep", targetStage: "dispatch_prep", scope: "readiness_recompute", reason: "policy hold 변경" },
      { targetDomain: "stock_release", targetStage: "stock_release", scope: "readiness_recompute", reason: "policy hold 변경" },
    ],
  },

  // ── Cross-cutting: Attachment 변경은 Dispatch Prep에 영향 ──
  {
    sourceDomain: "quote_chain",
    sourceEventTypes: ["attachment_added", "attachment_removed"],
    targets: [
      { targetDomain: "dispatch_prep", targetStage: "dispatch_prep", scope: "surface_only", reason: "첨부파일 변경" },
    ],
  },

  // ── Upstream reopens → downstream handoff invalidation ──
  {
    sourceDomain: "dispatch_prep",
    sourceEventTypes: ["dispatch_prep_po_conversion_reopened"],
    targets: [
      { targetDomain: "dispatch_execution", targetStage: "sent", scope: "handoff_invalidate", reason: "PO conversion 재열기" },
    ],
  },
  {
    sourceDomain: "receiving_prep",
    sourceEventTypes: ["receiving_prep_confirmation_reopened"],
    targets: [
      { targetDomain: "receiving_execution", targetStage: null, scope: "handoff_invalidate", reason: "supplier confirmation 재열기" },
    ],
  },
  {
    sourceDomain: "receiving_execution",
    sourceEventTypes: ["receiving_gov_cancelled"],
    targets: [
      { targetDomain: "stock_release", targetStage: "stock_release", scope: "handoff_invalidate", reason: "receiving execution 취소" },
    ],
  },
  {
    sourceDomain: "stock_release",
    sourceEventTypes: ["stock_release_cancelled"],
    targets: [
      { targetDomain: "reorder_decision", targetStage: "reorder_decision", scope: "handoff_invalidate", reason: "stock release 취소" },
    ],
  },
];

// ══════════════════════════════════════════════
// Invalidation Resolver — 이벤트 → 영향 범위 계산
// ══════════════════════════════════════════════

export interface InvalidationResult {
  event: GovernanceEvent;
  invalidatedTargets: InvalidationTarget[];
  hasInvalidation: boolean;
}

export function resolveInvalidation(event: GovernanceEvent): InvalidationResult {
  const invalidated: InvalidationTarget[] = [];

  for (const rule of GOVERNANCE_INVALIDATION_RULES) {
    if (rule.sourceDomain !== event.domain) continue;
    if (rule.sourceEventTypes.length > 0 && !rule.sourceEventTypes.includes(event.eventType)) continue;

    invalidated.push(...rule.targets);
  }

  return {
    event,
    invalidatedTargets: invalidated,
    hasInvalidation: invalidated.length > 0,
  };
}

// ══════════════════════════════════════════════
// Auto-Invalidation Subscriber — bus에 붙여서 자동 invalidation 실행
// ══════════════════════════════════════════════

export interface InvalidationCallback {
  (target: InvalidationTarget, event: GovernanceEvent): void;
}

/**
 * bus에 자동 invalidation listener를 등록.
 * event가 들어올 때마다 rule을 조회하고, 매칭되는 target에 대해 callback 호출.
 */
export function attachAutoInvalidation(
  bus: GovernanceEventBus,
  onInvalidate: InvalidationCallback,
): string {
  return bus.subscribe({
    domains: [],
    chainStages: [],
    caseId: null,
    poNumber: null,
    severities: [],
    handler: (event) => {
      const result = resolveInvalidation(event);
      if (result.hasInvalidation) {
        for (const target of result.invalidatedTargets) {
          onInvalidate(target, event);
        }
      }
    },
  });
}

// ══════════════════════════════════════════════
// Event Correlation — 같은 PO/case의 이벤트 체인 추적
// ══════════════════════════════════════════════

export interface EventCorrelation {
  poNumber: string;
  caseId: string;
  events: GovernanceEvent[];
  domainsCovered: GovernanceDomain[];
  stagesCovered: QuoteChainStage[];
  latestEvent: GovernanceEvent;
  hasWarnings: boolean;
  hasCritical: boolean;
}

export function buildEventCorrelation(
  bus: GovernanceEventBus,
  poNumber: string,
): EventCorrelation | null {
  const events = bus.getHistory({ poNumber });
  if (events.length === 0) return null;

  const domains = [...new Set(events.map(e => e.domain))];
  const stages = [...new Set(events.map(e => e.chainStage).filter((s): s is QuoteChainStage => s !== null))];
  const caseIds = [...new Set(events.map(e => e.caseId))];

  return {
    poNumber,
    caseId: caseIds[0] || "",
    events,
    domainsCovered: domains,
    stagesCovered: stages,
    latestEvent: events[events.length - 1],
    hasWarnings: events.some(e => e.severity === "warning"),
    hasCritical: events.some(e => e.severity === "critical"),
  };
}

// ══════════════════════════════════════════════
// Invalidation Chain Trace — 하나의 event가 trigger한 invalidation 체인 전체 추적
// ══════════════════════════════════════════════

export interface InvalidationChainNode {
  event: GovernanceEvent;
  targets: InvalidationTarget[];
  depth: number;
}

/**
 * 하나의 이벤트가 trigger할 수 있는 invalidation chain을 탐색.
 * depth는 실제로 cascade가 일어난 것이 아니라,
 * "만약 각 target이 이벤트를 발생시킨다면" 어디까지 갈 수 있는지의 가능성 분석.
 * 실제 cascade는 각 engine의 재계산 결과에 따라 발생 여부가 달라짐.
 */
export function traceInvalidationChain(
  event: GovernanceEvent,
  maxDepth: number = 3,
): InvalidationChainNode[] {
  const chain: InvalidationChainNode[] = [];
  const visited = new Set<string>();

  function trace(evt: GovernanceEvent, depth: number) {
    if (depth > maxDepth) return;
    const key = `${evt.domain}:${evt.eventType}`;
    if (visited.has(key)) return;
    visited.add(key);

    const result = resolveInvalidation(evt);
    if (result.hasInvalidation) {
      chain.push({ event: evt, targets: result.invalidatedTargets, depth });

      // Simulate potential cascade (each target domain could emit events)
      for (const target of result.invalidatedTargets) {
        if (target.scope === "readiness_recompute" || target.scope === "state_transition_check") {
          const simulatedEvent: GovernanceEvent = {
            ...evt,
            eventId: `sim_${evt.eventId}_${depth}`,
            domain: target.targetDomain,
            eventType: `${target.targetDomain}_readiness_changed`,
            chainStage: target.targetStage,
            detail: `[simulated cascade from ${evt.domain}]`,
          };
          trace(simulatedEvent, depth + 1);
        }
      }
    }
  }

  trace(event, 0);
  return chain;
}

// ══════════════════════════════════════════════
// Stale Context Detection — 구독자에게 stale 경고
// ══════════════════════════════════════════════

export interface StaleContextWarning {
  domain: GovernanceDomain;
  chainStage: QuoteChainStage | null;
  reason: string;
  staleSince: string;
  triggeringEvent: GovernanceEvent;
}

/**
 * 주어진 domain의 마지막 조회 시각과 bus의 이벤트 이력을 비교하여
 * stale 여부를 판단.
 */
export function detectStaleContext(
  bus: GovernanceEventBus,
  domain: GovernanceDomain,
  lastFetchedAt: string,
): StaleContextWarning[] {
  const warnings: StaleContextWarning[] = [];

  // Find events that would invalidate this domain
  const recentEvents = bus.getHistory({ since: lastFetchedAt });
  for (const event of recentEvents) {
    const result = resolveInvalidation(event);
    for (const target of result.invalidatedTargets) {
      if (target.targetDomain === domain) {
        warnings.push({
          domain,
          chainStage: target.targetStage,
          reason: target.reason,
          staleSince: event.timestamp,
          triggeringEvent: event,
        });
      }
    }
  }

  return warnings;
}
