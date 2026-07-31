/**
 * §inventory-brief-canonical P3 — 품목 최근 입출고 훅.
 *   canonical: GET /api/inventory/[id]/movements (InventoryRestock + InventoryUsage 병합,
 *   재고 ownership 게이트). 브리핑 mock(generateMockTransactions) 대체.
 *   표시 계층 전용 — mutation 0. enabled 게이트로 패널 open 시에만 조회.
 */
import { useQuery } from "@tanstack/react-query";

export interface InventoryMovementItem {
  id: string;
  type: "in" | "incoming" | "out";
  label: string;
  detail: string;
  occurredAt: string;
  quantity: number;
  unit: string | null;
  actor: string | null;
}

export interface UseInventoryMovementsResult {
  movements: InventoryMovementItem[];
  isLoading: boolean;
  isError: boolean;
}

const EMPTY: InventoryMovementItem[] = [];

export function useInventoryMovements(
  inventoryId: string | undefined,
  opts: { limit?: number; enabled?: boolean } = {},
): UseInventoryMovementsResult {
  const limit = opts.limit ?? 5;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["inventory-movements", inventoryId, limit],
    enabled: Boolean(inventoryId) && opts.enabled !== false,
    queryFn: async () => {
      const res = await fetch(`/api/inventory/${inventoryId}/movements?limit=${limit}`);
      if (!res.ok) throw new Error("movements fetch failed");
      return res.json();
    },
  });

  const movements: InventoryMovementItem[] = Array.isArray(data?.movements)
    ? data.movements
    : EMPTY;

  return { movements, isLoading, isError };
}
