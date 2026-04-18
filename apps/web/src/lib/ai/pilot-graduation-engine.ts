/**
 * Pilot Graduation Engine — Batch 20
 *
 * "pilot가 끝났는가"가 아니라 "성공적으로 끝났는가 / 확장 가능한가 / rollback해야 하는가"를 판정.
 *
 * 4 sections:
 * 1. Pilot Completion Evaluation — evidence 기반 종료 판정
 * 2. Pilot Metrics Aggregation — 학습을 수치로 잠금
 * 3. Graduation Path — pilot → expanded / GA / rollback 판단
 * 4. Graduation Surface — center/rail/dock workbench 데이터
 *
 * CORE CONTRACT:
 * 1. 단순 duration 만료로 completed 판정 금지 — evidence 기반만 허용
 * 2. blocker 존재 시 GA 승인 불가
 * 3. rollback 후 즉시 relaunch 금지 — reassessment + remediation 필수
 * 4. graduation은 irreversible에 준하는 판단 — role gating + confirmation 유지
 * 5. truth 변경 없음 — read-only 판단 + 상태 전이 기록만
 */

import type { GovernanceDomain } from "./governance-event-bus";
import type { QuoteChainStage } from "./quote-approval-governance-engine";
import type { PilotStatus } from "./pilot-activation-engine";
import type { OperationalVerdict, ActivationScope } from "./operational-readiness-gate-engine";
import type { RC0ScopeFreeze, SignoffRegistry, Day0MonitoringPack, RollbackDrillResult } from "./rc0-pilot-launch-engine";
import { getLifecycleActionLabel, getVerdictLabel, getGraduationPathLabel, type UnifiedSeverity } from "./governance-grammar-registry";

// ══════════════════════════════════════════════════════
// 1. Pilot Metrics Aggregation
// ══════════════════════════════════════════════════════

export interface PilotMetrics {
  /** 기간 */
  startDate: string;
  endDate: string;
  daysElapsed: number;
  daysPlanned: number;

  /** PO 처리 */
  poProcessed: number;
  poLimit: number;
  poCompletionRate: number;    // 0~1 — chain 끝까지 도달한 비율
  poInProgress: number;
  poBlocked: number;

  /** 체인 건강 */
  chainCompletionRate: number; // 0~1
  avgChainDurationHours: number;
  maxChainDurationHours: number;

  /** 블로커 */
  blockerIncidenceRate: number;  // 0~1 — PO 당 blocker 발생 비율
  totalBlockerCount: number;
  hardBlockerCount: number;
  softBlockerCount: number;

  /** Stale */
  staleBlockingFrequency: number;  // 발생 횟수
  staleAvgResolutionMin: number;

  /** Runtime Signal */
  runtimeSignalAvg: number;       // 0~100
  runtimeSignalMin: number;
  runtimeCriticalBreachCount: number;

  /** Reopen / Retry / Rollback */
  reopenCount: number;
  retryCount: number;
  rollbackTriggerHitCount: number;

  /** Compliance */
  complianceVerdictDistribution: {
    compliant: number;
    conditionally_compliant: number;
    non_compliant: number;
  };
  complianceRate: number;  // 0~1

  /** Actor participation */
  activeActorCount: number;
  decisionLogVolume: number;

  /** Irreversible action */
  irreversibleActionCount: number;
  irreversibleActionFailureCount: number;
}

