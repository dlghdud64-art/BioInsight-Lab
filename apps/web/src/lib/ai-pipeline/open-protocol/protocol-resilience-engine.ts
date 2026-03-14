/**
 * @module protocol-resilience-engine
 * @description 프로토콜 회복력 엔진
 *
 * 보증 프로토콜의 전반적인 회복력을 측정하고 취약점을 식별한다.
 * 철회 지연, 버전 파편화, 노드 가용성, 전파 신뢰성을 추적하며,
 * 시계열 추세 분석을 제공한다.
 */

/** 회복력 지표 유형 */
export type ResilienceMetric =
  | "REVOCATION_LAG"
  | "VERSION_FRAGMENTATION"
  | "NODE_AVAILABILITY"
  | "PROPAGATION_RELIABILITY";

/** 개별 지표 측정값 */
export interface MetricMeasurement {
  /** 지표 유형 */
  metric: ResilienceMetric;
  /** 점수 (0~100) */
  score: number;
  /** 상세 설명 */
  details: string;
  /** 측정 시각 */
  measuredAt: number;
}

/** 취약점 */
export interface Vulnerability {
  /** 관련 지표 */
  metric: ResilienceMetric;
  /** 설명 */
  description: string;
  /** 심각도 (0~10) */
  severity: number;
}

/** 회복력 보고서 */
export interface ResilienceReport {
  /** 종합 점수 (0~100) */
  overallScore: number;
  /** 개별 지표 측정값 */
  metrics: MetricMeasurement[];
  /** 식별된 취약점 */
  vulnerabilities: Vulnerability[];
  /** 권고 사항 */
  recommendations: string[];
}

/** 회복력 추세 데이터 포인트 */
export interface ResilienceTrendPoint {
  /** 시각 */
  timestamp: number;
  /** 종합 점수 */
  overallScore: number;
  /** 개별 지표 점수 */
  metricScores: Record<ResilienceMetric, number>;
}

// --- 인메모리 저장소 ---
const trendHistory: ResilienceTrendPoint[] = [];

/**
 * 종합 회복력을 측정한다.
 * @param revocationLagMs - 평균 철회 전파 지연 (ms)
 * @param versionDistribution - 버전별 참여자 수 맵
 * @param totalNodes - 총 노드 수
 * @param activeNodes - 활성 노드 수
 * @param propagationSuccessRate - 전파 성공률 (0~1)
 * @returns 회복력 보고서
 */
export function measureResilience(
  revocationLagMs: number,
  versionDistribution: Record<string, number>,
  totalNodes: number,
  activeNodes: number,
  propagationSuccessRate: number
): ResilienceReport {
  const metrics: MetricMeasurement[] = [];
  const vulnerabilities: Vulnerability[] = [];
  const recommendations: string[] = [];
  const now = Date.now();

  // 1. 철회 지연
  const lagScore = getRevocationLag(revocationLagMs);
  metrics.push({ metric: "REVOCATION_LAG", score: lagScore, details: `평균 철회 지연: ${revocationLagMs}ms`, measuredAt: now });
  if (lagScore < 50) {
    vulnerabilities.push({ metric: "REVOCATION_LAG", description: `철회 전파 지연이 ${revocationLagMs}ms로 높습니다.`, severity: lagScore < 25 ? 8 : 5 });
    recommendations.push("철회 전파 경로를 최적화하고 중계 노드 수를 늘리세요.");
  }

  // 2. 버전 파편화
  const fragScore = getFragmentationIndex(versionDistribution);
  metrics.push({ metric: "VERSION_FRAGMENTATION", score: fragScore, details: `버전 파편화 점수: ${fragScore}`, measuredAt: now });
  if (fragScore < 50) {
    vulnerabilities.push({ metric: "VERSION_FRAGMENTATION", description: "프로토콜 버전이 과도하게 분산되어 있습니다.", severity: fragScore < 25 ? 7 : 4 });
    recommendations.push("참여자들에게 최신 프로토콜 버전 채택을 권고하세요.");
  }

  // 3. 노드 가용성
  const availabilityScore = totalNodes > 0 ? Math.round((activeNodes / totalNodes) * 100) : 0;
  metrics.push({ metric: "NODE_AVAILABILITY", score: availabilityScore, details: `활성 노드: ${activeNodes}/${totalNodes}`, measuredAt: now });
  if (availabilityScore < 50) {
    vulnerabilities.push({ metric: "NODE_AVAILABILITY", description: `노드 가용성이 ${availabilityScore}%로 낮습니다.`, severity: availabilityScore < 25 ? 9 : 6 });
    recommendations.push("비활성 노드의 연결 상태를 점검하세요.");
  }

  // 4. 전파 신뢰성
  const propagationScore = Math.round(propagationSuccessRate * 100);
  metrics.push({ metric: "PROPAGATION_RELIABILITY", score: propagationScore, details: `전파 성공률: ${propagationScore}%`, measuredAt: now });
  if (propagationScore < 50) {
    vulnerabilities.push({ metric: "PROPAGATION_RELIABILITY", description: `전파 신뢰성이 ${propagationScore}%로 낮습니다.`, severity: propagationScore < 25 ? 9 : 6 });
    recommendations.push("네트워크 토폴로지를 점검하고 고립 노드를 연결하세요.");
  }

  // 종합 점수
  const overallScore = Math.round(
    metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length
  );

  // 추세 기록
  const metricScores: Record<ResilienceMetric, number> = {
    REVOCATION_LAG: lagScore,
    VERSION_FRAGMENTATION: fragScore,
    NODE_AVAILABILITY: availabilityScore,
    PROPAGATION_RELIABILITY: propagationScore,
  };
  trendHistory.push({ timestamp: now, overallScore, metricScores });

  return { overallScore, metrics, vulnerabilities, recommendations };
}

/**
 * 철회 전파 지연을 점수화한다.
 * @param lagMs - 평균 지연 (ms)
 * @returns 점수 (0~100, 높을수록 양호)
 */
export function getRevocationLag(lagMs: number): number {
  if (lagMs <= 100) return 100;
  if (lagMs <= 500) return 80;
  if (lagMs <= 1000) return 60;
  if (lagMs <= 5000) return 40;
  if (lagMs <= 10000) return 20;
  return 10;
}

/**
 * 버전 파편화 지수를 계산한다.
 * @param versionDistribution - 버전별 참여자 수 맵
 * @returns 점수 (0~100, 높을수록 통일됨)
 */
export function getFragmentationIndex(
  versionDistribution: Record<string, number>
): number {
  const versions = Object.keys(versionDistribution);
  if (versions.length === 0) return 100;
  if (versions.length === 1) return 100;

  const total = Object.values(versionDistribution).reduce((a, b) => a + b, 0);
  const maxVersion = Math.max(...Object.values(versionDistribution));
  const dominantShare = maxVersion / total;

  // 버전 수가 많고 지배적 버전 비율이 낮을수록 파편화 심각
  const versionPenalty = Math.min((versions.length - 1) * 10, 50);
  return Math.max(0, Math.round(dominantShare * 100 - versionPenalty));
}

/**
 * 회복력 추세를 반환한다.
 * @param limit - 최근 N건
 * @returns 추세 데이터 포인트 배열
 */
export function getResilienceTrend(limit: number = 30): ResilienceTrendPoint[] {
  return trendHistory.slice(-limit);
}
