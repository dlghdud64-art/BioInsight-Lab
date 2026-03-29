/**
 * RC0 Midpoint Review Engine — Batch 21
 *
 * "왜 아직 internal_only인지"와 "무엇을 더 보면 expand 가능한지"를 한 화면에서 설명.
 *
 * 5 sections:
 * 1. Non-Compliance Case Review — 미준수 1건 원인 분석
 * 2. Soft Blocker Pattern Summary — soft blocker 패턴/집중도 분석
 * 3. Dwell Risk Summary — 진행중 case 체류 위험 분석
 * 4. Graduation Projection — 정책 변경 없이 evidence 축적 효과 시뮬레이션
 * 5. Midpoint Review Surface — center/rail/dock workbench 데이터
 *
 * CORE CONTRACT:
 * 1. read-only 분석 엔진 — source of truth 수정 없음
 * 2. graduation policy 변경 금지 — projection은 시뮬레이션만
 * 3. grammar registry single source of truth 유지
 * 4. label 하드코딩 금지
 * 5. dashboard / audit / graduation으로 exact handoff 가능
 */

import type { GovernanceDomain } from "./governance-event-bus";
import type { QuoteChainStage } from "./quote-approval-governance-engine";
import type { ActivationScope } from "./operational-readiness-gate-engine";
import type { PilotStatus } from "./pilot-activation-engine";
import type { RC0ScopeFreeze } from "./rc0-pilot-launch-engine";
import type {
  PilotMetrics,
  PilotCompletionEvaluation,
  PilotCompletionVerdict,
  GraduationDecision,
  GraduationPath,
} from "./pilot-graduation-engine";
import {
  evaluatePilotCompletion,
  evaluateGraduationPath,
} from "./pilot-graduation-engine";
import {
  getVerdictLabel,
  getGraduationPathLabel,
  getLifecycleActionLabel,
  type UnifiedSeverity,
} from "./governance-grammar-registry";

// ══════════════════════════════════════════════════════
// 1. Non-Compliance Case Review
// ══════════════════════════════════════════════════════

export type RootCauseCategory =
  | "policy"
  | "stale_context"
  | "handoff"
  | "compliance_gap"
  | "operator_error"
  | "data_quality"
  | "unknown";

export interface NonComplianceCaseReview {
  caseId: string;
  poNumber: string;
  domain: GovernanceDomain;
  stage: QuoteChainStage;
  actor: string;
  decisionType: string;
  verdict: string;
  rootCauseCategory: RootCauseCategory;
  triggeredBy: string;
  lineage: string[];
  remediationRecommendation: string;
  repeatRisk: "low" | "medium" | "high";
}

export interface NonComplianceCaseInput {
  caseId: string;
  poNumber: string;
  domain: GovernanceDomain;
  stage: QuoteChainStage;
  actor: string;
  decisionType: string;
  verdict: string;
  /** Event lineage — stale / handoff / reopen / retry history */
  eventHistory: Array<{
    eventType: string;
    timestamp: string;
    detail: string;
  }>;
  /** Related blocker IDs (if any) */
  relatedBlockerIds: string[];
  /** Related stale events */
  staleEvents: number;
  /** Handoff chain breaks */
  handoffBreaks: number;
  /** Data quality signals */
  dataQualityFlags: string[];
}

export function analyzeNonComplianceCase(input: NonComplianceCaseInput): NonComplianceCaseReview {
  const rootCause = inferRootCause(input);
  const repeatRisk = assessRepeatRisk(input, rootCause);
  const remediation = buildRemediationRecommendation(rootCause, input);
  const triggeredBy = inferTrigger(input);
  const lineage = input.eventHistory.map(
    e => `[${e.eventType}] ${e.detail}`,
  );

  return {
    caseId: input.caseId,
    poNumber: input.poNumber,
    domain: input.domain,
    stage: input.stage,
    actor: input.actor,
    decisionType: input.decisionType,
    verdict: input.verdict,
    rootCauseCategory: rootCause,
    triggeredBy,
    lineage,
    remediationRecommendation: remediation,
    repeatRisk,
  };
}