export function aggregatePilotMetrics(input: {
  scope: RC0ScopeFreeze;
  /** Raw operational data — in production these come from actual systems */
  poProcessed: number;
  poInProgress: number;
  poBlocked: number;
  chainCompletions: number;
  avgChainDurationHours: number;
  maxChainDurationHours: number;
  totalBlockerCount: number;
  hardBlockerCount: number;
  softBlockerCount: number;
  staleBlockingFrequency: number;
  staleAvgResolutionMin: number;
  runtimeSignalAvg: number;
  runtimeSignalMin: number;
  runtimeCriticalBreachCount: number;
  reopenCount: number;
  retryCount: number;
  rollbackTriggerHitCount: number;
  complianceVerdicts: { compliant: number; conditionally_compliant: number; non_compliant: number };
  activeActorCount: number;
  decisionLogVolume: number;
  irreversibleActionCount: number;
  irreversibleActionFailureCount: number;
}): PilotMetrics {
  const startMs = new Date(input.scope.startDate).getTime();
  const nowMs = Date.now();
  const endMs = new Date(input.scope.endDate).getTime();
  const daysElapsed = Math.max(0, Math.ceil((Math.min(nowMs, endMs) - startMs) / 86400000));
  const totalPo = input.poProcessed + input.poInProgress + input.poBlocked;

  const totalVerdicts = input.complianceVerdicts.compliant
    + input.complianceVerdicts.conditionally_compliant
    + input.complianceVerdicts.non_compliant;

  return {
    startDate: input.scope.startDate,
    endDate: input.scope.endDate,
    daysElapsed,
    daysPlanned: input.scope.durationDays,
    poProcessed: input.poProcessed,
    poLimit: input.scope.poLimit,
    poCompletionRate: totalPo > 0 ? input.chainCompletions / totalPo : 0,
    poInProgress: input.poInProgress,
    poBlocked: input.poBlocked,
    chainCompletionRate: totalPo > 0 ? input.chainCompletions / totalPo : 0,
    avgChainDurationHours: input.avgChainDurationHours,
    maxChainDurationHours: input.maxChainDurationHours,
    blockerIncidenceRate: totalPo > 0 ? input.totalBlockerCount / totalPo : 0,
    totalBlockerCount: input.totalBlockerCount,
    hardBlockerCount: input.hardBlockerCount,
    softBlockerCount: input.softBlockerCount,
    staleBlockingFrequency: input.staleBlockingFrequency,
    staleAvgResolutionMin: input.staleAvgResolutionMin,
    runtimeSignalAvg: input.runtimeSignalAvg,
    runtimeSignalMin: input.runtimeSignalMin,
    runtimeCriticalBreachCount: input.runtimeCriticalBreachCount,
    reopenCount: input.reopenCount,
    retryCount: input.retryCount,
    rollbackTriggerHitCount: input.rollbackTriggerHitCount,
    complianceVerdictDistribution: { ...input.complianceVerdicts },
    complianceRate: totalVerdicts > 0 ? input.complianceVerdicts.compliant / totalVerdicts : 0,
    activeActorCount: input.activeActorCount,
    decisionLogVolume: input.decisionLogVolume,
    irreversibleActionCount: input.irreversibleActionCount,
    irreversibleActionFailureCount: input.irreversibleActionFailureCount,
  };
}

// ══════════════════════════════════════════════════════
// 2. Pilot Completion Evaluation
// ══════════════════════════════════════════════════════

export type PilotCompletionVerdict =
  | "completed_successfully"
  | "completed_conditionally"
  | "rollback_required"
  | "cancelled"
  | "insufficient_evidence";

export interface CompletionCriterion {
  criterionId: string;
  name: string;
  category: "volume" | "quality" | "compliance" | "stability" | "safety";
  met: boolean;
  actual: string;
  threshold: string;
  severity: "required" | "recommended";
}

export interface PilotCompletionEvaluation {
  evaluationId: string;
  rc0Id: string;
  evaluatedAt: string;
  verdict: PilotCompletionVerdict;
  criteria: CompletionCriterion[];
  requiredMet: number;
  requiredTotal: number;
  recommendedMet: number;
  recommendedTotal: number;
  blockingReasons: string[];
  evidenceSummary: string[];
}

