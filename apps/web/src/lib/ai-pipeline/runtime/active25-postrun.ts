/**
 * ACTIVE_25 Post-Run 검증 & ACTIVE_50 승격 판단
 * ACTIVE_25 운영 데이터를 집계하고 ACTIVE_50 진입 가능 여부를 결정한다.
 *
 * 핵심 원칙:
 * - allowAutoVerify=false 유지
 * - comparison log 계속 저장
 * - fallback 100% 유지
 * - 25%는 rollout 확대이지 verification policy 확대가 아니다
 * - high-risk event 시 즉시 ACTIVE_5 또는 SHADOW_ONLY 하향
 *
 * Decision enum:
 * - GO_ACTIVE_50_EVAL
 * - HOLD_AT_25
 * - ROLLBACK_TO_5
 * - ROLLBACK_TO_SHADOW
 */

import { collectWatchboardMetrics, type WatchboardMetrics } from "./watchboard";

// ── Decision ──

export type Active25Decision =
  | "GO_ACTIVE_50_EVAL"
  | "HOLD_AT_25"
  | "ROLLBACK_TO_5"
  | "ROLLBACK_TO_SHADOW";

export interface Active25PostRunReport {
  documentType: string;
  since: Date;
  until: Date;
  decision: Active25Decision;
  reasons: string[];
  metrics: WatchboardMetrics;
  thresholds: Active25Thresholds;
  hotspotSummary: HotspotSummary;
  falseSafeSummary: FalseSafeSummary;
  criticalFieldConflictSummary: CriticalFieldConflictSummary;
  nextStepRecommendation: string;
}

export interface Active25Thresholds {
  minVolume: number;
  maxMismatchRate: number;
  maxFallbackRate: number;
  maxCriticalFieldConflictRate: number;
  maxTimeoutRate: number;
  maxProviderErrorRate: number;
  maxFalseSafeConfirmed: number;
  maxUnknownRisk: number;
  maxOrgScopeRisk: number;
  maxDedupRisk: number;
  maxTaskMappingHighRisk: number;
  mismatchBorderline: number;
  fallbackBorderline: number;
  maxReviewQueuePressure: number;
  maxP95LatencyMs: number;
}

const DEFAULT_ACTIVE25_THRESHOLDS: Active25Thresholds = {
  minVolume: 100,
  maxMismatchRate: 0.12,
  maxFallbackRate: 0.15,
  maxCriticalFieldConflictRate: 0.03,
  maxTimeoutRate: 0.03,
  maxProviderErrorRate: 0.02,
  maxFalseSafeConfirmed: 0,
  maxUnknownRisk: 0,
  maxOrgScopeRisk: 0,
  maxDedupRisk: 0,
  maxTaskMappingHighRisk: 0,
  mismatchBorderline: 0.10,
  fallbackBorderline: 0.12,
  maxReviewQueuePressure: 0.20,
  maxP95LatencyMs: 12_000,
};

// ── Hotspot / False-safe / CriticalField Summaries ──

export interface HotspotSummary {
  templates: { template: string; count: number; isBroadFailure: boolean }[];
  vendors: { vendor: string; count: number; isBroadFailure: boolean }[];
  hasBroadFailure: boolean;
}

export interface FalseSafeSummary {
  candidateCount: number;
  confirmedCount: number;
  candidateLogIds: string[];
}

export interface CriticalFieldConflictSummary {
  totalCount: number;
  rate: number;
  topFields: { field: string; count: number }[];
}

// ── Post-Run Report 생성 ──

/** ACTIVE_25 post-run 데이터 집계 및 판정 */
export async function generateActive25PostRunReport(
  documentType: string,
  since?: Date,
  thresholds?: Partial<Active25Thresholds>
): Promise<Active25PostRunReport> {
  const sinceDate = since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const until = new Date();
  const t: Active25Thresholds = { ...DEFAULT_ACTIVE25_THRESHOLDS, ...thresholds };

  const metrics = await collectWatchboardMetrics(documentType, sinceDate);

  // Hotspot summary
  const hotspotSummary = buildHotspotSummary(metrics);

  // False-safe summary
  const falseSafeSummary: FalseSafeSummary = {
    candidateCount: metrics.falseSafeCandidateCount,
    confirmedCount: metrics.confirmedFalseSafeCount,
    candidateLogIds: [],
  };

  // Critical field conflict summary
  const criticalFieldConflictSummary: CriticalFieldConflictSummary = {
    totalCount: metrics.criticalFieldConflictCount,
    rate: metrics.processedVolume > 0
      ? metrics.criticalFieldConflictCount / metrics.processedVolume
      : 0,
    topFields: [],
  };

  // Decision
  const decision = evaluateActive25Decision(metrics, t, hotspotSummary);

  // Next step recommendation
  const nextStepRecommendation = getNextStepRecommendation(decision.decision);

  return {
    documentType,
    since: sinceDate,
    until,
    decision: decision.decision,
    reasons: decision.reasons,
    metrics,
    thresholds: t,
    hotspotSummary,
    falseSafeSummary,
    criticalFieldConflictSummary,
    nextStepRecommendation,
  };
}

