/**
 * @module cross-border-reconciliation
 * @description 국경 간 조정 엔진 — 관할권 간 데이터 일관성, 정책 정합성, 증거 동기화를 검증·조정
 */

/** 조정 유형 */
export type ReconciliationType =
  | 'DATA_CONSISTENCY'
  | 'POLICY_ALIGNMENT'
  | 'COMPLIANCE_PARITY'
  | 'EVIDENCE_SYNC';

/** 불일치 항목 */
export interface Discrepancy {
  /** 불일치 고유 ID */
  id: string;
  /** 조정 유형 */
  type: ReconciliationType;
  /** 관련 관할권 목록 */
  jurisdictions: string[];
  /** 불일치 설명 */
  description: string;
  /** 해결 여부 */
  resolved: boolean;
  /** 해결 방법 (해결 시) */
  resolution?: string;
}

/** 조정 결과 */
export interface ReconciliationResult {
  /** 조정 유형 */
  type: ReconciliationType;
  /** 관련 관할권 목록 */
  jurisdictions: string[];
  /** 발견된 불일치 목록 */
  discrepancies: Discrepancy[];
  /** 해결된 수 */
  resolvedCount: number;
  /** 미해결 수 */
  unresolvedCount: number;
  /** 조정 완료 시각 */
  reconciledAt: Date;
}

/** 인메모리 불일치 저장소 */
const discrepancyStore: Discrepancy[] = [];

/** 인메모리 조정 이력 */
const reconciliationHistory: ReconciliationResult[] = [];

let discrepancyCounter = 0;

/**
 * 조정을 실행한다.
 * @param type 조정 유형
 * @param jurisdictions 관련 관할권 ID 목록
 * @param findings 발견된 불일치 설명 배열
 * @returns 조정 결과
 */
export function runReconciliation(
  type: ReconciliationType,
  jurisdictions: string[],
  findings: string[],
): ReconciliationResult {
  const newDiscrepancies: Discrepancy[] = findings.map((desc) => ({
    id: `disc-${++discrepancyCounter}`,
    type,
    jurisdictions: [...jurisdictions],
    description: desc,
    resolved: false,
  }));

  discrepancyStore.push(...newDiscrepancies);

  const result: ReconciliationResult = {
    type,
    jurisdictions: [...jurisdictions],
    discrepancies: newDiscrepancies,
    resolvedCount: 0,
    unresolvedCount: newDiscrepancies.length,
    reconciledAt: new Date(),
  };

  reconciliationHistory.push(result);
  return result;
}

/**
 * 미해결 불일치 목록을 조회한다.
 * @param type 조정 유형 필터 (선택)
 * @returns 불일치 목록
 */
export function getDiscrepancies(type?: ReconciliationType): Discrepancy[] {
  if (!type) return discrepancyStore.filter((d) => !d.resolved);
  return discrepancyStore.filter((d) => d.type === type && !d.resolved);
}

/**
 * 불일치를 해결한다.
 * @param discrepancyId 불일치 ID
 * @param resolution 해결 방법
 * @returns 해결된 불일치 또는 undefined
 */
export function resolveDiscrepancy(
  discrepancyId: string,
  resolution: string,
): Discrepancy | undefined {
  const disc = discrepancyStore.find((d) => d.id === discrepancyId);
  if (!disc) return undefined;
  disc.resolved = true;
  disc.resolution = resolution;
  return { ...disc };
}

/**
 * 조정 이력을 조회한다.
 * @param type 조정 유형 필터 (선택)
 * @returns 조정 결과 배열
 */
export function getReconciliationHistory(type?: ReconciliationType): ReconciliationResult[] {
  if (!type) return [...reconciliationHistory];
  return reconciliationHistory.filter((r) => r.type === type);
}
