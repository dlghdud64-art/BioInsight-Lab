/**
 * Institutional Stewardship (Phase U) — 스튜어드십 대시보드
 * 기관의 의사결정 권한, 승계 준비도, 연속성, 미션 정렬을 종합 모니터링한다.
 * 순수 함수 — 제공된 데이터 기반 동작.
 */

export type StewardshipGrade = "EXCELLENT" | "GOOD" | "FAIR" | "AT_RISK" | "CRITICAL";

export interface StewardshipHealth {
  decisionRightsClarity: number;
  successionReadiness: number;
  continuityScore: number;
  missionAlignment: number;
  knowledgeRetention: number;
  emergencyPreparedness: number;
}

export interface StewardshipRisk {
  category: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
}

export interface StewardshipAction {
  action: string;
  actor: string;
  timestamp: Date;
}

export interface StewardshipDashboardData {
  health: StewardshipHealth;
  overallScore: number;
  grade: StewardshipGrade;
  topRisks: StewardshipRisk[];
  recentActions: StewardshipAction[];
  assessedAt: Date;
}

export interface StewardshipReport {
  period: string;
  dashboard: StewardshipDashboardData;
  recommendations: string[];
  keyMetrics: Record<string, number>;
}

function computeGrade(score: number): StewardshipGrade {
  if (score >= 90) return "EXCELLENT";
  if (score >= 75) return "GOOD";
  if (score >= 60) return "FAIR";
  if (score >= 40) return "AT_RISK";
  return "CRITICAL";
}

function identifyRisksFromHealth(h: StewardshipHealth): StewardshipRisk[] {
  const risks: StewardshipRisk[] = [];
  if (h.successionReadiness < 30) risks.push({ category: "SUCCESSION", severity: "HIGH", description: "승계 준비도 심각히 낮음" });
  if (h.continuityScore < 30) risks.push({ category: "CONTINUITY", severity: "HIGH", description: "연속성 보증 부재" });
  if (h.missionAlignment < 40) risks.push({ category: "MISSION_DRIFT", severity: "HIGH", description: "미션 드리프트 감지" });
  if (h.emergencyPreparedness < 30) risks.push({ category: "EMERGENCY", severity: "HIGH", description: "비상 대비 미흡" });
  if (h.knowledgeRetention < 40) risks.push({ category: "KNOWLEDGE", severity: "MEDIUM", description: "제도적 기억 유실 위험" });
  return risks;
}

export function getStewardshipDashboard(health: StewardshipHealth): StewardshipDashboardData {
  const vals = Object.values(health) as number[];
  const overallScore = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  return {
    health,
    overallScore,
    grade: computeGrade(overallScore),
    topRisks: identifyRisksFromHealth(health),
    recentActions: [],
    assessedAt: new Date(),
  };
}

export function generateStewardshipReport(health: StewardshipHealth, period: string): StewardshipReport {
  const dashboard = getStewardshipDashboard(health);
  const recommendations: string[] = [];
  if (health.successionReadiness < 50) recommendations.push("승계 계획 수립 필요");
  if (health.continuityScore < 50) recommendations.push("연속성 계획 테스트 필요");
  if (health.missionAlignment < 60) recommendations.push("미션 드리프트 점검 필요");
  if (health.knowledgeRetention < 50) recommendations.push("제도적 기억 문서화 필요");
  if (health.emergencyPreparedness < 50) recommendations.push("비상 권한 헌장 검토 필요");
  return { period, dashboard, recommendations, keyMetrics: { ...health } };
}

export function identifyRisks(health: StewardshipHealth): StewardshipRisk[] {
  return identifyRisksFromHealth(health);
}

export function getKeyMetrics(health: StewardshipHealth): Record<string, number> {
  const vals = Object.values(health) as number[];
  return { overallScore: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), ...health };
}