function inferRootCause(input: NonComplianceCaseInput): RootCauseCategory {
  // Priority-based inference from event lineage
  if (input.staleEvents > 0 && input.handoffBreaks > 0) return "handoff";
  if (input.staleEvents > 0) return "stale_context";
  if (input.handoffBreaks > 0) return "handoff";
  if (input.dataQualityFlags.length > 0) return "data_quality";
  if (input.relatedBlockerIds.length > 0) return "compliance_gap";

  // Check event history for patterns
  const hasReopen = input.eventHistory.some(e => e.eventType === "reopen");
  const hasRetry = input.eventHistory.some(e => e.eventType === "retry");
  const hasPolicyEvent = input.eventHistory.some(
    e => e.eventType === "policy_check_fail" || e.eventType === "policy_hold",
  );

  if (hasPolicyEvent) return "policy";
  if (hasReopen && hasRetry) return "operator_error";
  if (hasReopen) return "compliance_gap";

  return "unknown";
}

function assessRepeatRisk(input: NonComplianceCaseInput, rootCause: RootCauseCategory): "low" | "medium" | "high" {
  // Structural causes are higher repeat risk than one-off operational events
  if (rootCause === "policy" || rootCause === "compliance_gap") return "high";
  if (rootCause === "handoff" || rootCause === "stale_context") return "medium";
  if (rootCause === "data_quality") return "medium";
  if (rootCause === "operator_error") return "low";
  return "medium"; // unknown — conservative
}

function buildRemediationRecommendation(rootCause: RootCauseCategory, input: NonComplianceCaseInput): string {
  switch (rootCause) {
    case "policy":
      return "정책 규칙 재확인 및 operator 안내 갱신 필요";
    case "stale_context":
      return "stale 감지 임계치 조정 또는 refresh 자동화 검토";
    case "handoff":
      return "handoff 연결 검증 강화 및 chain 무결성 점검";
    case "compliance_gap":
      return "compliance 체크리스트 항목 보완 또는 기준 명확화";
    case "operator_error":
      return "operator 워크플로 교육 또는 UX 가이드 개선";
    case "data_quality":
      return `데이터 품질 플래그 해소: ${input.dataQualityFlags.join(", ")}`;
    case "unknown":
      return "원인 미식별 — 추가 이벤트 로그 수집 필요";
  }
}

function inferTrigger(input: NonComplianceCaseInput): string {
  if (input.eventHistory.length === 0) return "이벤트 이력 없음";
  // Most recent relevant event
  const relevant = input.eventHistory.filter(
    e => e.eventType !== "status_change",
  );
  if (relevant.length > 0) {
    const last = relevant[relevant.length - 1];
    return `${last.eventType}: ${last.detail}`;
  }
  return input.eventHistory[input.eventHistory.length - 1].detail;
}

// ══════════════════════════════════════════════════════
// 2. Soft Blocker Pattern Summary
// ══════════════════════════════════════════════════════

export interface SoftBlockerEntry {
  blockerId: string;
  caseId: string;
  poNumber: string;
  domain: GovernanceDomain;
  stage: QuoteChainStage;
  blockerType: string;
  actor: string;
  resolvedAt: string | null;
  durationMin: number | null;
}

export interface SoftBlockerPatternSummary {
  totalCount: number;
  byDomain: Record<string, number>;
  byStage: Record<string, number>;
  byBlockerType: Record<string, number>;
  byActor: Record<string, number>;
  byCaseId: Record<string, number>;
  /** 2회 이상 동일 domain+stage+type 조합이 반복된 패턴 */
  repeatedPatterns: Array<{
    pattern: string;
    count: number;
    instances: string[];
  }>;
  /** actor에 편중이 집중된 경우 */
  actorConcentration: Array<{
    actor: string;
    count: number;
    share: number;
  }>;
  /** 0~1 — 특정 조합에 몰린 정도 */
  concentrationScore: number;
  topRepeatedPath: string | null;
  recommendedAction: string;
}