export function evaluatePilotCompletion(
  metrics: PilotMetrics,
  rc0Id: string,
  pilotStatus: PilotStatus,
  rollbackTriggerActive: boolean,
): PilotCompletionEvaluation {
  if (pilotStatus === "cancelled") {
    return buildCancelledEvaluation(rc0Id);
  }

  if (rollbackTriggerActive) {
    return buildRollbackRequiredEvaluation(rc0Id, metrics);
  }

  const criteria = buildCompletionCriteria(metrics);
  const requiredCriteria = criteria.filter(c => c.severity === "required");
  const recommendedCriteria = criteria.filter(c => c.severity === "recommended");
  const requiredMet = requiredCriteria.filter(c => c.met).length;
  const recommendedMet = recommendedCriteria.filter(c => c.met).length;
  const blockingReasons: string[] = [];

  // Evidence sufficiency check
  if (metrics.poProcessed < 3) {
    blockingReasons.push(`처리 PO 수 부족: ${metrics.poProcessed}건 (최소 3건)`);
  }
  if (metrics.daysElapsed < Math.floor(metrics.daysPlanned * 0.5)) {
    blockingReasons.push(`경과 일수 부족: ${metrics.daysElapsed}일 / ${metrics.daysPlanned}일 (최소 50%)`);
  }

  // Determine verdict
  let verdict: PilotCompletionVerdict;
  if (blockingReasons.length > 0 && metrics.poProcessed < 3) {
    verdict = "insufficient_evidence";
  } else if (requiredMet === requiredCriteria.length && blockingReasons.length === 0) {
    verdict = "completed_successfully";
  } else if (requiredMet >= Math.ceil(requiredCriteria.length * 0.7)) {
    verdict = "completed_conditionally";
  } else {
    verdict = "rollback_required";
  }

  const evidenceSummary = buildEvidenceSummary(metrics);

  return {
    evaluationId: `pce_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    rc0Id,
    evaluatedAt: new Date().toISOString(),
    verdict,
    criteria,
    requiredMet,
    requiredTotal: requiredCriteria.length,
    recommendedMet,
    recommendedTotal: recommendedCriteria.length,
    blockingReasons,
    evidenceSummary,
  };
}

function buildCompletionCriteria(m: PilotMetrics): CompletionCriterion[] {
  return [
    // Volume
    {
      criterionId: "CC-V1",
      name: "PO 처리량",
      category: "volume",
      met: m.poProcessed >= 3,
      actual: `${m.poProcessed}건`,
      threshold: "≥ 3건",
      severity: "required",
    },
    {
      criterionId: "CC-V2",
      name: "체인 완료율",
      category: "volume",
      met: m.chainCompletionRate >= 0.7,
      actual: `${(m.chainCompletionRate * 100).toFixed(1)}%`,
      threshold: "≥ 70%",
      severity: "required",
    },
    // Quality
    {
      criterionId: "CC-Q1",
      name: "블로커 발생률",
      category: "quality",
      met: m.blockerIncidenceRate <= 0.3,
      actual: `${(m.blockerIncidenceRate * 100).toFixed(1)}%`,
      threshold: "≤ 30%",
      severity: "required",
    },
    {
      criterionId: "CC-Q2",
      name: "Hard 블로커 수",
      category: "quality",
      met: m.hardBlockerCount <= 2,
      actual: `${m.hardBlockerCount}건`,
      threshold: "≤ 2건",
      severity: "required",
    },
    {
      criterionId: "CC-Q3",
      name: "Stale 차단 빈도",
      category: "quality",
      met: m.staleBlockingFrequency <= 3,
      actual: `${m.staleBlockingFrequency}건`,
      threshold: "≤ 3건",
      severity: "recommended",
    },
    // Compliance
    {
      criterionId: "CC-C1",
      name: "컴플라이언스 준수율",
      category: "compliance",
      met: m.complianceRate >= 0.8,
      actual: `${(m.complianceRate * 100).toFixed(1)}%`,
      threshold: "≥ 80%",
      severity: "required",
    },
    // Stability
    {
      criterionId: "CC-S1",
      name: "런타임 시그널 평균",
      category: "stability",
      met: m.runtimeSignalAvg >= 70,
      actual: `${m.runtimeSignalAvg.toFixed(1)}`,
      threshold: "≥ 70",
      severity: "required",
    },
    {
      criterionId: "CC-S2",
      name: "런타임 Critical Breach",
      category: "stability",
      met: m.runtimeCriticalBreachCount <= 1,
      actual: `${m.runtimeCriticalBreachCount}건`,
      threshold: "≤ 1건",
      severity: "required",
    },
    {
      criterionId: "CC-S3",
      name: "런타임 시그널 최저치",
      category: "stability",
      met: m.runtimeSignalMin >= 50,
      actual: `${m.runtimeSignalMin.toFixed(1)}`,
      threshold: "≥ 50",
      severity: "recommended",
    },
    // Safety
    {
      criterionId: "CC-SF1",
      name: "롤백 트리거 발동",
      category: "safety",
      met: m.rollbackTriggerHitCount === 0,
      actual: `${m.rollbackTriggerHitCount}건`,
      threshold: "0건",
      severity: "required",
    },
    {
      criterionId: "CC-SF2",
      name: "Irreversible Action 실패",
      category: "safety",
      met: m.irreversibleActionFailureCount === 0,
      actual: `${m.irreversibleActionFailureCount}건`,
      threshold: "0건",
      severity: "required",
    },
  ];
}

function buildEvidenceSummary(m: PilotMetrics): string[] {
  const evidence: string[] = [];
  evidence.push(`PO 처리: ${m.poProcessed}건 / ${m.poLimit}건 한도, 완료율 ${(m.chainCompletionRate * 100).toFixed(1)}%`);
  evidence.push(`기간: ${m.daysElapsed}일 경과 / ${m.daysPlanned}일 예정`);
  evidence.push(`블로커: 총 ${m.totalBlockerCount}건 (hard ${m.hardBlockerCount}, soft ${m.softBlockerCount})`);
  evidence.push(`런타임: 평균 ${m.runtimeSignalAvg.toFixed(1)}, 최저 ${m.runtimeSignalMin.toFixed(1)}, breach ${m.runtimeCriticalBreachCount}건`);
  evidence.push(`컴플라이언스: 준수율 ${(m.complianceRate * 100).toFixed(1)}%`);
  evidence.push(`Stale: ${m.staleBlockingFrequency}건, 평균 해소 ${m.staleAvgResolutionMin.toFixed(1)}분`);
  evidence.push(`Reopen ${m.reopenCount}건, Retry ${m.retryCount}건, Rollback trigger ${m.rollbackTriggerHitCount}건`);
  return evidence;
}

function buildCancelledEvaluation(rc0Id: string): PilotCompletionEvaluation {
  return {
    evaluationId: `pce_cancel_${Date.now().toString(36)}`,
    rc0Id,
    evaluatedAt: new Date().toISOString(),
    verdict: "cancelled",
    criteria: [],
    requiredMet: 0,
    requiredTotal: 0,
    recommendedMet: 0,
    recommendedTotal: 0,
    blockingReasons: ["파일럿 취소됨"],
    evidenceSummary: ["운영자에 의해 파일럿이 취소되었습니다."],
  };
}

function buildRollbackRequiredEvaluation(rc0Id: string, metrics: PilotMetrics): PilotCompletionEvaluation {
  const criteria = buildCompletionCriteria(metrics);
  const requiredCriteria = criteria.filter(c => c.severity === "required");
  const requiredMet = requiredCriteria.filter(c => c.met).length;

  return {
    evaluationId: `pce_rb_${Date.now().toString(36)}`,
    rc0Id,
    evaluatedAt: new Date().toISOString(),
    verdict: "rollback_required",
    criteria,
    requiredMet,
    requiredTotal: requiredCriteria.length,
    recommendedMet: criteria.filter(c => c.severity === "recommended" && c.met).length,
    recommendedTotal: criteria.filter(c => c.severity === "recommended").length,
    blockingReasons: ["롤백 트리거 활성 — 즉시 롤백 필요"],
    evidenceSummary: buildEvidenceSummary(metrics),
  };
}

// ══════════════════════════════════════════════════════
// 3. Graduation Path Engine
// ══════════════════════════════════════════════════════

export type GraduationPath =
  | "remain_internal_only"
  | "expand_pilot"
  | "ready_for_ga"
  | "rollback_and_reassess";

export interface GraduationDecision {
  decisionId: string;
  rc0Id: string;
  evaluatedAt: string;
  completionVerdict: PilotCompletionVerdict;
  path: GraduationPath;
  confidence: "high" | "medium" | "low";
  supportingFactors: string[];
  riskFactors: string[];
  conditions: string[];
  /** rollback 후 재시작 시 필요한 항목 */
  reassessmentRequired: boolean;
  remediationItems: string[];
}

export function evaluateGraduationPath(
  completion: PilotCompletionEvaluation,
  metrics: PilotMetrics,
  currentScope: ActivationScope,
): GraduationDecision {
  const supportingFactors: string[] = [];
  const riskFactors: string[] = [];
  const conditions: string[] = [];
  const remediationItems: string[] = [];

  // Collect factors
  if (metrics.chainCompletionRate >= 0.9) supportingFactors.push("체인 완료율 90% 이상");
  if (metrics.chainCompletionRate >= 0.7) supportingFactors.push("체인 완료율 70% 이상");
  if (metrics.complianceRate >= 0.9) supportingFactors.push("컴플라이언스 준수율 90% 이상");
  if (metrics.runtimeSignalAvg >= 85) supportingFactors.push("런타임 시그널 안정적 (85+)");
  if (metrics.rollbackTriggerHitCount === 0) supportingFactors.push("롤백 트리거 미발동");
  if (metrics.irreversibleActionFailureCount === 0) supportingFactors.push("Irreversible action 실패 0건");
  if (metrics.poProcessed >= metrics.poLimit * 0.8) supportingFactors.push("PO 처리량 80% 이상 달성");

  if (metrics.blockerIncidenceRate > 0.2) riskFactors.push(`블로커 발생률 ${(metrics.blockerIncidenceRate * 100).toFixed(1)}%`);
  if (metrics.runtimeCriticalBreachCount > 0) riskFactors.push(`런타임 critical breach ${metrics.runtimeCriticalBreachCount}건`);
  if (metrics.staleBlockingFrequency > 2) riskFactors.push(`Stale blocking ${metrics.staleBlockingFrequency}건`);
  if (metrics.complianceRate < 0.8) riskFactors.push(`컴플라이언스 ${(metrics.complianceRate * 100).toFixed(1)}%`);
  if (metrics.hardBlockerCount > 2) riskFactors.push(`Hard blocker ${metrics.hardBlockerCount}건`);
  if (metrics.rollbackTriggerHitCount > 0) riskFactors.push(`롤백 트리거 ${metrics.rollbackTriggerHitCount}건`);

  // Determine path based on completion verdict + metrics
  let path: GraduationPath;
  let confidence: "high" | "medium" | "low";
  let reassessmentRequired = false;

  switch (completion.verdict) {
    case "completed_successfully": {
      if (currentScope === "internal_only") {
        path = "expand_pilot";
        confidence = riskFactors.length === 0 ? "high" : "medium";
        conditions.push("확장 파일럿 대상 scope 결정 필요");
      } else if (currentScope === "pilot_limited") {
        // Check if ready to go further
        if (riskFactors.length === 0 && metrics.complianceRate >= 0.9 && metrics.chainCompletionRate >= 0.9) {
          path = "ready_for_ga";
          confidence = "high";
          conditions.push("GA 승인자 최종 서명 필요");
          conditions.push("운영팀 GA 전환 계획 수립 필요");
        } else {
          path = "expand_pilot";
          confidence = "medium";
          conditions.push("리스크 항목 해소 후 GA 재평가");
        }
      } else if (currentScope === "pilot_expanded") {
        if (riskFactors.length <= 1 && metrics.complianceRate >= 0.85) {
          path = "ready_for_ga";
          confidence = riskFactors.length === 0 ? "high" : "medium";
          conditions.push("GA 승인자 최종 서명 필요");
        } else {
          path = "remain_internal_only";
          confidence = "low";
          conditions.push("운영 안정화 후 재평가 필요");
        }
      } else {
        path = "remain_internal_only";
        confidence = "low";
      }
      break;
    }
    case "completed_conditionally": {
      if (riskFactors.length <= 2) {
        path = currentScope === "internal_only" ? "expand_pilot" : "remain_internal_only";
        confidence = "medium";
        conditions.push("조건부 항목 해소 필요");
        for (const c of completion.criteria.filter(cr => cr.severity === "required" && !cr.met)) {
          conditions.push(`미충족: ${c.name} (${c.actual} vs ${c.threshold})`);
        }
      } else {
        path = "rollback_and_reassess";
        confidence = "medium";
        reassessmentRequired = true;
        remediationItems.push(...riskFactors.map(r => `리스크 해소: ${r}`));
      }
      break;
    }
    case "rollback_required": {
      path = "rollback_and_reassess";
      confidence = "high";
      reassessmentRequired = true;
      remediationItems.push("롤백 원인 분석 리포트 작성");
      remediationItems.push("재발 방지 계획 수립");
      if (metrics.rollbackTriggerHitCount > 0) remediationItems.push("롤백 트리거 원인 제거");
      if (metrics.runtimeCriticalBreachCount > 1) remediationItems.push("런타임 안정성 확보");
      if (metrics.complianceRate < 0.7) remediationItems.push("컴플라이언스 기준 재정비");
      break;
    }
    case "cancelled": {
      path = "rollback_and_reassess";
      confidence = "medium";
      reassessmentRequired = true;
      remediationItems.push("취소 사유 기록");
      remediationItems.push("재시작 조건 정의");
      break;
    }
    case "insufficient_evidence": {
      path = "remain_internal_only";
      confidence = "low";
      conditions.push("충분한 evidence 수집 후 재평가 필요");
      conditions.push(`현재 PO ${metrics.poProcessed}건, 경과 ${metrics.daysElapsed}일`);
      break;
    }
  }

  return {
    decisionId: `grad_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    rc0Id: completion.rc0Id,
    evaluatedAt: new Date().toISOString(),
    completionVerdict: completion.verdict,
    path,
    confidence,
    supportingFactors,
    riskFactors,
    conditions,
    reassessmentRequired,
    remediationItems,
  };
}

