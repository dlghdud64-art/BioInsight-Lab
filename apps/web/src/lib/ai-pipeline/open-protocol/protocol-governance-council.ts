/**
 * @module protocol-governance-council
 * @description 프로토콜 거버넌스 위원회
 *
 * 프로토콜 수정안(Amendment)의 제안, 투표, 비준을 관리한다.
 * 파괴적 변경(BREAKING_CHANGE)은 높은 투표 문턱을, 보안 패치는 신속 처리를 적용한다.
 */

/** 수정안 유형 */
export type AmendmentType =
  | "BREAKING_CHANGE"
  | "ADDITIVE"
  | "DEPRECATION"
  | "SECURITY_PATCH";

/** 수정안 상태 */
export type AmendmentStatus =
  | "PROPOSED"
  | "VOTING"
  | "RATIFIED"
  | "REJECTED"
  | "WITHDRAWN";

/** 투표 */
export interface Vote {
  /** 투표자 ID */
  voterId: string;
  /** 찬성 여부 */
  approve: boolean;
  /** 투표 시각 */
  votedAt: number;
  /** 투표 사유 */
  rationale: string;
}

/** 수정안 */
export interface Amendment {
  /** 수정안 고유 식별자 */
  id: string;
  /** 수정안 유형 */
  type: AmendmentType;
  /** 제안 내용 */
  proposal: string;
  /** 제안자 ID */
  proposedBy: string;
  /** 투표 목록 */
  votes: Vote[];
  /** 현재 상태 */
  status: AmendmentStatus;
  /** 제안 시각 */
  proposedAt: number;
  /** 결정 시각 */
  decidedAt: number | null;
}

/** 유형별 비준 문턱 (찬성 비율) */
const RATIFICATION_THRESHOLD: Record<AmendmentType, number> = {
  BREAKING_CHANGE: 0.75,
  ADDITIVE: 0.5,
  DEPRECATION: 0.6,
  SECURITY_PATCH: 0.33,
};

/** 최소 투표 수 */
const MIN_VOTES = 3;

// --- 인메모리 저장소 ---
const amendmentStore: Amendment[] = [];

/**
 * 수정안을 제안한다.
 * @param type - 수정안 유형
 * @param proposal - 제안 내용
 * @param proposedBy - 제안자 ID
 * @returns 생성된 수정안
 */
export function proposeAmendment(
  type: AmendmentType,
  proposal: string,
  proposedBy: string
): Amendment {
  const amendment: Amendment = {
    id: `amd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    proposal,
    proposedBy,
    votes: [],
    status: "PROPOSED",
    proposedAt: Date.now(),
    decidedAt: null,
  };
  amendmentStore.push(amendment);
  return amendment;
}

/**
 * 수정안에 투표한다.
 * @param amendmentId - 수정안 ID
 * @param voterId - 투표자 ID
 * @param approve - 찬성 여부
 * @param rationale - 투표 사유
 * @returns 업데이트된 수정안 또는 null
 */
export function voteOnAmendment(
  amendmentId: string,
  voterId: string,
  approve: boolean,
  rationale: string
): Amendment | null {
  const amendment = amendmentStore.find((a) => a.id === amendmentId);
  if (!amendment) return null;
  if (amendment.status !== "PROPOSED" && amendment.status !== "VOTING") return null;

  // 중복 투표 방지
  if (amendment.votes.some((v) => v.voterId === voterId)) return null;

  amendment.votes.push({
    voterId,
    approve,
    votedAt: Date.now(),
    rationale,
  });
  amendment.status = "VOTING";

  return amendment;
}

/**
 * 수정안의 비준 가능 여부를 평가하고, 조건 충족 시 비준한다.
 * @param amendmentId - 수정안 ID
 * @returns 비준된 수정안 또는 null (조건 미충족)
 */
export function ratifyAmendment(amendmentId: string): Amendment | null {
  const amendment = amendmentStore.find((a) => a.id === amendmentId);
  if (!amendment) return null;
  if (amendment.status !== "VOTING") return null;
  if (amendment.votes.length < MIN_VOTES) return null;

  const threshold = RATIFICATION_THRESHOLD[amendment.type];
  const approvals = amendment.votes.filter((v) => v.approve).length;
  const approvalRate = approvals / amendment.votes.length;

  if (approvalRate >= threshold) {
    amendment.status = "RATIFIED";
    amendment.decidedAt = Date.now();
    return amendment;
  } else {
    amendment.status = "REJECTED";
    amendment.decidedAt = Date.now();
    return amendment;
  }
}

/**
 * 수정안 이력을 반환한다.
 * @param statusFilter - 선택적 상태 필터
 * @returns 수정안 배열
 */
export function getAmendmentHistory(statusFilter?: AmendmentStatus): Amendment[] {
  if (statusFilter) {
    return amendmentStore.filter((a) => a.status === statusFilter);
  }
  return [...amendmentStore];
}