export function analyzeSoftBlockerPattern(blockers: SoftBlockerEntry[]): SoftBlockerPatternSummary {
  if (blockers.length === 0) {
    return emptyBlockerPattern();
  }

  const byDomain: Record<string, number> = {};
  const byStage: Record<string, number> = {};
  const byBlockerType: Record<string, number> = {};
  const byActor: Record<string, number> = {};
  const byCaseId: Record<string, number> = {};
  const pathCounts: Record<string, string[]> = {};

  for (const b of blockers) {
    byDomain[b.domain] = (byDomain[b.domain] ?? 0) + 1;
    byStage[b.stage] = (byStage[b.stage] ?? 0) + 1;
    byBlockerType[b.blockerType] = (byBlockerType[b.blockerType] ?? 0) + 1;
    byActor[b.actor] = (byActor[b.actor] ?? 0) + 1;
    byCaseId[b.caseId] = (byCaseId[b.caseId] ?? 0) + 1;

    const pathKey = `${b.domain}/${b.stage}/${b.blockerType}`;
    if (!pathCounts[pathKey]) pathCounts[pathKey] = [];
    pathCounts[pathKey].push(b.blockerId);
  }

  // Repeated patterns: path appears 2+ times
  const repeatedPatterns = Object.entries(pathCounts)
    .filter(([, ids]) => ids.length >= 2)
    .map(([pattern, ids]) => ({ pattern, count: ids.length, instances: ids }))
    .sort((a, b) => b.count - a.count);

  // Actor concentration: any actor with > 40% share
  const actorConcentration = Object.entries(byActor)
    .map(([actor, count]) => ({ actor, count, share: count / blockers.length }))
    .filter(a => a.share > 0.4 || a.count >= 2)
    .sort((a, b) => b.share - a.share);

  // Concentration score: Herfindahl index on path distribution
  const pathShares = Object.values(pathCounts).map(ids => ids.length / blockers.length);
  const concentrationScore = pathShares.reduce((sum, s) => sum + s * s, 0);

  const topRepeatedPath = repeatedPatterns.length > 0 ? repeatedPatterns[0].pattern : null;

  const recommendedAction = buildBlockerRecommendation(
    repeatedPatterns,
    actorConcentration,
    concentrationScore,
    blockers.length,
  );

  return {
    totalCount: blockers.length,
    byDomain,
    byStage,
    byBlockerType,
    byActor,
    byCaseId,
    repeatedPatterns,
    actorConcentration,
    concentrationScore: Math.round(concentrationScore * 1000) / 1000,
    topRepeatedPath,
    recommendedAction,
  };
}

function emptyBlockerPattern(): SoftBlockerPatternSummary {
  return {
    totalCount: 0,
    byDomain: {},
    byStage: {},
    byBlockerType: {},
    byActor: {},
    byCaseId: {},
    repeatedPatterns: [],
    actorConcentration: [],
    concentrationScore: 0,
    topRepeatedPath: null,
    recommendedAction: "soft blocker 없음 — 조치 불필요",
  };
}

function buildBlockerRecommendation(
  repeated: SoftBlockerPatternSummary["repeatedPatterns"],
  actorConc: SoftBlockerPatternSummary["actorConcentration"],
  concScore: number,
  total: number,
): string {
  if (total === 0) return "soft blocker 없음 — 조치 불필요";
  if (total === 1 && repeated.length === 0) return "단발성 blocker — 패턴 아닌 개별 이슈로 관찰";

  const parts: string[] = [];
  if (repeated.length > 0) {
    parts.push(`반복 패턴 ${repeated.length}건 감지 — 구조적 원인 점검 권장`);
  }
  if (actorConc.length > 0) {
    parts.push(`actor 편중 감지 (${actorConc.map(a => `${a.actor}: ${(a.share * 100).toFixed(0)}%`).join(", ")})`);
  }
  if (concScore > 0.5) {
    parts.push("높은 집중도 — 특정 경로에 blocker 몰림");
  }
  if (parts.length === 0) {
    parts.push("분산된 blocker — 개별 해소 우선");
  }

  return parts.join("; ");
}

// ══════════════════════════════════════════════════════
// 3. Dwell Risk Summary
// ══════════════════════════════════════════════════════

export type DwellRiskLevel = "normal" | "watch" | "at_risk" | "critical";

export interface InProgressCaseInput {
  caseId: string;
  poNumber: string;
  currentStage: QuoteChainStage;
  domain: GovernanceDomain;
  enteredStageAt: string;
  /** Expected max dwell hours for this stage — from operational norms */
  expectedMaxDwellHours: number;
  staleFlag: boolean;
  linkedBlockerIds: string[];
}

