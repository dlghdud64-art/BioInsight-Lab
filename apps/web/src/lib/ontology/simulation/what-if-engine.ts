/**
 * What-if Simulation Engine — Phase 4
 *
 * 예산 영향 시뮬레이션 + 재고 소진 예측 + 발주 의사결정 지원.
 * Ontology Object의 현재 상태를 기반으로 "만약 ~하면?" 시나리오를 계산.
 *
 * 규칙:
 * 1. 시뮬레이션은 실제 데이터를 변경하지 않음 (read-only projection)
 * 2. 결과에 confidence level 표시 (데이터 품질에 따라)
 * 3. 복수 시나리오 비교 지원
 * 4. ARCHITECTURE.md: engine output = truth, UI = projection
 */

// ══════════════════════════════════════════════════════════════════════════════
// Budget Impact Simulation
// ══════════════════════════════════════════════════════════════════════════════

export interface BudgetSimulationInput {
  /** 현재 예산 상태 */
  currentBudget: {
    budgetId: string;
    budgetName: string;
    totalAmount: number;
    totalSpent: number;
    committed: number;
    available: number;
    burnRate: number;
    periodEnd: string;
  };
  /** 시뮬레이션 대상 발주 금액 */
  proposedOrderAmount: number;
  /** 추가 예약 금액 (optional) */
  additionalReservation?: number;
}

export interface BudgetSimulationResult {
  scenarioId: string;
  /** 시뮬레이션 전 상태 */
  before: {
    available: number;
    burnRate: number;
    riskLevel: BudgetRiskCategory;
    remainingDays: number;
  };
  /** 시뮬레이션 후 예상 상태 */
  after: {
    available: number;
    burnRate: number;
    riskLevel: BudgetRiskCategory;
    remainingDays: number;
    projectedExhaustionDate: string | null;
  };
  /** 변화량 */
  delta: {
    availableChange: number;
    burnRateChange: number;
    riskLevelChanged: boolean;
  };
  /** 경고 */
  warnings: SimulationWarning[];
  /** 신뢰도 (0-1) */
  confidence: number;
}

export type BudgetRiskCategory = "safe" | "caution" | "warning" | "critical" | "over_budget";

export interface SimulationWarning {
  severity: "info" | "warning" | "critical";
  message: string;
}

