// @ts-nocheck — shadow pipeline: experimental code, type-check deferred
/**
 * Cost-Quality Analyzer - 문서 유형/신뢰도 구간별 비용-품질 분석기
 *
 * DB에서 처리 이력을 조회하여 각 문서 유형 및 신뢰도 구간별
 * 비용 효율성, 지연 시간, false-safe 비율 등을 분석합니다.
 */

import { db } from "@/lib/db";

// --- 타입 정의 ---

/** 비용-품질 분석 세그먼트 */
export interface CostQualitySegment {
  /** 문서 유형 */
  documentType: string;
  /** 신뢰도 구간 (예: "HIGH", "MEDIUM", "LOW") */
  confidenceBand: string;
  /** 평균 토큰 비용 (USD) */
  avgTokenCost: number;
  /** 평균 지연 시간 (밀리초) */
  avgLatencyMs: number;
  /** False-safe 비율 (0~1) */
  falseSafeRate: number;
  /** 리뷰 회피 건수 (자동 처리된 건수) */
  reviewAvoidedCount: number;
  /** 총 처리 건수 */
  totalProcessed: number;
  /** 비용 효율 비율 (리뷰 회피 건수 / 총 토큰 비용) */
  costEfficiencyRatio: number;
}

/**
 * 특정 문서 유형에 대한 비용-품질 분석을 수행합니다.
 * 각 신뢰도 구간별로 토큰 비용, 지연 시간, false-safe 비율 등을 계산합니다.
 *
 * @param documentType 분석할 문서 유형
 * @returns 신뢰도 구간별 비용-품질 세그먼트 배열
 */
export async function analyzeCostQuality(
  documentType: string
): Promise<CostQualitySegment[]> {
  // DB에서 문서 유형별, 신뢰도 구간별 집계 데이터 조회
  const rawResults = await db.$queryRawUnsafe<
    Array<{
      confidence_band: string;
      avg_token_cost: number;
      avg_latency_ms: number;
      false_safe_count: number;
      review_avoided_count: number;
      total_processed: number;
    }>
  >(
    `
    SELECT
      confidence_band,
      AVG(token_cost) as avg_token_cost,
      AVG(latency_ms) as avg_latency_ms,
      SUM(CASE WHEN is_false_safe = true THEN 1 ELSE 0 END) as false_safe_count,
      SUM(CASE WHEN review_skipped = true THEN 1 ELSE 0 END) as review_avoided_count,
      COUNT(*) as total_processed
    FROM "ProcessingLog"
    WHERE document_type = $1
    GROUP BY confidence_band
    ORDER BY confidence_band
    `,
    documentType
  );

  // 결과를 CostQualitySegment 형태로 변환
  return rawResults.map((row) => {
    const totalCost = row.avg_token_cost * row.total_processed;
    const falseSafeRate =
      row.total_processed > 0
        ? row.false_safe_count / row.total_processed
        : 0;
    const costEfficiencyRatio =
      totalCost > 0 ? row.review_avoided_count / totalCost : 0;

    return {
      documentType,
      confidenceBand: row.confidence_band,
      avgTokenCost: row.avg_token_cost,
      avgLatencyMs: row.avg_latency_ms,
      falseSafeRate,
      reviewAvoidedCount: row.review_avoided_count,
      totalProcessed: row.total_processed,
      costEfficiencyRatio,
    };
  });
}

/**
 * 비효율적인 세그먼트를 식별합니다.
 * 비용이 높지만 리뷰 회피 효과가 낮은 세그먼트를 반환합니다.
 *
 * 판별 기준:
 * - 비용 효율 비율이 전체 평균의 50% 미만
 * - 또는 평균 토큰 비용이 전체 평균의 2배 초과이면서 리뷰 회피율이 50% 미만
 *
 * @param segments 분석된 세그먼트 배열
 * @returns 비효율적 세그먼트 배열
 */
export function identifyInefficientSegments(
  segments: CostQualitySegment[]
): CostQualitySegment[] {
  if (segments.length === 0) return [];

  // 전체 평균 계산
  const avgEfficiency =
    segments.reduce((sum, s) => sum + s.costEfficiencyRatio, 0) /
    segments.length;
  const avgCost =
    segments.reduce((sum, s) => sum + s.avgTokenCost, 0) / segments.length;

  return segments.filter((segment) => {
    const lowEfficiency = segment.costEfficiencyRatio < avgEfficiency * 0.5;
    const highCostLowBenefit =
      segment.avgTokenCost > avgCost * 2 &&
      segment.reviewAvoidedCount / Math.max(segment.totalProcessed, 1) < 0.5;

    return lowEfficiency || highCostLowBenefit;
  });
}

/**
 * 안전한 세그먼트를 식별합니다.
 * false-safe가 0이고 높은 신뢰도를 보이는 세그먼트를 반환합니다.
 *
 * 판별 기준:
 * - false-safe 비율이 정확히 0
 * - 신뢰도 구간이 "HIGH" 이상
 *
 * @param segments 분석된 세그먼트 배열
 * @returns 안전 세그먼트 배열
 */
export function identifySafeSegments(
  segments: CostQualitySegment[]
): CostQualitySegment[] {
  return segments.filter((segment) => {
    // false-safe가 한 건도 없어야 함
    const zeroFalseSafe = segment.falseSafeRate === 0;
    // 높은 신뢰도 구간만 대상
    const highConfidence = segment.confidenceBand === "HIGH";

    return zeroFalseSafe && highConfidence;
  });
}
