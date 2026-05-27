/**
 * @module drift-dashboard-cards
 * @description 운영 루프 드리프트 대시보드 카드 — closure-dashboard와 통합하여
 * 갱신 무결성, 개정 누적 위험, 의무 압력, 리뷰 의례화, 일몰 백로그,
 * 목적 드리프트, 운영 루프 헌법적 건전성을 시각화한다.
 */

import type {
  OperatingLoopScorecard,
  RenewalIntegrityResult,
  AmendmentAccumulationResult,
  ObligationContinuityResult,
  PurposeLockTestResult,
  ReviewSubstanceResult,
  SunsetDisciplineResult,
  ErosionScenarioResult,
} from "./operating-loop-drift-resistance";

// ─────────────────────────────────────────────
// 대시보드 카드 유형
// ─────────────────────────────────────────────

/** 드리프트 카드 심각도 */
export type DriftCardSeverity = "OK" | "WARNING" | "CRITICAL" | "EMERGENCY";

/** 드리프트 대시보드 카드 */
export interface DriftDashboardCard {
  /** 카드 ID */
  cardId: string;
  /** 카드 제목 */
  title: string;
  /** 카드 설명 */
  description: string;
  /** 심각도 */
  severity: DriftCardSeverity;
  /** 현재 값 */
  currentValue: string;
  /** 임계값 */
  threshold: string;
  /** 추세 방향 */
  trend: "IMPROVING" | "STABLE" | "DEGRADING";
  /** 권고 조치 */
  recommendedAction: string;
  /** 관련 루프 유형 */
  relatedLoops: string[];
  /** 생성 시각 */
  generatedAt: Date;
}

// ─────────────────────────────────────────────
// 대시보드 카드 생성
// ─────────────────────────────────────────────

/**
 * 드리프트 대시보드 카드를 생성한다.
 * 7가지 관점에서 운영 루프 드리프트 상태를 시각화한다.
 */
