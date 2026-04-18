/**
 * @module commons-debt-monitor
 * @description 커먼즈 부채 모니터
 *
 * 신뢰 커먼즈 내의 미사용 허가, 오래된 패턴, 모순된 가이드,
 * 고아 자산, 만료된 증명 등 "부채"를 추적·해소하여
 * 커먼즈 오염을 방지한다.
 */

/** 부채 유형 */
export type DebtType =
  | 'UNUSED_GRANT'
  | 'STALE_PATTERN'
  | 'CONTRADICTORY_GUIDANCE'
  | 'ORPHANED_ASSET'
  | 'EXPIRED_ATTESTATION';

/** 부채 심각도 */
export type DebtSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** 커먼즈 부채 항목 */
export interface CommonsDebt {
  /** 부채 고유 ID */
  id: string;
  /** 부채 유형 */
  type: DebtType;
  /** 관련 자산 ID */
  assetId: string | null;
  /** 심각도 */
  severity: DebtSeverity;
  /** 감지 일시 */
  detectedAt: Date;
  /** 해소 일시 (미해소 시 null) */
  resolvedAt: Date | null;
  /** 영향 설명 */
  impact: string;
}

/** 부채 인벤토리 요약 */
export interface DebtInventory {
  /** 전체 부채 건수 */
  totalDebts: number;
  /** 미해소 부채 건수 */
  unresolvedDebts: number;
  /** 유형별 건수 */
  byType: Record<DebtType, number>;
  /** 심각도별 건수 */
  bySeverity: Record<DebtSeverity, number>;
  /** 미해소 부채 목록 */
  items: CommonsDebt[];
}

/** 부채 추이 데이터 포인트 */
export interface DebtTrendPoint {
  /** 측정 일시 */
  timestamp: Date;
  /** 미해소 부채 건수 */
  unresolvedCount: number;
  /** 부채 점수 */
  debtScore: number;
}

// ── 인메모리 저장소 ──
const debts: CommonsDebt[] = [];
const trendHistory: DebtTrendPoint[] = [];

/** 심각도별 가중치 */
const SEVERITY_WEIGHT: Record<DebtSeverity, number> = {
  LOW: 1,
  MEDIUM: 3,
  HIGH: 7,
  CRITICAL: 15,
};

/**
 * 커먼즈 부채를 스캔하여 등록한다.
 *
 * @param items 감지된 부채 항목 목록
 * @returns 등록된 부채 목록
 */
export function scanForDebt(
  items: Array<{
    id: string;
    type: DebtType;
    assetId: string | null;
    severity: DebtSeverity;
    impact: string;
  }>,
): CommonsDebt[] {
  const registered: CommonsDebt[] = [];

  for (const item of items) {
    const existing = debts.find((d) => d.id === item.id);
    if (existing) continue;

    const debt: CommonsDebt = {
      id: item.id,
      type: item.type,
      assetId: item.assetId,
      severity: item.severity,
      detectedAt: new Date(),
      resolvedAt: null,
      impact: item.impact,
    };

    debts.push(debt);
    registered.push({ ...debt });
  }

  // 추이 기록
  recordTrend();

  return registered;
}

/**
 * 부채 인벤토리를 반환한다.
 */
export function getDebtInventory(): DebtInventory {
  const unresolved = debts.filter((d) => d.resolvedAt === null);

  const byType: Record<DebtType, number> = {
    UNUSED_GRANT: 0,
    STALE_PATTERN: 0,
    CONTRADICTORY_GUIDANCE: 0,
    ORPHANED_ASSET: 0,
    EXPIRED_ATTESTATION: 0,
  };
  const bySeverity: Record<DebtSeverity, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };

  for (const d of unresolved) {
    byType[d.type]++;
    bySeverity[d.severity]++;
  }

  return {
    totalDebts: debts.length,
    unresolvedDebts: unresolved.length,
    byType,
    bySeverity,
    items: unresolved.map((d) => ({ ...d })),
  };
}

/**
 * 부채를 해소한다.
 *
 * @param debtId 부채 ID
 * @returns 해소 성공 여부
 */
export function resolveDebt(debtId: string): boolean {
  const debt = debts.find((d) => d.id === debtId);
  if (!debt || debt.resolvedAt !== null) return false;

  debt.resolvedAt = new Date();
  recordTrend();
  return true;
}

/**
 * 부채 추이를 반환한다.
 *
 * @param limit 최대 반환 건수
 */
export function getDebtTrend(limit: number = 20): DebtTrendPoint[] {
  return trendHistory.slice(-limit).map((t) => ({ ...t }));
}

/**
 * 현재 부채 점수를 계산한다.
 * 심각도별 가중치를 적용하여 산출한다.
 *
 * @returns 부채 점수 (낮을수록 양호)
 */
export function calculateDebtScore(): number {
  const unresolved = debts.filter((d) => d.resolvedAt === null);
  return unresolved.reduce((sum, d) => sum + SEVERITY_WEIGHT[d.severity], 0);
}

/** 추이 기록 헬퍼 */
function recordTrend(): void {
  const unresolved = debts.filter((d) => d.resolvedAt === null);
  trendHistory.push({
    timestamp: new Date(),
    unresolvedCount: unresolved.length,
    debtScore: calculateDebtScore(),
  });
}
