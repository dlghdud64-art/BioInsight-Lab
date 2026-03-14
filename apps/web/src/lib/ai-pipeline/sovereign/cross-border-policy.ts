/**
 * @module cross-border-policy
 * @description 국경 간 정책 관리 — 관할권 간 데이터 이전 메커니즘 평가 및 이력 관리
 */

/** 데이터 이전 메커니즘 */
export type TransferMechanism =
  | 'ADEQUACY_DECISION'
  | 'SCC'
  | 'BCR'
  | 'CONSENT'
  | 'DEROGATION'
  | 'NONE';

/** 국경 간 이전 기록 */
export interface CrossBorderTransfer {
  /** 이전 고유 ID */
  id: string;
  /** 출발 관할권 ID */
  sourceJurisdiction: string;
  /** 도착 관할권 ID */
  targetJurisdiction: string;
  /** 이전 메커니즘 */
  mechanism: TransferMechanism;
  /** 승인 여부 */
  approved: boolean;
  /** 데이터 분류 목록 */
  dataCategories: string[];
  /** 안전 조치 목록 */
  safeguards: string[];
}

/** 메커니즘 가용성 매핑 */
interface MechanismMapping {
  sourceJurisdiction: string;
  targetJurisdiction: string;
  availableMechanisms: TransferMechanism[];
}

/** 인메모리 이전 기록 저장소 */
const transferStore: CrossBorderTransfer[] = [];

/** 인메모리 메커니즘 매핑 저장소 */
const mechanismMappings: MechanismMapping[] = [];

let transferCounter = 0;

/**
 * 국경 간 이전 요청을 평가한다.
 * @param source 출발 관할권 ID
 * @param target 도착 관할권 ID
 * @param dataCategories 이전할 데이터 분류
 * @param mechanism 사용할 메커니즘
 * @returns 이전 기록
 */
export function evaluateTransfer(
  source: string,
  target: string,
  dataCategories: string[],
  mechanism: TransferMechanism,
): CrossBorderTransfer {
  const mapping = mechanismMappings.find(
    (m) => m.sourceJurisdiction === source && m.targetJurisdiction === target,
  );

  const approved = mapping
    ? mapping.availableMechanisms.includes(mechanism)
    : mechanism !== 'NONE';

  const transfer: CrossBorderTransfer = {
    id: `cbt-${++transferCounter}`,
    sourceJurisdiction: source,
    targetJurisdiction: target,
    mechanism,
    approved,
    dataCategories,
    safeguards: approved ? ['데이터 암호화', '감사 로그'] : [],
  };

  transferStore.push(transfer);
  return transfer;
}

/**
 * 두 관할권 간 사용 가능한 이전 메커니즘을 조회한다.
 * @param source 출발 관할권 ID
 * @param target 도착 관할권 ID
 * @returns 사용 가능한 메커니즘 배열
 */
export function getAvailableMechanisms(
  source: string,
  target: string,
): TransferMechanism[] {
  const mapping = mechanismMappings.find(
    (m) => m.sourceJurisdiction === source && m.targetJurisdiction === target,
  );
  return mapping ? [...mapping.availableMechanisms] : [];
}

/**
 * 메커니즘 매핑을 등록한다.
 * @param source 출발 관할권 ID
 * @param target 도착 관할권 ID
 * @param mechanisms 사용 가능한 메커니즘 목록
 */
export function registerMechanismMapping(
  source: string,
  target: string,
  mechanisms: TransferMechanism[],
): void {
  const idx = mechanismMappings.findIndex(
    (m) => m.sourceJurisdiction === source && m.targetJurisdiction === target,
  );
  const mapping: MechanismMapping = {
    sourceJurisdiction: source,
    targetJurisdiction: target,
    availableMechanisms: mechanisms,
  };
  if (idx !== -1) {
    mechanismMappings[idx] = mapping;
  } else {
    mechanismMappings.push(mapping);
  }
}

/**
 * 이전 기록을 저장한다.
 * @param transfer 이전 기록
 * @returns 저장된 이전 기록
 */
export function recordTransfer(transfer: CrossBorderTransfer): CrossBorderTransfer {
  transferStore.push(transfer);
  return transfer;
}

/**
 * 이전 이력을 조회한다.
 * @param filter 필터 조건 (선택)
 * @returns 이전 기록 배열
 */
export function getTransferHistory(filter?: {
  sourceJurisdiction?: string;
  targetJurisdiction?: string;
  approved?: boolean;
}): CrossBorderTransfer[] {
  if (!filter) return [...transferStore];

  return transferStore.filter((t) => {
    if (filter.sourceJurisdiction && t.sourceJurisdiction !== filter.sourceJurisdiction) return false;
    if (filter.targetJurisdiction && t.targetJurisdiction !== filter.targetJurisdiction) return false;
    if (filter.approved !== undefined && t.approved !== filter.approved) return false;
    return true;
  });
}