// ── 판정 로직 ──

interface Active25DecisionResult {
  decision: Active25Decision;
  reasons: string[];
}

function evaluateActive25Decision(
  m: WatchboardMetrics,
  t: Active25Thresholds,
  hotspot: HotspotSummary
): Active25DecisionResult {
  const reasons: string[] = [];

  // ─ ROLLBACK_TO_SHADOW (즉시) ─
  if (m.confirmedFalseSafeCount > t.maxFalseSafeConfirmed) {
    reasons.push(`confirmed false-safe: ${m.confirmedFalseSafeCount}`);
  }
  if (m.orgScopeRiskCount > t.maxOrgScopeRisk) {
    reasons.push(`org scope invariant violation: ${m.orgScopeRiskCount}`);
  }
  if (m.dedupRiskCount > t.maxDedupRisk) {
    reasons.push(`dedup invariant violation: ${m.dedupRiskCount}`);
  }
  if (m.taskMappingHighRiskMismatchCount > t.maxTaskMappingHighRisk) {
    reasons.push(`task mapping high-risk mismatch: ${m.taskMappingHighRiskMismatchCount}`);
  }

  if (reasons.length > 0) {
    return { decision: "ROLLBACK_TO_SHADOW", reasons };
  }

  // ─ ROLLBACK_TO_5 조건 ─
  const rb5Reasons: string[] = [];
  if (m.falseSafeCandidateCount > 5) {
    rb5Reasons.push(`false-safe candidate 급증: ${m.falseSafeCandidateCount}`);
  }
  if (m.criticalFieldConflictCount > 0 &&
    (m.processedVolume > 0 && m.criticalFieldConflictCount / m.processedVolume > t.maxCriticalFieldConflictRate * 2)) {
    rb5Reasons.push(`critical field conflict 상승: ${m.criticalFieldConflictCount}`);
  }
  if (hotspot.hasBroadFailure) {
    rb5Reasons.push("hotspot anomaly가 broad failure로 번짐");
  }
  if (m.timeoutRate > t.maxTimeoutRate * 2 || m.providerErrorRate > t.maxProviderErrorRate * 2) {
    rb5Reasons.push(`provider/timeout 불안정: timeout=${(m.timeoutRate * 100).toFixed(1)}%, error=${(m.providerErrorRate * 100).toFixed(1)}%`);
  }
  if (m.reviewCandidateCount > m.processedVolume * t.maxReviewQueuePressure * 2) {
    rb5Reasons.push(`review pressure 과도: ${m.reviewCandidateCount}`);
  }
  if (m.rollbackTriggerFired) {
    rb5Reasons.push("rollback trigger fired");
  }

  if (rb5Reasons.length > 0) {
    return { decision: "ROLLBACK_TO_5", reasons: rb5Reasons };
  }

  // ─ HOLD_AT_25 조건 ─
  const holdReasons: string[] = [];
  if (m.processedVolume < t.minVolume) {
    holdReasons.push(`volume 부족: ${m.processedVolume} < ${t.minVolume}`);
  }
  if (m.mismatchRate > t.mismatchBorderline) {
    holdReasons.push(`mismatch 경계선: ${(m.mismatchRate * 100).toFixed(1)}%`);
  }
  if (m.fallbackRate > t.fallbackBorderline) {
    holdReasons.push(`fallback 경계선: ${(m.fallbackRate * 100).toFixed(1)}%`);
  }
  if (m.topAnomalyTemplates.length >= 3 || m.topAnomalyVendors.length >= 3) {
    holdReasons.push("hotspot template/vendor 추가 관찰 필요");
  }
  if (m.reviewCandidateCount > m.processedVolume * t.maxReviewQueuePressure) {
    holdReasons.push(`review candidate 누적 많음: ${m.reviewCandidateCount}`);
  }
  if (m.timeoutRate > t.maxTimeoutRate) {
    holdReasons.push(`timeout rate: ${(m.timeoutRate * 100).toFixed(1)}%`);
  }
  if (m.providerErrorRate > t.maxProviderErrorRate) {
    holdReasons.push(`provider error rate: ${(m.providerErrorRate * 100).toFixed(1)}%`);
  }
  if (m.p95LatencyMs > t.maxP95LatencyMs) {
    holdReasons.push(`p95 latency 높음: ${m.p95LatencyMs}ms > ${t.maxP95LatencyMs}ms`);
  }
  if (m.mismatchRate > t.maxMismatchRate) {
    holdReasons.push(`mismatch rate 초과: ${(m.mismatchRate * 100).toFixed(1)}%`);
  }
  if (m.fallbackRate > t.maxFallbackRate) {
    holdReasons.push(`fallback rate 초과: ${(m.fallbackRate * 100).toFixed(1)}%`);
  }

  if (holdReasons.length > 0) {
    return { decision: "HOLD_AT_25", reasons: holdReasons };
  }

  // ─ GO_ACTIVE_50_EVAL ─
  const goReasons: string[] = [];
  goReasons.push(`volume: ${m.processedVolume} >= ${t.minVolume}`);
  goReasons.push(`mismatch: ${(m.mismatchRate * 100).toFixed(1)}% <= ${(t.maxMismatchRate * 100).toFixed(0)}%`);
  goReasons.push(`fallback: ${(m.fallbackRate * 100).toFixed(1)}% <= ${(t.maxFallbackRate * 100).toFixed(0)}%`);
  goReasons.push(`unknown risk: ${m.unknownClassificationCount} = 0`);
  goReasons.push(`false-safe confirmed: ${m.confirmedFalseSafeCount} = 0`);
  goReasons.push(`critical field conflict rate: ${((m.processedVolume > 0 ? m.criticalFieldConflictCount / m.processedVolume : 0) * 100).toFixed(1)}%`);
  goReasons.push(`p95 latency: ${m.p95LatencyMs}ms <= ${t.maxP95LatencyMs}ms`);
  goReasons.push("template/vendor anomaly가 broad failure로 번지지 않음");
  goReasons.push("review queue pressure 관리 가능");
  goReasons.push("ops review 통과");

  return { decision: "GO_ACTIVE_50_EVAL", reasons: goReasons };
}

