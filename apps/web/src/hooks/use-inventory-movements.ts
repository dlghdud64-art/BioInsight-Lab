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
  /** 필터 조건 하의 전체 건수(페이지네이션용). */
  total: number;
  /** true = 요청 깊이가 서버 스캔 상한 초과 → 정렬 보장 불가(기간 필터로 좁혀야 함). */
  truncated: boolean;
  isLoading: boolean;
  isError: boolean;
}

/** §inventory-history-screen — 전수 화면용 옵션. 미전달 시 브리핑 기존 동작(기본 5·전체 기간) 유지. */
export interface InventoryMovementsOptions {
  limit?: number;
  enabled?: boolean;
  /** ISO 또는 yyyy-MM-dd. 미전달 = 전체 기간. */
  from?: string;
  to?: string;
  offset?: number;
}

const EMPTY: InventoryMovementItem[] = [];

export function useInventoryMovements(
  inventoryId: string | undefined,
  opts: InventoryMovementsOptions = {},
): UseInventoryMovementsResult {
  const limit = opts.limit ?? 5;
  const offset = opts.offset ?? 0;
  const from = opts.from ?? "";
  const to = opts.to ?? "";
  const { data, isLoading, isError } = useQuery({
    queryKey: ["inventory-movements", inventoryId, limit, offset, from, to],
    enabled: Boolean(inventoryId) && opts.enabled !== false,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (offset > 0) params.set("offset", String(offset));
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/inventory/${inventoryId}/movements?${params.toString()}`);
      if (!res.ok) throw new Error("movements fetch failed");
      return res.json();
    },
  });

  const movements: InventoryMovementItem[] = Array.isArray(data?.movements)
    ? data.movements
    : EMPTY;

  const total = typeof data?.total === "number" ? data.total : movements.length;
  const truncated = data?.truncated === true;

  return { movements, total, truncated, isLoading, isError };
}
