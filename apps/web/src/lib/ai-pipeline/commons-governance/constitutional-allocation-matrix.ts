/**
 * 헌법적 배분 매트릭스
 *
 * 공공 자원의 헌법적 배분 원칙을 정의하고,
 * 참여자 분류별 접근 수준·검토 부담·증거 의무를 체계적으로 관리한다.
 * 시장 논리(트래픽·결제)가 아닌 시민적 중요도와 기여 의무에 따라 배분한다.
 */

/** 참여자 분류 */
export type ParticipantClass =
  | 'PUBLIC_INTEREST'
  | 'COMMERCIAL_STANDARD'
  | 'HIGH_CONSEQUENCE'
  | 'LOW_POWER_PARTICIPANT';

/** 접근 수준 */
export type AccessLevel = 'FULL' | 'STANDARD' | 'RESTRICTED' | 'MINIMAL';

/** 사용 사례 범주 */
export type UseCaseCategory =
  | 'SAFETY_CRITICAL'
  | 'AUDIT_COMPLIANCE'
  | 'COMMERCIAL_STANDARD'
  | 'RESEARCH'
  | 'PUBLIC_BENEFIT';

/** 배분 규칙 */
export interface AllocationRule {
  /** 참여자 분류 */
  participantClass: ParticipantClass;
  /** 접근 수준 */
  accessLevel: AccessLevel;
  /** 검토 부담 (0~1, 1이 최고 부담) */
  reviewBurden: number;
  /** 증거 의무 수준 (0~1) */
  evidenceObligation: number;
  /** 우선순위 가중치 (높을수록 우선) */
  priorityWeight: number;
}

/** 참여자 분류 평가 입력 */
export interface ParticipantEvaluationInput {
  participantId: string;
  isPublicInterest: boolean;
  isHighConsequence: boolean;
  hasLowPower: boolean;
  useCaseCategory: UseCaseCategory;
}

/** 배분 매트릭스 항목 */
export interface AllocationMatrixEntry {
  participantClass: ParticipantClass;
  useCaseCategory: UseCaseCategory;
  rule: AllocationRule;
}

// ─── 기본 배분 규칙 저장소 ───

const DEFAULT_RULES: ReadonlyArray<AllocationRule> = [
  {
    participantClass: 'PUBLIC_INTEREST',
    accessLevel: 'FULL',
    reviewBurden: 0.2,
    evidenceObligation: 0.3,
    priorityWeight: 1.0,
  },
  {
    participantClass: 'LOW_POWER_PARTICIPANT',
    accessLevel: 'STANDARD',
    reviewBurden: 0.1,
    evidenceObligation: 0.2,
    priorityWeight: 0.9,
  },
  {
    participantClass: 'HIGH_CONSEQUENCE',
    accessLevel: 'RESTRICTED',
    reviewBurden: 0.9,
    evidenceObligation: 0.95,
    priorityWeight: 0.7,
  },
  {
    participantClass: 'COMMERCIAL_STANDARD',
    accessLevel: 'STANDARD',
    reviewBurden: 0.5,
    evidenceObligation: 0.5,
    priorityWeight: 0.5,
  },
];

const allocationRulesStore: AllocationRule[] = [...DEFAULT_RULES];

/**
 * 전체 배분 규칙 목록을 반환한다.
 * @returns 현재 등록된 모든 배분 규칙
 */
export function getAllocationRules(): ReadonlyArray<AllocationRule> {
  return [...allocationRulesStore];
}

/**
 * 참여자의 특성을 기반으로 참여자 분류를 평가한다.
 * 공익 > 저전력 참여자 > 고결과 > 상업 표준 순으로 판정한다.
 * @param input 참여자 평가 입력
 * @returns 평가된 참여자 분류
 */
export function evaluateParticipantClass(
  input: ParticipantEvaluationInput
): ParticipantClass {
  if (input.isPublicInterest) {
    return 'PUBLIC_INTEREST';
  }
  if (input.hasLowPower) {
    return 'LOW_POWER_PARTICIPANT';
  }
  if (input.isHighConsequence) {
    return 'HIGH_CONSEQUENCE';
  }
  return 'COMMERCIAL_STANDARD';
}

/**
 * 전체 배분 매트릭스를 생성한다.
 * 모든 참여자 분류 × 사용 사례 범주 조합에 대해 적용 가능한 규칙을 매핑한다.
 * @returns 배분 매트릭스 항목 배열
 */
export function getAllocationMatrix(): AllocationMatrixEntry[] {
  const participantClasses: ParticipantClass[] = [
    'PUBLIC_INTEREST',
    'COMMERCIAL_STANDARD',
    'HIGH_CONSEQUENCE',
    'LOW_POWER_PARTICIPANT',
  ];
  const useCaseCategories: UseCaseCategory[] = [
    'SAFETY_CRITICAL',
    'AUDIT_COMPLIANCE',
    'COMMERCIAL_STANDARD',
    'RESEARCH',
    'PUBLIC_BENEFIT',
  ];

  const matrix: AllocationMatrixEntry[] = [];

  for (const pc of participantClasses) {
    const rule = allocationRulesStore.find((r) => r.participantClass === pc);
    if (!rule) continue;

    for (const uc of useCaseCategories) {
      const adjustedRule = applyUseCaseAdjustment(rule, uc);
      matrix.push({
        participantClass: pc,
        useCaseCategory: uc,
        rule: adjustedRule,
      });
    }
  }

  return matrix;
}

/**
 * 사용 사례 범주에 따라 규칙을 조정한다 (내부 헬퍼).
 */
function applyUseCaseAdjustment(
  baseRule: AllocationRule,
  useCase: UseCaseCategory
): AllocationRule {
  const adjusted = { ...baseRule };

  switch (useCase) {
    case 'SAFETY_CRITICAL':
      adjusted.reviewBurden = Math.min(1.0, adjusted.reviewBurden + 0.3);
      adjusted.evidenceObligation = Math.min(1.0, adjusted.evidenceObligation + 0.3);
      adjusted.priorityWeight = Math.min(1.0, adjusted.priorityWeight + 0.2);
      break;
    case 'AUDIT_COMPLIANCE':
      adjusted.reviewBurden = Math.min(1.0, adjusted.reviewBurden + 0.2);
      adjusted.evidenceObligation = Math.min(1.0, adjusted.evidenceObligation + 0.2);
      break;
    case 'PUBLIC_BENEFIT':
      adjusted.priorityWeight = Math.min(1.0, adjusted.priorityWeight + 0.15);
      adjusted.reviewBurden = Math.max(0, adjusted.reviewBurden - 0.1);
      break;
    case 'RESEARCH':
      adjusted.reviewBurden = Math.max(0, adjusted.reviewBurden - 0.05);
      break;
    case 'COMMERCIAL_STANDARD':
      // 기본 규칙 유지
      break;
  }

  return adjusted;
}