export interface DwellCaseAssessment {
  caseId: string;
  poNumber: string;
  currentStage: QuoteChainStage;
  hoursInStage: number;
  expectedMaxDwellHours: number;
  riskLevel: DwellRiskLevel;
  staleFlag: boolean;
  blockerLinkage: boolean;
}

export interface DwellRiskSummary {
  totalInProgress: number;
  cases: DwellCaseAssessment[];
  aggregate: {
    normal: number;
    watch: number;
    atRisk: number;
    critical: number;
  };
  oldestInProgressCase: DwellCaseAssessment | null;
  likelyGraduationImpact: string;
}

export function analyzeDwellRisk(cases: InProgressCaseInput[]): DwellRiskSummary {
  if (cases.length === 0) {
    return emptyDwellSummary();
  }

  const now = Date.now();
  const assessed = cases.map((c): DwellCaseAssessment => {
    const enteredMs = new Date(c.enteredStageAt).getTime();
    const hoursInStage = Math.max(0, (now - enteredMs) / 3600000);
    const ratio = c.expectedMaxDwellHours > 0 ? hoursInStage / c.expectedMaxDwellHours : 0;

    let riskLevel: DwellRiskLevel;
    if (ratio >= 2.0) riskLevel = "critical";
    else if (ratio >= 1.0) riskLevel = "at_risk";
    else if (ratio >= 0.7) riskLevel = "watch";
    else riskLevel = "normal";

    // Stale flag or blocker linkage escalates risk by one level
    if (c.staleFlag || c.linkedBlockerIds.length > 0) {
      if (riskLevel === "normal") riskLevel = "watch";
      else if (riskLevel === "watch") riskLevel = "at_risk";
      else if (riskLevel === "at_risk") riskLevel = "critical";
    }

    return {
      caseId: c.caseId,
      poNumber: c.poNumber,
      currentStage: c.currentStage,
      hoursInStage: Math.round(hoursInStage * 10) / 10,
      expectedMaxDwellHours: c.expectedMaxDwellHours,
      riskLevel,
      staleFlag: c.staleFlag,
      blockerLinkage: c.linkedBlockerIds.length > 0,
    };
  });

  const aggregate = {
    normal: assessed.filter(c => c.riskLevel === "normal").length,
    watch: assessed.filter(c => c.riskLevel === "watch").length,
    atRisk: assessed.filter(c => c.riskLevel === "at_risk").length,
    critical: assessed.filter(c => c.riskLevel === "critical").length,
  };

  const sorted = [...assessed].sort((a, b) => b.hoursInStage - a.hoursInStage);
  const oldestInProgressCase = sorted[0] ?? null;

  const impact = assessGraduationImpact(aggregate, cases.length);

  return {
    totalInProgress: cases.length,
    cases: assessed,
    aggregate,
    oldestInProgressCase,
    likelyGraduationImpact: impact,
  };
}

function emptyDwellSummary(): DwellRiskSummary {
  return {
    totalInProgress: 0,
    cases: [],
    aggregate: { normal: 0, watch: 0, atRisk: 0, critical: 0 },
    oldestInProgressCase: null,
    likelyGraduationImpact: "진행중 case 없음 — dwell 리스크 없음",
  };
}

function assessGraduationImpact(
  agg: DwellRiskSummary["aggregate"],
  total: number,
): string {
  if (total === 0) return "진행중 case 없음 — dwell 리스크 없음";
  if (agg.critical > 0) return "critical dwell 존재 — graduation 시 chain completion rate 하락 가능";
  if (agg.atRisk > 0) return "at_risk case 존재 — graduation 평가 시 completion rate 재확인 필요";
  if (agg.watch > 0) return "watch 수준 — 현재는 graduation 영향 낮음, 지속 모니터링 권장";
  return "전체 정상 — graduation 영향 없음";
}

// ══════════════════════════════════════════════════════
// 4. Graduation Projection
// ══════════════════════════════════════════════════════

export interface GraduationProjection {
  /** Current evaluation (unchanged) */
  currentVerdict: PilotCompletionVerdict;
  currentPath: GraduationPath;
  /** Projected evaluation when daysElapsed >= minimum evidence window */
  projectedVerdict: PilotCompletionVerdict;
  projectedPath: GraduationPath;
  projectedConfidence: "high" | "medium" | "low";
  /** Blockers that disappear once minimum evidence window is met */
  timeResolvedBlockers: string[];
  /** Blockers that remain even after time passes */
  persistentBlockers: string[];
  /** Projection assumptions */
  assumptions: string[];
  /** Whether expansion is plausible at 7-day mark */
  expansionPlausible: boolean;
}

