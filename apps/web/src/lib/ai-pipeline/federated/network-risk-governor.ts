/**
 * @module network-risk-governor
 * @description 연합 네트워크 리스크 총괄
 *
 * 연합 네트워크 전체의 리스크를 감지·평가하고, 영향 받는 파트너를 식별하여
 * 완화 조치를 관리한다.
 */

/** 리스크 카테고리 */
export type RiskCategory =
  | "DATA_BREACH"
  | "POLICY_VIOLATION"
  | "TRUST_DEGRADATION"
  | "COMPLIANCE_FAILURE"
  | "OPERATIONAL_DISRUPTION"
  | "CONTRACT_BREACH";

/** 리스크 심각도 */
export type RiskSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

/** 완화 상태 */
export type MitigationStatus =
  | "UNMITIGATED"
  | "IN_PROGRESS"
  | "MITIGATED"
  | "ACCEPTED";

/** 네트워크 리스크 */
export interface NetworkRisk {
  riskId: string;
  category: RiskCategory;
  affectedPartners: string[];
  severity: RiskSeverity;
  mitigationStatus: MitigationStatus;
  detectedAt: Date;
  description: string;
}

/** 리스크 프로필 */
export interface RiskProfile {
  totalRisks: number;
  bySeverity: Record<RiskSeverity, number>;
  byCategory: Partial<Record<RiskCategory, number>>;
  unmitigatedCount: number;
  generatedAt: Date;
}

/** 리스크 등록 요청 */
export interface AssessNetworkRiskInput {
  category: RiskCategory;
  affectedPartners: string[];
  severity: RiskSeverity;
  description: string;
}

/** 인메모리 리스크 저장소 */
const riskStore: NetworkRisk[] = [];

/** 고유 ID 생성 */
let riskSeq = 0;
function nextRiskId(): string {
  riskSeq += 1;
  return `risk-${riskSeq}`;
}

/**
 * 네트워크 리스크를 등록·평가한다.
 * @param input 리스크 평가 정보
 * @returns 등록된 리스크
 */
export function assessNetworkRisk(input: AssessNetworkRiskInput): NetworkRisk {
  const risk: NetworkRisk = {
    riskId: nextRiskId(),
    category: input.category,
    affectedPartners: [...input.affectedPartners],
    severity: input.severity,
    mitigationStatus: "UNMITIGATED",
    detectedAt: new Date(),
    description: input.description,
  };

  riskStore.push(risk);
  return risk;
}

/**
 * 네트워크 전체 리스크 프로필을 반환한다.
 * @returns 리스크 프로필
 */
export function getNetworkRiskProfile(): RiskProfile {
  const bySeverity: Record<RiskSeverity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };
  const byCategory: Partial<Record<RiskCategory, number>> = {};
  let unmitigatedCount = 0;

  for (const risk of riskStore) {
    bySeverity[risk.severity] += 1;
    byCategory[risk.category] = (byCategory[risk.category] ?? 0) + 1;
    if (risk.mitigationStatus === "UNMITIGATED") {
      unmitigatedCount += 1;
    }
  }

  return {
    totalRisks: riskStore.length,
    bySeverity,
    byCategory,
    unmitigatedCount,
    generatedAt: new Date(),
  };
}

/**
 * 리스크에 대한 완화 조치를 수행한다.
 * @param riskId 완화할 리스크 ID
 * @param newStatus 새 완화 상태
 * @returns 갱신된 리스크
 * @throws 리스크를 찾을 수 없는 경우
 */
export function mitigateRisk(
  riskId: string,
  newStatus: MitigationStatus,
): NetworkRisk {
  const risk = riskStore.find((r) => r.riskId === riskId);
  if (!risk) {
    throw new Error(`리스크 '${riskId}'을(를) 찾을 수 없습니다.`);
  }

  risk.mitigationStatus = newStatus;
  return risk;
}

/**
 * 네트워크의 종합 리스크 점수를 계산한다.
 * 심각도별 가중치: CRITICAL=10, HIGH=5, MEDIUM=2, LOW=1
 * 완화된 리스크는 제외한다.
 * @returns 0 이상의 종합 리스크 점수
 */
export function getAggregateRiskScore(): number {
  const weights: Record<RiskSeverity, number> = {
    CRITICAL: 10,
    HIGH: 5,
    MEDIUM: 2,
    LOW: 1,
  };

  return riskStore
    .filter((r) => r.mitigationStatus !== "MITIGATED")
    .reduce((total, risk) => total + weights[risk.severity], 0);
}
