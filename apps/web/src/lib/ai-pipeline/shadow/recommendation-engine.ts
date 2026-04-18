/**
 * Strategic Command Layer (Phase P) — 전략적 행동 계획 생성기
 * 포트폴리오 상태를 분석하여 실행 가능한 행동 계획을 생성한다.
 */

/** 행동 계획 유형 */
export type ActionType =
  | 'PROMOTE_DOC_TYPE'
  | 'FREEZE_PORTFOLIO'
  | 'TIGHTEN_POLICY'
  | 'LOOSEN_POLICY'
  | 'EXPAND_TENANT'
  | 'HOLD_EXPANSION'
  | 'REALLOCATE_BUDGET';

/** 되돌림 가능성 수준 */
export type Reversibility = 'HIGH' | 'MEDIUM' | 'LOW';

/** 행동 계획 상태 */
export type ActionPlanStatus = 'DRAFT' | 'PROPOSED' | 'APPROVED' | 'EXECUTED' | 'REJECTED';

/** 행동 계획 인터페이스 */
export interface ActionPlan {
  planId: string;
  actionType: ActionType;
  scope: string;
  expectedBenefit: string;
  expectedRisk: string;
  reversibility: Reversibility;
  requiredApprovals: string[];
  status: ActionPlanStatus;
  createdAt: Date;
}

/** 포트폴리오 상태 입력 (외부에서 주입) */
export interface PortfolioState {
  tenantId: string;
  documentTypes: string[];
  incidentRate: number;
  automationRate: number;
  budgetUtilization: number;
  reviewBacklog: number;
  falseSafeRate: number;
}

// 인메모리 저장소 (production: DB-backed)
const actionPlanStore: ActionPlan[] = [];

/** 고유 ID 생성 유틸 */
function generatePlanId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 완화/확장 유형은 항상 임원 승인 필요.
 * 강화/동결 유형은 자동 실행 가능.
 */
function requiresExecutiveApproval(actionType: ActionType): boolean {
  const autoExecutable: ActionType[] = ['TIGHTEN_POLICY', 'FREEZE_PORTFOLIO'];
  return !autoExecutable.includes(actionType);
}

/**
 * 포트폴리오 상태를 분석하여 전략적 행동 계획을 생성한다.
 * 규칙: 완화(LOOSEN)/확장(EXPAND) 계획은 반드시 임원 승인 필요.
 *       강화(TIGHTEN)/동결(FREEZE)은 자동 실행 가능.
 */