export function projectGraduation(
  metrics: PilotMetrics,
  currentCompletion: PilotCompletionEvaluation,
  currentGraduation: GraduationDecision,
  scope: RC0ScopeFreeze,
  /** Additional blocking factors not captured in metrics */
  additionalBlockers: string[],
): GraduationProjection {
  const assumptions: string[] = [
    "현재 metrics가 7일 시점까지 유지된다고 가정",
    "rollback trigger 미발동 유지 가정",
    "hard blocker 미발생 유지 가정",
  ];

  // Simulate with daysElapsed >= minimum
  const minDays = Math.ceil(metrics.daysPlanned * 0.5);
  const simulatedMetrics: PilotMetrics = {
    ...metrics,
    daysElapsed: Math.max(metrics.daysElapsed, minDays),
  };

  // Re-evaluate using existing engines (read-only — no policy change)
  const projectedCompletion = evaluatePilotCompletion(
    simulatedMetrics,
    currentCompletion.rc0Id,
    "active",
    false,
  );

  const projectedGradDecision = evaluateGraduationPath(
    projectedCompletion,
    simulatedMetrics,
    scope.activationScope,
  );

  // Classify blockers
  const timeResolvedBlockers = currentCompletion.blockingReasons.filter(
    r => r.includes("경과 일수 부족") || r.includes("Evidence 부족"),
  );
  const persistentBlockers = [
    ...currentCompletion.blockingReasons.filter(
      r => !r.includes("경과 일수 부족") && !r.includes("Evidence 부족"),
    ),
    ...additionalBlockers,
  ];

  // Check if non-time blockers exist in projected evaluation
  const projectedNonTimeBlockers = projectedCompletion.blockingReasons.filter(
    r => !r.includes("경과 일수 부족"),
  );
  if (projectedNonTimeBlockers.length > 0) {
    for (const b of projectedNonTimeBlockers) {
      if (!persistentBlockers.includes(b)) {
        persistentBlockers.push(b);
      }
    }
  }

  const expansionPlausible =
    projectedGradDecision.path === "expand_pilot" ||
    projectedGradDecision.path === "ready_for_ga";

  return {
    currentVerdict: currentCompletion.verdict,
    currentPath: currentGraduation.path,
    projectedVerdict: projectedCompletion.verdict,
    projectedPath: projectedGradDecision.path,
    projectedConfidence: projectedGradDecision.confidence,
    timeResolvedBlockers,
    persistentBlockers,
    assumptions,
    expansionPlausible,
  };
}

// ══════════════════════════════════════════════════════
// 5. Midpoint Action Plan
// ══════════════════════════════════════════════════════

export interface MidpointActionPlan {
  immediateActions: string[];
  beforeDay7Actions: string[];
  evidenceCollectionActions: string[];
  safeToExpandPrerequisites: string[];
  ownerSuggestion: string | null;
}

