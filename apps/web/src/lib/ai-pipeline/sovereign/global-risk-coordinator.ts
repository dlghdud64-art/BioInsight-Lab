/**
 * @module global-risk-coordinator
 * @description 글로벌 리스크 코디네이터 — 다중 관할권에 걸친 리스크 평가, 대응 조율, 보고서 생성
 */

/** 리스크 카테고리 */
export type RiskCategory =
  | 'REGULATORY'
  | 'OPERATIONAL'
  | 'DATA_BREACH'
  | 'COMPLIANCE'
  | 'GEOPOLITICAL'
  | 'TECHNICAL';

/** 리스크 상태 */
export type RiskStatus = 'IDENTIFIED' | 'ASSESSING' | 'MITIGATING' | 'RESOLVED' | 'ACCEPTED';

/** 심각도 수준 */
export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** 글로벌 리스크 */
export interface GlobalRisk {
  /** 리스크 고유 ID */
  id: string;
  /** 리스크 카테고리 */
  category: RiskCategory;
  /** 영향 받는 관할권 ID 목록 */
  affectedJurisdictions: string[];
  /** 심각도 */
  severity: SeverityLevel;
  /** 상태 */
  status: RiskStatus;
  /** 완화 계획 */
  mitigationPlan: string;
  /** 조율 담당자 */
  coordinatedBy: string;
}

/** 글로벌 리스크 프로파일 */
export interface GlobalRiskProfile {
  totalRisks: number;
  bySeverity: Record<SeverityLevel, number>;
  byCategory: Record<RiskCategory, number>;
  unresolvedCount: number;
  generatedAt: Date;
}

/** 글로벌 리스크 보고서 */
export interface GlobalRiskReport {
  risks: GlobalRisk[];
  profile: GlobalRiskProfile;
  recommendations: string[];
  generatedAt: Date;
}

/** 인메모리 리스크 저장소 */
const riskStore: GlobalRisk[] = [];

let riskCounter = 0;

/**
 * 글로벌 리스크를 평가·등록한다.
 * @param params 리스크 정보 (id 제외)
 * @returns 등록된 리스크
 */
export function assessGlobalRisk(params: Omit<GlobalRisk, 'id'>): GlobalRisk {
  const risk: GlobalRisk = {
    ...params,
    id: `gr-${++riskCounter}`,
  };
  riskStore.push(risk);
  return risk;
}

/**
 * 리스크 대응을 조율한다 (상태와 완화 계획 업데이트).
 * @param riskId 리스크 ID
 * @param status 새 상태
 * @param mitigationPlan 완화 계획
 * @returns 갱신된 리스크 또는 undefined
 */
export function coordinateResponse(
  riskId: string,
  status: RiskStatus,
  mitigationPlan: string,
): GlobalRisk | undefined {
  const risk = riskStore.find((r) => r.id === riskId);
  if (!risk) return undefined;
  risk.status = status;
  risk.mitigationPlan = mitigationPlan;
  return { ...risk };
}

/**
 * 글로벌 리스크 프로파일을 생성한다.
 * @returns 리스크 프로파일
 */
export function getGlobalRiskProfile(): GlobalRiskProfile {
  const bySeverity: Record<SeverityLevel, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };
  const byCategory: Record<RiskCategory, number> = {
    REGULATORY: 0,
    OPERATIONAL: 0,
    DATA_BREACH: 0,
    COMPLIANCE: 0,
    GEOPOLITICAL: 0,
    TECHNICAL: 0,
  };

  let unresolvedCount = 0;

  for (const risk of riskStore) {
    bySeverity[risk.severity]++;
    byCategory[risk.category]++;
    if (risk.status !== 'RESOLVED' && risk.status !== 'ACCEPTED') {
      unresolvedCount++;
    }
  }

  return {
    totalRisks: riskStore.length,
    bySeverity,
    byCategory,
    unresolvedCount,
    generatedAt: new Date(),
  };
}

/**
 * 글로벌 리스크 보고서를 생성한다.
 * @returns 글로벌 리스크 보고서
 */
export function generateGlobalRiskReport(): GlobalRiskReport {
  const profile = getGlobalRiskProfile();
  const recommendations: string[] = [];

  if (profile.bySeverity.CRITICAL > 0) {
    recommendations.push('즉시 대응이 필요한 CRITICAL 리스크가 존재합니다');
  }
  if (profile.unresolvedCount > 5) {
    recommendations.push('미해결 리스크가 누적되고 있습니다. 추가 리소스 투입을 권고합니다');
  }
  if (profile.byCategory.COMPLIANCE > 0) {
    recommendations.push('컴플라이언스 관련 리스크에 대한 정기 점검을 권고합니다');
  }

  return {
    risks: [...riskStore],
    profile,
    recommendations,
    generatedAt: new Date(),
  };
}