// ══════════════════════════════════════════════════════
// 4. Restart / Reassess Workflow
// ══════════════════════════════════════════════════════

export type RestartStatus = "rolled_back" | "reassess_required" | "remediation_in_progress" | "restart_ready";

export interface RestartAssessment {
  assessmentId: string;
  rc0Id: string;
  previousGraduationId: string;
  status: RestartStatus;
  createdAt: string;
  /** 원래 rollback 사유 */
  rollbackReason: string;
  /** remediation 항목 */
  remediationItems: RemediationItem[];
  /** 재시작 조건 충족 여부 */
  restartReady: boolean;
  /** 재시작 불가 사유 */
  blockingReasons: string[];
}

export interface RemediationItem {
  itemId: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "waived";
  assignee: string | null;
  completedAt: string | null;
  evidence: string | null;
}

export function createRestartAssessment(
  rc0Id: string,
  graduationDecisionId: string,
  rollbackReason: string,
  remediationDescriptions: string[],
): RestartAssessment {
  return {
    assessmentId: `restart_${Date.now().toString(36)}`,
    rc0Id,
    previousGraduationId: graduationDecisionId,
    status: "reassess_required",
    createdAt: new Date().toISOString(),
    rollbackReason,
    remediationItems: remediationDescriptions.map((desc, i) => ({
      itemId: `REM-${i + 1}`,
      description: desc,
      status: "pending",
      assignee: null,
      completedAt: null,
      evidence: null,
    })),
    restartReady: false,
    blockingReasons: ["remediation 항목 미완료"],
  };
}

