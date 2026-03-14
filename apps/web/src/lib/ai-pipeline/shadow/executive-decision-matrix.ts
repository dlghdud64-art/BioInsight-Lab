/**
 * Strategic Command Layer (Phase P) — C-level 의사결정 패키지 표준화
 * 경영진을 위한 구조화된 의사결정 옵션과 근거를 패키지로 제공한다.
 */

/** 의사결정 유형 */
export type DecisionType =
  | 'EXPAND_NOW'
  | 'HOLD_FOR_SAFETY'
  | 'FREEZE_AND_STABILIZE'
  | 'REALLOCATE_RESOURCES'
  | 'ACCELERATE_ROLLOUT';

/** 의사결정 상태 */
export type DecisionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEFERRED';

/** 경영진 의사결정 옵션 */
export interface ExecutiveDecision {
  decisionType: DecisionType;
  /** 근거 증거 목록 */
  evidence: string[];
  /** 필요 승인자 목록 */
  approvers: string[];
  /** 롤백 계획 */
  rollbackPlan: string;
  /** 결정 시한 */
  deadline: Date;
  status: DecisionStatus;
}

/** 의사결정 패키지 */
export interface DecisionPackage {
  decisionId: string;
  /** 의사결정 배경 및 맥락 */
  context: string;
  /** 선택 가능한 옵션 목록 */
  options: ExecutiveDecision[];
  /** AI 추천 옵션 (options 배열의 인덱스) */
  recommendation: number;
  createdAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
}

// 인메모리 저장소 (production: DB-backed)
const decisionPackageStore: DecisionPackage[] = [];

/** 고유 ID 생성 유틸 */
function generateDecisionId(): string {
  return `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 의사결정 패키지를 구성한다.
 * 경영진이 근거 기반으로 최적 옵션을 선택할 수 있도록 구조화한다.
 *
 * @param context 의사결정 배경 설명
 * @param options 선택 가능한 의사결정 옵션 배열
 * @returns 생성된 DecisionPackage
 */
export function buildDecisionPackage(
  context: string,
  options: ExecutiveDecision[]
): DecisionPackage {
  // 최적 옵션 자동 추천: 증거가 가장 많고 롤백 계획이 존재하는 옵션 우선
  const recommendation = selectBestOption(options);

  const pkg: DecisionPackage = {
    decisionId: generateDecisionId(),
    context,
    options,
    recommendation,
    createdAt: new Date(),
    decidedAt: null,
    decidedBy: null,
  };

  decisionPackageStore.push(pkg);
  return pkg;
}

/**
 * 최적 옵션 선택 로직
 * - 증거 수가 많을수록 가산점
 * - 롤백 계획 존재 시 가산점
 * - FREEZE/HOLD 유형은 안전성 가산점
 */
function selectBestOption(options: ExecutiveDecision[]): number {
  if (options.length === 0) return -1;

  let bestIndex = 0;
  let bestScore = -Infinity;

  options.forEach((option, index) => {
    let score = 0;

    // 증거 수에 따른 점수
    score += option.evidence.length * 10;

    // 롤백 계획 존재 여부
    if (option.rollbackPlan && option.rollbackPlan.length > 0) {
      score += 15;
    }

    // 안전 지향 옵션 보너스
    if (option.decisionType === 'HOLD_FOR_SAFETY' || option.decisionType === 'FREEZE_AND_STABILIZE') {
      score += 5;
    }

    // 승인자가 적을수록 실행 속도 보너스
    score -= option.approvers.length * 2;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

/** 저장된 모든 의사결정 패키지 조회 */
export function getDecisionPackages(): DecisionPackage[] {
  return [...decisionPackageStore];
}

/** 특정 의사결정 패키지에 결정 기록 */
export function recordDecision(
  decisionId: string,
  decidedBy: string,
  selectedOption: number
): DecisionPackage | null {
  const pkg = decisionPackageStore.find((p) => p.decisionId === decisionId);
  if (!pkg) return null;
  if (selectedOption < 0 || selectedOption >= pkg.options.length) return null;

  pkg.decidedAt = new Date();
  pkg.decidedBy = decidedBy;
  pkg.options[selectedOption].status = 'APPROVED';

  // 선택되지 않은 옵션은 DEFERRED 처리
  pkg.options.forEach((opt, idx) => {
    if (idx !== selectedOption && opt.status === 'PENDING') {
      opt.status = 'DEFERRED';
    }
  });

  return { ...pkg };
}
