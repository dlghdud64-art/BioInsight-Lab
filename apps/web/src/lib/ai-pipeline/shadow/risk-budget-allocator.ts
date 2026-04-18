/**
 * Strategic Command Layer (Phase P) — 리소스 배분 전략 엔진
 * 포트폴리오 데이터를 기반으로 문서 유형/테넌트별 자원 배분 전략을 산출한다.
 * 규칙: 예산 압박 시 보류/재우선순위화, 절대 자동으로 모델 다운그레이드 금지.
 */

/** 배분 권고 유형 */
export type AllocationRecommendation =
  | 'INVEST_MORE'
  | 'MAINTAIN'
  | 'SLOW_DOWN'
  | 'DIVEST';

/** 배분 전략 인터페이스 */
export interface AllocationStrategy {
  documentType: string;
  tenantId: string;
  recommendation: AllocationRecommendation;
  /** 토큰 예산 비율 (0~100) */
  tokenBudgetPercent: number;
  /** 리뷰 예산 비율 (0~100) */
  reviewBudgetPercent: number;
  /** 전략 근거 설명 */
  rationale: string;
  /** 컴플라이언스 리스크 수준 (0~1) */
  complianceRisk: number;
}

/** 포트폴리오 데이터 항목 */
export interface PortfolioDataItem {
  documentType: string;
  tenantId: string;
  automationRate: number;
  incidentRate: number;
  volume: number;
  costPerDocument: number;
  budgetUtilization: number;
  complianceRisk: number;
}

/**
 * 포트폴리오 데이터를 분석하여 자원 배분 전략을 산출한다.
 *
 * 규칙:
 * - 예산 압박(budgetUtilization > 0.9) → SLOW_DOWN 또는 MAINTAIN (보류/재우선순위화)
 * - 절대 자동으로 모델 다운그레이드하지 않는다
 * - 높은 사고율 + 높은 볼륨 → INVEST_MORE
 * - 낮은 사고율 + 낮은 볼륨 → DIVEST 검토
 *
 * 순수 함수, DB 의존성 없음.
 */
export function computeAllocation(
  portfolioData: PortfolioDataItem[]
): AllocationStrategy[] {
  const totalVolume = portfolioData.reduce((sum, item) => sum + item.volume, 0);

  return portfolioData.map((item) => {
    const volumeShare = totalVolume > 0 ? item.volume / totalVolume : 0;

    // 예산 압박 판단 — 절대 자동 모델 다운그레이드 금지
    if (item.budgetUtilization > 0.9) {
      return {
        documentType: item.documentType,
        tenantId: item.tenantId,
        recommendation: 'SLOW_DOWN' as AllocationRecommendation,
        tokenBudgetPercent: Math.round(volumeShare * 80), // 예산 20% 절감
        reviewBudgetPercent: Math.round(volumeShare * 100),
        rationale: '예산 압박 상태 — 처리 속도 조절 (모델 다운그레이드 금지)',
        complianceRisk: item.complianceRisk,
      };
    }

    // 높은 사고율 → 투자 확대
    if (item.incidentRate > 0.05) {
      return {
        documentType: item.documentType,
        tenantId: item.tenantId,
        recommendation: 'INVEST_MORE' as AllocationRecommendation,
        tokenBudgetPercent: Math.round(volumeShare * 130), // 예산 30% 증액
        reviewBudgetPercent: Math.round(volumeShare * 150),
        rationale: '높은 사고율 — 리뷰 및 모델 품질 투자 확대 필요',
        complianceRisk: item.complianceRisk,
      };
    }

    // 낮은 볼륨 + 낮은 자동화율 → 철수 검토
    if (item.volume < 10 && item.automationRate < 0.3) {
      return {
        documentType: item.documentType,
        tenantId: item.tenantId,
        recommendation: 'DIVEST' as AllocationRecommendation,
        tokenBudgetPercent: Math.round(volumeShare * 50),
        reviewBudgetPercent: Math.round(volumeShare * 50),
        rationale: '낮은 볼륨 및 자동화율 — 자원 철수 검토',
        complianceRisk: item.complianceRisk,
      };
    }

    // 기본: 현상 유지
    return {
      documentType: item.documentType,
      tenantId: item.tenantId,
      recommendation: 'MAINTAIN' as AllocationRecommendation,
      tokenBudgetPercent: Math.round(volumeShare * 100),
      reviewBudgetPercent: Math.round(volumeShare * 100),
      rationale: '안정적 운영 — 현재 배분 유지',
      complianceRisk: item.complianceRisk,
    };
  });
}
