/**
 * Planetary Trust Substrate (Phase X) — 개방형 시민 대시보드
 * 파편화 리스크, 철회 전파 상태, 이의 제기 핫스팟, 기저 회복력을 한눈에 조망.
 * 순수 함수 — 제공된 데이터 기반 동작.
 */

export interface CivilDashboardData {
  fragmentationRisk: string;
  revocationPropagationStatus: string;
  contestationHotspots: ContestationHotspot[];
  substrateHealth: string;
  networkCount: number;
  activeAssertions: number;
  revokedAssertions: number;
  constitutionalComputationStats: { totalComputations: number; conflictsEscalated: number };
  upgradeStatus: string;
  alerts: CivilAlert[];
}

export interface ContestationHotspot {
  networkId: string;
  contestationCount: number;
  topCategories: string[];
}

export interface CivilAlert {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  message: string;
  detectedAt: Date;
}

export interface CivilReport {
  period: string;
  dashboard: CivilDashboardData;
  recommendations: string[];
  generatedAt: Date;
}

export function getCivilDashboard(params: {
  fragmentationRisk: string;
  revocationPropagationStatus: string;
  contestationHotspots: ContestationHotspot[];
  substrateHealth: string;
  networkCount: number;
  activeAssertions: number;
  revokedAssertions: number;
  constitutionalComputationStats: { totalComputations: number; conflictsEscalated: number };
  upgradeStatus: string;
}): CivilDashboardData {
  const alerts: CivilAlert[] = [];
  if (params.substrateHealth !== "HEALTHY") {
    alerts.push({ id: `CA-${Date.now()}`, severity: "CRITICAL", message: `기저 상태: ${params.substrateHealth}`, detectedAt: new Date() });
  }
  if (params.fragmentationRisk === "HIGH") {
    alerts.push({ id: `CA-${Date.now() + 1}`, severity: "HIGH", message: "헌법적 파편화 리스크 높음", detectedAt: new Date() });
  }
  if (params.contestationHotspots.some((h) => h.contestationCount > 20)) {
    alerts.push({ id: `CA-${Date.now() + 2}`, severity: "HIGH", message: "이의 제기 핫스팟 감지", detectedAt: new Date() });
  }
  return { ...params, alerts };
}

export function generateCivilReport(dashboard: CivilDashboardData, period: string): CivilReport {
  const recommendations: string[] = [];
  if (dashboard.alerts.some((a) => a.severity === "CRITICAL")) recommendations.push("긴급 거버넌스 회의 소집");
  if (dashboard.contestationHotspots.length > 3) recommendations.push("분쟁 해결 자원 추가 배치 필요");
  return { period, dashboard, recommendations, generatedAt: new Date() };
}

export function getContestationHotspots(dashboard: CivilDashboardData): ContestationHotspot[] {
  return [...dashboard.contestationHotspots].sort((a, b) => b.contestationCount - a.contestationCount);
}
