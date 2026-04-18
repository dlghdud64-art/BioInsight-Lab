/**
 * Impact Analysis Engine — What-if simulation for order approval
 *
 * 발주 승인 직전에 실행되는 결정론적 시뮬레이션 엔진.
 * "이 발주를 승인할 경우 예산 고갈 시점이 얼마나 앞당겨지는지,
 *  재고 회전율에 어떤 영향을 미치는지"를 사전에 계산한다.
 *
 * 고정 규칙 (CLAUDE.md):
 * 1. canonical truth(예산/재고 store)는 절대 mutate하지 않는다.
 *    → 본 엔진은 read-only 시뮬레이션이며, before/after snapshot만 반환.
 * 2. ready_to_approve ≠ approved.
 *    → 본 엔진의 출력은 "approve 가능한 사전 정보"일 뿐,
 *      실제 status transition은 별도 action(finalizeApproval)에서만 발생.
 * 3. 결정론적이어야 한다.
 *    → 동일 입력에 동일 출력. AI 호출은 별도 layer에서 본 결과를 context로 사용.
 *
 * 출력은 ImpactAnalysisModal과 /api/ai/impact-analysis route 양쪽에서 사용된다.
 */

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export interface ImpactAnalysisInput {
  /** 발주 식별자 (audit용) */
  orderId: string;
  /** 발주 품목명 */
  itemName: string;
  /** 발주 금액 (KRW) */
  orderAmount: number;
  /** 예산 정보 — null이면 예산 영향 분석 skip */
  budget: {
    budgetId: string;
    budgetName: string;
    /** 총 예산액 */
    total: number;
    /** 이미 집행된 금액 (actual spent) */
    spent: number;
    /** 예약/약정된 금액 (reserved + committed) */
    committed: number;
    /** 예산 종료일 (ISO date) */
    periodEndDate: string;
    /** 평균 월 burn (없으면 spent / 경과 개월수로 추정) */
    averageMonthlyBurn?: number;
  } | null;
  /** 재고 정보 — null이면 재고 영향 분석 skip */
  inventory?: {
    itemId: string;
    /** 현재 재고량 */
    currentStock: number;
    /** 일 평균 소비량 */
    dailyConsumption: number;
    /** 안전 재고 (reorder point) */
    reorderPoint: number;
    /** 발주 수령으로 들어올 수량 (없으면 0) */
    incomingQuantity?: number;
  } | null;
  /** 시뮬레이션 기준 일자 (테스트 결정성용) */
  evaluationDate?: string;
}

export interface BudgetSnapshot {
  total: number;
  spent: number;
  committed: number;
  available: number;
  burnRatePercent: number;
  /** 0-100 (위험도) */
  utilizationPercent: number;
  /** 예측 고갈일 (ISO date) — null이면 예상 안 됨 */
  predictedDepletionDate: string | null;
  /** 예산 종료일까지 남은 일수 */
  daysUntilPeriodEnd: number;
}

export interface InventorySnapshot {
  currentStock: number;
  daysOfSupply: number;
  belowReorderPoint: boolean;
  /** 회전율 (일 소비량 / 현재 재고 * 30) */
  monthlyTurnoverRate: number;
}

export interface ImpactAnalysisSimulation {
  orderId: string;
  itemName: string;
  orderAmount: number;
  evaluatedAt: string;

  /** 예산 영향 — null이면 분석 skip */
  budget: {
    before: BudgetSnapshot;
    after: BudgetSnapshot;
    /** 고갈 시점이 며칠 앞당겨지는가 (음수면 변화 없음) */
    depletionAdvancedDays: number;
    /** 잔여 가용 예산 변화량 */
    availableDelta: number;
    /** 위험 등급 변화 — true면 위험도 상승 */
    riskEscalated: boolean;
    riskBefore: BudgetRiskLevel;
    riskAfter: BudgetRiskLevel;
  } | null;

  /** 재고 영향 — null이면 분석 skip */
  inventory: {
    before: InventorySnapshot;
    after: InventorySnapshot;
    /** 회전율 변화 (after - before) */
    turnoverDelta: number;
  } | null;

  /** 결정론적 요약 (AI 호출 없는 fallback에서도 사용) */
  summary: {
    headline: string;
    bulletPoints: string[];
    severity: ImpactSeverity;
  };
}

export type BudgetRiskLevel = "safe" | "warning" | "critical" | "over";
export type ImpactSeverity = "ok" | "review" | "blocked";

// ══════════════════════════════════════════════════════════════════════════════
// Engine
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 결정론적 impact 시뮬레이션. mutation 없음.
 */
