/**
 * flow-insight-engine.ts
 * ───────────────────────
 * Rule-based AI insight engine for inventory flow analysis.
 * Detect → Explain → Recommend → Operator Apply.
 *
 * ⚠️ This engine NEVER modifies source of truth.
 * All outputs are read-only insights for operator decision-making.
 */

/* ── Types ── */

export type InsightSeverity = "critical" | "warning" | "info";
export type InsightType =
  | "usage_spike"
  | "expiry_priority"
  | "reorder_needed"
  | "low_turnover"
  | "location_mismatch"
  | "receiving_delay";

export interface FlowInsight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  reason: string;
  /** Number of items affected */
  affectedCount: number;
  /** Filter to apply when drilling down */
  drilldownFilter?: {
    status?: string;
    category?: string;
    itemIds?: string[];
  };
}

export type RecommendationType =
  | "use_first"
  | "reorder"
  | "hold"
  | "inspect"
  | "relocate"
  | "dispose";

export interface FlowRecommendation {
  type: RecommendationType;
  label: string;
  reasoning: string;
  priority: "high" | "medium" | "low";
  /** Item IDs this applies to */
  targetItemIds: string[];
}

/** Simplified inventory snapshot for insight computation */
export interface InventorySnapshot {
  id: string;
  productName: string;
  currentQuantity: number;
  unit: string;
  safetyStock: number | null;
  averageDailyUsage: number;
  leadTimeDays: number;
  expiryDate: string | null;
  lotNumber: string | null;
  location: string | null;
  storageCondition: string | null;
}

/** Usage record for trend analysis */
export interface UsageRecord {
  itemId: string;
  quantity: number;
  date: string; // ISO
}

/* ── Constants ── */

const USAGE_SPIKE_THRESHOLD = 1.8; // 80% above average
const EXPIRY_PRIORITY_DAYS = 14;
const LOW_TURNOVER_DAYS = 60; // No usage in 60 days

/* ── Insight Detection ── */

/**
 * Detect anomalies and generate insights from inventory + usage data.
 * Pure function — no side effects.
 */
export function detectInsights(
  inventories: InventorySnapshot[],
  recentUsage: UsageRecord[],
  now: Date = new Date()
): FlowInsight[] {
  const insights: FlowInsight[] = [];
  let idCounter = 0;
  const nextId = () => `insight-${++idCounter}`;

  // 1. Usage spike detection (recent 7d vs 30d average)
  const usageByItem = groupUsageByItem(recentUsage);
  const spikeItems: string[] = [];

  for (const [itemId, records] of Object.entries(usageByItem)) {
    const recent7d = sumUsageInWindow(records, 7, now);
    const avg30d = sumUsageInWindow(records, 30, now) / 4; // weekly average over 30d

    if (avg30d > 0 && recent7d > avg30d * USAGE_SPIKE_THRESHOLD) {
      spikeItems.push(itemId);
    }
  }

  if (spikeItems.length > 0) {
    insights.push({
      id: nextId(),
      type: "usage_spike",
      severity: "warning",
      title: `사용량 급증 ${spikeItems.length}건`,
      reason: "최근 7일 사용량이 30일 주간 평균 대비 80% 이상 증가한 품목이 있습니다.",
      affectedCount: spikeItems.length,
      drilldownFilter: { itemIds: spikeItems },
    });
  }

  // 2. Expiry priority — lots expiring within 14 days with remaining qty
  const expiringItems = inventories.filter((inv) => {
    if (!inv.expiryDate || inv.currentQuantity <= 0) return false;
    const daysLeft = Math.ceil(
      (new Date(inv.expiryDate).getTime() - now.getTime()) / 86400000
    );
    return daysLeft > 0 && daysLeft <= EXPIRY_PRIORITY_DAYS;
  });

  if (expiringItems.length > 0) {
    insights.push({
      id: nextId(),
      type: "expiry_priority",
      severity: "critical",
      title: `만료 임박 우선 소진 ${expiringItems.length}건`,
      reason: `${EXPIRY_PRIORITY_DAYS}일 이내 유효기간 만료 예정 품목이 잔량과 함께 존재합니다. 우선 소진이 필요합니다.`,
      affectedCount: expiringItems.length,
      drilldownFilter: { itemIds: expiringItems.map((i) => i.id) },
    });
  }

  // 3. Reorder needed — remaining qty / daily usage < lead time
  const reorderItems = inventories.filter((inv) => {
    if (inv.averageDailyUsage <= 0 || inv.leadTimeDays <= 0) return false;
    const daysRemaining = inv.currentQuantity / inv.averageDailyUsage;
    return daysRemaining < inv.leadTimeDays;
  });

  if (reorderItems.length > 0) {
    insights.push({
      id: nextId(),
      type: "reorder_needed",
      severity: reorderItems.length >= 3 ? "critical" : "warning",
      title: `재주문 검토 ${reorderItems.length}건`,
      reason:
        "현재 잔량을 일평균 사용량으로 나누면 납기(lead time)보다 짧습니다. 재주문을 검토하세요.",
      affectedCount: reorderItems.length,
      drilldownFilter: { itemIds: reorderItems.map((i) => i.id) },
    });
  }

  // 4. Low turnover — items with no recent usage
  const itemIdsWithUsage = new Set(recentUsage.map((r) => r.itemId));
  const lowTurnoverItems = inventories.filter(
    (inv) =>
      inv.currentQuantity > 0 && !itemIdsWithUsage.has(inv.id)
  );

  if (lowTurnoverItems.length > 0) {
    insights.push({
      id: nextId(),
      type: "low_turnover",
      severity: "info",
      title: `미사용 재고 ${lowTurnoverItems.length}건`,
      reason: `최근 기록에서 사용 이력이 없는 품목입니다. 재배치 또는 폐기 여부를 검토하세요.`,
      affectedCount: lowTurnoverItems.length,
      drilldownFilter: { itemIds: lowTurnoverItems.map((i) => i.id) },
    });
  }

  // Sort by severity
  const severityOrder: Record<InsightSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  insights.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  return insights;
}

