/**
 * Post-Batch 11 Integration Engine
 *
 * 3개 마감 정리:
 * 1. Compliance Snapshot 자동 생성 Trigger 연결
 * 2. Dashboard → Audit Review Exact Handoff
 * 3. 기존 Label Map → Grammar Registry Lookup 전환 adapter
 */

import type { QuoteChainStage } from "./quote-approval-governance-engine";
import type { ComplianceTrigger, ComplianceSnapshot, DecisionLogEntry } from "./governance-audit-engine";
import type { GovernanceEvent, GovernanceDomain } from "./governance-event-bus";

// ══════════════════════════════════════════════
// 1. Compliance Snapshot Auto-Trigger Rules
// ══════════════════════════════════════════════

/**
 * 어떤 이벤트가 compliance snapshot을 자동 생성해야 하는지 결정.
 *
 * TRIGGER RULES:
 * - irreversible action 실행 직전 → "irreversible_action_pre"
 * - irreversible action 실행 직후 → "irreversible_action_post"
 * - terminal stage 진입 시 → "stage_transition"
 * - critical blocker 해소 시 → "blocker_resolution"
 * - chain 완료 시 (reorder_decision 완료) → "chain_completion"
 */

export interface SnapshotAutoTriggerRule {
  ruleId: string;
  condition: (event: GovernanceEvent) => boolean;
  trigger: ComplianceTrigger;
  description: string;
}

const TERMINAL_STAGES: string[] = ["sent", "supplier_confirmed", "stock_release", "reorder_decision"];

const IRREVERSIBLE_EVENT_PATTERNS: string[] = [
  "send_now", "fire_execute", "stock_release_execute",
  "po_send", "dispatch_execute", "apply_now",
];

export const SNAPSHOT_AUTO_TRIGGER_RULES: SnapshotAutoTriggerRule[] = [
  {
    ruleId: "pre_irreversible",
    condition: (event) => IRREVERSIBLE_EVENT_PATTERNS.some(p => event.eventType.includes(p)) && event.toStatus !== event.fromStatus,
    trigger: "irreversible_action_pre",
    description: "Irreversible action 실행 직전 snapshot",
  },
  {
    ruleId: "post_irreversible",
    condition: (event) => {
      const terminalStatuses = ["sent", "released", "confirmed", "completed", "applied"];
      return terminalStatuses.some(s => event.toStatus.includes(s)) && !event.fromStatus.includes(event.toStatus);
    },
    trigger: "irreversible_action_post",
    description: "Irreversible action 실행 직후 snapshot",
  },
  {
    ruleId: "terminal_entry",
    condition: (event) => TERMINAL_STAGES.some(s => event.toStatus.includes(s) || (event.chainStage && TERMINAL_STAGES.includes(event.chainStage))),
    trigger: "stage_transition",
    description: "Terminal stage 진입 시 snapshot",
  },
  {
    ruleId: "critical_blocker_resolved",
    condition: (event) => event.eventType.includes("blocker_resolved") && event.severity === "critical",
    trigger: "blocker_resolution",
    description: "Critical blocker 해소 시 snapshot",
  },
  {
    ruleId: "chain_completion",
    condition: (event) => event.chainStage === "reorder_decision" && event.toStatus.includes("completed"),
    trigger: "chain_completion",
    description: "Chain 완전 완료 시 snapshot",
  },
];

export function shouldAutoTriggerSnapshot(event: GovernanceEvent): { shouldTrigger: boolean; triggers: ComplianceTrigger[]; ruleIds: string[] } {
  const matched = SNAPSHOT_AUTO_TRIGGER_RULES.filter(rule => rule.condition(event));
  return {
    shouldTrigger: matched.length > 0,
    triggers: matched.map(r => r.trigger),
    ruleIds: matched.map(r => r.ruleId),
  };
}

// ══════════════════════════════════════════════
// 2. Dashboard → Audit Review Exact Handoff
// ══════════════════════════════════════════════

export interface AuditHandoffLink {
  linkId: string;
  source: "dashboard_kpi" | "dashboard_bottleneck" | "dashboard_panel" | "inbox_item" | "workbench_rail";
  sourceItemId: string;
  // Target
  targetRoute: string;
  targetContext: AuditReviewContext;
  label: string;
  urgency: "high" | "medium" | "low";
}

export interface AuditReviewContext {
  mode: "case_review" | "period_review" | "compliance_review" | "decision_trace";
  caseId: string | null;
  poNumber: string | null;
  correlationId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  filterDomain: GovernanceDomain | null;
  filterDecisionType: string | null;
  highlightLogId: string | null;
}

