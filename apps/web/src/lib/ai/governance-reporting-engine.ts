/**
 * Governance Reporting Engine — chain-level 운영 보고서 생성
 *
 * audit engine의 decision log + compliance snapshot을 소비하여
 * operator가 읽는 보고서 surface를 생성.
 *
 * CORE CONTRACT:
 * 1. reporting은 pure read surface — truth 변경 안 함
 * 2. 모든 label은 grammar registry에서 resolve
 * 3. report는 snapshot-in-time — 생성 후 불변
 * 4. 집계/통계 계산은 이 엔진에서, raw data는 audit engine에서
 * 5. operator UX: center=report, rail=context, dock=export/filter
 *
 * IMMUTABLE RULES:
 * - reporting이 audit data를 수정하면 안 됨
 * - grammar registry 외 label 하드코딩 금지
 * - report 생성 후 내용 변경 금지 (새 report 생성으로만 갱신)
 */

import type { GovernanceDomain } from "./governance-event-bus";
import type { QuoteChainStage } from "./quote-approval-governance-engine";
import {
  getStageLabel,
  getStatusLabel,
  getPanelLabel,
  CHAIN_STAGE_GRAMMAR,
  SEVERITY_SPEC,
  BLOCKER_SEVERITY_SPEC,
  type UnifiedSeverity,
} from "./governance-grammar-registry";
import type {
  DecisionLogStore,
  DecisionLogEntry,
  DecisionType,
  ComplianceSnapshotStore,
  ComplianceSnapshot,
  ChainAuditSummary,
  BlockerSnapshot,
} from "./governance-audit-engine";
import { buildChainAuditSummary } from "./governance-audit-engine";

// ══════════════════════════════════════════════════════
// 1. Report Types
// ══════════════════════════════════════════════════════

/**
 * 단일 PO chain report — operator가 "이 PO는 어떤 상태?" 물을 때.
 */
export interface POChainReport {
  reportId: string;
  reportType: "po_chain";
  generatedAt: string;

  /** Audit summary (full chain history for this PO) */
  auditSummary: ChainAuditSummary;

  // ── Derived insights ──
  /** Average time per stage (ms) */
  avgTimePerStageMs: number | null;
  /** Longest stage with label */
  longestStage: { stage: QuoteChainStage; stageLabel: string; durationMs: number } | null;
  /** Blocker history — how many times was the chain blocked */
  totalBlockerEvents: number;
  /** Reopen count — how many times was something reopened */
  reopenCount: number;
  /** Risk indicators */
  riskIndicators: RiskIndicator[];
}

/**
 * 기간별 운영 집계 report — "이번 주 구매 운영 어떤가?" 물을 때.
 */
export interface PeriodReport {
  reportId: string;
  reportType: "period";
  generatedAt: string;
  periodStart: string;
  periodEnd: string;

  // ── Volume metrics ──
  /** Total PO chains active in this period */
  activePOCount: number;
  /** Total decisions made */
  totalDecisions: number;
  /** Irreversible decisions */
  irreversibleDecisions: number;
  /** Decisions per domain */
  decisionsPerDomain: Partial<Record<GovernanceDomain, number>>;

  // ── Stage throughput ──
  /** How many POs passed through each stage */
  stagesThroughput: Array<{
    stage: QuoteChainStage;
    stageLabel: string;
    count: number;
  }>;
  /** Stage where most POs are currently sitting */
  bottleneckStage: { stage: QuoteChainStage; stageLabel: string; count: number } | null;

  // ── Compliance ──
  /** Total compliance snapshots in period */
  complianceSnapshotCount: number;
  /** Non-compliant count */
  nonCompliantCount: number;
  /** Compliance rate (0-1) */
  complianceRate: number | null;

  // ── Blocker metrics ──
  /** Total blocker events */
  blockerEvents: number;
  /** Average blocker resolution time (ms) */
  avgBlockerResolutionMs: number | null;
  /** Most common blocker types */
  topBlockerTypes: Array<{ type: string; count: number }>;

  // ── Actor metrics ──
  /** Active operators count */
  activeActorCount: number;
  /** Most active operator */
  mostActiveActor: { actor: string; decisionCount: number } | null;