/**
 * Generate actionable recommendations for a specific inventory item.
 */
export function generateRecommendations(
  item: InventorySnapshot,
  recentUsage: UsageRecord[],
  now: Date = new Date()
): FlowRecommendation[] {
  const recs: FlowRecommendation[] = [];

  // Expiry-based: use first
  if (item.expiryDate && item.currentQuantity > 0) {
    const daysLeft = Math.ceil(
      (new Date(item.expiryDate).getTime() - now.getTime()) / 86400000
    );
    if (daysLeft > 0 && daysLeft <= EXPIRY_PRIORITY_DAYS) {
      recs.push({
        type: "use_first",
        label: "우선 소진",
        reasoning: `유효기간 ${daysLeft}일 남음. 잔량 ${item.currentQuantity}${item.unit}을 우선 사용하세요.`,
        priority: "high",
        targetItemIds: [item.id],
      });
    } else if (daysLeft <= 0) {
      recs.push({
        type: "dispose",
        label: "폐기 검토",
        reasoning: `유효기간이 만료되었습니다. 폐기 또는 재검사를 진행하세요.`,
        priority: "high",
        targetItemIds: [item.id],
      });
    }
  }

  // Reorder check
  if (item.averageDailyUsage > 0 && item.leadTimeDays > 0) {
    const daysRemaining = item.currentQuantity / item.averageDailyUsage;
    if (daysRemaining < item.leadTimeDays) {
      recs.push({
        type: "reorder",
        label: "재주문 검토",
        reasoning: `현재 속도 기준 ${Math.round(daysRemaining)}일 후 소진 예상. 납기 ${item.leadTimeDays}일 고려 시 즉시 발주가 필요합니다.`,
        priority: daysRemaining < item.leadTimeDays * 0.5 ? "high" : "medium",
        targetItemIds: [item.id],
      });
    }
  }

  // Safety stock
  if (
    item.safetyStock !== null &&
    item.currentQuantity > 0 &&
    item.currentQuantity <= item.safetyStock
  ) {
    recs.push({
      type: "reorder",
      label: "안전 재고 이하",
      reasoning: `현재 ${item.currentQuantity}${item.unit} — 안전 재고(${item.safetyStock}${item.unit}) 이하입니다.`,
      priority: "medium",
      targetItemIds: [item.id],
    });
  }

  // No recent usage
  const itemUsage = recentUsage.filter((r) => r.itemId === item.id);
  if (itemUsage.length === 0 && item.currentQuantity > 0) {
    recs.push({
      type: "inspect",
      label: "사용 이력 확인",
      reasoning: "최근 사용 이력이 없습니다. 재고 실사 또는 재배치를 검토하세요.",
      priority: "low",
      targetItemIds: [item.id],
    });
  }

  return recs;
}

/* ── Helpers ── */

function groupUsageByItem(
  records: UsageRecord[]
): Record<string, UsageRecord[]> {
  const groups: Record<string, UsageRecord[]> = {};
  for (const r of records) {
    if (!groups[r.itemId]) groups[r.itemId] = [];
    groups[r.itemId].push(r);
  }
  return groups;
}

function sumUsageInWindow(
  records: UsageRecord[],
  windowDays: number,
  now: Date
): number {
  const cutoff = now.getTime() - windowDays * 86400000;
  return records
    .filter((r) => new Date(r.date).getTime() >= cutoff)
    .reduce((sum, r) => sum + r.quantity, 0);
}

/* ── Insight display helpers ── */

export function getInsightIcon(type: InsightType): string {
  const icons: Record<InsightType, string> = {
    usage_spike: "TrendingUp",
    expiry_priority: "Clock",
    reorder_needed: "ShoppingCart",
    low_turnover: "Archive",
    location_mismatch: "MapPin",
    receiving_delay: "Truck",
  };
  return icons[type];
}

export function getInsightColor(severity: InsightSeverity): {
  bg: string;
  text: string;
  border: string;
  iconBg: string;
} {
  const colors: Record<InsightSeverity, { bg: string; text: string; border: string; iconBg: string }> = {
    critical: { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA", iconBg: "#FEE2E2" },
    warning: { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A", iconBg: "#FEF3C7" },
    info: { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE", iconBg: "#DBEAFE" },
  };
  return colors[severity];
}