export function generateRecommendations(portfolioState: PortfolioState): ActionPlan[] {
  const plans: ActionPlan[] = [];
  const now = new Date();

  // 높은 사고율 → 정책 강화 (자동 실행 가능)
  if (portfolioState.incidentRate > 0.05) {
    plans.push({
      planId: generatePlanId(),
      actionType: 'TIGHTEN_POLICY',
      scope: `테넌트 ${portfolioState.tenantId} 전체`,
      expectedBenefit: '사고율 감소 및 안전성 향상',
      expectedRisk: '처리량 일시적 감소',
      reversibility: 'HIGH',
      requiredApprovals: [], // 자동 실행 가능
      status: 'PROPOSED',
      createdAt: now,
    });
  }

  // 매우 높은 사고율 → 포트폴리오 동결 (자동 실행 가능)
  if (portfolioState.incidentRate > 0.15) {
    plans.push({
      planId: generatePlanId(),
      actionType: 'FREEZE_PORTFOLIO',
      scope: `테넌트 ${portfolioState.tenantId} 전체 포트폴리오`,
      expectedBenefit: '추가 손실 방지',
      expectedRisk: '자동화 중단으로 인한 수동 작업 부담 증가',
      reversibility: 'HIGH',
      requiredApprovals: [], // 동결은 자동 실행 가능
      status: 'PROPOSED',
      createdAt: now,
    });
  }

  // 높은 자동화율 + 낮은 사고율 → 확장 권장 (임원 승인 필요)
  if (portfolioState.automationRate > 0.7 && portfolioState.incidentRate < 0.02) {
    plans.push({
      planId: generatePlanId(),
      actionType: 'EXPAND_TENANT',
      scope: `테넌트 ${portfolioState.tenantId} 문서 유형 확장`,
      expectedBenefit: '자동화 범위 확대 및 비용 절감',
      expectedRisk: '새 문서 유형에서의 미발견 리스크',
      reversibility: 'MEDIUM',
      requiredApprovals: ['CTO', 'VP_Operations'], // 확장은 임원 승인 필요
      status: 'DRAFT',
      createdAt: now,
    });
  }

  // 정책 완화 권장 조건 (임원 승인 필요)
  if (portfolioState.falseSafeRate < 0.01 && portfolioState.automationRate > 0.8) {
    plans.push({
      planId: generatePlanId(),
      actionType: 'LOOSEN_POLICY',
      scope: `테넌트 ${portfolioState.tenantId} 검토 정책`,
      expectedBenefit: '처리 속도 향상',
      expectedRisk: '미탐지 위험 소폭 증가',
      reversibility: 'HIGH',
      requiredApprovals: ['CTO', 'Chief_Risk_Officer'], // 완화는 임원 승인 필수
      status: 'DRAFT',
      createdAt: now,
    });
  }

  // 예산 비효율 → 재배분 권장 (임원 승인 필요)
  if (portfolioState.budgetUtilization < 0.5 || portfolioState.budgetUtilization > 0.95) {
    plans.push({
      planId: generatePlanId(),
      actionType: 'REALLOCATE_BUDGET',
      scope: `테넌트 ${portfolioState.tenantId} 예산 재배분`,
      expectedBenefit: '자원 효율성 향상',
      expectedRisk: '전환 기간 동안 서비스 품질 변동',
      reversibility: 'MEDIUM',
      requiredApprovals: ['CFO', 'CTO'],
      status: 'DRAFT',
      createdAt: now,
    });
  }

  // 리뷰 백로그 과다 → 확장 보류
  if (portfolioState.reviewBacklog > 100) {
    plans.push({
      planId: generatePlanId(),
      actionType: 'HOLD_EXPANSION',
      scope: `테넌트 ${portfolioState.tenantId} 확장 보류`,
      expectedBenefit: '기존 백로그 해소에 집중',
      expectedRisk: '경쟁 기회 지연',
      reversibility: 'HIGH',
      requiredApprovals: requiresExecutiveApproval('HOLD_EXPANSION')
        ? ['VP_Operations']
        : [],
      status: 'PROPOSED',
      createdAt: now,
    });
  }

  // 문서 유형 승격 조건
  if (portfolioState.automationRate > 0.9 && portfolioState.incidentRate < 0.01) {
    plans.push({
      planId: generatePlanId(),
      actionType: 'PROMOTE_DOC_TYPE',
      scope: `테넌트 ${portfolioState.tenantId} 고성과 문서 유형 승격`,
      expectedBenefit: '완전 자동화 달성',
      expectedRisk: '수동 검토 안전망 제거',
      reversibility: 'LOW',
      requiredApprovals: ['CTO', 'VP_Operations', 'Chief_Risk_Officer'],
      status: 'DRAFT',
      createdAt: now,
    });
  }

  // 생성된 계획을 저장소에 추가
  actionPlanStore.push(...plans);

  return plans;
}

/** 저장된 모든 행동 계획 조회 */
export function getActionPlans(): ActionPlan[] {
  return [...actionPlanStore];
}

/** 특정 계획의 상태 업데이트 */
export function updatePlanStatus(planId: string, status: ActionPlanStatus): ActionPlan | null {
  const plan = actionPlanStore.find((p) => p.planId === planId);
  if (!plan) return null;
  plan.status = status;
  return { ...plan };
}
