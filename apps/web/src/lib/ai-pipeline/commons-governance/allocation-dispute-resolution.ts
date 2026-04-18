/**
 * 배분 분쟁 해결
 *
 * 자원 독점, 불공정 배분, 부담 외부화, 공익 우선 우회 등
 * 배분 관련 분쟁을 접수·조사·중재·판결·집행하는 전체 라이프사이클을 관리한다.
 */

/** 분쟁 범주 */
export type DisputeCategory =
  | 'RESOURCE_MONOPOLY'
  | 'UNFAIR_ALLOCATION'
  | 'BURDEN_EXTERNALIZATION'
  | 'CIVIC_PRIORITY_BYPASS';

/** 분쟁 단계 */
export type DisputePhase =
  | 'FILED'
  | 'INVESTIGATION'
  | 'MEDIATION'
  | 'RULING'
  | 'ENFORCEMENT';

/** 판결 결과 */
export type RulingOutcome =
  | 'COMPLAINANT_UPHELD'
  | 'RESPONDENT_UPHELD'
  | 'PARTIAL_REMEDY'
  | 'DISMISSED';

/** 배분 분쟁 */
export interface AllocationDispute {
  /** 분쟁 ID */
  id: string;
  /** 분쟁 범주 */
  category: DisputeCategory;
  /** 제소자 ID */
  complainantId: string;
  /** 피제소자 ID */
  respondentId: string;
  /** 분쟁 단계 */
  phase: DisputePhase;
  /** 증거 목록 */
  evidence: string[];
  /** 판결 (판결 단계 이후) */
  ruling: RulingOutcome | null;
  /** 판결 사유 */
  rulingReason: string | null;
  /** 접수 시점 */
  filedAt: string;
  /** 해결 시점 */
  resolvedAt: string | null;
}

// ─── 인메모리 저장소 ───

const disputeStore: AllocationDispute[] = [];
let nextDisputeId = 1;

/**
 * 분쟁을 접수한다.
 * @param category 분쟁 범주
 * @param complainantId 제소자 ID
 * @param respondentId 피제소자 ID
 * @param evidence 증거 목록
 * @returns 접수된 분쟁
 */
export function fileDispute(
  category: DisputeCategory,
  complainantId: string,
  respondentId: string,
  evidence: string[]
): AllocationDispute {
  const dispute: AllocationDispute = {
    id: `DSP-${String(nextDisputeId++).padStart(6, '0')}`,
    category,
    complainantId,
    respondentId,
    phase: 'FILED',
    evidence: [...evidence],
    ruling: null,
    rulingReason: null,
    filedAt: new Date().toISOString(),
    resolvedAt: null,
  };

  disputeStore.push(dispute);
  return { ...dispute };
}

/**
 * 분쟁을 조사 단계로 전환한다.
 * @param disputeId 분쟁 ID
 * @param additionalEvidence 추가 증거
 * @returns 업데이트된 분쟁, 없으면 null
 */
export function investigateDispute(
  disputeId: string,
  additionalEvidence: string[] = []
): AllocationDispute | null {
  const dispute = disputeStore.find((d) => d.id === disputeId);
  if (!dispute) return null;
  if (dispute.phase !== 'FILED' && dispute.phase !== 'INVESTIGATION') return null;

  dispute.phase = 'INVESTIGATION';
  dispute.evidence.push(...additionalEvidence);
  return { ...dispute };
}

/**
 * 판결을 내린다.
 * @param disputeId 분쟁 ID
 * @param ruling 판결 결과
 * @param reason 판결 사유
 * @returns 업데이트된 분쟁, 없으면 null
 */
export function issueRuling(
  disputeId: string,
  ruling: RulingOutcome,
  reason: string
): AllocationDispute | null {
  const dispute = disputeStore.find((d) => d.id === disputeId);
  if (!dispute) return null;

  dispute.phase = 'RULING';
  dispute.ruling = ruling;
  dispute.rulingReason = reason;
  return { ...dispute };
}

/**
 * 판결을 집행한다.
 * @param disputeId 분쟁 ID
 * @returns 집행 완료된 분쟁, 없으면 null
 */
export function enforceRuling(disputeId: string): AllocationDispute | null {
  const dispute = disputeStore.find((d) => d.id === disputeId);
  if (!dispute) return null;
  if (dispute.phase !== 'RULING' || dispute.ruling === null) return null;

  dispute.phase = 'ENFORCEMENT';
  dispute.resolvedAt = new Date().toISOString();
  return { ...dispute };
}

/**
 * 분쟁 이력을 반환한다.
 * @param participantId 선택적 참여자 ID 필터 (제소자 또는 피제소자)
 * @returns 분쟁 이력 배열
 */
export function getDisputeHistory(
  participantId?: string
): ReadonlyArray<AllocationDispute> {
  if (participantId) {
    return disputeStore
      .filter(
        (d) =>
          d.complainantId === participantId ||
          d.respondentId === participantId
      )
      .map((d) => ({ ...d }));
  }
  return disputeStore.map((d) => ({ ...d }));
}