export function buildAuditHandoffFromDashboard(
  sourcePanel: string,
  sourceItemId: string,
  caseId: string | null,
  poNumber: string | null,
  mode: AuditReviewContext["mode"] = "case_review",
): AuditHandoffLink {
  const context: AuditReviewContext = {
    mode,
    caseId, poNumber,
    correlationId: null,
    dateFrom: null, dateTo: null,
    filterDomain: null, filterDecisionType: null,
    highlightLogId: null,
  };

  const params = new URLSearchParams();
  if (caseId) params.set("caseId", caseId);
  if (poNumber) params.set("poNumber", poNumber);
  params.set("mode", mode);

  return {
    linkId: `audit_hoff_${Date.now().toString(36)}`,
    source: sourcePanel as AuditHandoffLink["source"],
    sourceItemId,
    targetRoute: `/dashboard/approval/audit?${params.toString()}`,
    targetContext: context,
    label: mode === "case_review" ? `${poNumber || caseId || "건"} 감사 추적`
      : mode === "compliance_review" ? "준법 검토"
      : mode === "decision_trace" ? "의사결정 추적"
      : "기간 리뷰",
    urgency: mode === "compliance_review" ? "high" : "medium",
  };
}

export function buildAuditHandoffFromBottleneck(
  bottleneckType: string,
  affectedDomain: GovernanceDomain | null,
  dateFrom: string,
  dateTo: string,
): AuditHandoffLink {
  const context: AuditReviewContext = {
    mode: "period_review",
    caseId: null, poNumber: null, correlationId: null,
    dateFrom, dateTo,
    filterDomain: affectedDomain,
    filterDecisionType: null,
    highlightLogId: null,
  };

  const params = new URLSearchParams();
  params.set("mode", "period_review");
  params.set("from", dateFrom);
  params.set("to", dateTo);
  if (affectedDomain) params.set("domain", affectedDomain);

  return {
    linkId: `audit_hoff_bneck_${Date.now().toString(36)}`,
    source: "dashboard_bottleneck",
    sourceItemId: bottleneckType,
    targetRoute: `/dashboard/approval/audit?${params.toString()}`,
    targetContext: context,
    label: `${bottleneckType} 기간 감사 분석`,
    urgency: "high",
  };
}

// ══════════════════════════════════════════════
// 3. Label Map → Grammar Registry Adapter
// ══════════════════════════════════════════════

/**
 * 기존 workbench/panel의 하드코딩된 label을
 * grammar registry로 전환하기 위한 adapter.
 *
 * broad refactor 금지 — 얇은 전환만.
 * stage/status/panel/stale/dock action부터 우선.
 */

import {
  getStageLabel,
  getStatusLabel,
  getPanelLabel,
  CHAIN_STAGE_GRAMMAR,
} from "./governance-grammar-registry";

// Stage short labels — registry에서 가져오기
export function getStageShortLabel(stage: QuoteChainStage): string {
  const grammar = CHAIN_STAGE_GRAMMAR.find(s => s.stage === stage);
  return grammar?.shortLabel ?? stage;
}

// Status badge label — registry에서 가져오기
export function getStatusBadgeLabel(domain: GovernanceDomain, status: string): string {
  return getStatusLabel(domain, status);
}

// Panel label — registry에서 가져오기
export function getPanelDisplayLabel(panelKey: string): string {
  return getPanelLabel(panelKey);
}

/**
 * 기존 STAGE_SHORT 등 하드코딩 map을 registry lookup으로 대체하는
 * 호환 adapter. 기존 코드에서 import만 바꾸면 됨.
 */
export const STAGE_SHORT_FROM_REGISTRY: Partial<Record<QuoteChainStage, string>> = Object.fromEntries(
  CHAIN_STAGE_GRAMMAR.map(s => [s.stage, s.shortLabel])
) as Partial<Record<QuoteChainStage, string>>;

// Readiness label adapter
const READINESS_LABELS: Record<string, string> = {
  not_evaluated: "미평가",
  blocked: "차단",
  needs_review: "검토 필요",
  ready_to_send: "발송 가능",
  scheduled: "예약됨",
  sent: "발송 완료",
  cancelled: "취소됨",
  ready: "준비 완료",
};

export function getReadinessLabel(readiness: string): string {
  return READINESS_LABELS[readiness] ?? readiness;
}

// ══════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════

export type IntegrationEventType = "auto_snapshot_triggered" | "audit_handoff_created" | "grammar_lookup_used";
export interface IntegrationEvent { type: IntegrationEventType; detail: string; timestamp: string; }
