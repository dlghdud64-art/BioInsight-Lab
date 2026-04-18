/**
 * Planetary Trust Substrate (Phase X) — 기저 회복력 엔진
 * 철회 지연, 분쟁 백로그, 버전 파편화 등 Substrate 스트레스를 측정.
 * 순수 함수 — 제공된 데이터 기반 동작.
 */

export type SubstrateHealth = "HEALTHY" | "SUBSTRATE_STRAINED" | "REFOUNDATION_NEEDED";
export type ResilienceMetric = "REVOCATION_LAG" | "DISPUTE_BACKLOG" | "VERSION_FRAGMENTATION" | "NODE_COVERAGE" | "PROPAGATION_RELIABILITY";

export interface MetricValue {
  metric: ResilienceMetric;
  value: number;
  threshold: number;
  passed: boolean;
}

export interface ResilienceReport {
  health: SubstrateHealth;
  overallScore: number;
  metrics: MetricValue[];
  criticalIssues: string[];
  recommendations: string[];
  assessedAt: Date;
}

export function measureResilience(params: {
  revocationLagMs: number;
  disputeBacklogCount: number;
  versionCount: number;
  nodeCoveragePercent: number;
  propagationReliabilityPercent: number;
}): ResilienceReport {
  const metrics: MetricValue[] = [
    { metric: "REVOCATION_LAG", value: params.revocationLagMs, threshold: 60000, passed: params.revocationLagMs <= 60000 },
    { metric: "DISPUTE_BACKLOG", value: params.disputeBacklogCount, threshold: 50, passed: params.disputeBacklogCount <= 50 },
    { metric: "VERSION_FRAGMENTATION", value: params.versionCount, threshold: 3, passed: params.versionCount <= 3 },
    { metric: "NODE_COVERAGE", value: params.nodeCoveragePercent, threshold: 80, passed: params.nodeCoveragePercent >= 80 },
    { metric: "PROPAGATION_RELIABILITY", value: params.propagationReliabilityPercent, threshold: 95, passed: params.propagationReliabilityPercent >= 95 },
  ];

  const passedCount = metrics.filter((m) => m.passed).length;
  const overallScore = Math.round((passedCount / metrics.length) * 100);

  const criticalIssues: string[] = [];
  if (!metrics[0].passed) criticalIssues.push("철회 전파 지연 임계치 초과");
  if (!metrics[1].passed) criticalIssues.push("분쟁 백로그 과다");
  if (!metrics[4].passed) criticalIssues.push("전파 신뢰도 저하");

  let health: SubstrateHealth = "HEALTHY";
  if (passedCount <= 2) health = "REFOUNDATION_NEEDED";
  else if (passedCount <= 3) health = "SUBSTRATE_STRAINED";

  const recommendations: string[] = [];
  if (!metrics[0].passed) recommendations.push("철회 메시 노드 추가 배포 필요");
  if (!metrics[2].passed) recommendations.push("레거시 버전 퇴역 가속화 필요");

  return { health, overallScore, metrics, criticalIssues, recommendations, assessedAt: new Date() };
}

export function getHealthStatus(report: ResilienceReport): SubstrateHealth {
  return report.health;
}

export function getResilienceTrend(reports: ResilienceReport[]): { improving: boolean; avgScore: number } {
  if (reports.length < 2) return { improving: true, avgScore: reports[0]?.overallScore ?? 0 };
  const recent = reports.slice(-3);
  const avgScore = Math.round(recent.reduce((s, r) => s + r.overallScore, 0) / recent.length);
  const improving = recent[recent.length - 1].overallScore >= recent[0].overallScore;
  return { improving, avgScore };
}

export function triggerRefoundationReview(report: ResilienceReport): boolean {
  return report.health === "REFOUNDATION_NEEDED";
}