export function simulateOrderImpact(input: ImpactAnalysisInput): ImpactAnalysisSimulation {
  const evaluatedAt = input.evaluationDate ?? new Date().toISOString();
  const evalDate = new Date(evaluatedAt);

  // ── 예산 시뮬레이션 ──
  const budgetSim = input.budget ? simulateBudget(input.budget, input.orderAmount, evalDate) : null;

  // ── 재고 시뮬레이션 ──
  const inventorySim = input.inventory ? simulateInventory(input.inventory) : null;

  // ── 결정론적 요약 ──
  const summary = buildDeterministicSummary({
    itemName: input.itemName,
    orderAmount: input.orderAmount,
    budgetSim,
    inventorySim,
  });

  return {
    orderId: input.orderId,
    itemName: input.itemName,
    orderAmount: input.orderAmount,
    evaluatedAt,
    budget: budgetSim,
    inventory: inventorySim,
    summary,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Budget simulation
// ══════════════════════════════════════════════════════════════════════════════

function simulateBudget(
  budget: NonNullable<ImpactAnalysisInput["budget"]>,
  orderAmount: number,
  evalDate: Date,
): NonNullable<ImpactAnalysisSimulation["budget"]> {
  const periodEnd = new Date(budget.periodEndDate);
  const daysUntilPeriodEnd = Math.max(
    0,
    Math.ceil((periodEnd.getTime() - evalDate.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const before = buildBudgetSnapshot({
    total: budget.total,
    spent: budget.spent,
    committed: budget.committed,
    averageMonthlyBurn: budget.averageMonthlyBurn,
    daysUntilPeriodEnd,
    evalDate,
  });

  // 발주 승인 → committed에 더해진다 (actual spent는 수령 이후)
  const after = buildBudgetSnapshot({
    total: budget.total,
    spent: budget.spent,
    committed: budget.committed + orderAmount,
    averageMonthlyBurn: budget.averageMonthlyBurn,
    daysUntilPeriodEnd,
    evalDate,
  });

  // 고갈 시점이 며칠 앞당겨지는가
  let depletionAdvancedDays = 0;
  if (before.predictedDepletionDate && after.predictedDepletionDate) {
    const beforeDate = new Date(before.predictedDepletionDate).getTime();
    const afterDate = new Date(after.predictedDepletionDate).getTime();
    depletionAdvancedDays = Math.max(
      0,
      Math.round((beforeDate - afterDate) / (1000 * 60 * 60 * 24)),
    );
  }

  const riskBefore = before.utilizationPercent >= 100
    ? "over"
    : before.utilizationPercent >= 80
      ? "critical"
      : before.utilizationPercent >= 60
        ? "warning"
        : "safe";

  const riskAfter = after.utilizationPercent >= 100
    ? "over"
    : after.utilizationPercent >= 80
      ? "critical"
      : after.utilizationPercent >= 60
        ? "warning"
        : "safe";

  const riskOrder: Record<BudgetRiskLevel, number> = { safe: 0, warning: 1, critical: 2, over: 3 };

  return {
    before,
    after,
    depletionAdvancedDays,
    availableDelta: after.available - before.available,
    riskEscalated: riskOrder[riskAfter] > riskOrder[riskBefore],
    riskBefore,
    riskAfter,
  };
}

function buildBudgetSnapshot(args: {
  total: number;
  spent: number;
  committed: number;
  averageMonthlyBurn?: number;
  daysUntilPeriodEnd: number;
  evalDate: Date;
}): BudgetSnapshot {
  const consumed = args.spent + args.committed;
  const available = Math.max(0, args.total - consumed);
  const utilizationPercent = args.total > 0 ? (consumed / args.total) * 100 : 0;
  const burnRatePercent = utilizationPercent;

  // 월 burn 추정: 명시값 우선, 없으면 spent를 3개월로 나눈 값
  const monthlyBurn =
    args.averageMonthlyBurn && args.averageMonthlyBurn > 0
      ? args.averageMonthlyBurn
      : args.spent > 0
        ? args.spent / 3
        : 0;

  let predictedDepletionDate: string | null = null;
  if (monthlyBurn > 0 && available > 0) {
    const monthsToDeplete = available / monthlyBurn;
    const depletionDate = new Date(args.evalDate);
    depletionDate.setDate(depletionDate.getDate() + Math.round(monthsToDeplete * 30));
    predictedDepletionDate = depletionDate.toISOString();
  } else if (available <= 0) {
    predictedDepletionDate = args.evalDate.toISOString();
  }

  return {
    total: args.total,
    spent: args.spent,
    committed: args.committed,
    available,
    burnRatePercent: Math.round(burnRatePercent * 10) / 10,
    utilizationPercent: Math.round(utilizationPercent * 10) / 10,
    predictedDepletionDate,
    daysUntilPeriodEnd: args.daysUntilPeriodEnd,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Inventory simulation
// ══════════════════════════════════════════════════════════════════════════════

function simulateInventory(
  inv: NonNullable<ImpactAnalysisInput["inventory"]>,
): NonNullable<ImpactAnalysisSimulation["inventory"]> {
  const before = buildInventorySnapshot({
    stock: inv.currentStock,
    dailyConsumption: inv.dailyConsumption,
    reorderPoint: inv.reorderPoint,
  });

  const incomingQty = inv.incomingQuantity ?? 0;
  const after = buildInventorySnapshot({
    stock: inv.currentStock + incomingQty,
    dailyConsumption: inv.dailyConsumption,
    reorderPoint: inv.reorderPoint,
  });

  return {
    before,
    after,
    turnoverDelta: Math.round((after.monthlyTurnoverRate - before.monthlyTurnoverRate) * 10) / 10,
  };
}

function buildInventorySnapshot(args: {
  stock: number;
  dailyConsumption: number;
  reorderPoint: number;
}): InventorySnapshot {
  const daysOfSupply = args.dailyConsumption > 0 ? args.stock / args.dailyConsumption : Infinity;
  const monthlyTurnoverRate =
    args.stock > 0 ? Math.round(((args.dailyConsumption * 30) / args.stock) * 10) / 10 : 0;

  return {
    currentStock: args.stock,
    daysOfSupply: Number.isFinite(daysOfSupply) ? Math.round(daysOfSupply) : 999,
    belowReorderPoint: args.stock <= args.reorderPoint,
    monthlyTurnoverRate,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Deterministic summary
// ══════════════════════════════════════════════════════════════════════════════

function buildDeterministicSummary(args: {
  itemName: string;
  orderAmount: number;
  budgetSim: ImpactAnalysisSimulation["budget"];
  inventorySim: ImpactAnalysisSimulation["inventory"];
}): ImpactAnalysisSimulation["summary"] {
  const bullets: string[] = [];
  // eslint-disable-next-line prefer-const
  let severity = "ok" as ImpactSeverity;

  if (args.budgetSim) {
    const b = args.budgetSim;
    bullets.push(
      `예산 가용액: ${formatKRW(b.before.available)} → ${formatKRW(b.after.available)} (${formatKRW(b.availableDelta)})`,
    );
    bullets.push(
      `예산 소진율: ${b.before.utilizationPercent}% → ${b.after.utilizationPercent}%`,
    );
    if (b.depletionAdvancedDays > 0) {
      bullets.push(`예상 고갈 시점이 약 ${b.depletionAdvancedDays}일 앞당겨짐`);
    }
    if (b.after.available < 0) {
      severity = "blocked";
      bullets.push("승인 시 예산 초과 — 차단 권장");
    } else if (b.riskEscalated) {
      if (severity !== "blocked") severity = "review";
      bullets.push(`예산 위험 등급 상승: ${b.riskBefore} → ${b.riskAfter}`);
    } else if (b.after.utilizationPercent >= 80) {
      if (severity !== "blocked") severity = "review";
    }
  }

  if (args.inventorySim) {
    const inv = args.inventorySim;
    bullets.push(
      `재고 일수: ${inv.before.daysOfSupply}일 → ${inv.after.daysOfSupply}일`,
    );
    if (inv.before.belowReorderPoint && !inv.after.belowReorderPoint) {
      bullets.push("발주 수령 시 재주문 임계 회복");
    } else if (inv.before.belowReorderPoint) {
      bullets.push("현재 재주문 임계 이하 — 발주 시급");
      if (severity !== "blocked") severity = "review";
    }
    if (inv.turnoverDelta !== 0) {
      bullets.push(
        `월 회전율 변화: ${inv.before.monthlyTurnoverRate} → ${inv.after.monthlyTurnoverRate}`,
      );
    }
  }

  const headline =
    severity === "blocked"
      ? `${args.itemName} 승인 차단 권장 — 예산/재고 임계 위반`
      : severity === "review"
        ? `${args.itemName} 승인 전 검토 필요 — 위험 신호 존재`
        : `${args.itemName} 승인 영향 정상 범위`;

  return { headline, bulletPoints: bullets, severity };
}

function formatKRW(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}₩${Math.abs(value).toLocaleString("ko-KR")}`;
}
