/**
 * Open Assurance Protocol (Phase W) — 생태계 관제 대시보드
 * 티어별 참여자, 분쟁 중인 보증, 중립성 리스크, 버전 파편화 상태를 한눈에 조망.
 * 순수 함수 — 제공된 데이터 기반 동작.
 */

export interface EcosystemDashboardData {
  participantsByTier: Record<string, number>;
  activeAssertions: number;
  revokedAssertions: number;
  contestedAssertions: number;
  neutralityStatus: string;
  resilienceScore: number;
  versionDistribution: Record<string, number>;
  recentContestations: EcosystemEvent[];
  governanceActions: EcosystemEvent[];
  alerts: EcosystemAlert[];
}

export interface EcosystemEvent {
  id: string;
  type: string;
  description: string;
  timestamp: Date;
}

export interface EcosystemAlert {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  message: string;
  detectedAt: Date;
}

export interface EcosystemReport {
  period: string;
  dashboard: EcosystemDashboardData;
  recommendations: string[];
  generatedAt: Date;
}

export function getEcosystemDashboard(params: {
  participantsByTier: Record<string, number>;
  activeAssertions: number;
  revokedAssertions: number;
  contestedAssertions: number;
  neutralityStatus: string;
  resilienceScore: number;
  versionDistribution: Record<string, number>;
}): EcosystemDashboardData {
  const alerts: EcosystemAlert[] = [];
  if (params.contestedAssertions > 10) {
    alerts.push({ id: `EA-${Date.now()}`, severity: "HIGH", message: "분쟁 중인 보증 10건 초과", detectedAt: new Date() });
  }
  if (params.neutralityStatus !== "HEALTHY") {
    alerts.push({ id: `EA-${Date.now() + 1}`, severity: "CRITICAL", message: `중립성 상태: ${params.neutralityStatus}`, detectedAt: new Date() });
  }
  if (params.resilienceScore < 50) {
    alerts.push({ id: `EA-${Date.now() + 2}`, severity: "HIGH", message: "프로토콜 회복력 점수 50 미만", detectedAt: new Date() });
  }
  return { ...params, recentContestations: [], governanceActions: [], alerts };
}

export function generateEcosystemReport(dashboard: EcosystemDashboardData, period: string): EcosystemReport {
  const recommendations: string[] = [];
  if (dashboard.contestedAssertions > 5) recommendations.push("분쟁 해결 프로세스 가속화 필요");
  if (dashboard.resilienceScore < 60) recommendations.push("프로토콜 회복력 강화 필요");
  if (dashboard.alerts.some((a) => a.severity === "CRITICAL")) recommendations.push("긴급 거버넌스 회의 소집 필요");
  return { period, dashboard, recommendations, generatedAt: new Date() };
}

export function getAlertFeed(dashboard: EcosystemDashboardData): EcosystemAlert[] {
  return [...dashboard.alerts].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return order[a.severity] - order[b.severity];
  });
}
