/**
 * 공익 배분 엔진
 *
 * 시장 논리(트래픽, 결제)를 완전히 배제하고,
 * 안전 중요도·취약 인구 봉사·커먼즈 기여도·준수 이력만으로
 * 자원 배분 결정을 내린다.
 */

/** 배분 결정 */
export type AllocationDecision =
  | 'PRIORITIZE_WITH_RESTRICTIONS'
  | 'NORMAL_ACCESS'
  | 'REQUIRE_ADDITIONAL_OBLIGATION'
  | 'THROTTLE'
  | 'BLOCK';

/** 배분 입력 */
export interface AllocationInput {
  /** 참여자 ID */
  participantId: string;
  /** 안전 중요도 (0~1) */
  safetyCriticality: number;
  /** 취약 인구 봉사 여부 */
  vulnerablePopulationServed: boolean;
  /** 커먼즈 기여 점수 (0~1) */
  commonsContributionScore: number;
  /** 준수 이력 점수 (0~1, 1이 완벽 준수) */
  complianceHistory: number;
}

/** 의무 사항 */
export interface AllocationObligation {
  /** 의무 유형 */
  type: string;
  /** 의무 설명 */
  description: string;
}

/** 배분 결과 */
export interface AllocationResult {
  /** 배분 결정 */
  decision: AllocationDecision;
  /** 결정 사유 */
  reason: string;
  /** 부과된 의무 목록 */
  obligations: AllocationObligation[];
  /** 우선순위 점수 (0~1) */
  priorityScore: number;
  /** 평가 시점 */
  evaluatedAt: string;
}

/** 배분 이력 항목 */
export interface AllocationHistoryEntry {
  input: AllocationInput;
  result: AllocationResult;
  timestamp: string;
}

// ─── 인메모리 저장소 ───

const allocationHistory: AllocationHistoryEntry[] = [];

/**
 * 배분을 계산한다.
 * 시장 논리(트래픽, 결제)를 완전히 배제하고 공익 기준으로만 판단한다.
 * @param input 배분 입력
 * @returns 배분 결과
 */
export function computeAllocation(input: AllocationInput): AllocationResult {
  const priorityScore = computePriorityScore(input);
  const decision = determineDecision(input, priorityScore);
  const obligations = determineObligations(input, decision);
  const reason = buildReason(input, decision);

  const result: AllocationResult = {
    decision,
    reason,
    obligations,
    priorityScore,
    evaluatedAt: new Date().toISOString(),
  };

  allocationHistory.push({
    input: { ...input },
    result: { ...result },
    timestamp: new Date().toISOString(),
  });

  return result;
}

/**
 * 시장 논리를 무력화한다.
 * 트래픽량, 결제 금액 등 시장 기반 지표를 배분 결정에서 명시적으로 제거한다.
 * @param marketMetrics 시장 지표 (무시됨)
 * @returns 시장 논리 무력화 확인 메시지
 */
export function overrideMarketLogic(marketMetrics: Record<string, unknown>): {
  overridden: true;
  excludedMetrics: string[];
  reason: string;
} {
  const excludedMetrics = Object.keys(marketMetrics);
  return {
    overridden: true,
    excludedMetrics,
    reason:
      '시장 논리(트래픽, 결제)는 공익 배분에서 완전히 배제됩니다. ' +
      '배분은 안전 중요도, 취약 인구 봉사, 커먼즈 기여도, 준수 이력으로만 결정됩니다.',
  };
}

/**
 * 배분 이력을 반환한다.
 * @param participantId 선택적 참여자 ID 필터
 * @returns 배분 이력 배열
 */
export function getAllocationHistory(
  participantId?: string
): ReadonlyArray<AllocationHistoryEntry> {
  if (participantId) {
    return allocationHistory.filter(
      (e) => e.input.participantId === participantId
    );
  }
  return [...allocationHistory];
}

// ─── 내부 헬퍼 ───

function computePriorityScore(input: AllocationInput): number {
  let score = 0;
  // 안전 중요도: 40% 가중
  score += input.safetyCriticality * 0.4;
  // 취약 인구 봉사: 25% 가중
  score += (input.vulnerablePopulationServed ? 1 : 0) * 0.25;
  // 커먼즈 기여도: 20% 가중
  score += input.commonsContributionScore * 0.2;
  // 준수 이력: 15% 가중
  score += input.complianceHistory * 0.15;

  return Math.min(1.0, Math.max(0, score));
}

function determineDecision(
  input: AllocationInput,
  priorityScore: number
): AllocationDecision {
  // 준수 이력이 매우 낮으면 차단
  if (input.complianceHistory < 0.2) {
    return 'BLOCK';
  }
  // 준수 이력이 낮으면 스로틀
  if (input.complianceHistory < 0.4) {
    return 'THROTTLE';
  }
  // 높은 우선순위 + 안전 중요도 높음 → 제한적 우선 배분
  if (priorityScore >= 0.7 && input.safetyCriticality >= 0.7) {
    return 'PRIORITIZE_WITH_RESTRICTIONS';
  }
  // 기여도 낮은 경우 추가 의무 부과
  if (input.commonsContributionScore < 0.3) {
    return 'REQUIRE_ADDITIONAL_OBLIGATION';
  }
  return 'NORMAL_ACCESS';
}

function determineObligations(
  input: AllocationInput,
  decision: AllocationDecision
): AllocationObligation[] {
  const obligations: AllocationObligation[] = [];

  if (
    decision === 'PRIORITIZE_WITH_RESTRICTIONS' ||
    decision === 'REQUIRE_ADDITIONAL_OBLIGATION'
  ) {
    if (input.commonsContributionScore < 0.5) {
      obligations.push({
        type: 'KNOWLEDGE_SHARING',
        description: '커먼즈 기여도 향상을 위해 지식 공유 의무가 부과됩니다.',
      });
    }
    if (input.safetyCriticality >= 0.8) {
      obligations.push({
        type: 'AUDIT_PRESERVATION',
        description: '높은 안전 중요도로 인해 감사 보존 의무가 부과됩니다.',
      });
    }
  }

  if (decision === 'THROTTLE') {
    obligations.push({
      type: 'REMEDIATION_DUTY',
      description: '낮은 준수 이력으로 인해 시정 의무가 부과됩니다.',
    });
  }

  return obligations;
}

function buildReason(
  input: AllocationInput,
  decision: AllocationDecision
): string {
  switch (decision) {
    case 'PRIORITIZE_WITH_RESTRICTIONS':
      return `참여자 ${input.participantId}: 높은 안전 중요도와 공익 기여로 제한적 우선 배분`;
    case 'NORMAL_ACCESS':
      return `참여자 ${input.participantId}: 표준 접근 허용`;
    case 'REQUIRE_ADDITIONAL_OBLIGATION':
      return `참여자 ${input.participantId}: 낮은 기여도로 인해 추가 의무 부과 후 접근 허용`;
    case 'THROTTLE':
      return `참여자 ${input.participantId}: 낮은 준수 이력으로 접근 제한`;
    case 'BLOCK':
      return `참여자 ${input.participantId}: 매우 낮은 준수 이력으로 접근 차단`;
  }
}
