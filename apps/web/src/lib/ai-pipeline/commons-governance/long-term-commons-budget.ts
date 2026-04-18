/**
 * 장기 커먼즈 예산
 *
 * 신뢰 유지, 위기 예비, 공익 지원, 시정 기금, 혁신 씨앗 등
 * 커먼즈 장기 예산 풀을 관리한다.
 * 위기 예비 및 시정 기금은 격리되어 편의 기능으로 전용할 수 없다.
 */

/** 예산 풀 유형 */
export type BudgetPool =
  | 'TRUST_MAINTENANCE'
  | 'CRISIS_RESERVE'
  | 'PUBLIC_INTEREST_SUPPORT'
  | 'REMEDIATION_FUND'
  | 'INNOVATION_SEED';

/** 예산 배분 */
export interface BudgetAllocation {
  /** 풀 유형 */
  pool: BudgetPool;
  /** 배분 총액 */
  allocated: number;
  /** 사용 총액 */
  spent: number;
  /** 예약 금액 */
  reserved: number;
  /** 최종 갱신 시점 */
  lastUpdated: string;
}

/** 지출 기록 */
export interface SpendRecord {
  pool: BudgetPool;
  amount: number;
  purpose: string;
  spentAt: string;
}

/** 장기 수요 예측 */
export interface LongTermProjection {
  pool: BudgetPool;
  currentBalance: number;
  projectedNeed12Months: number;
  projectedNeed36Months: number;
  sustainabilityRisk: 'LOW' | 'MEDIUM' | 'HIGH';
}

/** 격리된 풀 (편의 기능 전용 불가) */
const ISOLATED_POOLS: ReadonlySet<BudgetPool> = new Set<BudgetPool>([
  'CRISIS_RESERVE',
  'REMEDIATION_FUND',
]);

// ─── 인메모리 저장소 ───

const budgetStore: Map<BudgetPool, BudgetAllocation> = new Map();
const spendHistory: SpendRecord[] = [];

// 초기화
function initializePool(pool: BudgetPool): BudgetAllocation {
  const allocation: BudgetAllocation = {
    pool,
    allocated: 0,
    spent: 0,
    reserved: 0,
    lastUpdated: new Date().toISOString(),
  };
  budgetStore.set(pool, allocation);
  return allocation;
}

/**
 * 예산을 배분한다.
 * @param pool 대상 풀
 * @param amount 배분 금액
 * @returns 업데이트된 예산 배분
 */
export function allocateBudget(
  pool: BudgetPool,
  amount: number
): BudgetAllocation {
  let allocation = budgetStore.get(pool);
  if (!allocation) {
    allocation = initializePool(pool);
  }

  allocation.allocated += amount;
  allocation.lastUpdated = new Date().toISOString();
  return { ...allocation };
}

/**
 * 풀에서 지출한다.
 * 격리된 풀(CRISIS_RESERVE, REMEDIATION_FUND)은 편의 기능 목적으로 사용할 수 없다.
 * @param pool 대상 풀
 * @param amount 지출 금액
 * @param purpose 지출 목적
 * @returns 지출 성공 여부와 결과
 */
export function spendFromPool(
  pool: BudgetPool,
  amount: number,
  purpose: string
): {
  success: boolean;
  reason: string;
  allocation: BudgetAllocation | null;
} {
  // 격리된 풀의 편의 기능 전용 차단
  if (ISOLATED_POOLS.has(pool)) {
    const convenienceKeywords = ['편의', 'convenience', 'optimization', '최적화', 'feature'];
    const isConveniencePurpose = convenienceKeywords.some((kw) =>
      purpose.toLowerCase().includes(kw)
    );
    if (isConveniencePurpose) {
      return {
        success: false,
        reason: `${pool} 풀은 격리되어 있어 편의 기능으로 전용할 수 없습니다.`,
        allocation: null,
      };
    }
  }

  let allocation = budgetStore.get(pool);
  if (!allocation) {
    allocation = initializePool(pool);
  }

  const available = allocation.allocated - allocation.spent - allocation.reserved;
  if (amount > available) {
    return {
      success: false,
      reason: `잔액 부족: 사용 가능 ${available}, 요청 ${amount}`,
      allocation: { ...allocation },
    };
  }

  allocation.spent += amount;
  allocation.lastUpdated = new Date().toISOString();

  spendHistory.push({
    pool,
    amount,
    purpose,
    spentAt: new Date().toISOString(),
  });

  return {
    success: true,
    reason: '지출 완료',
    allocation: { ...allocation },
  };
}

/**
 * 풀 잔액을 조회한다.
 * @param pool 대상 풀
 * @returns 예산 배분 정보
 */
export function getPoolBalance(pool: BudgetPool): BudgetAllocation {
  let allocation = budgetStore.get(pool);
  if (!allocation) {
    allocation = initializePool(pool);
  }
  return { ...allocation };
}

/**
 * 장기 수요를 예측한다.
 * @returns 풀별 장기 수요 예측 배열
 */
export function projectLongTermNeeds(): LongTermProjection[] {
  const pools: BudgetPool[] = [
    'TRUST_MAINTENANCE',
    'CRISIS_RESERVE',
    'PUBLIC_INTEREST_SUPPORT',
    'REMEDIATION_FUND',
    'INNOVATION_SEED',
  ];

  return pools.map((pool) => {
    const allocation = budgetStore.get(pool) ?? initializePool(pool);
    const currentBalance =
      allocation.allocated - allocation.spent - allocation.reserved;

    // 최근 지출 추세 기반 예측
    const recentSpends = spendHistory.filter((s) => s.pool === pool);
    const avgMonthlySpend =
      recentSpends.reduce((s, r) => s + r.amount, 0) /
      Math.max(recentSpends.length, 1);

    const projectedNeed12 = avgMonthlySpend * 12;
    const projectedNeed36 = avgMonthlySpend * 36;

    let sustainabilityRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (currentBalance < projectedNeed12) {
      sustainabilityRisk = 'HIGH';
    } else if (currentBalance < projectedNeed36) {
      sustainabilityRisk = 'MEDIUM';
    }

    return {
      pool,
      currentBalance,
      projectedNeed12Months: projectedNeed12,
      projectedNeed36Months: projectedNeed36,
      sustainabilityRisk,
    };
  });
}
