/**
 * Pilot Monitoring Engine — 파일럿 운영 감시 + handoff + rollback 판단
 *
 * Batch 15: Pilot Monitoring & Audit Handoff Pack
 *
 * PilotActivationWorkbench를 체크리스트 화면이 아니라
 * runtime signal / dashboard / audit / rollback 판단이 한곳에서 이어지는
 * 운영 workbench로 만드는 핵심 엔진.
 *
 * CORE CONTRACT:
 * 1. read-only — truth 변경 안 함, 판단과 handoff token 생성만
 * 2. handoff는 exact context 보존 — 단순 navigation 금지
 * 3. rollback evaluator는 score가 아니라 trigger match 기반
 * 4. signal freshness를 반드시 표시 — stale signal이면 score 무의미
 * 5. checklist 완료율과 운영 건강도는 절대 같은 것으로 보이지 않게
 */

import type { GovernanceDomain } from "./governance-event-bus";
import type { QuoteChainStage } from "./quote-approval-governance-engine";
import { SEVERITY_SPEC, type UnifiedSeverity } from "./governance-grammar-registry";
import type { PilotPlan, PilotStatus, MonitoringConfig } from "./pilot-activation-engine";
import type { SignalCheckResult, AppRuntimeSignalReport } from "./app-runtime-signal-provider";
import type { ComplianceSnapshot } from "./governance-audit-engine";

// ══════════════════════════════════════════════════════
// 1. Handoff Tokens
// ══════════════════════════════════════════════════════

/**
 * Pilot → Procurement Dashboard handoff.
 * dashboard 진입 시 pilot scope 기준으로 panel/filter가 자동 적용.
 */
export interface PilotDashboardHandoff {
  kind: "pilot_to_dashboard";
  pilotId: string;
  originMode: "pilot_monitoring";
  activeScope: {
    includedStages: QuoteChainStage[];
    activeDomains: GovernanceDomain[];
    activePoIds: string[];
  };
  activeDomainFilter: GovernanceDomain[];
  runtimeSignalSnapshot: {
    overallScore: number;
    overallHealthy: boolean;
    criticalIssueCount: number;
    calculatedAt: string;
  };
  rollbackTriggerState: RollbackEvaluationResult;
  enteredAt: string;
}

/**
 * Pilot → Audit Review handoff.
 * audit review 진입 시 pilot context 기준으로 바로 evidence 확인.
 */
export interface PilotAuditHandoff {
  kind: "pilot_to_audit";
  pilotId: string;
  reviewMode: AuditReviewMode;
  scope: {
    poNumbers: string[];
    caseIds: string[];
    correlationIds: string[];
    dateRange: { from: string; to: string } | null;
  };
  complianceSummary: {
    totalSnapshots: number;
    nonCompliantCount: number;
    needsReviewCount: number;
    latestVerdict: string | null;
  };
  enteredAt: string;
}

export type AuditReviewMode = "case_review" | "period_review" | "compliance_review" | "decision_trace";

export function buildPilotDashboardHandoff(
  plan: PilotPlan,
  signalReport: AppRuntimeSignalReport,
  rollbackState: RollbackEvaluationResult,
  activePoIds: string[] = [],
): PilotDashboardHandoff {
  return {
    kind: "pilot_to_dashboard",
    pilotId: plan.planId,
    originMode: "pilot_monitoring",
    activeScope: {
      includedStages: plan.includedStages.map(s => s.stage),
      activeDomains: plan.activeDomains,
      activePoIds,
    },
    activeDomainFilter: plan.activeDomains,
    runtimeSignalSnapshot: {
      overallScore: signalReport.overallScore,
      overallHealthy: signalReport.overallHealthy,
      criticalIssueCount: signalReport.criticalIssues.length,
      calculatedAt: signalReport.evaluatedAt,
    },
    rollbackTriggerState: rollbackState,
    enteredAt: new Date().toISOString(),
  };
}

