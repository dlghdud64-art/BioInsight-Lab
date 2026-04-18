import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api";
import type {
  Quote,
  QuoteDetail,
  QuoteStatusHistory,
  PurchaseRecord,
  ProductInventory,
  DashboardSummary,
  Inspection,
  InspectionResult,
  InspectionChecklist,
} from "../types";

// ─── 대시보드 ───────────────────────────────────────────────────────

export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const [quotesRes, inventoryRes, allInventoryRes] = await Promise.allSettled([
        apiClient.get("/api/quotes", { params: { status: "PENDING", limit: 1 } }),
        apiClient.get("/api/inventory/reorder-recommendations"),
        apiClient.get("/api/inventory"),
      ]);

      const pendingQuotes =
        quotesRes.status === "fulfilled"
          ? (quotesRes.value.data?.quotes?.length ?? quotesRes.value.data?.total ?? 0)
          : 0;

      const lowStockItems =
        inventoryRes.status === "fulfilled"
          ? (inventoryRes.value.data?.recommendations?.length ?? 0)
          : 0;

      // 점검 필요: lastInspectedAt 없거나 30일 경과
      let pendingInspections = 0;
      if (allInventoryRes.status === "fulfilled") {
        const inventories = allInventoryRes.value.data?.inventories ?? [];
        const threshold = 30 * 24 * 60 * 60 * 1000;
        pendingInspections = inventories.filter((inv: any) => {
          const last = inv.lastInspectedAt ? new Date(inv.lastInspectedAt).getTime() : 0;
          return !last || Date.now() - last > threshold;
        }).length;
      }

      return {
        pendingQuotes,
        lowStockItems,
        pendingInspections,
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
      qc.invalidateQueries({ queryKey: ["quote-history", id] });
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
      qc.invalidateQueries({ queryKey: ["quotes"] });
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
      qc.invalidateQueries({ queryKey: ["quote-history", id] });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useQuoteHistory(quoteId: string) {
  return useQuery<QuoteStatusHistory[]>({
    queryKey: ["quote-history", quoteId],
    queryFn: async () => {
      const res = await apiClient.get(`/api/quotes/${quoteId}/history`);
      return res.data?.history ?? [];
    },
    enabled: !!quoteId,
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
      const created = res.data?.records?.[0];
      return { ...res.data, purchaseId: created?.id ?? null } as {
        totalRows: number;
        successRows: number;
        errorRows: number;
        purchaseId: string | null;
      };
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
      purchaseId,
    }: {
      id: string;
      quantity: number;
      lotNumber?: string;
      expiryDate?: string;
      notes?: string;
      purchaseId?: string;
    }) => {
      const res = await apiClient.post(`/api/inventory/${id}/restock`, {
        quantity,
        lotNumber,
        expiryDate,
        notes,
        purchaseId,
      });
      return res.data;
    },
    onSuccess: (_, { id, purchaseId }) => {
      qc.invalidateQueries({ queryKey: ["inventories"] });
      qc.invalidateQueries({ queryKey: ["inventory", id] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      // 구매→재고 반영 후 구매 상세도 갱신 (followUpStatus 반영)
      if (purchaseId) {
        qc.invalidateQueries({ queryKey: ["purchase", purchaseId] });
      }
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

// ─── 재고 lookup ─────────────────────────────────────────────────────

export async function lookupInventory(params: {
  catalogNumber?: string;
  productName?: string;
}): Promise<string | null> {
  const query = new URLSearchParams();
  if (params.catalogNumber) query.set("catalogNumber", params.catalogNumber);
  if (params.productName) query.set("productName", params.productName);
  const res = await apiClient.get(`/api/inventory/lookup?${query.toString()}`);
  return res.data?.inventoryId ?? null;
}

export function useCreateInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      productName: string;
      catalogNumber?: string;
      unit?: string;
      currentQuantity?: number;
    }) => {
      const res = await apiClient.post("/api/inventory", data);
      return res.data?.inventory as ProductInventory;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventories"] });
    },
  });
}

// ─── 점검 ────────────────────────────────────────────────────────────

export function useInspections(inventoryId: string) {
  return useQuery<Inspection[]>({
    queryKey: ["inspections", inventoryId],
    queryFn: async () => {
      const res = await apiClient.get(`/api/inventory/${inventoryId}/inspection`);
      return res.data?.inspections ?? [];
    },
    enabled: !!inventoryId,
  });
}

export function useCreateInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      result,
      checklist,
      notes,
      photoUrls,
    }: {
      id: string;
      result: InspectionResult;
      checklist: InspectionChecklist;
      notes?: string;
      photoUrls?: string[];
    }) => {
      const res = await apiClient.post(`/api/inventory/${id}/inspection`, {
        result,
        checklist,
        notes,
        photoUrls,
      });
      return res.data;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["inspections", id] });
      qc.invalidateQueries({ queryKey: ["inventory", id] });
      qc.invalidateQueries({ queryKey: ["inventories"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}