  // ── Risk ──
  riskIndicators: RiskIndicator[];
}

export interface RiskIndicator {
  level: UnifiedSeverity;
  levelLabel: string;
  category: string;
  detail: string;
}

// ══════════════════════════════════════════════════════
// 2. Report Builders
// ══════════════════════════════════════════════════════

/**
 * 단일 PO chain report 생성.
 */
export function buildPOChainReport(
  poNumber: string,
  decisionStore: DecisionLogStore,
  complianceStore: ComplianceSnapshotStore,
): POChainReport {
  const auditSummary = buildChainAuditSummary(poNumber, decisionStore, complianceStore);
  const decisions = decisionStore.getEntriesByPONumber(poNumber);

  // Average time per stage
  let avgTimePerStageMs: number | null = null;
  if (auditSummary.stagesVisited.length > 1 && auditSummary.chainDurationMs !== null) {
    avgTimePerStageMs = auditSummary.chainDurationMs / auditSummary.stagesVisited.length;
  }

  // Longest stage
  const longestStage = computeLongestStage(auditSummary.stagesVisited);

  // Blocker count
  const totalBlockerEvents = decisions.filter(
    d => d.decisionType === "blocker_added" || d.decisionType === "blocker_resolved",
  ).length;

  // Reopen count
  const reopenCount = decisions.filter(d => d.decisionType === "reopen").length;

  // Risk indicators
  const riskIndicators = assessPOChainRisk(auditSummary, decisions);

  return {
    reportId: `rpt_po_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    reportType: "po_chain",
    generatedAt: new Date().toISOString(),
    auditSummary,
    avgTimePerStageMs,
    longestStage,
    totalBlockerEvents,
    reopenCount,
    riskIndicators,
  };
}

/**
 * 기간별 운영 집계 report 생성.
 */
export function buildPeriodReport(
  periodStart: string,
  periodEnd: string,
  decisionStore: DecisionLogStore,
  complianceStore: ComplianceSnapshotStore,
): PeriodReport {
  const allDecisions = decisionStore.getEntries({
    since: periodStart,
    until: periodEnd,
  });
  const allSnapshots = complianceStore.getSnapshots({
    since: periodStart,
  });
  // Filter snapshots within period
  const periodSnapshots = allSnapshots.filter(s => s.capturedAt <= periodEnd);

  // Active POs
  const activePOs = new Set(allDecisions.map(d => d.poNumber));

  // Decisions per domain
  const decisionsPerDomain: Partial<Record<GovernanceDomain, number>> = {};
  for (const d of allDecisions) {
    decisionsPerDomain[d.domain] = (decisionsPerDomain[d.domain] ?? 0) + 1;
  }

  // Stage throughput
  const stageCountMap = new Map<QuoteChainStage, number>();
  for (const d of allDecisions) {
    if (d.chainStage) {
      stageCountMap.set(d.chainStage, (stageCountMap.get(d.chainStage) ?? 0) + 1);
    }
  }
  const stagesThroughput = Array.from(stageCountMap.entries())
    .map(([stage, count]) => ({
      stage,
      stageLabel: getStageLabel(stage),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const bottleneckStage = stagesThroughput.length > 0 ? stagesThroughput[0] : null;

  // Compliance
  const nonCompliantSnapshots = periodSnapshots.filter(s => s.verdict === "non_compliant");
  const compliantSnapshots = periodSnapshots.filter(s => s.verdict === "compliant");
  const complianceRate = periodSnapshots.length > 0
    ? compliantSnapshots.length / periodSnapshots.length
    : null;

  // Blocker metrics
  const blockerEvents = allDecisions.filter(
    d => d.decisionType === "blocker_added" || d.decisionType === "blocker_resolved",
  ).length;

  const blockerTypeMap = new Map<string, number>();
  for (const d of allDecisions) {
    if (d.decisionType === "blocker_added") {
      for (const b of d.blockersActiveAtDecision) {
        blockerTypeMap.set(b.blockerType, (blockerTypeMap.get(b.blockerType) ?? 0) + 1);
      }
    }
  }
  const topBlockerTypes = Array.from(blockerTypeMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Actor metrics
  const actorCounts = new Map<string, number>();
  for (const d of allDecisions) {
    actorCounts.set(d.actor, (actorCounts.get(d.actor) ?? 0) + 1);
  }
  const mostActiveActor = actorCounts.size > 0
    ? Array.from(actorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([actor, decisionCount]) => ({ actor, decisionCount }))[0]
    : null;

  // Risk
  const riskIndicators = assessPeriodRisk(allDecisions, periodSnapshots, activePOs.size);

  return {
    reportId: `rpt_period_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    reportType: "period",
    generatedAt: new Date().toISOString(),
    periodStart,
    periodEnd,
    activePOCount: activePOs.size,
    totalDecisions: allDecisions.length,
    irreversibleDecisions: allDecisions.filter(d => d.irreversible).length,
    decisionsPerDomain,
    stagesThroughput,
    bottleneckStage,
    complianceSnapshotCount: periodSnapshots.length,
    nonCompliantCount: nonCompliantSnapshots.length,
    complianceRate,
    blockerEvents,
    avgBlockerResolutionMs: null, // 향후: blocker added→resolved 쌍으로 계산
    topBlockerTypes,
    activeActorCount: actorCounts.size,
    mostActiveActor,
    riskIndicators,
  };
}