export function buildPilotAuditHandoff(
  plan: PilotPlan,
  reviewMode: AuditReviewMode,
  scope: {
    poNumbers?: string[];
    caseIds?: string[];
    correlationIds?: string[];
    dateRange?: { from: string; to: string } | null;
  } = {},
  complianceSnapshots: ComplianceSnapshot[] = [],
): PilotAuditHandoff {
  const nonCompliant = complianceSnapshots.filter(s => s.verdict === "non_compliant").length;
  const needsReview = complianceSnapshots.filter(s => s.verdict === "needs_review").length;
  const latest = complianceSnapshots.length > 0
    ? complianceSnapshots[complianceSnapshots.length - 1].verdict
    : null;

  return {
    kind: "pilot_to_audit",
    pilotId: plan.planId,
    reviewMode,
    scope: {
      poNumbers: scope.poNumbers ?? [],
      caseIds: scope.caseIds ?? [],
      correlationIds: scope.correlationIds ?? [],
      dateRange: scope.dateRange ?? null,
    },
    complianceSummary: {
      totalSnapshots: complianceSnapshots.length,
      nonCompliantCount: nonCompliant,
      needsReviewCount: needsReview,
      latestVerdict: latest,
    },
    enteredAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════
// 2. Rollback Trigger Evaluator
// ══════════════════════════════════════════════════════

export type RollbackRecommendation = "none" | "watch" | "rollback_recommended" | "rollback_required";

export interface RollbackTriggerHit {
  triggerId: string;
  name: string;
  severity: UnifiedSeverity;
  severityLabel: string;
  detail: string;
  hitAt: string;
}

export interface RollbackEvaluationResult {
  recommendation: RollbackRecommendation;
  triggersHit: RollbackTriggerHit[];
  triggerCount: number;
  /** 가장 높은 severity */
  maxSeverity: UnifiedSeverity | null;
  evaluatedAt: string;
  /** Signal freshness — 마지막 signal 수집 시점 */
  signalAge: {
    calculatedAt: string;
    ageMs: number;
    stale: boolean;
  };
}

export interface RollbackEvaluationInput {
  signalReport: AppRuntimeSignalReport;
  complianceSnapshots: ComplianceSnapshot[];
  /** 현재 활성 blocker 수 */
  activeBlockerCount: number;
  /** chain health: blocked 상태 지속 시간(ms) */
  chainBlockedDurationMs: number;
  /** irreversible action 최근 실패 수 */
  irreversibleActionFailureCount: number;
  /** stale blocking이 미해결 상태인지 */
  staleBlockingUnresolved: boolean;
  /** 평가 시점 기준 signal freshness threshold (ms) */
  signalFreshnessThresholdMs?: number;
}

/**
 * 롤백 필요 여부를 structured trigger match로 평가.
 * score 기반이 아니라 구체적 trigger 조건 match.
 */
export function evaluateRollbackTriggers(
  plan: PilotPlan,
  input: RollbackEvaluationInput,
): RollbackEvaluationResult {
  const triggers: RollbackTriggerHit[] = [];
  const now = Date.now();
  const freshnessThreshold = input.signalFreshnessThresholdMs ?? 10 * 60 * 1000; // 기본 10분
  const signalAge = now - new Date(input.signalReport.evaluatedAt).getTime();
  const signalStale = signalAge > freshnessThreshold;

  // T1: Critical runtime signal breach
  const criticalSignals = input.signalReport.signals.filter(s => s.severity === "critical");
  if (criticalSignals.length > 0) {
    triggers.push({
      triggerId: "RBT-1",
      name: "Critical runtime signal",
      severity: "critical",
      severityLabel: SEVERITY_SPEC.critical.label,
      detail: `${criticalSignals.length}개 critical signal: ${criticalSignals.map(s => s.name).join(", ")}`,
      hitAt: new Date().toISOString(),
    });
  }

  // T2: Compliance non_compliant 급증
  const nonCompliantCount = input.complianceSnapshots.filter(s => s.verdict === "non_compliant").length;
  const totalSnapshots = input.complianceSnapshots.length;
  const nonCompliantRate = totalSnapshots > 0 ? nonCompliantCount / totalSnapshots : 0;
  const threshold = plan.monitoringConfig.alertThresholds.nonCompliantRatePercent / 100;
  if (nonCompliantRate > threshold && totalSnapshots >= 3) {
    triggers.push({
      triggerId: "RBT-2",
      name: "비준수 비율 임계 초과",
      severity: "critical",
      severityLabel: SEVERITY_SPEC.critical.label,
      detail: `비준수 ${Math.round(nonCompliantRate * 100)}% (임계 ${plan.monitoringConfig.alertThresholds.nonCompliantRatePercent}%)`,
      hitAt: new Date().toISOString(),
    });
  }

  // T3: Chain health blocked 지속
  if (input.chainBlockedDurationMs > 30 * 60 * 1000) { // 30분 이상
    triggers.push({
      triggerId: "RBT-3",
      name: "Chain blocked 지속",
      severity: "warning",
      severityLabel: SEVERITY_SPEC.warning.label,
      detail: `chain blocked 상태 ${Math.round(input.chainBlockedDurationMs / 60000)}분 지속`,
      hitAt: new Date().toISOString(),
    });
  }

  // T4: Stale blocking 미해결
  if (input.staleBlockingUnresolved) {
    triggers.push({
      triggerId: "RBT-4",
      name: "Stale blocking 미해결",
      severity: "warning",
      severityLabel: SEVERITY_SPEC.warning.label,
      detail: "stale context blocking이 해소되지 않은 상태",
      hitAt: new Date().toISOString(),
    });
  }

  // T5: Irreversible action failure threshold
  const failureMax = plan.monitoringConfig.alertThresholds.blockerCountMax;
  if (input.irreversibleActionFailureCount > failureMax) {
    triggers.push({
      triggerId: "RBT-5",
      name: "Irreversible action 실패 초과",
      severity: "critical",
      severityLabel: SEVERITY_SPEC.critical.label,
      detail: `irreversible action 실패 ${input.irreversibleActionFailureCount}건 (임계 ${failureMax}건)`,
      hitAt: new Date().toISOString(),
    });
  }

  // T6: Active blocker 과다
  if (input.activeBlockerCount > failureMax) {
    triggers.push({
      triggerId: "RBT-6",
      name: "Active blocker 초과",
      severity: "warning",
      severityLabel: SEVERITY_SPEC.warning.label,
      detail: `활성 blocker ${input.activeBlockerCount}건 (임계 ${failureMax}건)`,
      hitAt: new Date().toISOString(),
    });
  }

  // Determine recommendation
  const hasCritical = triggers.some(t => t.severity === "critical");
  const hasWarning = triggers.some(t => t.severity === "warning");
  const criticalCount = triggers.filter(t => t.severity === "critical").length;

  let recommendation: RollbackRecommendation;
  if (criticalCount >= 2) {
    recommendation = "rollback_required";
  } else if (hasCritical) {
    recommendation = "rollback_recommended";
  } else if (hasWarning) {
    recommendation = "watch";
  } else {
    recommendation = "none";
  }

  const maxSeverity: UnifiedSeverity | null = hasCritical ? "critical" : hasWarning ? "warning" : triggers.length > 0 ? "info" : null;

  return {
    recommendation,
    triggersHit: triggers,
    triggerCount: triggers.length,
    maxSeverity,
    evaluatedAt: new Date().toISOString(),
    signalAge: {
      calculatedAt: input.signalReport.evaluatedAt,
      ageMs: signalAge,
      stale: signalStale,
    },
  };
}

// ══════════════════════════════════════════════════════
// 3. Active Pilot Health Summary
// ══════════════════════════════════════════════════════

/**
 * 체크리스트 진행률과 운영 건강도를 명확히 분리한 health summary.
 * PilotActivationWorkbench center에 표시.
 */
export interface ActivePilotHealthSummary {
  // ── Checklist (setup completeness) ──
  checklistHealth: {
    progressPercent: number;
    requiredRemaining: number;
    status: "incomplete" | "complete";
  };

  // ── Operational Health (runtime) ──
  operationalHealth: {
    overallScore: number;
    overallHealthy: boolean;
    signals: Array<{
      signalId: string;
      name: string;
      passed: boolean;
      score: number;
      severity: UnifiedSeverity;
    }>;
    criticalIssues: string[];
    warningIssues: string[];
  };

  // ── Compliance ──
  complianceHealth: {
    totalSnapshots: number;
    compliantCount: number;
    nonCompliantCount: number;
    needsReviewCount: number;
    complianceRate: number;
  };

  // ── Rollback Status ──
  rollbackStatus: {
    recommendation: RollbackRecommendation;
    triggerCount: number;
    maxSeverity: UnifiedSeverity | null;
  };

  // ── Freshness ──
  signalFreshness: {
    calculatedAt: string;
    stale: boolean;
    ageMs: number;
  };

  // ── Recent Events ──
  recentCriticalEvents: Array<{
    eventType: string;
    domain: GovernanceDomain;
    occurredAt: string;
    detail: string;
  }>;
}

export function buildActivePilotHealthSummary(
  plan: PilotPlan,
  signalReport: AppRuntimeSignalReport,
  rollbackResult: RollbackEvaluationResult,
  complianceSnapshots: ComplianceSnapshot[],
  recentCriticalEvents: Array<{
    eventType: string;
    domain: GovernanceDomain;
    occurredAt: string;
    detail: string;
  }> = [],
): ActivePilotHealthSummary {
  const requiredTotal = plan.checklist.filter(i => i.required).length;
  const requiredChecked = plan.checklist.filter(i => i.required && i.checked).length;
  const progressPercent = requiredTotal > 0 ? Math.round((requiredChecked / requiredTotal) * 100) : 100;

  const compliant = complianceSnapshots.filter(s => s.verdict === "compliant").length;
  const nonCompliant = complianceSnapshots.filter(s => s.verdict === "non_compliant").length;
  const needsReview = complianceSnapshots.filter(s => s.verdict === "needs_review").length;
  const total = complianceSnapshots.length;
  const complianceRate = total > 0 ? Math.round((compliant / total) * 100) : 100;

  return {
    checklistHealth: {
      progressPercent,
      requiredRemaining: requiredTotal - requiredChecked,
      status: requiredChecked >= requiredTotal ? "complete" : "incomplete",
    },
    operationalHealth: {
      overallScore: signalReport.overallScore,
      overallHealthy: signalReport.overallHealthy,
      signals: signalReport.signals.map(s => ({
        signalId: s.signalId,
        name: s.name,
        passed: s.passed,
        score: s.score,
        severity: s.severity,
      })),
      criticalIssues: signalReport.criticalIssues,
      warningIssues: signalReport.warningIssues,
    },
    complianceHealth: {
      totalSnapshots: total,
      compliantCount: compliant,
      nonCompliantCount: nonCompliant,
      needsReviewCount: needsReview,
      complianceRate,
    },
    rollbackStatus: {
      recommendation: rollbackResult.recommendation,
      triggerCount: rollbackResult.triggerCount,
      maxSeverity: rollbackResult.maxSeverity,
    },
    signalFreshness: rollbackResult.signalAge,
    recentCriticalEvents,
  };
}

// ══════════════════════════════════════════════════════
// 4. Extended Pilot Surface Builder
// ══════════════════════════════════════════════════════

/**
 * 기존 PilotActivationSurface를 확장한 monitoring surface.
 * checklist + operational health + handoff + rollback을 한 surface에 통합.
 */
export interface PilotMonitoringSurface {
  center: {
    healthSummary: ActivePilotHealthSummary;
    /** 체크리스트 vs 운영 건강도 분리 표시 */
    splitView: {
      setupComplete: boolean;
      operationalHealthy: boolean;
      complianceHealthy: boolean;
      rollbackSafe: boolean;
    };
  };
  rail: {
    complianceSummary: string;
    staleWarning: string | null;
    criticalIssues: string[];
    recentDecisionTraceIds: string[];
    /** Signal freshness — 마지막 계산 시점 */
    lastCalculatedAt: string;
    /** Handoff shortcuts */
    shortcuts: Array<{
      target: "dashboard" | "audit_case" | "audit_period" | "audit_compliance" | "audit_decision_trace";
      label: string;
      enabled: boolean;
    }>;
  };
  dock: {
    actions: Array<{
      actionKey: PilotMonitoringAction;
      label: string;
      enabled: boolean;
      requiresConfirmation: boolean;
      /** Role gating — 이 action에 필요한 역할 */
      requiredRoles: string[];
    }>;
  };
}

export type PilotMonitoringAction =
  | "activate_pilot"
  | "complete_pilot"
  | "rollback_pilot"
  | "cancel_pilot"
  | "open_dashboard"
  | "open_audit_review";

export function buildPilotMonitoringSurface(
  plan: PilotPlan,
  healthSummary: ActivePilotHealthSummary,
  rollbackResult: RollbackEvaluationResult,
  recentDecisionTraceIds: string[] = [],
): PilotMonitoringSurface {
  const isActive = plan.status === "active";
  const isTerminal = plan.status === "completed" || plan.status === "rolled_back" || plan.status === "cancelled";
  const authorizedRoles = plan.rollbackPlan.authorizedRoles;

  // Stale warning
  const staleWarning = rollbackResult.signalAge.stale
    ? `신호 ${Math.round(rollbackResult.signalAge.ageMs / 60000)}분 전 수집 — 최신 상태가 아닐 수 있습니다`
    : null;

  // Compliance summary
  const ch = healthSummary.complianceHealth;
  const complianceSummary = ch.totalSnapshots > 0
    ? `준수 ${ch.complianceRate}% (${ch.compliantCount}/${ch.totalSnapshots}) · 비준수 ${ch.nonCompliantCount}건 · 검토필요 ${ch.needsReviewCount}건`
    : "compliance snapshot 없음";

  return {
    center: {
      healthSummary,
      splitView: {
        setupComplete: healthSummary.checklistHealth.status === "complete",
        operationalHealthy: healthSummary.operationalHealth.overallHealthy,
        complianceHealthy: ch.nonCompliantCount === 0,
        rollbackSafe: rollbackResult.recommendation === "none",
      },
    },
    rail: {
      complianceSummary,
      staleWarning,
      criticalIssues: healthSummary.operationalHealth.criticalIssues,
      recentDecisionTraceIds,
      lastCalculatedAt: rollbackResult.evaluatedAt,
      shortcuts: [
        { target: "dashboard", label: "대시보드", enabled: isActive || isTerminal },
        { target: "audit_case", label: "건별 감사", enabled: true },
        { target: "audit_period", label: "기간 감사", enabled: true },
        { target: "audit_compliance", label: "준수 현황", enabled: ch.totalSnapshots > 0 },
        { target: "audit_decision_trace", label: "결정 추적", enabled: recentDecisionTraceIds.length > 0 },
      ],
    },
    dock: {
      actions: [
        {
          actionKey: "activate_pilot",
          label: "파일럿 시작",
          enabled: plan.status === "ready_to_activate",
          requiresConfirmation: true,
          requiredRoles: authorizedRoles,
        },
        {
          actionKey: "complete_pilot",
          label: "파일럿 완료",
          enabled: isActive && rollbackResult.recommendation !== "rollback_required",
          requiresConfirmation: true,
          requiredRoles: authorizedRoles,
        },
        {
          actionKey: "rollback_pilot",
          label: "파일럿 롤백",
          enabled: isActive,
          requiresConfirmation: true,
          requiredRoles: authorizedRoles,
        },
        {
          actionKey: "cancel_pilot",
          label: "파일럿 취소",
          enabled: !isTerminal,
          requiresConfirmation: true,
          requiredRoles: authorizedRoles,
        },
        {
          actionKey: "open_dashboard",
          label: "대시보드 열기",
          enabled: isActive || isTerminal,
          requiresConfirmation: false,
          requiredRoles: [],
        },
        {
          actionKey: "open_audit_review",
          label: "감사 검토",
          enabled: true,
          requiresConfirmation: false,
          requiredRoles: [],
        },
      ],
    },
  };
}