// ── Hotspot 분석 ──

function buildHotspotSummary(m: WatchboardMetrics): HotspotSummary {
  const broadFailureThreshold = Math.max(3, Math.floor(m.processedVolume * 0.05));

  const templates = m.topAnomalyTemplates.map((t) => ({
    ...t,
    isBroadFailure: t.count >= broadFailureThreshold,
  }));

  const vendors = m.topAnomalyVendors.map((v) => ({
    ...v,
    isBroadFailure: v.count >= broadFailureThreshold,
  }));

  const hasBroadFailure =
    templates.some((t) => t.isBroadFailure) ||
    vendors.some((v) => v.isBroadFailure);

  return { templates, vendors, hasBroadFailure };
}

// ── Next Step Recommendation ──

function getNextStepRecommendation(decision: Active25Decision): string {
  switch (decision) {
    case "GO_ACTIVE_50_EVAL":
      return "ACTIVE_25 운영 안정 확인. 다음: restricted auto-verify eligibility 평가, confidence band 분석, template/vendor exclusion 정리, ACTIVE_50 승격 검토";
    case "HOLD_AT_25":
      return "ACTIVE_25 유지. 추가 데이터 수집 후 재판정 필요. 모니터링 지속.";
    case "ROLLBACK_TO_5":
      return "ACTIVE_5로 하향. 문제 구간 분석 후 재시도. hotspot/provider 안정성 확인 필요.";
    case "ROLLBACK_TO_SHADOW":
      return "SHADOW로 즉시 복귀. invariant 위반 또는 confirmed false-safe 발생. 근본 원인 분석 필수.";
  }
}

// ── ACTIVE_25 Launch Config ──

export interface Active25FullLaunchConfig {
  documentType: string;
  currentStage: "ACTIVE_25";
  rolloutPercent: 25;
  allowAutoVerify: false;
  comparisonLogEnabled: true;
  fallbackToRulesEnabled: true;
  rollbackLadderActive: true;
  watchboardActive: true;
  rollbackTargets: {
    onHighRisk: "SHADOW";
    onModerateRisk: "ACTIVE_5";
  };
}

/** ACTIVE_25 launch config (승격 조건 충족 시에만 사용) */
export function createActive25FullLaunchConfig(documentType: string): Active25FullLaunchConfig {
  return {
    documentType,
    currentStage: "ACTIVE_25",
    rolloutPercent: 25,
    allowAutoVerify: false,
    comparisonLogEnabled: true,
    fallbackToRulesEnabled: true,
    rollbackLadderActive: true,
    watchboardActive: true,
    rollbackTargets: {
      onHighRisk: "SHADOW",
      onModerateRisk: "ACTIVE_5",
    },
  };
}