// ══════════════════════════════════════════════════════
// 3. Risk Assessment
// ══════════════════════════════════════════════════════

function assessPOChainRisk(
  summary: ChainAuditSummary,
  decisions: DecisionLogEntry[],
): RiskIndicator[] {
  const indicators: RiskIndicator[] = [];

  // Non-compliant snapshots
  if (summary.nonCompliantCount > 0) {
    indicators.push({
      level: "critical",
      levelLabel: SEVERITY_SPEC.critical.label,
      category: "compliance",
      detail: `${summary.nonCompliantCount}건의 비준수 스냅샷 발견`,
    });
  }

  // High reopen rate
  const reopenCount = decisions.filter(d => d.decisionType === "reopen").length;
  if (reopenCount >= 3) {
    indicators.push({
      level: "warning",
      levelLabel: SEVERITY_SPEC.warning.label,
      category: "stability",
      detail: `${reopenCount}회 재열기 — 프로세스 안정성 점검 필요`,
    });
  }

  // Chain stuck (no progress for a long time)
  if (summary.chainDurationMs !== null && summary.stagesVisited.length <= 2 && summary.chainDurationMs > 7 * 24 * 60 * 60 * 1000) {
    indicators.push({
      level: "warning",
      levelLabel: SEVERITY_SPEC.warning.label,
      category: "throughput",
      detail: "7일 이상 초기 단계에 머물러 있음",
    });
  }

  // Many irreversible actions
  if (summary.irreversibleDecisions > 10) {
    indicators.push({
      level: "info",
      levelLabel: SEVERITY_SPEC.info.label,
      category: "activity",
      detail: `비가역 조치 ${summary.irreversibleDecisions}건 — 정상 범위 확인 필요`,
    });
  }

  return indicators;
}

function assessPeriodRisk(
  decisions: DecisionLogEntry[],
  snapshots: ComplianceSnapshot[],
  activePOCount: number,
): RiskIndicator[] {
  const indicators: RiskIndicator[] = [];

  // Non-compliant rate
  const nonCompliant = snapshots.filter(s => s.verdict === "non_compliant").length;
  if (snapshots.length > 0 && nonCompliant / snapshots.length > 0.1) {
    indicators.push({
      level: "critical",
      levelLabel: SEVERITY_SPEC.critical.label,
      category: "compliance",
      detail: `비준수 비율 ${Math.round((nonCompliant / snapshots.length) * 100)}% — 임계치(10%) 초과`,
    });
  }

  // High cancellation rate
  const cancellations = decisions.filter(d => d.decisionType === "cancellation").length;
  if (activePOCount > 0 && cancellations / activePOCount > 0.2) {
    indicators.push({
      level: "warning",
      levelLabel: SEVERITY_SPEC.warning.label,
      category: "operations",
      detail: `취소 비율 ${Math.round((cancellations / activePOCount) * 100)}% — 임계치(20%) 초과`,
    });
  }

  // No compliance snapshots
  if (snapshots.length === 0 && decisions.length > 0) {
    indicators.push({
      level: "warning",
      levelLabel: SEVERITY_SPEC.warning.label,
      category: "audit",
      detail: "기간 내 compliance 스냅샷 없음 — 감사 공백",
    });
  }

  return indicators;
}

