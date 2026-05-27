/**
 * Org Benchmarking — 테넌트별 벤치마킹 지표
 *
 * 안전 자동화율, 예산 효율성, 롤백 대응 속도를 계량화하여
 * 조직 간 벤치마킹 지표를 산출합니다.
 */

export interface OrgBenchmark {
  tenantId: string;
  orgName: string;
  safeAutomationRate: number;        // 0~1 (auto-verified without false-safe / total)
  costPerSafeAutomation: number;     // USD
  reviewAvoidanceRate: number;       // 0~1
  rollbackResponseTimeMs: number;    // avg ms from detection to rollback
  falseSafeIncidents: number;
  totalProcessed: number;
  overallScore: number;              // 0~100
}

export interface BenchmarkInput {
  tenantId: string;
  orgName: string;
  totalProcessed: number;
  autoVerifiedCount: number;
  falseSafeCount: number;
  reviewAvoidedCount: number;
  totalCost: number;
  avgRollbackResponseMs: number;
}

/**
 * 개별 조직 벤치마크 계산
 */
export function computeOrgBenchmark(input: BenchmarkInput): OrgBenchmark {
  const safeAutomationRate = input.totalProcessed > 0
    ? (input.autoVerifiedCount - input.falseSafeCount) / input.totalProcessed
    : 0;

  const costPerSafeAutomation = input.autoVerifiedCount > 0
    ? input.totalCost / input.autoVerifiedCount
    : 0;

  const reviewAvoidanceRate = input.totalProcessed > 0
    ? input.reviewAvoidedCount / input.totalProcessed
    : 0;

  // Overall score: weighted composite
  let overallScore = 0;
  overallScore += Math.min(safeAutomationRate * 40, 40);                    // 40 max
  overallScore += Math.min(reviewAvoidanceRate * 25, 25);                   // 25 max
  overallScore += input.falseSafeCount === 0 ? 20 : Math.max(0, 20 - input.falseSafeCount * 5); // 20 max
  overallScore += input.avgRollbackResponseMs < 60_000 ? 15 : input.avgRollbackResponseMs < 300_000 ? 10 : 5; // 15 max

  return {
    tenantId: input.tenantId,
    orgName: input.orgName,
    safeAutomationRate: Math.round(safeAutomationRate * 1000) / 1000,
    costPerSafeAutomation: Math.round(costPerSafeAutomation * 100) / 100,
    reviewAvoidanceRate: Math.round(reviewAvoidanceRate * 1000) / 1000,
    rollbackResponseTimeMs: input.avgRollbackResponseMs,
    falseSafeIncidents: input.falseSafeCount,
    totalProcessed: input.totalProcessed,
    overallScore: Math.round(overallScore),
  };
}

/**
 * 조직 벤치마크 일괄 계산
 */
export function computeOrgBenchmarks(inputs: BenchmarkInput[]): OrgBenchmark[] {
  return inputs.map(computeOrgBenchmark);
}

/**
 * 순위 정렬
 */
export function rankOrgs(benchmarks: OrgBenchmark[]): OrgBenchmark[] {
  return [...benchmarks].sort((a, b) => b.overallScore - a.overallScore);
}

/**
 * 상위/하위 조직 식별
 */
export function identifyOutliers(benchmarks: OrgBenchmark[]): {
  topPerformers: OrgBenchmark[];
  needsAttention: OrgBenchmark[];
} {
  const sorted = rankOrgs(benchmarks);
  return {
    topPerformers: sorted.filter((b) => b.overallScore >= 80),
    needsAttention: sorted.filter((b) => b.overallScore < 40 || b.falseSafeIncidents > 0),
  };
}
