/**
 * 계승 의무 이전 (먹튀 방지)
 *
 * 기관이 커먼즈에서 탈퇴할 때 미이행 의무가 이전되지 않으면
 * 탈퇴를 하드 블록한다. 의무 없는 탈퇴(먹튀)를 원천 차단한다.
 */

/** 탈퇴 차단 사유 */
export type WithdrawalBlockReason =
  | 'UNRESOLVED_REMEDIATION'
  | 'OUTSTANDING_AUDIT_DUTY'
  | 'ACTIVE_DISPUTE'
  | 'UNTRANSFERRED_OBLIGATIONS';

/** 의무 이전 항목 */
export interface ObligationTransferItem {
  /** 의무 ID */
  obligationId: string;
  /** 의무 설명 */
  description: string;
  /** 이전 대상 기관 ID (null이면 미지정) */
  transferToId: string | null;
  /** 이전 완료 여부 */
  transferred: boolean;
}

/** 탈퇴 요청 */
export interface WithdrawalRequest {
  /** 기관 ID */
  institutionId: string;
  /** 요청 시점 */
  requestedAt: string;
  /** 미이행 의무 목록 */
  outstandingObligations: ObligationTransferItem[];
  /** 이전 계획 설명 */
  transferPlan: string;
  /** 승인 여부 */
  approved: boolean;
  /** 차단 사유 (차단 시) */
  blockReasons: WithdrawalBlockReason[];
  /** 처리 시점 */
  processedAt: string | null;
}

// ─── 인메모리 저장소 ───

const withdrawalRequests: WithdrawalRequest[] = [];

/**
 * 탈퇴를 요청한다.
 * @param institutionId 기관 ID
 * @param outstandingObligations 미이행 의무 목록
 * @param transferPlan 이전 계획 설명
 * @returns 생성된 탈퇴 요청
 */
export function requestWithdrawal(
  institutionId: string,
  outstandingObligations: ObligationTransferItem[],
  transferPlan: string
): WithdrawalRequest {
  const request: WithdrawalRequest = {
    institutionId,
    requestedAt: new Date().toISOString(),
    outstandingObligations: outstandingObligations.map((o) => ({ ...o })),
    transferPlan,
    approved: false,
    blockReasons: [],
    processedAt: null,
  };

  withdrawalRequests.push(request);
  return { ...request };
}

/**
 * 탈퇴 요청을 검증한다.
 * 미이행 의무가 모두 이전되지 않으면 차단 사유를 반환한다.
 * @param institutionId 기관 ID
 * @returns 차단 사유 배열 (빈 배열이면 검증 통과)
 */
export function validateWithdrawal(
  institutionId: string
): WithdrawalBlockReason[] {
  const request = withdrawalRequests.find(
    (r) => r.institutionId === institutionId && r.processedAt === null
  );

  if (!request) return [];

  const blockReasons: WithdrawalBlockReason[] = [];

  // 미이전 의무 확인
  const untransferred = request.outstandingObligations.filter(
    (o) => !o.transferred
  );
  if (untransferred.length > 0) {
    blockReasons.push('UNTRANSFERRED_OBLIGATIONS');
  }

  // 이전 대상 미지정 의무 확인 (시정 의무)
  const noTarget = request.outstandingObligations.filter(
    (o) => o.transferToId === null && !o.transferred
  );
  if (noTarget.some((o) => o.description.includes('시정'))) {
    blockReasons.push('UNRESOLVED_REMEDIATION');
  }
  if (noTarget.some((o) => o.description.includes('감사'))) {
    blockReasons.push('OUTSTANDING_AUDIT_DUTY');
  }

  return blockReasons;
}

/**
 * 의무를 이전한다.
 * @param institutionId 탈퇴 기관 ID
 * @param obligationId 의무 ID
 * @param transferToId 이전 대상 기관 ID
 * @returns 이전 성공 여부
 */
export function transferObligations(
  institutionId: string,
  obligationId: string,
  transferToId: string
): boolean {
  const request = withdrawalRequests.find(
    (r) => r.institutionId === institutionId && r.processedAt === null
  );

  if (!request) return false;

  const obligation = request.outstandingObligations.find(
    (o) => o.obligationId === obligationId
  );

  if (!obligation) return false;

  obligation.transferToId = transferToId;
  obligation.transferred = true;
  return true;
}

/**
 * 탈퇴를 승인한다.
 * 모든 의무가 이전된 경우에만 승인 가능하다.
 * @param institutionId 기관 ID
 * @returns 승인된 탈퇴 요청, 차단 시 차단 사유 포함
 */
export function approveWithdrawal(institutionId: string): WithdrawalRequest | null {
  const request = withdrawalRequests.find(
    (r) => r.institutionId === institutionId && r.processedAt === null
  );

  if (!request) return null;

  const blockReasons = validateWithdrawal(institutionId);
  if (blockReasons.length > 0) {
    request.blockReasons = blockReasons;
    return { ...request };
  }

  request.approved = true;
  request.processedAt = new Date().toISOString();
  return { ...request };
}

/**
 * 탈퇴를 차단한다.
 * 미이행 의무가 존재하면 하드 블록한다.
 * @param institutionId 기관 ID
 * @param reasons 차단 사유
 * @returns 차단된 탈퇴 요청
 */
export function blockWithdrawal(
  institutionId: string,
  reasons: WithdrawalBlockReason[]
): WithdrawalRequest | null {
  const request = withdrawalRequests.find(
    (r) => r.institutionId === institutionId && r.processedAt === null
  );

  if (!request) return null;

  request.approved = false;
  request.blockReasons = [...reasons];
  request.processedAt = new Date().toISOString();
  return { ...request };
}