// ══════════════════════════════════════════════════════
// 4. Report Surface Builder — workbench center/rail/dock용
// ══════════════════════════════════════════════════════

export interface AuditReportSurface {
  /** center: 보고서 본문 */
  center: {
    reportType: "po_chain" | "period";
    report: POChainReport | PeriodReport;
  };
  /** rail: 맥락 정보 */
  rail: {
    /** 최근 compliance snapshot 요약 */
    complianceSummary: {
      totalSnapshots: number;
      compliantCount: number;
      nonCompliantCount: number;
      needsReviewCount: number;
    };
    /** Risk indicators */
    riskIndicators: RiskIndicator[];
    /** Stage labels (grammar-resolved) for timeline context */
    stageLabels: Array<{ stage: QuoteChainStage; label: string }>;
  };
  /** dock: 가용 actions */
  dock: {
    actions: AuditDockAction[];
  };
}

export type AuditDockAction =
  | { actionKey: "export_report"; label: string; enabled: boolean }
  | { actionKey: "refresh_report"; label: string; enabled: boolean }
  | { actionKey: "filter_change"; label: string; enabled: boolean }
  | { actionKey: "view_decision_log"; label: string; enabled: boolean }
  | { actionKey: "view_compliance_snapshots"; label: string; enabled: boolean };

export function buildAuditReportSurface(
  report: POChainReport | PeriodReport,
  complianceStore: ComplianceSnapshotStore,
  filter?: { poNumber?: string },
): AuditReportSurface {
  const snapshots = filter?.poNumber
    ? complianceStore.getSnapshots({ poNumber: filter.poNumber })
    : complianceStore.getSnapshots();

  const compliantCount = snapshots.filter(s => s.verdict === "compliant").length;
  const nonCompliantCount = snapshots.filter(s => s.verdict === "non_compliant").length;
  const needsReviewCount = snapshots.filter(s => s.verdict === "needs_review").length;

  const stageLabels = CHAIN_STAGE_GRAMMAR.map(s => ({
    stage: s.stage,
    label: s.fullLabel,
  }));

  const riskIndicators = report.reportType === "po_chain"
    ? (report as POChainReport).riskIndicators
    : (report as PeriodReport).riskIndicators;

  return {
    center: {
      reportType: report.reportType,
      report,
    },
    rail: {
      complianceSummary: {
        totalSnapshots: snapshots.length,
        compliantCount,
        nonCompliantCount,
        needsReviewCount,
      },
      riskIndicators,
      stageLabels,
    },
    dock: {
      actions: [
        { actionKey: "export_report", label: "보고서 내보내기", enabled: true },
        { actionKey: "refresh_report", label: "보고서 갱신", enabled: true },
        { actionKey: "filter_change", label: "필터 변경", enabled: true },
        { actionKey: "view_decision_log", label: "판단 이력 보기", enabled: true },
        { actionKey: "view_compliance_snapshots", label: "준수 스냅샷 보기", enabled: true },
      ],
    },
  };
}

// ══════════════════════════════════════════════════════
// 5. Helper — stage duration 계산
// ══════════════════════════════════════════════════════

function computeLongestStage(
  stagesVisited: Array<{ stage: QuoteChainStage; stageLabel: string; enteredAt: string }>,
): { stage: QuoteChainStage; stageLabel: string; durationMs: number } | null {
  if (stagesVisited.length < 2) return null;

  let longestStage: QuoteChainStage | null = null;
  let longestLabel = "";
  let longestDuration = 0;

  for (let i = 0; i < stagesVisited.length - 1; i++) {
    const current = stagesVisited[i];
    const next = stagesVisited[i + 1];
    const duration = new Date(next.enteredAt).getTime() - new Date(current.enteredAt).getTime();
    if (duration > longestDuration) {
      longestDuration = duration;
      longestStage = current.stage;
      longestLabel = current.stageLabel;
    }
  }

  if (!longestStage) return null;
  return { stage: longestStage, stageLabel: longestLabel, durationMs: longestDuration };
}
