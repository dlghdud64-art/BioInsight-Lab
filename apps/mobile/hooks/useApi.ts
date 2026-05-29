import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, API_BASE_URL } from "../lib/api";
import type {
  Quote,
  QuoteDetail,
  QuoteApproval,
  QuoteStatusHistory,
  PurchaseRecord,
  ProductInventory,
  DashboardSummary,
  Inspection,
  InspectionResult,
  InspectionChecklist,
  NotificationItem,
  OrderDetail,
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

/**
 * §11.209d-mobile Phase 2 — quote 결재 정보 hook.
 * /api/quotes/[id] response.approval 매핑. Option A (visualization only):
 * mutation 은 web 또는 §11.209d-mobile-mutation 후속 batch.
 */
export function useQuoteApproval(id: string) {
  return useQuery<QuoteApproval | null>({
    queryKey: ["quote-approval", id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/quotes/${id}`);
      return res.data?.approval ?? null;
    },
    enabled: !!id,
  });
}

/**
 * §11.209d-mobile-request-approval-cta — 결재 요청 mutation.
 * canonical truth = web POST /api/work-queue/purchase-conversion/[id]/request-approval.
 * server-side 8-step validation (in_app_approval policy + 본인 소유 +
 * DUPLICATE_PENDING 차단 + 결재자 자동 매핑 — workspace 첫 ADMIN/OWNER).
 * caller 가 canRequestApproval === true 일 때만 visible (dead button 0).
 *
 * Invalidation: 4 keys 동시 (NOT_REQUIRED → PENDING 전환 시 status badge +
 * approval card visibility + 카운터 sync).
 */
export function useRequestApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ quoteId }: { quoteId: string }) => {
      const res = await apiClient.post(
        `/api/work-queue/purchase-conversion/${quoteId}/request-approval`,
      );
      return res.data;
    },
    onSuccess: (_, { quoteId }) => {
      qc.invalidateQueries({ queryKey: ["quote-approval", quoteId] });
      qc.invalidateQueries({ queryKey: ["quote", quoteId] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

/**
 * §11.209d-mobile-mutation — 결재 승인 mutation.
 * canonical truth = web POST /api/request/[id]/approve. mobile = thin wrapper.
 * caller 가 canApprove === true 일 때만 visible (dead button 0).
 *
 * Invalidation: quote-approval / quote / quotes / dashboard-summary 모두
 * 갱신 (status badge + history + 대시보드 결재 대기 카운터 sync).
 */
export function useApproveQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      quoteId: _quoteId,
      requestId,
    }: {
      quoteId: string;
      requestId: string;
    }) => {
      const res = await apiClient.post(`/api/request/${requestId}/approve`);
      return res.data;
    },
    onSuccess: (_, { quoteId }) => {
      qc.invalidateQueries({ queryKey: ["quote-approval", quoteId] });
      qc.invalidateQueries({ queryKey: ["quote", quoteId] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

/**
 * §11.209d-mobile-mutation — 결재 반려 mutation.
 * canonical truth = web POST /api/request/[id]/reject. body { reason }.
 * caller 가 canApprove === true 일 때만 visible.
 */
export function useRejectQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      quoteId: _quoteId,
      requestId,
      reason,
    }: {
      quoteId: string;
      requestId: string;
      reason: string;
    }) => {
      const res = await apiClient.post(`/api/request/${requestId}/reject`, {
        reason,
      });
      return res.data;
    },
    onSuccess: (_, { quoteId }) => {
      qc.invalidateQueries({ queryKey: ["quote-approval", quoteId] });
      qc.invalidateQueries({ queryKey: ["quote", quoteId] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
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

// ─── §11.319 시약 라벨 스캔 (OCR) ────────────────────────────────────
//
// Boundary A (호영님 2026-05-29): 모바일 = OCR 라벨 촬영 → web canonical
//   POST /api/inventory/scan-label 재사용(별도 mobile route 0). 응답 shape 은
//   web LabelScannerModal 의 ScanApiResponse 와 1:1. 신뢰도 기반 재촬영 권유는
//   mapOcrConfidence(parsed.confidence) 로 처리. 클라이언트 흐림/조명 휴리스틱은
//   웹 전용(Phase 3) — 모바일은 OCR 추출 신뢰도 기반.

export interface LabelScanParsed {
  productName: string | null;
  catalogNo: string | null;
  lotNo: string | null;
  expirationDate: string | null;
  quantity: string | null;
  brand: string | null;
  casNumber: string | null;
  confidence: "high" | "medium" | "low";
}

export interface LabelScanResponse {
  success: boolean;
  parsed: LabelScanParsed;
  matchedProduct: {
    id: string;
    name: string;
    brand: string | null;
    catalogNumber: string | null;
  } | null;
  matchedInventory: {
    id: string;
    lotNumber: string | null;
    currentQuantity: number;
    unit: string | null;
  } | null;
  ocrMetadata?: {
    jobId: string | null;
    providerUsed: "GEMINI" | "CLOUD_VISION_CLAUDE" | "REGEX";
    cached: boolean;
  } | null;
  suggestions: {
    isNewProduct: boolean;
    isNewLot: boolean;
    isExistingLot: boolean;
    action: "restock" | "new_lot" | "new_product";
  };
}

/**
 * §11.319 — 시약 라벨 OCR. imageBase64(data URI) 를 web canonical
 * POST /api/inventory/scan-label 로 전송. Bearer token 자동 주입(apiClient).
 */
export async function scanLabel(imageBase64: string): Promise<LabelScanResponse> {
  const res = await apiClient.post("/api/inventory/scan-label", { imageBase64 });
  return res.data as LabelScanResponse;
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

// ─── #post-approval-purchase-order-flow Phase 4.3 + 1.2 — Order tracking ─────

/**
 * canonical truth = 1 Quote → N Order (vendor 별, option A 정합).
 * Phase 1.2 swap: return type `OrderDetail | null` → `OrderDetail[]`
 * (response shape `{ order }` → `{ orders }`). orders empty 시 UI 가 hide.
 */
export function useOrderByQuote(quoteId: string) {
  return useQuery<OrderDetail[]>({
    queryKey: ["order-by-quote", quoteId],
    queryFn: async () => {
      const res = await apiClient.get(`/api/orders/by-quote/${quoteId}`);
      return (res.data?.orders ?? []) as OrderDetail[];
    },
    enabled: !!quoteId,
    staleTime: 30_000,
  });
}

/**
 * #post-approval-purchase-order-flow Phase 4.2-G — mobile PDF download.
 * 현장/엣지 도구 — 출장 중 vendor 발송 직전 PDF 미리보기 / 외부 share.
 *
 * 흐름: server GET /api/orders/[id]/generate-pdf (idempotent, POST 와 동일
 * 동작) → expo-file-system downloadAsync → cacheDirectory 안 .pdf 저장
 * → expo-sharing shareAsync (iOS share sheet / Android intent).
 *
 * 의존:
 *   - expo-file-system (host install: `npx expo install expo-file-system`)
 *   - expo-sharing (이미 설치됨 — apps/mobile/package.json)
 */
export function useDownloadOrderPdf() {
  return useMutation({
    mutationFn: async ({
      orderId,
      orderNumber,
      poDocumentUrl,
    }: {
      orderId: string;
      orderNumber: string;
      /**
       * Phase 2.3 step 4 — 영속화된 PDF storage URL. 있으면 직접 download
       * (재생성 0). 미전달 시 generate-pdf endpoint 호출 (PDF 생성 + storage
       * upload + db update + stream).
       */
      poDocumentUrl?: string | null;
    }) => {
      // dynamic import — host 측 expo-file-system install 후 정상 작동
      const FileSystem = await import("expo-file-system");
      const Sharing = await import("expo-sharing");
      const token = (apiClient.defaults.headers as any)?.common?.Authorization;
      const uri = `${FileSystem.cacheDirectory ?? ""}${orderNumber}.pdf`;
      // poDocumentUrl 우선 — storage URL 이 already public/signed 라 token 0
      const downloadUrl =
        poDocumentUrl ?? `${API_BASE_URL}/api/orders/${orderId}/generate-pdf`;
      const downloadResult = await FileSystem.downloadAsync(
        downloadUrl,
        uri,
        token && !poDocumentUrl
          ? { headers: { Authorization: String(token) } }
          : undefined,
      );
      if (downloadResult.status !== 200) {
        throw new Error(`PDF 다운로드 실패 (status ${downloadResult.status})`);
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
        });
      }
      return { uri: downloadResult.uri };
    },
  });
}

/**
 * #post-approval-purchase-order-flow Phase 4.2-A2 — vendor email 발송
 * (POST /api/orders/[id]/send-email). server-side vendor.email 422 분기 +
 * audit log. mobile 은 현장/엣지 도구 — 출장 중 vendor 발송 트리거에 사용.
 */
export function useSendOrderEmail() {
  return useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      const res = await apiClient.post(`/api/orders/${orderId}/send-email`);
      return res.data;
    },
  });
}

/**
 * Order status 변경 (PATCH /api/orders/[id]).
 * onSuccess invalidate ['order' / 'order-by-quote'].
 */
export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId: _orderId,
      status,
      orderId,
    }: {
      orderId: string;
      status: string;
    }) => {
      const res = await apiClient.patch(`/api/orders/${orderId}`, { status });
      return res.data;
    },
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["order-by-quote"] });
      qc.invalidateQueries({ queryKey: ["quote"] });
    },
  });
}

// ─── §11.209d-notification-inapp-mobile-screen — in-app 알림 ────────

/**
 * §11.209d-notification-inapp-mobile-screen — IN_APP 알림 list + unread count.
 * canonical truth = /api/notifications GET (web/mobile 동일). 1분 폴링 —
 * SSE/WebSocket 별도 batch.
 */
export function useNotifications() {
  return useQuery<{ notifications: NotificationItem[]; unreadCount: number }>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await apiClient.get("/api/notifications", {
        params: { actionType: "IN_APP", limit: 20 },
      });
      return {
        notifications: res.data?.notifications ?? [],
        unreadCount: res.data?.unreadCount ?? 0,
      };
    },
    refetchInterval: 60_000,
  });
}

/**
 * §11.209d-notification-inapp-mobile-screen — 개별 알림 read 처리.
 * server validation: 본인 소유 NotificationAction 만 read 가능.
 */
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/api/notifications/${id}/read`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
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

/**
 * §11.229b-4 #mobile-vendor-request-org-book — 호영님 §11.229b-3 자연 후속.
 *
 * useOrgVendors(organizationId) — 조직 등록 vendor directory query.
 *   GET /api/organizations/[id]/vendors. modal "공급사 등록 목록" section 용.
 */
export function useOrgVendors(organizationId: string | null | undefined) {
  return useQuery<{
    vendors: Array<{
      id: string;
      vendorName: string;
      vendorEmail: string;
      isPrimary: boolean;
    }>;
  }>({
    queryKey: ["org-vendors", organizationId ?? "none"],
    queryFn: async () => {
      const res = await apiClient.get(`/api/organizations/${organizationId}/vendors`);
      return res.data;
    },
    enabled: !!organizationId,
    staleTime: 60_000,
  });
}

// ─── §11.250-pref-mobile — Notification Preference Toggles (mobile sync) ────
//
// 호영님 spec: §11.250-pref (in-app filter) + §11.250-pref-ui (web settings 토글)
//   + §11.250-pref-push (mobile push filter) 의 mobile UI 동기.
//   사용자가 mobile/web 어느 surface 에서든 토글 → server preference (User.
//   preferences.notificationToggles) 즉시 sync → cross-platform 1:1 정합.
//
// canonical truth lock:
//   - web `/api/user/preferences` GET/PATCH 시그니처 reuse (별도 mobile route 0).
//   - User.preferences.notificationToggles Json field reuse (schema 0).
//   - 7 카테고리 (event-category-map) — web + mobile 1:1.
//   - default true 보존 (preference 미설정 사용자 영향 0).

export interface UserPreferencesJson {
  notificationToggles?: {
    stock_alert?: boolean;
    quote_arrived?: boolean;
    approval_pending?: boolean;
    expiry_warning?: boolean;
    safety_alert?: boolean;
    delivery_complete?: boolean;
    system?: boolean;
  };
  [key: string]: unknown;
}

export interface NotificationTogglesPatch {
  stock_alert?: boolean;
  quote_arrived?: boolean;
  approval_pending?: boolean;
  expiry_warning?: boolean;
  safety_alert?: boolean;
  delivery_complete?: boolean;
  system?: boolean;
}

/**
 * §11.250-pref-mobile — server preference fetch (mobile).
 *   web `/api/user/preferences` GET 시그니처 reuse. Bearer token 자동 주입.
 */
export function useUserPreferences() {
  return useQuery<{ preferences: UserPreferencesJson | null }>({
    queryKey: ["user-preferences"],
    queryFn: async () => {
      const res = await apiClient.get("/api/user/preferences");
      return res.data;
    },
    staleTime: 60_000,
    retry: 1,
  });
}

/**
 * §11.250-pref-mobile — notification toggle mutation (mobile).
 *   web `/api/user/preferences` PATCH 시그니처 reuse. partial update
 *   (한 카테고리 토글 시 다른 카테고리 보존). invalidateQueries 으로 cache sync.
 */
export function useUpdateNotificationToggles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: NotificationTogglesPatch) => {
      const res = await apiClient.patch("/api/user/preferences", {
        notificationToggles: patch,
      });
      return res.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(["user-preferences"], data);
      qc.invalidateQueries({ queryKey: ["user-preferences"] });
    },
  });
}

// ─── §11.250g-2 — Compare Session Detail (mobile detail surface) ────────────
//
// 호영님 spec: §11.250g push notification ("AI 비교 분석 완료") tap 시 ROUTE_MAP
//   .compare 가 /(tabs) dashboard fallback → 사용자 confusion. detail screen
//   `/compare/[id]` 가 본 hook 으로 server fetch + insight 표시.
//
// canonical truth lock:
//   - GET /api/compare-sessions/[id] route reuse (server schema 0).
//   - CompareSession.aiInsight Json (keyChanges + recommendedActions) 표시.

export interface CompareInsightShape {
  keyChanges?: string[];
  recommendedActions?: string[];
  [key: string]: unknown;
}

export interface CompareSessionDetail {
  session: {
    id: string;
    productIds?: string[];
    aiInsight?: CompareInsightShape | null;
    userId?: string | null;
    organizationId?: string | null;
    createdAt?: string;
    updatedAt?: string;
    decisionState?: string | null;
    decisionNote?: string | null;
  };
  linkedQuotes?: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
  inquiryDrafts?: Array<{
    id: string;
    vendorName: string;
    productName: string;
    status: string;
  }>;
  latestActionAt?: string;
}

/**
 * §11.250g-2 — Compare Session detail fetch (mobile).
 *   web GET /api/compare-sessions/[id] reuse. Bearer token 자동 주입.
 */
export function useCompareSession(id: string) {
  return useQuery<CompareSessionDetail>({
    queryKey: ["compare-session", id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/compare-sessions/${id}`);
      return res.data;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}
