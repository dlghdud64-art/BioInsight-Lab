/**
 * §inventory-delta-label-kpi P2b-1 — 품목 소진 추이 훅.
 *   canonical: /api/inventory/usage (db.inventoryUsage) 재사용. 신규 route 0.
 *   records → computeUsageTrend 파생(주버킷/<2주 폴백). 표시 계층 전용.
 */
import { useQuery } from "@tanstack/react-query";
import { computeUsageTrend, type UsageTrendResult } from "@/lib/inventory/usage-trend";

export interface UseInventoryUsageTrendResult {
  trend: UsageTrendResult;
  isLoading: boolean;
  isError: boolean;
  recordCount: number;
}

const EMPTY_TREND: UsageTrendResult = {
  granularity: "week",
  points: [],
  totalUsage: 0,
  recordCount: 0,
};

export function useInventoryUsageTrend(
  inventoryId: string | undefined,
  opts: { limit?: number; enabled?: boolean } = {},
): UseInventoryUsageTrendResult {
  const limit = opts.limit ?? 200;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["inventory-usage-trend", inventoryId, limit],
    enabled: Boolean(inventoryId) && opts.enabled !== false,
    queryFn: async () => {
      const res = await fetch(`/api/inventory/usage?inventoryId=${inventoryId}&limit=${limit}`);
      if (!res.ok) throw new Error("usage fetch failed");
      return res.json();
    },
  });

  const records = Array.isArray(data?.records)
    ? data.records.map((r: any) => ({ usageDate: r.usageDate, quantity: r.quantity }))
    : [];
  const trend = records.length > 0 ? computeUsageTrend(records) : EMPTY_TREND;

  return { trend, isLoading, isError, recordCount: records.length };
}