export function evaluateRestartReadiness(assessment: RestartAssessment): RestartAssessment {
  const pending = assessment.remediationItems.filter(
    r => r.status === "pending" || r.status === "in_progress",
  );
  const blockingReasons: string[] = [];

  if (pending.length > 0) {
    blockingReasons.push(`미완료 remediation: ${pending.length}건`);
  }

  // Waived items are acceptable — only pending/in_progress block
  const completedOrWaived = assessment.remediationItems.filter(
    r => r.status === "completed" || r.status === "waived",
  );
  if (completedOrWaived.length === 0 && assessment.remediationItems.length > 0) {
    blockingReasons.push("remediation 항목 중 완료/면제된 항목 없음");
  }

  const restartReady = blockingReasons.length === 0;

  let status: RestartStatus;
  if (restartReady) {
    status = "restart_ready";
  } else if (assessment.remediationItems.some(r => r.status === "in_progress")) {
    status = "remediation_in_progress";
  } else {
    status = "reassess_required";
  }

  return {
    ...assessment,
    status,
    restartReady,
    blockingReasons,
  };
}

// ══════════════════════════════════════════════════════
// 5. Graduation Surface Builder
// ══════════════════════════════════════════════════════

export interface GraduationSurface {
  center: {
    completionVerdict: PilotCompletionVerdict;
    graduationPath: GraduationPath;
    confidence: string;
    criteriaSnapshot: {
      requiredMet: number;
      requiredTotal: number;
      recommendedMet: number;
      recommendedTotal: number;
    };
    metricsSummary: {
      poProcessed: number;
      poLimit: number;
      chainCompletionRate: string;
      blockerIncidenceRate: string;
      complianceRate: string;
      runtimeSignalAvg: string;
    };
    supportingFactors: string[];
    riskFactors: string[];
    conditions: string[];
    blockingReasons: string[];
  };
  rail: {
    evidenceSummary: string[];
    criteriaDetails: Array<{
      id: string;
      name: string;
      category: string;
      met: boolean;
      actual: string;
      threshold: string;
      severity: string;
    }>;
    metricsDetail: {
      staleBlockingFrequency: number;
      reopenCount: number;
      retryCount: number;
      rollbackTriggerHitCount: number;
      irreversibleActionFailureCount: number;
      activeActorCount: number;
      decisionLogVolume: number;
    };
    remediationItems: RemediationItem[] | null;
  };
  dock: {
    actions: GraduationAction[];
  };
}

