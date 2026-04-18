/**
 * Capacity Forecast Engine — 1/2/4주 용량 예측
 *
 * 현재 트렌드를 기반으로 병목, 리뷰 인력 수요, 고위험 캘린더를 예측합니다.
 */

export interface ForecastInput {
  currentDailyVolume: number;
  volumeGrowthRatePerWeek: number; // e.g. 0.05 = 5% growth
  currentReviewBacklog: number;
  reviewProcessingRatePerDay: number;
  currentIncidentRate: number; // incidents per week
  activeDocTypes: number;
  pendingPromotions: number;
  reviewersAvailable: number;
}

export interface ForecastResult {
  horizonWeeks: number;
  predictedDailyVolume: number;
  predictedReviewLoad: number;
  predictedIncidentRate: number;
  predictedBottleneck: string | null;
  staffingNeed: number; // additional reviewers needed
  reviewBacklogProjection: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  warnings: string[];
}

/**
 * 용량 예측 — 선형 추세 투사
 */
export function forecastCapacity(input: ForecastInput, horizonWeeks: number): ForecastResult {
  const predictedDailyVolume = input.currentDailyVolume * Math.pow(1 + input.volumeGrowthRatePerWeek, horizonWeeks);
  const reviewGenerationRate = predictedDailyVolume * 0.1; // ~10% of volume needs review
  const predictedReviewLoad = reviewGenerationRate * 7 * horizonWeeks;

  // Backlog projection
  const netBacklogPerDay = reviewGenerationRate - input.reviewProcessingRatePerDay;
  const reviewBacklogProjection = Math.max(0, input.currentReviewBacklog + netBacklogPerDay * 7 * horizonWeeks);

  // Incident rate projection (linear)
  const predictedIncidentRate = input.currentIncidentRate * (1 + input.pendingPromotions * 0.1);

  // Staffing need
  const staffingNeed = netBacklogPerDay > 0
    ? Math.ceil(netBacklogPerDay / (input.reviewProcessingRatePerDay / Math.max(input.reviewersAvailable, 1)))
    : 0;

  // Bottleneck detection
  let predictedBottleneck: string | null = null;
  if (reviewBacklogProjection > 100) predictedBottleneck = "REVIEW_BACKLOG_OVERFLOW";
  else if (staffingNeed > 2) predictedBottleneck = "REVIEWER_SHORTAGE";
  else if (predictedIncidentRate > 3) predictedBottleneck = "HIGH_INCIDENT_RISK";

  // Warnings
  const warnings: string[] = [];
  if (reviewBacklogProjection > 50) warnings.push(`리뷰 백로그 ${Math.round(reviewBacklogProjection)}건 예상 (${horizonWeeks}주 후)`);
  if (staffingNeed > 0) warnings.push(`리뷰어 ${staffingNeed}명 추가 필요`);
  if (predictedIncidentRate > 2) warnings.push(`인시던트 주당 ${predictedIncidentRate.toFixed(1)}건 예상`);
  if (input.pendingPromotions > 2) warnings.push(`대기 중 승격 ${input.pendingPromotions}건 — 동시 리스크 증가`);

  // Confidence
  const confidence = horizonWeeks <= 1 ? "HIGH" : horizonWeeks <= 2 ? "MEDIUM" : "LOW";

  return {
    horizonWeeks,
    predictedDailyVolume: Math.round(predictedDailyVolume),
    predictedReviewLoad: Math.round(predictedReviewLoad),
    predictedIncidentRate: Math.round(predictedIncidentRate * 10) / 10,
    predictedBottleneck,
    staffingNeed,
    reviewBacklogProjection: Math.round(reviewBacklogProjection),
    confidence,
    warnings,
  };
}

/**
 * 다중 기간 예측
 */
export function forecastMultiHorizon(input: ForecastInput): {
  week1: ForecastResult;
  week2: ForecastResult;
  week4: ForecastResult;
} {
  return {
    week1: forecastCapacity(input, 1),
    week2: forecastCapacity(input, 2),
    week4: forecastCapacity(input, 4),
  };
}
