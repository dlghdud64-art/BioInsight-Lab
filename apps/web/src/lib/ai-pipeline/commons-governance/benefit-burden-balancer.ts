/**
 * 편익-부담 균형기
 *
 * 참여자별 편익 획득과 부담 외부화 간의 균형을 추적·강제한다.
 * 불균형 비율 > 3:1 → 접근 제한, > 5:1 → 균형 회복 시까지 차단.
 */

/** 편익 획득 기록 */
export interface BenefitCapture {
  /** 참여자 ID */
  participantId: string;
  /** 자동화 편익 점수 */
  automationBenefitScore: number;
  /** 비용 회피 점수 */
  costAvoidanceScore: number;
  /** 기간 (ISO 날짜 범위) */
  period: string;
}

/** 부담 외부화 기록 */
export interface BurdenExternalized {
  /** 참여자 ID */
  participantId: string;
  /** 검토 부담 전가 점수 */
  reviewBurdenPushed: number;
  /** 사고 비용 전가 점수 */
  incidentCostPushed: number;
  /** 기간 */
  period: string;
}

/** 불균형 조치 */
export type ImbalanceAction =
  | 'NONE'
  | 'WARNING'
  | 'THROTTLE_ACCESS'
  | 'IMPOSE_OBLIGATION'
  | 'BLOCK_UNTIL_BALANCED';

/** 균형 결과 */
export interface BalanceResult {
  /** 참여자 ID */
  participantId: string;
  /** 편익 점수 합계 */
  benefitScore: number;
  /** 부담 점수 합계 */
  burdenScore: number;
  /** 불균형 비율 (편익/부담) */
  imbalance: number;
  /** 조치 */
  action: ImbalanceAction;
  /** 평가 시점 */
  evaluatedAt: string;
}

/** 균형 이력 항목 */
export interface BalanceHistoryEntry {
  result: BalanceResult;
  benefits: BenefitCapture[];
  burdens: BurdenExternalized[];
  timestamp: string;
}

// ─── 인메모리 저장소 ───

const benefitStore: BenefitCapture[] = [];
const burdenStore: BurdenExternalized[] = [];
const balanceHistory: BalanceHistoryEntry[] = [];

/**
 * 편익-부담 균형을 계산한다.
 * @param participantId 참여자 ID
 * @param benefits 편익 획득 기록 배열
 * @param burdens 부담 외부화 기록 배열
 * @returns 균형 결과
 */
export function computeBalance(
  participantId: string,
  benefits: BenefitCapture[],
  burdens: BurdenExternalized[]
): BalanceResult {
  benefitStore.push(...benefits);
  burdenStore.push(...burdens);

  const benefitScore = benefits.reduce(
    (sum, b) => sum + b.automationBenefitScore + b.costAvoidanceScore,
    0
  );
  const burdenScore = burdens.reduce(
    (sum, b) => sum + b.reviewBurdenPushed + b.incidentCostPushed,
    0
  );

  const imbalance = burdenScore > 0 ? benefitScore / burdenScore : benefitScore > 0 ? Infinity : 1;
  const action = determineAction(imbalance);

  const result: BalanceResult = {
    participantId,
    benefitScore,
    burdenScore,
    imbalance,
    action,
    evaluatedAt: new Date().toISOString(),
  };

  balanceHistory.push({
    result: { ...result },
    benefits: [...benefits],
    burdens: [...burdens],
    timestamp: new Date().toISOString(),
  });

  return result;
}

/**
 * 불균형을 감지한다.
 * @param participantId 참여자 ID
 * @returns 불균형이 존재하면 해당 BalanceResult, 없으면 null
 */
export function detectImbalance(participantId: string): BalanceResult | null {
  const participantBenefits = benefitStore.filter(
    (b) => b.participantId === participantId
  );
  const participantBurdens = burdenStore.filter(
    (b) => b.participantId === participantId
  );

  if (participantBenefits.length === 0 && participantBurdens.length === 0) {
    return null;
  }

  const result = computeBalance(participantId, participantBenefits, participantBurdens);
  return result.action !== 'NONE' ? result : null;
}

/**
 * 균형을 강제한다.
 * 불균형 비율에 따라 적절한 조치를 반환한다.
 * @param participantId 참여자 ID
 * @returns 강제 조치가 포함된 균형 결과
 */
export function enforceBalance(participantId: string): BalanceResult {
  const participantBenefits = benefitStore.filter(
    (b) => b.participantId === participantId
  );
  const participantBurdens = burdenStore.filter(
    (b) => b.participantId === participantId
  );

  return computeBalance(participantId, participantBenefits, participantBurdens);
}

/**
 * 균형 이력을 반환한다.
 * @param participantId 선택적 참여자 ID 필터
 * @returns 균형 이력 배열
 */
export function getBalanceHistory(
  participantId?: string
): ReadonlyArray<BalanceHistoryEntry> {
  if (participantId) {
    return balanceHistory.filter(
      (e) => e.result.participantId === participantId
    );
  }
  return [...balanceHistory];
}

// ─── 내부 헬퍼 ───

/**
 * 불균형 비율에 따른 조치를 결정한다.
 * > 5:1 → BLOCK_UNTIL_BALANCED
 * > 3:1 → THROTTLE_ACCESS
 * > 2:1 → IMPOSE_OBLIGATION
 * > 1.5:1 → WARNING
 */
function determineAction(imbalance: number): ImbalanceAction {
  if (imbalance >= 5) return 'BLOCK_UNTIL_BALANCED';
  if (imbalance >= 3) return 'THROTTLE_ACCESS';
  if (imbalance >= 2) return 'IMPOSE_OBLIGATION';
  if (imbalance >= 1.5) return 'WARNING';
  return 'NONE';
}