export interface GraduationAction {
  actionKey: string;
  label: string;
  enabled: boolean;
  requiresConfirmation: boolean;
  requiredRoles: string[];
  disabledReason: string | null;
}

export function buildGraduationSurface(
  completion: PilotCompletionEvaluation,
  graduation: GraduationDecision,
  metrics: PilotMetrics,
  restartAssessment: RestartAssessment | null,
): GraduationSurface {
  const hasBlockers = completion.blockingReasons.length > 0 || graduation.riskFactors.length > 2;

  return {
    center: {
      completionVerdict: completion.verdict,
      graduationPath: graduation.path,
      confidence: graduation.confidence,
      criteriaSnapshot: {
        requiredMet: completion.requiredMet,
        requiredTotal: completion.requiredTotal,
        recommendedMet: completion.recommendedMet,
        recommendedTotal: completion.recommendedTotal,
      },
      metricsSummary: {
        poProcessed: metrics.poProcessed,
        poLimit: metrics.poLimit,
        chainCompletionRate: `${(metrics.chainCompletionRate * 100).toFixed(1)}%`,
        blockerIncidenceRate: `${(metrics.blockerIncidenceRate * 100).toFixed(1)}%`,
        complianceRate: `${(metrics.complianceRate * 100).toFixed(1)}%`,
        runtimeSignalAvg: metrics.runtimeSignalAvg.toFixed(1),
      },
      supportingFactors: graduation.supportingFactors,
      riskFactors: graduation.riskFactors,
      conditions: graduation.conditions,
      blockingReasons: completion.blockingReasons,
    },
    rail: {
      evidenceSummary: completion.evidenceSummary,
      criteriaDetails: completion.criteria.map(c => ({
        id: c.criterionId,
        name: c.name,
        category: c.category,
        met: c.met,
        actual: c.actual,
        threshold: c.threshold,
        severity: c.severity,
      })),
      metricsDetail: {
        staleBlockingFrequency: metrics.staleBlockingFrequency,
        reopenCount: metrics.reopenCount,
        retryCount: metrics.retryCount,
        rollbackTriggerHitCount: metrics.rollbackTriggerHitCount,
        irreversibleActionFailureCount: metrics.irreversibleActionFailureCount,
        activeActorCount: metrics.activeActorCount,
        decisionLogVolume: metrics.decisionLogVolume,
      },
      remediationItems: restartAssessment?.remediationItems ?? null,
    },
    dock: {
      actions: [
        {
          actionKey: "mark_completed",
          label: getLifecycleActionLabel("mark_completed"),
          enabled: completion.verdict === "completed_successfully" || completion.verdict === "completed_conditionally",
          requiresConfirmation: true,
          requiredRoles: ["release_manager", "ops_lead"],
          disabledReason: completion.verdict !== "completed_successfully" && completion.verdict !== "completed_conditionally"
            ? `현재 verdict: ${getVerdictLabel(completion.verdict)}`
            : null,
        },
        {
          actionKey: "expand_pilot",
          label: getLifecycleActionLabel("expand_pilot"),
          enabled: graduation.path === "expand_pilot" && !hasBlockers,
          requiresConfirmation: true,
          requiredRoles: ["release_manager"],
          disabledReason: graduation.path !== "expand_pilot"
            ? `현재 경로: ${getGraduationPathLabel(graduation.path)}`
            : hasBlockers ? "리스크 항목 해소 필요" : null,
        },
        {
          actionKey: "approve_ga",
          label: getLifecycleActionLabel("approve_ga"),
          enabled: graduation.path === "ready_for_ga" && !hasBlockers,
          requiresConfirmation: true,
          requiredRoles: ["release_manager", "compliance_reviewer"],
          disabledReason: graduation.path !== "ready_for_ga"
            ? `현재 경로: ${getGraduationPathLabel(graduation.path)}`
            : hasBlockers ? "리스크/블로커 해소 필요" : null,
        },
        {
          actionKey: "rollback_and_reassess",
          label: getLifecycleActionLabel("rollback_and_reassess"),
          enabled: true,
          requiresConfirmation: true,
          requiredRoles: ["release_manager", "rollback_owner"],
          disabledReason: null,
        },
        {
          actionKey: "cancel_pilot",
          label: getLifecycleActionLabel("cancel_pilot"),
          enabled: true,
          requiresConfirmation: true,
          requiredRoles: ["release_manager"],
          disabledReason: null,
        },
        {
          actionKey: "export_graduation_pack",
          label: getLifecycleActionLabel("export_graduation_pack"),
          enabled: true,
          requiresConfirmation: false,
          requiredRoles: [],
          disabledReason: null,
        },
      ],
    },
  };
}