export function buildMidpointActionPlan(
  nonCompliance: NonComplianceCaseReview[],
  blockerPattern: SoftBlockerPatternSummary,
  dwellRisk: DwellRiskSummary,
  projection: GraduationProjection,
): MidpointActionPlan {
  const immediate: string[] = [];
  const beforeDay7: string[] = [];
  const evidence: string[] = [];
  const prerequisites: string[] = [];

  // From non-compliance
  for (const nc of nonCompliance) {
    if (nc.repeatRisk === "high") {
      immediate.push(`[${nc.caseId}] ${nc.remediationRecommendation} (반복 위험 높음)`);
    } else {
      beforeDay7.push(`[${nc.caseId}] ${nc.remediationRecommendation}`);
    }
    evidence.push(`[${nc.caseId}] root cause 확정 및 해소 이력 기록`);
  }

  // From blocker pattern
  if (blockerPattern.repeatedPatterns.length > 0) {
    immediate.push(`반복 blocker 패턴 ${blockerPattern.repeatedPatterns.length}건 구조적 원인 점검`);
  }
  if (blockerPattern.actorConcentration.length > 0) {
    beforeDay7.push("actor 편중 해소 또는 워크플로 교육");
  }

  // From dwell risk
  if (dwellRisk.aggregate.critical > 0) {
    immediate.push(`critical dwell case ${dwellRisk.aggregate.critical}건 즉시 해소`);
  }
  if (dwellRisk.aggregate.atRisk > 0) {
    beforeDay7.push(`at_risk dwell case ${dwellRisk.aggregate.atRisk}건 모니터링 강화`);
  }

  // From projection
  if (projection.persistentBlockers.length > 0) {
    for (const b of projection.persistentBlockers) {
      prerequisites.push(`persistent blocker 해소: ${b}`);
    }
  }
  if (!projection.expansionPlausible) {
    prerequisites.push("현재 metrics로는 expansion 불가 — metrics 개선 필요");
  }

  // Default evidence collection
  evidence.push("7일 시점 metrics 스냅샷 수집");
  evidence.push("compliance verdict 누적 확인");
  evidence.push("dwell 추이 기록");

  // Expand prerequisites
  prerequisites.push("daysElapsed ≥ 7");
  prerequisites.push("chain completion ≥ 70% 유지");
  prerequisites.push("compliance ≥ 85% 유지");
  prerequisites.push("rollback trigger 0건 유지");
  prerequisites.push("irreversible failure 0건 유지");

  const ownerSuggestion = nonCompliance.length > 0 || blockerPattern.repeatedPatterns.length > 0
    ? "운영 오너 + compliance reviewer 합동 점검 권장"
    : null;

  return {
    immediateActions: immediate,
    beforeDay7Actions: beforeDay7,
    evidenceCollectionActions: evidence,
    safeToExpandPrerequisites: prerequisites,
    ownerSuggestion,
  };
}

// ══════════════════════════════════════════════════════
// 6. Midpoint Verdict
// ══════════════════════════════════════════════════════

export type MidpointVerdict =
  | "stable"
  | "stable_but_insufficient_time"
  | "attention_required"
  | "risk_increasing";

export function assessMidpointVerdict(
  metrics: PilotMetrics,
  nonCompliance: NonComplianceCaseReview[],
  blockerPattern: SoftBlockerPatternSummary,
  dwellRisk: DwellRiskSummary,
): MidpointVerdict {
  // Risk increasing: rollback trigger or critical dwell or high repeat-risk non-compliance
  if (metrics.rollbackTriggerHitCount > 0) return "risk_increasing";
  if (dwellRisk.aggregate.critical > 0) return "risk_increasing";
  if (nonCompliance.some(nc => nc.repeatRisk === "high") && blockerPattern.repeatedPatterns.length > 0) {
    return "risk_increasing";
  }

  // Attention required: at_risk dwell, repeated patterns, or degrading signals
  if (dwellRisk.aggregate.atRisk > 0) return "attention_required";
  if (blockerPattern.repeatedPatterns.length >= 2) return "attention_required";
  if (metrics.runtimeSignalAvg < 70) return "attention_required";
  if (metrics.complianceRate < 0.8) return "attention_required";

  // Stable but insufficient time
  if (metrics.daysElapsed < Math.ceil(metrics.daysPlanned * 0.5)) {
    return "stable_but_insufficient_time";
  }

  return "stable";
}

// ══════════════════════════════════════════════════════
// 7. Handoff Token
// ══════════════════════════════════════════════════════

export interface MidpointHandoffToken {
  pilotId: string;
  scopeId: string;
  reviewTimestamp: string;
  daysElapsed: number;
  projectedVerdict: PilotCompletionVerdict;
  projectedPath: GraduationPath;
  nonComplianceCaseIds: string[];
  softBlockerCaseIds: string[];
  dwellRiskCaseIds: string[];
  originMode: "midpoint_review";
}

