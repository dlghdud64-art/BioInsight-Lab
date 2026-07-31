/**
 * §inventory-brief-canonical P3 — 품목 최근 수정 이력 훅.
 *   canonical: GET /api/inventory/[id]/history (DataAuditLog entity-scoped,
 *   재고 ownership 게이트). 브리핑 하드코딩 이력(김연구원·수량 조정 5→3) 대체.
 *   표시 계층 전용 — mutation 0. enabled 게이트로 섹션 펼침 시에만 조회.
 */
import { useQuery } from "@tanstack/react-query";

export interface InventoryHistoryChangeItem {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
}

export interface InventoryHistoryItem {
  id: string;
  action: string;
  occurredAt: string;
  actor: string | null;
  changes: InventoryHistoryChangeItem[];
}

export interface UseInventoryHistoryResult {
  history: InventoryHistoryItem[];
  isLoading: boolean;
  isError: boolean;
}

const EMPTY: InventoryHistoryItem[] = [];

export function useInventoryHistory(
  inventoryId: string | undefined,
  opts: { limit?: number; enabled?: boolean } = {},
): UseInventoryHistoryResult {
  const limit = opts.limit ?? 5;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["inventory-history", inventoryId, limit],
    enabled: Boolean(inventoryId) && opts.enabled !== false,
    queryFn: async () => {
      const res = await fetch(`/api/inventory/${inventoryId}/history?limit=${limit}`);
      if (!res.ok) throw new Error("history fetch failed");
      return res.json();
    },
  });

  const history: InventoryHistoryItem[] = Array.isArray(data?.history) ? data.history : EMPTY;

  return { history, isLoading, isError };
}
