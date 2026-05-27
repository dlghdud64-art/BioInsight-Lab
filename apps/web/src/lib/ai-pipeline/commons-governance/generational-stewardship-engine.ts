/**
 * 세대 간 스튜어드십 엔진
 *
 * 현재 세대의 결정이 미래 세대에 부담을 전가하지 않도록 관리한다.
 * 세대 간 부채가 증가 추세이면 모든 편의 중심 최적화를 동결한다.
 */

/** 부채 범주 */
export type DebtCategory =
  | 'EXCEPTION_DEBT'
  | 'UNRESOLVED_DISPUTE'
  | 'UNDOCUMENTED_POLICY'
  | 'DEFERRED_REMEDIATION'
  | 'TECHNICAL_DEBT';

/** 세대 간 건강 상태 */
export type GenerationalHealth =
  | 'SUSTAINABLE'
  | 'DEBT_GROWING'
  | 'FREEZE_REQUIRED';

/** 세대 간 부채 */
export interface GenerationalDebt {
  /** 부채 ID */
  id: string;
  /** 부채 범주 */
  category: DebtCategory;
  /** 부채 설명 */
  description: string;
  /** 예상 미래 비용 */
  estimatedFutureCost: number;
  /** 생성자 */
  createdBy: string;
  /** 생성 시점 */
  createdAt: string;
  /** 해결 시점 (null이면 미해결) */
  resolvedAt: string | null;
}

/** 부채 추세 항목 */
export interface DebtTrendEntry {
  /** 측정 시점 */
  timestamp: string;
  /** 총 미해결 부채 수 */
  totalUnresolved: number;
  /** 총 예상 미래 비용 */
  totalEstimatedCost: number;
  /** 건강 상태 */
  health: GenerationalHealth;
}

// ─── 인메모리 저장소 ───

const debtStore: GenerationalDebt[] = [];
const debtTrend: DebtTrendEntry[] = [];
let nextDebtId = 1;

/**
 * 세대 간 건강 상태를 평가한다.
 * DEBT_GROWING 상태 시 모든 편의 중심 최적화를 동결해야 한다.
 * @returns 현재 세대 간 건강 상태
 */
export function assessGenerationalHealth(): {
  health: GenerationalHealth;
  unresolvedCount: number;
  totalEstimatedCost: number;
  freezeRequired: boolean;
} {
  const unresolved = debtStore.filter((d) => d.resolvedAt === null);
  const totalCost = unresolved.reduce(
    (sum, d) => sum + d.estimatedFutureCost,
    0
  );

  let health: GenerationalHealth = 'SUSTAINABLE';

  // 미해결 부채가 10건 이상이거나 총 비용이 임계값 초과
  if (unresolved.length >= 10 || totalCost >= 100000) {
    health = 'FREEZE_REQUIRED';
  } else if (unresolved.length >= 5 || totalCost >= 50000) {
    // 추세 확인: 최근 추세가 증가세인지 확인
    if (debtTrend.length >= 2) {
      const recent = debtTrend[debtTrend.length - 1];
      const previous = debtTrend[debtTrend.length - 2];
      if (
        recent &&
        previous &&
        recent.totalUnresolved > previous.totalUnresolved
      ) {
        health = 'DEBT_GROWING';
      }
    } else {
      health = 'DEBT_GROWING';
    }
  }

  // 추세 기록
  const trendEntry: DebtTrendEntry = {
    timestamp: new Date().toISOString(),
    totalUnresolved: unresolved.length,
    totalEstimatedCost: totalCost,
    health,
  };
  debtTrend.push(trendEntry);

  return {
    health,
    unresolvedCount: unresolved.length,
    totalEstimatedCost: totalCost,
    freezeRequired: health === 'DEBT_GROWING' || health === 'FREEZE_REQUIRED',
  };
}

/**
 * 새로운 세대 간 부채를 등록한다.
 * @param category 부채 범주
 * @param description 부채 설명
 * @param estimatedFutureCost 예상 미래 비용
 * @param createdBy 생성자 ID
 * @returns 등록된 부채
 */
export function registerDebt(
  category: DebtCategory,
  description: string,
  estimatedFutureCost: number,
  createdBy: string
): GenerationalDebt {
  const debt: GenerationalDebt = {
    id: `DEBT-${String(nextDebtId++).padStart(6, '0')}`,
    category,
    description,
    estimatedFutureCost,
    createdBy,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };

  debtStore.push(debt);
  return { ...debt };
}

/**
 * 세대 간 부채를 해결한다.
 * @param debtId 부채 ID
 * @returns 해결된 부채, 없으면 null
 */
export function resolveDebt(debtId: string): GenerationalDebt | null {
  const debt = debtStore.find((d) => d.id === debtId);
  if (!debt) return null;
  if (debt.resolvedAt !== null) return { ...debt };

  debt.resolvedAt = new Date().toISOString();
  return { ...debt };
}

/**
 * 부채 추세를 반환한다.
 * @returns 부채 추세 이력
 */
export function getDebtTrend(): ReadonlyArray<DebtTrendEntry> {
  return [...debtTrend];
}