export function buildHandoffToken(
  scope: RC0ScopeFreeze,
  metrics: PilotMetrics,
  projection: GraduationProjection,
  nonCompliance: NonComplianceCaseReview[],
  blockerPattern: SoftBlockerPatternSummary,
  dwellRisk: DwellRiskSummary,
): MidpointHandoffToken {
  // Collect soft blocker case IDs (unique)
  const softBlockerCaseIds = Object.keys(blockerPattern.byCaseId);

  return {
    pilotId: scope.rc0Id,
    scopeId: scope.rc0Id,
    reviewTimestamp: new Date().toISOString(),
    daysElapsed: metrics.daysElapsed,
    projectedVerdict: projection.projectedVerdict,
    projectedPath: projection.projectedPath,
    nonComplianceCaseIds: nonCompliance.map(nc => nc.caseId),
    softBlockerCaseIds,
    dwellRiskCaseIds: dwellRisk.cases
      .filter(c => c.riskLevel !== "normal")
      .map(c => c.caseId),
    originMode: "midpoint_review",
  };
}

// ══════════════════════════════════════════════════════
// 8. Export Pack
// ══════════════════════════════════════════════════════

export interface RC0MidpointReviewExport {
  /** Snapshot of current metrics */
  currentMetrics: PilotMetrics;
  nonComplianceCaseReviews: NonComplianceCaseReview[];
  softBlockerPatternSummary: SoftBlockerPatternSummary;
  dwellRiskSummary: DwellRiskSummary;
  graduationProjection: GraduationProjection;
  actionPlan: MidpointActionPlan;
  evidenceLinks: string[];
  generatedAt: string;
  grammarVersion: string;
  pilotScopeId: string;
}

export function buildExportPack(
  metrics: PilotMetrics,
  nonCompliance: NonComplianceCaseReview[],
  blockerPattern: SoftBlockerPatternSummary,
  dwellRisk: DwellRiskSummary,
  projection: GraduationProjection,
  actionPlan: MidpointActionPlan,
  scope: RC0ScopeFreeze,
): RC0MidpointReviewExport {
  const evidenceLinks: string[] = [];
  evidenceLinks.push(`dashboard://pilot/${scope.rc0Id}`);
  evidenceLinks.push(`audit://pilot/${scope.rc0Id}/compliance`);
  evidenceLinks.push(`graduation://pilot/${scope.rc0Id}/evaluation`);
  for (const nc of nonCompliance) {
    evidenceLinks.push(`audit://case/${nc.caseId}/decision-trace`);
  }

  return {
    currentMetrics: { ...metrics },
    nonComplianceCaseReviews: nonCompliance,
    softBlockerPatternSummary: blockerPattern,
    dwellRiskSummary: dwellRisk,
    graduationProjection: projection,
    actionPlan,
    evidenceLinks,
    generatedAt: new Date().toISOString(),
    grammarVersion: "batch-21",
    pilotScopeId: scope.rc0Id,
  };
}

// ══════════════════════════════════════════════════════
// 9. Midpoint Review Surface Builder
// ══════════════════════════════════════════════════════

export interface MidpointReviewSurface {
  center: {
    midpointVerdict: MidpointVerdict;
    currentVerdict: PilotCompletionVerdict;
    currentVerdictLabel: string;
    currentPath: GraduationPath;
    currentPathLabel: string;
    projectedVerdict: PilotCompletionVerdict;
    projectedVerdictLabel: string;
    projectedPath: GraduationPath;
    projectedPathLabel: string;
    projectedConfidence: string;
    expansionPlausible: boolean;
    nonComplianceSummary: {
      count: number;
      highRepeatRisk: number;
      topRootCause: RootCauseCategory | null;
    };
    blockerPatternSummary: {
      total: number;
      repeatedPatterns: number;
      actorConcentrations: number;
      concentrationScore: number;
    };
    dwellRiskSummary: {
      total: number;
      normal: number;
      watch: number;
      atRisk: number;
      critical: number;
    };
    actionPlan: MidpointActionPlan;
  };
  rail: {
    evidenceLinks: string[];
    complianceSummary: {
      compliant: number;
      conditionallyCompliant: number;
      nonCompliant: number;
      rate: string;
    };
    blockerTypeDistribution: Record<string, number>;
    actorConcentrationSummary: Array<{ actor: string; share: string }>;
    projectionAssumptions: string[];
    daysElapsed: number;
    daysPlanned: number;
    requiredWindow: number;
    timeResolvedBlockers: string[];
    persistentBlockers: string[];
  };
  dock: {
    actions: MidpointDockAction[];
  };
}

export interface MidpointDockAction {
  actionKey: string;
  label: string;
  enabled: boolean;
  requiresConfirmation: boolean;
  /** All midpoint actions are reversible/navigation — no irreversible */
  risk: "reversible" | "navigation";
}

