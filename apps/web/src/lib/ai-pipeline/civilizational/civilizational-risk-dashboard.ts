/**
 * 문명 규모 리스크 대시보드 (Civilizational Risk Dashboard)
 *
 * 신뢰 앵커 건전성, 양자 준비 상태, 거버넌스 안정성, 위협 프로필,
 * 아카이브 무결성 등을 종합하여 문명 규모 리스크를 시각화합니다.
 */

import { listActiveAnchors, verifyAnchor } from "./civilizational-trust-anchor";
import { assessQuantumReadiness } from "./post-quantum-evidence-fabric";
import { evaluateGovernanceState } from "./adaptive-governance-engine";
import { getArchiveStats } from "./multi-generational-archive";

/** 문명 규모 리스크 데이터 */
export interface CivilizationalRiskData {
  /** 신뢰 앵커 건전성 (0–1) */
  trustAnchorHealth: number;
  /** 양자 준비도 (0–1) */
  quantumReadiness: number;
  /** 거버넌스 안정성 (0–1) */
  governanceStability: number;
  /** 위협 프로필 요약 */
  threatProfile: {
    level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    description: string;
  };
  /** 아카이브 무결성 (0–1) */
  archiveIntegrity: number;
}

/** 장기 보고서 */
export interface LongTermReport {
  generatedAt: Date;
  riskData: CivilizationalRiskData;
  overallScore: number;
  recommendations: string[];
}

/** 시스템 회복력 평가 */
export interface ResilienceAssessment {
  overallResilience: number;
  dimensions: {
    name: string;
    score: number;
    status: "STRONG" | "ADEQUATE" | "WEAK" | "CRITICAL";
  }[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function computeTrustAnchorHealth(): number {
  const anchors = listActiveAnchors();
  if (anchors.length === 0) return 0;

  let validCount = 0;
  for (const a of anchors) {
    const result = verifyAnchor(a.id);
    if (result.valid) validCount++;
  }
  return validCount / anchors.length;
}

function computeArchiveIntegrity(): number {
  const stats = getArchiveStats();
  if (stats.totalEntries === 0) return 1; // 아카이브가 비어있으면 무결
  // PERPETUAL 비율이 높을수록 무결성이 높다고 간주
  const perpetualRatio = stats.byTier.PERPETUAL / stats.totalEntries;
  return Math.min(1, 0.5 + perpetualRatio * 0.5);
}

function deriveThreatLevel(
  trustHealth: number,
  quantumScore: number,
  govStability: number
): { level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; description: string } {
  const avg = (trustHealth + quantumScore + govStability) / 3;
  if (avg >= 0.8) return { level: "LOW", description: "시스템이 안정적입니다." };
  if (avg >= 0.5)
    return { level: "MEDIUM", description: "일부 영역에서 주의가 필요합니다." };
  if (avg >= 0.3)
    return { level: "HIGH", description: "심각한 리스크가 감지되었습니다." };
  return { level: "CRITICAL", description: "즉각적인 조치가 필요합니다." };
}

function scoreToStatus(
  score: number
): "STRONG" | "ADEQUATE" | "WEAK" | "CRITICAL" {
  if (score >= 0.8) return "STRONG";
  if (score >= 0.5) return "ADEQUATE";
  if (score >= 0.3) return "WEAK";
  return "CRITICAL";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 문명 규모 리스크 대시보드 데이터를 생성합니다.
 */
export function getCivilizationalDashboard(): CivilizationalRiskData {
  const trustAnchorHealth = computeTrustAnchorHealth();
  const quantumReadiness = assessQuantumReadiness().readinessScore;
  const govState = evaluateGovernanceState();
  const governanceStability = govState.healthScore;
  const archiveIntegrity = computeArchiveIntegrity();
  const threatProfile = deriveThreatLevel(
    trustAnchorHealth,
    quantumReadiness,
    governanceStability
  );

  return {
    trustAnchorHealth,
    quantumReadiness,
    governanceStability,
    threatProfile,
    archiveIntegrity,
  };
}

/**
 * 장기 보고서를 생성합니다.
 */
export function generateLongTermReport(): LongTermReport {
  const riskData = getCivilizationalDashboard();
  const overallScore =
    (riskData.trustAnchorHealth +
      riskData.quantumReadiness +
      riskData.governanceStability +
      riskData.archiveIntegrity) /
    4;

  const recommendations: string[] = [];
  if (riskData.trustAnchorHealth < 0.5) {
    recommendations.push("신뢰 앵커 보증인을 추가하고 검증 체계를 강화하십시오.");
  }
  if (riskData.quantumReadiness < 0.5) {
    recommendations.push(
      "양자 저항 알고리즘으로의 마이그레이션을 가속하십시오."
    );
  }
  if (riskData.governanceStability < 0.5) {
    recommendations.push("거버넌스 규칙을 검토하고 핵심 규칙을 채택하십시오.");
  }
  if (riskData.archiveIntegrity < 0.5) {
    recommendations.push("아카이브 보존 정책을 검토하십시오.");
  }
  if (recommendations.length === 0) {
    recommendations.push("현재 시스템 상태가 양호합니다. 정기 점검을 유지하십시오.");
  }

  return {
    generatedAt: new Date(),
    riskData,
    overallScore: Math.round(overallScore * 100) / 100,
    recommendations,
  };
}

/**
 * 시스템 전반의 회복력을 평가합니다.
 */
export function assessSystemicResilience(): ResilienceAssessment {
  const riskData = getCivilizationalDashboard();

  const dimensions = [
    { name: "신뢰 앵커 건전성", score: riskData.trustAnchorHealth },
    { name: "양자 저항 준비도", score: riskData.quantumReadiness },
    { name: "거버넌스 안정성", score: riskData.governanceStability },
    { name: "아카이브 무결성", score: riskData.archiveIntegrity },
  ].map((d) => ({
    ...d,
    score: Math.round(d.score * 100) / 100,
    status: scoreToStatus(d.score),
  }));

  const overallResilience =
    dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length;

  return {
    overallResilience: Math.round(overallResilience * 100) / 100,
    dimensions,
  };
}
