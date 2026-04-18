/**
 * @module federated-decision-council
 * @description 연합 의사결정 위원회
 *
 * 연합 수준의 정책 변경, 위기 조율, 멤버십 조치, 헌법 수정 등
 * 주요 결정을 합의 기반으로 처리한다.
 * CRITICAL: 반대 의견(dissent) 기록은 영구적이며 불변이다.
 */

/** 결정 카테고리 */
export type DecisionCategory =
  | 'POLICY_CHANGE'
  | 'CRISIS_COORDINATION'
  | 'MEMBERSHIP_ACTION'
  | 'COMMONS_GOVERNANCE'
  | 'CONSTITUTIONAL_AMENDMENT';

/** 투표 유형 */
export type VoteType = 'APPROVE' | 'REJECT' | 'ABSTAIN';

/** 결정 상태 */
export type DecisionStatus = 'OPEN' | 'FINALIZED';

/** 투표 기록 */
export interface VoteRecord {
  /** 투표자 기관 ID */
  voterId: string;
  /** 투표 유형 */
  vote: VoteType;
  /** 투표 일시 */
  votedAt: Date;
}

/** 반대 의견 기록 — 영구적이며 삭제 불가 */
export interface DissentRecord {
  /** 반대 투표자 기관 ID */
  voterId: string;
  /** 반대 사유 */
  reason: string;
  /** 대안 제안 */
  alternativeProposal: string;
  /** 기록 일시 */
  recordedAt: Date;
}

/** 의사결정 결과 */
export type DecisionOutcome = 'APPROVED' | 'REJECTED' | 'NO_QUORUM';

/** 위원회 결정 */
export interface CouncilDecision {
  /** 결정 고유 ID */
  id: string;
  /** 결정 카테고리 */
  category: DecisionCategory;
  /** 제안 내용 */
  proposal: string;
  /** 투표 기록 */
  votes: VoteRecord[];
  /** 반대 의견 기록 — 불변 */
  dissentRecords: DissentRecord[];
  /** 결정 결과 (미결정 시 null) */
  outcome: DecisionOutcome | null;
  /** 결정 상태 */
  status: DecisionStatus;
  /** 결정 확정 일시 */
  decidedAt: Date | null;
  /** 발효 일시 */
  effectiveAt: Date | null;
  /** 제안 일시 */
  proposedAt: Date;
  /** 제안자 기관 ID */
  proposerId: string;
}

// ── 인메모리 저장소 ──
const decisions: CouncilDecision[] = [];

/**
 * 새로운 결정 안건을 제안한다.
 *
 * @param params 제안 파라미터
 * @returns 생성된 안건
 */
export function proposeDecision(params: {
  id: string;
  category: DecisionCategory;
  proposal: string;
  proposerId: string;
  effectiveAt?: Date;
}): CouncilDecision {
  const existing = decisions.find((d) => d.id === params.id);
  if (existing) {
    throw new Error(`이미 존재하는 안건 ID: ${params.id}`);
  }

  const decision: CouncilDecision = {
    id: params.id,
    category: params.category,
    proposal: params.proposal,
    votes: [],
    dissentRecords: [],
    outcome: null,
    status: 'OPEN',
    decidedAt: null,
    effectiveAt: params.effectiveAt ?? null,
    proposedAt: new Date(),
    proposerId: params.proposerId,
  };

  decisions.push(decision);
  return cloneDecision(decision);
}

/**
 * 투표를 행사한다.
 *
 * @param decisionId 안건 ID
 * @param voterId 투표자 기관 ID
 * @param vote 투표 유형
 */
export function castVote(
  decisionId: string,
  voterId: string,
  vote: VoteType,
): CouncilDecision {
  const decision = decisions.find((d) => d.id === decisionId);
  if (!decision) {
    throw new Error(`존재하지 않는 안건: ${decisionId}`);
  }
  if (decision.status === 'FINALIZED') {
    throw new Error(`이미 확정된 안건: ${decisionId}`);
  }

  // 중복 투표 방지
  const existingVote = decision.votes.find((v) => v.voterId === voterId);
  if (existingVote) {
    throw new Error(`기관 ${voterId}은(는) 이미 투표함`);
  }

  decision.votes.push({
    voterId,
    vote,
    votedAt: new Date(),
  });

  return cloneDecision(decision);
}

/**
 * 반대 의견을 기록한다.
 * CRITICAL: 반대 의견은 영구적이며 불변이다. 한번 기록되면 삭제 또는 수정 불가.
 *
 * @param decisionId 안건 ID
 * @param dissent 반대 의견
 */
export function recordDissent(
  decisionId: string,
  dissent: Omit<DissentRecord, 'recordedAt'>,
): CouncilDecision {
  const decision = decisions.find((d) => d.id === decisionId);
  if (!decision) {
    throw new Error(`존재하지 않는 안건: ${decisionId}`);
  }

  // 반대 의견은 확정 후에도 기록 가능 (역사적 기록)
  decision.dissentRecords.push({
    ...dissent,
    recordedAt: new Date(),
  });

  return cloneDecision(decision);
}

/**
 * 안건을 확정한다. 투표 결과를 집계하여 결과를 결정한다.
 *
 * @param decisionId 안건 ID
 * @param quorumSize 의결 정족수
 * @returns 확정된 안건
 */
export function finalizeDecision(
  decisionId: string,
  quorumSize: number,
): CouncilDecision {
  const decision = decisions.find((d) => d.id === decisionId);
  if (!decision) {
    throw new Error(`존재하지 않는 안건: ${decisionId}`);
  }
  if (decision.status === 'FINALIZED') {
    throw new Error(`이미 확정된 안건: ${decisionId}`);
  }

  const approves = decision.votes.filter((v) => v.vote === 'APPROVE').length;
  const rejects = decision.votes.filter((v) => v.vote === 'REJECT').length;
  const totalVotes = decision.votes.length;

  if (totalVotes < quorumSize) {
    decision.outcome = 'NO_QUORUM';
  } else if (approves > rejects) {
    decision.outcome = 'APPROVED';
  } else {
    decision.outcome = 'REJECTED';
  }

  decision.status = 'FINALIZED';
  decision.decidedAt = new Date();

  return cloneDecision(decision);
}

/**
 * 미결 안건 목록을 반환한다.
 */
export function getPendingDecisions(): CouncilDecision[] {
  return decisions
    .filter((d) => d.status === 'OPEN')
    .map(cloneDecision);
}

/**
 * 전체 결정 이력을 반환한다.
 */
export function getDecisionHistory(): CouncilDecision[] {
  return decisions.map(cloneDecision);
}

/** 결정 객체 깊은 복사 */
function cloneDecision(d: CouncilDecision): CouncilDecision {
  return {
    ...d,
    votes: d.votes.map((v) => ({ ...v })),
    dissentRecords: d.dissentRecords.map((r) => ({ ...r })),
  };
}