export function simulateBudgetImpact(input: BudgetSimulationInput): BudgetSimulationResult {
  const { currentBudget, proposedOrderAmount, additionalReservation = 0 } = input;
  const now = new Date();
  const periodEnd = new Date(currentBudget.periodEnd);
  const remainingDays = Math.max(0, Math.floor((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  // Before
  const beforeBurnRate = currentBudget.burnRate;
  const beforeRisk = classifyBudgetRisk(beforeBurnRate, currentBudget.available, currentBudget.totalAmount);

  // After
  const newSpent = currentBudget.totalSpent + proposedOrderAmount;
  const newCommitted = currentBudget.committed + additionalReservation;
  const newAvailable = currentBudget.totalAmount - newSpent - newCommitted;
  const newBurnRate = currentBudget.totalAmount > 0
    ? Math.round((newSpent / currentBudget.totalAmount) * 100)
    : 0;
  const afterRisk = classifyBudgetRisk(newBurnRate, newAvailable, currentBudget.totalAmount);

  // Projected exhaustion
  let projectedExhaustion: string | null = null;
  if (remainingDays > 0 && newBurnRate > 0) {
    const dailyBurn = newSpent / Math.max(1, getDaysElapsedInPeriod(currentBudget.periodEnd));
    if (dailyBurn > 0) {
      const daysUntilExhaustion = Math.floor(newAvailable / dailyBurn);
      const exhaustionDate = new Date(now.getTime() + daysUntilExhaustion * 24 * 60 * 60 * 1000);
      projectedExhaustion = exhaustionDate.toISOString().split("T")[0];
    }
  }

  // Warnings
  const warnings: SimulationWarning[] = [];
  if (newAvailable < 0) {
    warnings.push({ severity: "critical", message: `예산 초과: ${Math.abs(newAvailable).toLocaleString()}원 부족` });
  } else if (newBurnRate > 90) {
    warnings.push({ severity: "critical", message: `소진율 ${newBurnRate}% — 예산 거의 소진` });
  } else if (newBurnRate > 75) {
    warnings.push({ severity: "warning", message: `소진율 ${newBurnRate}% — 잔여 예산 주의` });
  }
  if (afterRisk !== beforeRisk) {
    warnings.push({ severity: "warning", message: `위험 등급 변경: ${beforeRisk} → ${afterRisk}` });
  }
  if (proposedOrderAmount > currentBudget.available * 0.5) {
    warnings.push({ severity: "info", message: "이 발주는 잔여 예산의 50% 이상을 사용합니다" });
  }

  // Confidence (데이터 품질 기반)
  const confidence = calculateConfidence(currentBudget, remainingDays);

  return {
    scenarioId: `sim_budget_${Date.now().toString(36)}`,
    before: {
      available: currentBudget.available,
      burnRate: beforeBurnRate,
      riskLevel: beforeRisk,
      remainingDays,
    },
    after: {
      available: newAvailable,
      burnRate: newBurnRate,
      riskLevel: afterRisk,
      remainingDays,
      projectedExhaustionDate: projectedExhaustion,
    },
    delta: {
      availableChange: newAvailable - currentBudget.available,
      burnRateChange: newBurnRate - beforeBurnRate,
      riskLevelChanged: afterRisk !== beforeRisk,
    },
    warnings,
    confidence,
  };
}

function classifyBudgetRisk(burnRate: number, available: number, total: number): BudgetRiskCategory {
  if (available < 0) return "over_budget";
  if (burnRate > 90) return "critical";
  if (burnRate > 75) return "warning";
  if (burnRate > 50) return "caution";
  return "safe";
}

function getDaysElapsedInPeriod(periodEnd: string): number {
  // 기간 시작은 추정 (보통 월초/분기초)
  const end = new Date(periodEnd);
  const now = new Date();
  const total = end.getTime() - now.getTime();
  // 전체 기간을 90일(분기)로 추정
  const quarterMs = 90 * 24 * 60 * 60 * 1000;
  const elapsed = quarterMs - total;
  return Math.max(1, Math.floor(elapsed / (24 * 60 * 60 * 1000)));
}

function calculateConfidence(
  budget: BudgetSimulationInput["currentBudget"],
  remainingDays: number,
): number {
  let conf = 0.8;
  // 데이터가 불완전하면 신뢰도 감소
  if (budget.totalAmount === 0) conf -= 0.3;
  if (remainingDays < 7) conf -= 0.1; // 기간 말 데이터 불안정
  if (budget.burnRate === 0 && budget.totalSpent > 0) conf -= 0.2;
  return Math.max(0.1, Math.min(1, conf));
}

// ══════════════════════════════════════════════════════════════════════════════
// Inventory Depletion Simulation
// ══════════════════════════════════════════════════════════════════════════════

export interface InventorySimulationInput {
  itemId: string;
  itemName: string;
  currentQuantity: number;
  reservedQuantity: number;
  reorderPoint: number | null;
  /** 일간 평균 소모량 (추정) */
  dailyConsumption: number;
  /** 리드타임 (일) */
  leadTimeDays: number;
}

export interface InventorySimulationResult {
  scenarioId: string;
  itemId: string;
  itemName: string;
  availableQuantity: number;
  /** 재고 소진 예상일 (null = 소모량 0) */
  projectedDepletionDate: string | null;
  /** 소진까지 남은 일수 */
  daysUntilDepletion: number | null;
  /** 재주문점 도달 예상일 */
  reorderPointDate: string | null;
  /** 리드타임 고려 시 발주 마감일 */
  orderDeadline: string | null;
  /** 안전 재고 여부 */
  isSafe: boolean;
  /** 경고 */
  warnings: SimulationWarning[];
}

export function simulateInventoryDepletion(input: InventorySimulationInput): InventorySimulationResult {
  const { currentQuantity, reservedQuantity, reorderPoint, dailyConsumption, leadTimeDays } = input;
  const available = currentQuantity - reservedQuantity;
  const now = new Date();
  const warnings: SimulationWarning[] = [];

  let projectedDepletion: string | null = null;
  let daysUntilDepletion: number | null = null;
  let reorderPointDate: string | null = null;
  let orderDeadline: string | null = null;

  if (dailyConsumption > 0) {
    daysUntilDepletion = Math.floor(available / dailyConsumption);
    projectedDepletion = new Date(now.getTime() + daysUntilDepletion * 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0];

    if (reorderPoint !== null) {
      const daysToReorder = Math.floor((available - reorderPoint) / dailyConsumption);
      if (daysToReorder > 0) {
        reorderPointDate = new Date(now.getTime() + daysToReorder * 24 * 60 * 60 * 1000)
          .toISOString().split("T")[0];
      }
    }

    // 리드타임 고려 발주 마감
    const safeDays = daysUntilDepletion - leadTimeDays;
    if (safeDays > 0) {
      orderDeadline = new Date(now.getTime() + safeDays * 24 * 60 * 60 * 1000)
        .toISOString().split("T")[0];
    } else {
      warnings.push({ severity: "critical", message: `리드타임(${leadTimeDays}일) 내 재고 소진 예상` });
    }

    if (daysUntilDepletion <= 7) {
      warnings.push({ severity: "critical", message: `${daysUntilDepletion}일 내 재고 소진 예상` });
    } else if (daysUntilDepletion <= 14) {
      warnings.push({ severity: "warning", message: `${daysUntilDepletion}일 내 재고 소진 예상` });
    }
  }

  const isSafe = reorderPoint !== null ? available > reorderPoint : available > 0;

  return {
    scenarioId: `sim_inv_${Date.now().toString(36)}`,
    itemId: input.itemId,
    itemName: input.itemName,
    availableQuantity: available,
    projectedDepletionDate: projectedDepletion,
    daysUntilDepletion,
    reorderPointDate,
    orderDeadline,
    isSafe,
    warnings,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Multi-Scenario Comparison
// ══════════════════════════════════════════════════════════════════════════════

export interface ScenarioComparison {
  scenarios: BudgetSimulationResult[];
  bestScenario: string;
  worstScenario: string;
  recommendation: string;
}

export function compareScenarios(scenarios: BudgetSimulationResult[]): ScenarioComparison {
  if (scenarios.length === 0) {
    return { scenarios: [], bestScenario: "", worstScenario: "", recommendation: "시나리오를 추가하세요" };
  }

  const sorted = [...scenarios].sort((a, b) => b.after.available - a.after.available);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  let recommendation = "";
  if (worst.after.available < 0) {
    recommendation = "일부 시나리오에서 예산 초과 — 발주 분할 또는 축소 검토";
  } else if (worst.after.riskLevel === "critical") {
    recommendation = "위험 시나리오 존재 — 예산 증액 또는 우선순위 조정 필요";
  } else if (best.after.riskLevel === "safe") {
    recommendation = "모든 시나리오에서 예산 안전";
  } else {
    recommendation = "시나리오별 예산 영향 차이 존재 — 우선순위 기반 선택 권장";
  }

  return {
    scenarios,
    bestScenario: best.scenarioId,
    worstScenario: worst.scenarioId,
    recommendation,
  };
}
