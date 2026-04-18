/**
 * @module authority-transfer-protocol
 * @description 권한 이전 프로토콜 — 계획적 승계, 긴급 위임, 임시 대리, 영구 이전 등 권한 이전의 전 과정을 관리합니다.
 */

/** 이전 유형 */
export type TransferType =
  | 'PLANNED_SUCCESSION'
  | 'EMERGENCY_DELEGATION'
  | 'TEMPORARY_PROXY'
  | 'PERMANENT_TRANSFER';

/** 이전 상태 */
export type TransferStatus =
  | 'PROPOSED'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REVERTED';

/** 권한 이전 */
export interface AuthorityTransfer {
  /** 고유 식별자 */
  id: string;
  /** 이전 유형 */
  type: TransferType;
  /** 이전 원본 역할 */
  fromRole: string;
  /** 이전 대상 역할 */
  toRole: string;
  /** 이전 상태 */
  status: TransferStatus;
  /** 승인자 */
  approvedBy: string | null;
  /** 발효 일시 */
  effectiveAt: Date | null;
  /** 만료 일시 */
  expiresAt: Date | null;
  /** 이전 범위 */
  scope: string;
  /** 생성 일시 */
  createdAt: Date;
}

/** 인메모리 이전 저장소 */
const transferStore: AuthorityTransfer[] = [];

/**
 * 권한 이전을 제안합니다.
 * @param params - 이전 제안 정보
 * @returns 생성된 이전 레코드
 */
export function proposeTransfer(
  params: Pick<AuthorityTransfer, 'type' | 'fromRole' | 'toRole' | 'scope'> & {
    effectiveAt?: Date;
    expiresAt?: Date;
  }
): AuthorityTransfer {
  const transfer: AuthorityTransfer = {
    id: `at-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: params.type,
    fromRole: params.fromRole,
    toRole: params.toRole,
    status: 'PROPOSED',
    approvedBy: null,
    effectiveAt: params.effectiveAt ?? null,
    expiresAt: params.expiresAt ?? null,
    scope: params.scope,
    createdAt: new Date(),
  };
  transferStore.push(transfer);
  return { ...transfer };
}

/**
 * 권한 이전을 승인합니다.
 * @param transferId - 이전 ID
 * @param approver - 승인자
 * @returns 승인된 이전 레코드 또는 null
 */
export function approveTransfer(
  transferId: string,
  approver: string
): AuthorityTransfer | null {
  const transfer = transferStore.find(
    (t) => t.id === transferId && t.status === 'PROPOSED'
  );
  if (!transfer) return null;

  transfer.status = 'APPROVED';
  transfer.approvedBy = approver;
  return { ...transfer };
}

/**
 * 승인된 권한 이전을 실행합니다.
 * @param transferId - 이전 ID
 * @returns 실행 결과
 */
export function executeTransfer(
  transferId: string
): { success: boolean; transfer: AuthorityTransfer | null; reason: string } {
  const transfer = transferStore.find(
    (t) => t.id === transferId && t.status === 'APPROVED'
  );
  if (!transfer) {
    return {
      success: false,
      transfer: null,
      reason: '승인된 이전 건을 찾을 수 없습니다.',
    };
  }

  transfer.status = 'IN_PROGRESS';
  transfer.effectiveAt = transfer.effectiveAt ?? new Date();

  // 즉시 완료 처리 (실제 시스템에서는 비동기 프로세스)
  transfer.status = 'COMPLETED';

  return {
    success: true,
    transfer: { ...transfer },
    reason: '권한 이전이 성공적으로 완료되었습니다.',
  };
}

/**
 * 완료된 권한 이전을 되돌립니다.
 * @param transferId - 이전 ID
 * @param reason - 되돌림 사유
 * @returns 되돌림 결과
 */
export function revertTransfer(
  transferId: string,
  reason: string
): { success: boolean; transfer: AuthorityTransfer | null; reason: string } {
  const transfer = transferStore.find(
    (t) =>
      t.id === transferId &&
      (t.status === 'COMPLETED' || t.status === 'IN_PROGRESS')
  );
  if (!transfer) {
    return {
      success: false,
      transfer: null,
      reason: '되돌릴 수 있는 이전 건을 찾을 수 없습니다.',
    };
  }

  transfer.status = 'REVERTED';

  return {
    success: true,
    transfer: { ...transfer },
    reason: `권한 이전이 되돌려졌습니다: ${reason}`,
  };
}

/**
 * 이전 이력을 조회합니다.
 * @param filters - 선택적 필터
 * @returns 이전 이력 목록
 */
export function getTransferHistory(filters?: {
  type?: TransferType;
  status?: TransferStatus;
  fromRole?: string;
  toRole?: string;
}): AuthorityTransfer[] {
  return transferStore
    .filter((t) => {
      if (filters?.type && t.type !== filters.type) return false;
      if (filters?.status && t.status !== filters.status) return false;
      if (filters?.fromRole && t.fromRole !== filters.fromRole) return false;
      if (filters?.toRole && t.toRole !== filters.toRole) return false;
      return true;
    })
    .map((t) => ({ ...t }));
}
