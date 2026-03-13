import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api";
import type {
  Quote,
  QuoteDetail,
  PurchaseRecord,
  ProductInventory,
  DashboardSummary,
} from "../types";

// ─── 대시보드 ───────────────────────────────────────────────────────

export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const [quotesRes, inventoryRes] = await Promise.allSettled([
        apiClient.get("/api/quotes", { params: { status: "PENDING", limit: 1 } }),
        apiClient.get("/api/inventory/reorder-recommendations"),
      ]);

      const pendingQuotes =
        quotesRes.status === "fulfilled"
          ? (quotesRes.value.data?.quotes?.length ?? quotesRes.value.data?.total ?? 0)
          : 0;

      const lowStockItems =
        inventoryRes.status === "fulfilled"
          ? (inventoryRes.value.data?.recommendations?.length ?? 0)
          : 0;

      return {
        pendingQuotes,
        lowStockItems,
        pendingInspections: 0,
        recentPurchases: 0,
      };
    },
  });
}

// ─── 견적 ────────────────────────────────────────────────────────────

export function useQuotes(status?: string) {
  return useQuery<Quote[]>({
    queryKey: ["quotes", status],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (status && status !== "ALL") params.status = status;
      const res = await apiClient.get("/api/quotes", { params });
      return res.data?.quotes ?? res.data ?? [];
    },
  });
}

export function useQuoteDetail(id: string) {
  return useQuery<QuoteDetail>({
    queryKey: ["quote", id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/quotes/${id}`);
      return res.data?.quote ?? res.data;
    },
    enabled: !!id,
  });
}

export function useUpdateQuoteStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiClient.post(`/api/quotes/${id}/status`, { status });
      return res.data;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote", id] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useUpdateQuoteMemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, description }: { id: string; description: string }) => {
      const res = await apiClient.patch(`/api/quotes/${id}`, { description });
      return res.data;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["quote", id] });
    },
  });
}

export function useConvertQuoteToOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const res = await apiClient.patch(`/api/quotes/${id}`, { status: "PURCHASED" });
      return res.data;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote", id] });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

// ─── 구매 ────────────────────────────────────────────────────────────

export function usePurchases() {
  return useQuery<PurchaseRecord[]>({
    queryKey: ["purchases"],
    queryFn: async () => {
      const res = await apiClient.get("/api/purchases");
      return res.data?.records ?? res.data ?? [];
    },
  });
}

export function usePurchaseDetail(id: string) {
  return useQuery<PurchaseRecord>({
    queryKey: ["purchase", id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/purchases/${id}`);
      return res.data?.record ?? res.data;
    },
    enabled: !!id,
  });
}

export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<PurchaseRecord>) => {
      // 단건 등록: rows[] 형태로 감싸서 batch import API 사용
      const row = {
        purchasedAt: data.purchasedAt || new Date().toISOString(),
        vendorName: data.vendor || "-",
        itemName: data.productName || "",
        catalogNumber: data.catalogNumber,
        unit: data.unit,
        qty: data.quantity || 1,
        amount: data.amount,
        category: data.category,
      };
      const res = await apiClient.post("/api/purchases/import", { rows: [row] });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useBatchImportPurchases() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { rows: Array<Record<string, any>> }) => {
      const res = await apiClient.post("/api/purchases/import", data);
      return res.data as { totalRows: number; successRows: number; errorRows: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

// ─── 재고 ────────────────────────────────────────────────────────────

export function useInventory() {
  return useQuery<ProductInventory[]>({
    queryKey: ["inventories"],
    queryFn: async () => {
      const res = await apiClient.get("/api/inventory");
      return res.data?.inventories ?? res.data ?? [];
    },
  });
}

export function useInventoryDetail(id: string) {
  return useQuery<ProductInventory>({
    queryKey: ["inventory", id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/inventory/${id}`);
      return res.data?.inventory ?? res.data;
    },
    enabled: !!id,
  });
}

export function useUpdateInventoryLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, location }: { id: string; location: string }) => {
      const res = await apiClient.patch(`/api/inventory/${id}`, { location });
      return res.data;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["inventories"] });
      qc.invalidateQueries({ queryKey: ["inventory", id] });
    },
  });
}

export function useRestockInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      quantity,
      lotNumber,
      expiryDate,
      notes,
    }: {
      id: string;
      quantity: number;
      lotNumber?: string;
      expiryDate?: string;
      notes?: string;
    }) => {
      const res = await apiClient.post(`/api/inventory/${id}/restock`, {
        quantity,
        lotNumber,
        expiryDate,
        notes,
      });
      return res.data;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["inventories"] });
      qc.invalidateQueries({ queryKey: ["inventory", id] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useConsumeInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      quantity,
      notes,
      lotNumber,
      type = "DISPATCH",
    }: {
      id: string;
      quantity: number;
      notes?: string;
      lotNumber?: string;
      type?: "DISPATCH" | "USAGE";
    }) => {
      const res = await apiClient.post(`/api/inventory/${id}/use`, {
        quantity,
        notes,
        lotNumber,
        type,
      });
      return res.data;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["inventories"] });
      qc.invalidateQueries({ queryKey: ["inventory", id] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}