export function getDriftDashboardCards(params: {
  scorecard: OperatingLoopScorecard;
  renewalResult: RenewalIntegrityResult;
  amendmentResult: AmendmentAccumulationResult;
  obligationResult: ObligationContinuityResult;
  purposeLockResult: PurposeLockTestResult;
  reviewResult: ReviewSubstanceResult;
  sunsetResult: SunsetDisciplineResult;
  erosionResults: ErosionScenarioResult[];
}): DriftDashboardCard[] {
  const {
    scorecard, renewalResult, amendmentResult,
    obligationResult, purposeLockResult, reviewResult,
    sunsetResult, erosionResults,
  } = params;

  const now = new Date();
  const cards: DriftDashboardCard[] = [];

  // 1. 갱신 무결성 추세
  cards.push({
    cardId: `DDC-RENEWAL-${Date.now()}`,
    title: "갱신 무결성 추세",
    description: "신선 증거 기반 갱신 비율 및 carry-forward 추세",
    severity: renewalResult.verdict === "VALID_RENEWAL" ? "OK"
      : renewalResult.verdict === "VALID_RENEWAL_WITH_TIGHTENING" ? "WARNING"
      : "CRITICAL",
    currentValue: renewalResult.verdict,
    threshold: "VALID_RENEWAL",
    trend: renewalResult.verdict === "VALID_RENEWAL" ? "STABLE" : "DEGRADING",
    recommendedAction: renewalResult.recommendedActions[0] ?? "현 상태 유지",
    relatedLoops: ["MONTHLY_RENEWAL_REVIEW", "SEMIANNUAL_TRUST_RENEWAL"],
    generatedAt: now,
  });

  // 2. 개정 누적 위험
  cards.push({
    cardId: `DDC-AMENDMENT-${Date.now()}`,
    title: "개정 누적 위험",
    description: "개정 누적 의미론적 변화량 및 범위 확장 비율",
    severity: amendmentResult.verdict === "CUMULATIVE_IMPACT_ACCEPTABLE" ? "OK"
      : amendmentResult.verdict === "IMPACT_REVIEW_REQUIRED" ? "WARNING"
      : amendmentResult.verdict === "SEMANTIC_SCOPE_CREEP_DETECTED" ? "CRITICAL"
      : "EMERGENCY",
    currentValue: `delta=${amendmentResult.cumulativeSemanticDelta.toFixed(3)}, scope=${(amendmentResult.scopeExpansionRatio * 100).toFixed(1)}%`,
    threshold: "delta < 0.5, scope < 30%",
    trend: amendmentResult.verdict === "CUMULATIVE_IMPACT_ACCEPTABLE" ? "STABLE" : "DEGRADING",
    recommendedAction: amendmentResult.recommendedActions[0] ?? "현 상태 유지",
    relatedLoops: ["AMENDMENT_REVIEW_CYCLE", "QUARTERLY_CONSTITUTIONAL_REVIEW"],
    generatedAt: now,
  });

  // 3. Stale 의무 압력
  cards.push({
    cardId: `DDC-OBLIGATION-${Date.now()}`,
    title: "Stale 의무 압력",
    description: "미이행 의무 건수 및 최대 경과 일수",
    severity: obligationResult.verdict === "OBLIGATION_HEALTHY" ? "OK"
      : obligationResult.verdict === "OBLIGATION_DELAYED" ? "WARNING"
      : obligationResult.verdict === "OBLIGATION_BACKLOG_RISK" ? "CRITICAL"
      : "EMERGENCY",
    currentValue: `지연=${obligationResult.delayedCount}건, 최대=${obligationResult.maxUnresolvedAgeDays}일`,
    threshold: "지연=0건",
    trend: obligationResult.verdict === "OBLIGATION_HEALTHY" ? "STABLE" : "DEGRADING",
    recommendedAction: obligationResult.recommendedActions[0] ?? "현 상태 유지",
    relatedLoops: ["OBLIGATION_CONTINUITY_REVIEW"],
    generatedAt: now,
  });

  // 4. 리뷰 의례화 위험
  cards.push({
    cardId: `DDC-REVIEW-${Date.now()}`,
    title: "리뷰 의례화 위험",
    description: "리뷰 소요 시간 추세 및 이의 제기율",
    severity: reviewResult.verdict === "REVIEW_SUBSTANTIVE" ? "OK"
      : reviewResult.verdict === "REVIEW_RITUALIZING" ? "WARNING"
      : reviewResult.verdict === "GOVERNANCE_FORMALITY_RISK" ? "CRITICAL"
      : "EMERGENCY",
    currentValue: `평균=${reviewResult.averageReviewDurationMinutes.toFixed(0)}분, 이의율=${(reviewResult.challengeRate * 100).toFixed(1)}%`,
    threshold: "평균 > 20분, 이의율 > 10%",
    trend: reviewResult.durationDeclineTrend >= 0.2 ? "DEGRADING" : "STABLE",
    recommendedAction: reviewResult.recommendedActions[0] ?? "현 상태 유지",
    relatedLoops: ["QUARTERLY_CONSTITUTIONAL_REVIEW", "TERMINAL_AUDIT_CYCLE"],
    generatedAt: now,
  });

  // 5. 일몰 백로그 히트맵
  cards.push({
    cardId: `DDC-SUNSET-${Date.now()}`,
    title: "일몰 백로그 히트맵",
    description: "일몰 백로그 크기 및 증가율",
    severity: sunsetResult.verdict === "SUNSET_DISCIPLINED" ? "OK"
      : sunsetResult.verdict === "SUNSET_DELAYED" ? "WARNING"
      : sunsetResult.verdict === "LEGACY_COMPLEXITY_ACCUMULATING" ? "CRITICAL"
      : "EMERGENCY",
    currentValue: `백로그=${sunsetResult.backlogSize}건, 증가율=${(sunsetResult.backlogGrowthRate * 100).toFixed(1)}%`,
    threshold: "백로그=0건, 증가율 < 10%",
    trend: sunsetResult.backlogGrowthRate > 0.1 ? "DEGRADING" : "STABLE",
    recommendedAction: sunsetResult.recommendedActions[0] ?? "현 상태 유지",
    relatedLoops: ["SUNSET_REFACTOR_REVIEW"],
    generatedAt: now,
  });

  // 6. 목적 드리프트 조기 신호
  const maxDivergence = purposeLockResult.scenarioResults.reduce(
    (max, s) => Math.max(max, s.divergenceScore), 0
  );
  const purposeMissedCount = purposeLockResult.scenarioResults.filter((s) => !s.blocked).length;
  cards.push({
    cardId: `DDC-PURPOSE-${Date.now()}`,
    title: "목적 드리프트 조기 신호",
    description: "목적 잠금 스트레스 테스트 결과 및 발산 점수",
    severity: purposeLockResult.verdict === "PURPOSE_LOCK_HELD" ? "OK"
      : purposeLockResult.verdict === "PURPOSE_DRIFT_BLOCKED" ? "WARNING"
      : purposeLockResult.verdict === "PURPOSE_DRIFT_MISSED" ? "CRITICAL"
      : "EMERGENCY",
    currentValue: `최대발산=${maxDivergence.toFixed(2)}, 미차단=${purposeMissedCount}건`,
    threshold: "발산 < 0.2, 미차단=0건",
    trend: maxDivergence >= 0.4 ? "DEGRADING" : "STABLE",
    recommendedAction: purposeLockResult.recommendedActions[0] ?? "현 상태 유지",
    relatedLoops: ["REFOUNDATION_WATCH_CYCLE"],
    generatedAt: now,
  });

  // 7. 운영 루프 헌법적 건전성
  const severeErosions = erosionResults.filter((r) => r.hardeningRequired).length;
  cards.push({
    cardId: `DDC-LOOP-HEALTH-${Date.now()}`,
    title: "운영 루프 헌법적 건전성",
    description: "전체 스코어카드 가중 평균 및 판정",
    severity: scorecard.verdict === "LOOP_CONSTITUTIONALLY_SOUND" ? "OK"
      : scorecard.verdict === "SOUND_WITH_DRIFT_WARNINGS" ? "WARNING"
      : scorecard.verdict === "DRIFT_ACCUMULATING" ? "CRITICAL"
      : "EMERGENCY",
    currentValue: `점수=${scorecard.weightedAverage.toFixed(1)}, 판정=${scorecard.verdict}`,
    threshold: "점수 >= 90, 판정=LOOP_CONSTITUTIONALLY_SOUND",
    trend: severeErosions > 2 ? "DEGRADING" : severeErosions > 0 ? "STABLE" : "IMPROVING",
    recommendedAction: scorecard.hardeningBacklog[0] ?? "현 상태 유지",
    relatedLoops: Array.from(scorecard.dimensions.map((d) => d.dimension)),
    generatedAt: now,
  });

  return cards;
}