export function buildMidpointReviewSurface(
  verdict: MidpointVerdict,
  metrics: PilotMetrics,
  nonCompliance: NonComplianceCaseReview[],
  blockerPattern: SoftBlockerPatternSummary,
  dwellRisk: DwellRiskSummary,
  projection: GraduationProjection,
  actionPlan: MidpointActionPlan,
  exportPack: RC0MidpointReviewExport,
): MidpointReviewSurface {
  const highRepeatRisk = nonCompliance.filter(nc => nc.repeatRisk === "high").length;
  const topRootCause = nonCompliance.length > 0
    ? nonCompliance[0].rootCauseCategory
    : null;

  const minWindow = Math.ceil(metrics.daysPlanned * 0.5);

  return {
    center: {
      midpointVerdict: verdict,
      currentVerdict: projection.currentVerdict,
      currentVerdictLabel: getVerdictLabel(projection.currentVerdict),
      currentPath: projection.currentPath,
      currentPathLabel: getGraduationPathLabel(projection.currentPath),
      projectedVerdict: projection.projectedVerdict,
      projectedVerdictLabel: getVerdictLabel(projection.projectedVerdict),
      projectedPath: projection.projectedPath,
      projectedPathLabel: getGraduationPathLabel(projection.projectedPath),
      projectedConfidence: projection.projectedConfidence,
      expansionPlausible: projection.expansionPlausible,
      nonComplianceSummary: {
        count: nonCompliance.length,
        highRepeatRisk,
        topRootCause,
      },
      blockerPatternSummary: {
        total: blockerPattern.totalCount,
        repeatedPatterns: blockerPattern.repeatedPatterns.length,
        actorConcentrations: blockerPattern.actorConcentration.length,
        concentrationScore: blockerPattern.concentrationScore,
      },
      dwellRiskSummary: {
        total: dwellRisk.totalInProgress,
        ...dwellRisk.aggregate,
      },
      actionPlan,
    },
    rail: {
      evidenceLinks: exportPack.evidenceLinks,
      complianceSummary: {
        compliant: metrics.complianceVerdictDistribution.compliant,
        conditionallyCompliant: metrics.complianceVerdictDistribution.conditionally_compliant,
        nonCompliant: metrics.complianceVerdictDistribution.non_compliant,
        rate: `${(metrics.complianceRate * 100).toFixed(1)}%`,
      },
      blockerTypeDistribution: blockerPattern.byBlockerType,
      actorConcentrationSummary: blockerPattern.actorConcentration.map(a => ({
        actor: a.actor,
        share: `${(a.share * 100).toFixed(0)}%`,
      })),
      projectionAssumptions: projection.assumptions,
      daysElapsed: metrics.daysElapsed,
      daysPlanned: metrics.daysPlanned,
      requiredWindow: minWindow,
      timeResolvedBlockers: projection.timeResolvedBlockers,
      persistentBlockers: projection.persistentBlockers,
    },
    dock: {
      actions: [
        {
          actionKey: "open_dashboard",
          label: "대시보드 열기",
          enabled: true,
          requiresConfirmation: false,
          risk: "navigation",
        },
        {
          actionKey: "open_audit_review",
          label: "감사 리뷰 열기",
          enabled: true,
          requiresConfirmation: false,
          risk: "navigation",
        },
        {
          actionKey: "open_graduation_review",
          label: "졸업 심사 열기",
          enabled: true,
          requiresConfirmation: false,
          risk: "navigation",
        },
        {
          actionKey: "export_midpoint_pack",
          label: "중간 리뷰 팩 내보내기",
          enabled: true,
          requiresConfirmation: false,
          risk: "navigation",
        },
        {
          actionKey: "create_remediation_checklist",
          label: "개선 체크리스트 생성",
          enabled: nonCompliance.length > 0 || blockerPattern.repeatedPatterns.length > 0 || dwellRisk.aggregate.atRisk > 0 || dwellRisk.aggregate.critical > 0,
          requiresConfirmation: true,
          risk: "reversible",
        },
        {
          actionKey: "hold_scope",
          label: "범위 유지 확정",
          enabled: true,
          requiresConfirmation: true,
          risk: "reversible",
        },
      ],
    },
  };
}
