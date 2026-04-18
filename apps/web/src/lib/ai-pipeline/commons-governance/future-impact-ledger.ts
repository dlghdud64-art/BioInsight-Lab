/**
 * 미래 영향 원장 (불변)
 *
 * 현재의 결정이 미래에 미칠 영향을 불변으로 기록한다.
 * 한번 기록된 항목은 절대 수정하거나 삭제할 수 없다.
 * 안전 임계값 하향, 예외 승인, 시정 유예, 감사 부채 생성 등을 추적한다.
 */

/** 원장 항목 유형 */
export type LedgerEntryType =
  | 'SAFETY_THRESHOLD_LOWERING'
  | 'EXCEPTION_GRANTED'
  | 'REMEDIATION_DEFERRED'
  | 'AUDIT_DEBT_CREATED';

/** 원장 항목 */
export interface LedgerEntry {
  /** 항목 ID */
  id: string;
  /** 원장 항목 유형 */
  type: LedgerEntryType;
  /** 결정 내용 */
  decision: string;
  /** 결정자 */
  decidedBy: string;
  /** 단기 편익 설명 */
  shortTermBenefit: string;
  /** 미래 비용 추정치 */
  futureCostEstimate: number;
  /** 정당화 사유 */
  justification: string;
  /** 기록 시점 */
  recordedAt: string;
}

// ─── 불변 저장소 ───
// Object.freeze로 개별 항목을 동결하여 수정을 방지한다.

const ledger: ReadonlyArray<LedgerEntry>[] = [];
const immutableEntries: LedgerEntry[] = [];
let nextLedgerId = 1;

/**
 * 원장에 항목을 기록한다.
 * 기록된 항목은 불변이며, 이후 수정이나 삭제가 불가능하다.
 * @param type 항목 유형
 * @param decision 결정 내용
 * @param decidedBy 결정자 ID
 * @param shortTermBenefit 단기 편익 설명
 * @param futureCostEstimate 미래 비용 추정치
 * @param justification 정당화 사유
 * @returns 기록된 불변 항목
 */
export function recordEntry(
  type: LedgerEntryType,
  decision: string,
  decidedBy: string,
  shortTermBenefit: string,
  futureCostEstimate: number,
  justification: string
): Readonly<LedgerEntry> {
  const entry: LedgerEntry = Object.freeze({
    id: `LED-${String(nextLedgerId++).padStart(6, '0')}`,
    type,
    decision,
    decidedBy,
    shortTermBenefit,
    futureCostEstimate,
    justification,
    recordedAt: new Date().toISOString(),
  });

  immutableEntries.push(entry);
  return entry;
}

/**
 * 전체 원장을 반환한다.
 * 반환된 배열은 원본의 방어적 복사본이다.
 * @returns 전체 원장 항목 배열 (불변)
 */
export function getLedger(): ReadonlyArray<Readonly<LedgerEntry>> {
  return immutableEntries.map((e) => ({ ...e }));
}

/**
 * 결정자로 원장 항목을 검색한다.
 * @param decidedBy 결정자 ID
 * @returns 해당 결정자의 원장 항목 배열
 */
export function searchByDecisionMaker(
  decidedBy: string
): ReadonlyArray<Readonly<LedgerEntry>> {
  return immutableEntries
    .filter((e) => e.decidedBy === decidedBy)
    .map((e) => ({ ...e }));
}

/**
 * 누적 부채를 계산한다.
 * @param filterByType 선택적 유형 필터
 * @returns 누적 미래 비용 추정치
 */
export function calculateAccumulatedDebt(
  filterByType?: LedgerEntryType
): {
  totalEntries: number;
  totalFutureCost: number;
  byType: Record<LedgerEntryType, { count: number; cost: number }>;
} {
  const filtered = filterByType
    ? immutableEntries.filter((e) => e.type === filterByType)
    : immutableEntries;

  const byType: Record<LedgerEntryType, { count: number; cost: number }> = {
    SAFETY_THRESHOLD_LOWERING: { count: 0, cost: 0 },
    EXCEPTION_GRANTED: { count: 0, cost: 0 },
    REMEDIATION_DEFERRED: { count: 0, cost: 0 },
    AUDIT_DEBT_CREATED: { count: 0, cost: 0 },
  };

  for (const entry of filtered) {
    byType[entry.type].count += 1;
    byType[entry.type].cost += entry.futureCostEstimate;
  }

  return {
    totalEntries: filtered.length,
    totalFutureCost: filtered.reduce(
      (sum, e) => sum + e.futureCostEstimate,
      0
    ),
    byType,
  };
}
