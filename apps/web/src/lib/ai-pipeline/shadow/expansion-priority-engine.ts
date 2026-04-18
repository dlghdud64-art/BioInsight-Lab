/**
 * Strategic Command Layer (Phase P) — 데이터 기반 확장 대상 우선순위 엔진
 * 확장 후보를 준비도 점수와 무사고 기간으로 랭킹하고,
 * 리뷰 백로그 압력에 따라 페널티를 적용한다.
 */

/** 확장 후보 인터페이스 */
export interface ExpansionCandidate {
  tenantId: string;
  documentType: string;
  /** 0~1 사이의 준비도 점수 */
  readinessScore: number;
  /** 사고 없이 경과한 일수 */
  incidentFreeWindowDays: number;
  /** 0~1 사이의 리뷰 백로그 압력 (높을수록 불리) */
  reviewBacklogPressure: number;
  /** 처리 문서량 */
  volume: number;
  /** 계산된 우선순위 점수 (출력용) */
  priority: number;
}

/**
 * 확장 후보를 우선순위로 정렬한다.
 *
 * 우선순위 산정 공식:
 *   priority = readinessScore * incidentFreeWindowDays * (1 - backlogPenalty)
 *
 * - readinessScore: 높을수록 확장 준비 완료
 * - incidentFreeWindowDays: 무사고 기간이 길수록 안정성 입증
 * - reviewBacklogPressure: 높을수록 페널티 적용 (현재 리소스 부담)
 *
 * 순수 함수, DB 의존성 없음.
 */
export function rankExpansionCandidates(
  candidates: ExpansionCandidate[]
): ExpansionCandidate[] {
  // 백로그 압력 페널티 계수 (0~0.8 범위로 제한, 완전 제거 방지)
  const MAX_BACKLOG_PENALTY = 0.8;

  const scored = candidates.map((candidate) => {
    const backlogPenalty = Math.min(candidate.reviewBacklogPressure, MAX_BACKLOG_PENALTY);
    const priority =
      candidate.readinessScore *
      candidate.incidentFreeWindowDays *
      (1 - backlogPenalty);

    return {
      ...candidate,
      priority: Math.round(priority * 1000) / 1000, // 소수점 3자리 반올림
    };
  });

  // 우선순위 내림차순 정렬
  return scored.sort((a, b) => b.priority - a.priority);
}
