/**
 * 기여 의무 레지스트리
 *
 * 참여자에게 권리에 상응하는 의무를 등록·추적하고,
 * 의무를 이행하지 않은 참여자를 체계적으로 퇴출한다.
 * 권리만 있고 이행된 의무가 없는 참여자 → 체계적 퇴출 대상.
 */

/** 의무 유형 */
export type ObligationType =
  | 'CONTROL_HARDENING'
  | 'AUDIT_PRESERVATION'
  | 'GOVERNANCE_PARTICIPATION'
  | 'REMEDIATION_DUTY'
  | 'KNOWLEDGE_SHARING';

/** 의무 */
export interface Obligation {
  /** 의무 ID */
  id: string;
  /** 참여자 ID */
  participantId: string;
  /** 의무 유형 */
  type: ObligationType;
  /** 의무 설명 */
  description: string;
  /** 이행 기한 */
  dueDate: string;
  /** 이행 완료 여부 */
  fulfilled: boolean;
  /** 검증 시점 */
  verifiedAt: string | null;
  /** 등록 시점 */
  registeredAt: string;
}

/** 퇴출 결과 */
export interface EvictionResult {
  /** 퇴출 대상 참여자 ID */
  participantId: string;
  /** 미이행 의무 수 */
  outstandingCount: number;
  /** 퇴출 사유 */
  reason: string;
  /** 퇴출 시점 */
  evictedAt: string;
}

// ─── 인메모리 저장소 ───

const obligationStore: Obligation[] = [];
const evictionHistory: EvictionResult[] = [];
let nextObligationId = 1;

/**
 * 새로운 의무를 등록한다.
 * @param participantId 참여자 ID
 * @param type 의무 유형
 * @param description 의무 설명
 * @param dueDate 이행 기한 (ISO 문자열)
 * @returns 등록된 의무
 */
export function registerObligation(
  participantId: string,
  type: ObligationType,
  description: string,
  dueDate: string
): Obligation {
  const obligation: Obligation = {
    id: `OBL-${String(nextObligationId++).padStart(6, '0')}`,
    participantId,
    type,
    description,
    dueDate,
    fulfilled: false,
    verifiedAt: null,
    registeredAt: new Date().toISOString(),
  };

  obligationStore.push(obligation);
  return { ...obligation };
}

/**
 * 의무를 이행 완료로 표시한다.
 * @param obligationId 의무 ID
 * @returns 업데이트된 의무, 없으면 null
 */
export function fulfillObligation(obligationId: string): Obligation | null {
  const obligation = obligationStore.find((o) => o.id === obligationId);
  if (!obligation) return null;

  obligation.fulfilled = true;
  obligation.verifiedAt = new Date().toISOString();
  return { ...obligation };
}

/**
 * 참여자의 미이행 의무 목록을 반환한다.
 * @param participantId 참여자 ID
 * @returns 미이행 의무 배열
 */
export function getOutstandingObligations(
  participantId: string
): ReadonlyArray<Obligation> {
  return obligationStore.filter(
    (o) => o.participantId === participantId && !o.fulfilled
  );
}

/**
 * 미이행 의무가 있는 참여자를 체계적으로 퇴출한다.
 * 권리만 있고 이행된 의무가 없는 참여자를 대상으로 한다.
 * @param participantId 참여자 ID
 * @returns 퇴출 결과, 퇴출 불필요 시 null
 */
export function evictNonCompliant(
  participantId: string
): EvictionResult | null {
  const allObligations = obligationStore.filter(
    (o) => o.participantId === participantId
  );

  if (allObligations.length === 0) return null;

  const outstanding = allObligations.filter((o) => !o.fulfilled);
  const fulfilled = allObligations.filter((o) => o.fulfilled);

  // 이행된 의무가 하나도 없으면 퇴출
  if (fulfilled.length === 0 && outstanding.length > 0) {
    const result: EvictionResult = {
      participantId,
      outstandingCount: outstanding.length,
      reason: `권리만 보유하고 이행된 의무가 없음 (미이행 ${outstanding.length}건)`,
      evictedAt: new Date().toISOString(),
    };
    evictionHistory.push(result);
    return { ...result };
  }

  // 기한 초과 미이행 의무가 있는 경우
  const now = new Date();
  const overdue = outstanding.filter((o) => new Date(o.dueDate) < now);
  if (overdue.length > 0) {
    const result: EvictionResult = {
      participantId,
      outstandingCount: overdue.length,
      reason: `기한 초과 미이행 의무 ${overdue.length}건 존재`,
      evictedAt: new Date().toISOString(),
    };
    evictionHistory.push(result);
    return { ...result };
  }

  return null;
}
