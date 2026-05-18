"use client";

/**
 * §11.230c (a) #user-preferences-server-persist — 호영님 §11.230b 백로그 잔재.
 *
 * useUserPreferences hook — server-first cross-device sync 정합.
 *
 *   - useQuery: GET /api/user/preferences (mount + cache).
 *   - useMutation: PATCH /api/user/preferences (debounce 400ms).
 *   - rapid mutation (column resize 등) silent absorb. 마지막 setColumnPrefs
 *     trigger 만 server 도달.
 *   - error silent — client localStorage fallback 으로 graceful degrade.
 *
 * canonical truth lock:
 *   - server preferences = source. local cache = TanStack Query cache.
 *   - mutation 결과 useQuery cache invalidate (refetch 0, 마지막 patched 반영).
 *   - debounce 는 setTimeout 만 (lodash 의존 0).
 */

import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface UserPreferencesJson {
  columnPrefs?: {
    quotes?: {
      widths?: Record<string, number>;
      visibility?: Record<string, boolean>;
      order?: string[];
    };
  };
  // §11.230c (a)-2 — briefingCollapsed server-persist. §11.248e-2 localStorage reuse.
  briefingCollapsed?: boolean;
  // §11.230c (a)-3 — quotes/page viewMode + sortState server-persist.
  quotesView?: {
    mode?: "card" | "table";
    sort?: {
      key?: "title" | "status" | "itemCount" | "responseCount" | "createdAt" | null;
      direction?: "asc" | "desc";
    };
  };
  // §11.230c (a)-4 — quotes/page statusFilter + modeChip server-persist.
  quotesFilter?: {
    status?: string;
    modeChip?: string | null;
  };
  // §11.230c (a)-5 — inventory page statusFilter server-persist.
  // §11.230c (a)-8 — location + category 추가 (잔여 백로그 처리).
  inventoryFilter?: {
    status?: string;
    location?: string;
    category?: string;
  };
  // §11.230c (a)-5 — receiving page activeTab server-persist.
  receivingFilter?: {
    activeTab?: string;
  };
  // §11.230c (a)-6 — purchases page queueTab server-persist.
  purchasesFilter?: {
    queueTab?: string;
  };
  // §11.230c (a)-6 — purchase-orders page activeTab server-persist.
  purchaseOrdersFilter?: {
    activeTab?: string;
  };
  // §11.230c (a)-7 — safety page activeFrame server-persist.
  safetyFilter?: {
    activeFrame?: string;
  };
  // §11.250-pref-ui — role-aware notification toggles (7 카테고리, default true).
  notificationToggles?: {
    stock_alert?: boolean;
    quote_arrived?: boolean;
    approval_pending?: boolean;
    expiry_warning?: boolean;
    safety_alert?: boolean;
    delivery_complete?: boolean;
    system?: boolean;
  };
  // §11.250-pref-silence-ui — 방해 금지 시간 (push silence window).
  //   default off (enabled === false 또는 미설정 시 silence 적용 0).
  //   start/end "HH:mm" KST timezone. backend (§11.250-pref-silence) 정합.
  silenceWindow?: {
    enabled?: boolean;
    start?: string;
    end?: string;
  };
  [key: string]: unknown;
}

// §11.230c (a)-3 — QuotesView patch type (partial — mode 만 또는 sort 만 가능).
export type QuotesViewPatch = {
  mode?: "card" | "table";
  sort?: {
    key?: "title" | "status" | "itemCount" | "responseCount" | "createdAt" | null;
    direction?: "asc" | "desc";
  };
};

// §11.230c (a)-4 — QuotesFilter patch type (partial — status 만 또는 modeChip 만 가능).
export type QuotesFilterPatch = {
  status?: string;
  modeChip?: string | null;
};

// §11.230c (a)-5 — InventoryFilter patch type.
// §11.230c (a)-8 — location + category 추가 (잔여 백로그 처리).
export type InventoryFilterPatch = {
  status?: string;
  location?: string;
  category?: string;
};

// §11.230c (a)-5 — ReceivingFilter patch type.
export type ReceivingFilterPatch = {
  activeTab?: string;
};

// §11.230c (a)-6 — PurchasesFilter patch type.
export type PurchasesFilterPatch = {
  queueTab?: string;
};

// §11.230c (a)-6 — PurchaseOrdersFilter patch type.
export type PurchaseOrdersFilterPatch = {
  activeTab?: string;
};

// §11.230c (a)-7 — SafetyFilter patch type.
//   StrategyFrame ("balanced_ops" | ... ) 자유 string (정합은 page UI 가드).
export type SafetyFilterPatch = {
  activeFrame?: string;
};

// §11.250-pref-ui — role-aware notification toggles patch type (7 카테고리).
//   default true 보존 — 명시 false 만 dispatch filter 안 제외.
// §11.250-pref-silence-ui — SilenceWindow patch type (partial — enabled / start / end 부분 patch 가능).
export type SilenceWindowPatch = {
  enabled?: boolean;
  start?: string;
  end?: string;
};

export type NotificationTogglesPatch = {
  stock_alert?: boolean;
  quote_arrived?: boolean;
  approval_pending?: boolean;
  expiry_warning?: boolean;
  safety_alert?: boolean;
  delivery_complete?: boolean;
  system?: boolean;
};

interface UserPreferencesResponse {
  preferences: UserPreferencesJson | null;
}

type ColumnPrefsPatch = {
  widths?: Record<string, number>;
  visibility?: Record<string, boolean>;
  order?: string[];
};

// §11.230c (a)-2/(a)-3/(a)-4/(a)-5/(a)-6/(a)-7 — PATCH body type 확장.
type UserPreferencesPatch = {
  columnPrefs?: { quotes?: ColumnPrefsPatch };
  briefingCollapsed?: boolean;
  quotesView?: QuotesViewPatch;
  quotesFilter?: QuotesFilterPatch;
  inventoryFilter?: InventoryFilterPatch;
  receivingFilter?: ReceivingFilterPatch;
  purchasesFilter?: PurchasesFilterPatch;
  purchaseOrdersFilter?: PurchaseOrdersFilterPatch;
  safetyFilter?: SafetyFilterPatch;
  notificationToggles?: NotificationTogglesPatch;
  silenceWindow?: { enabled?: boolean; start?: string; end?: string };
};

const QUERY_KEY = ["user-preferences"];
const DEBOUNCE_MS = 400;

async function fetchUserPreferences(): Promise<UserPreferencesResponse> {
  const res = await fetch("/api/user/preferences");
  if (!res.ok) {
    throw new Error(`Failed to fetch user preferences (${res.status})`);
  }
  return res.json();
}

async function patchUserPreferences(
  patch: UserPreferencesPatch,
): Promise<UserPreferencesResponse> {
  const res = await fetch("/api/user/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(`Failed to patch user preferences (${res.status})`);
  }
  return res.json();
}

export function useUserPreferences(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useQuery<UserPreferencesResponse>({
    queryKey: QUERY_KEY,
    queryFn: fetchUserPreferences,
    enabled: options?.enabled ?? true,
    staleTime: 60_000, // 1 min
    retry: 1, // server 실패 시 silent fallback (localStorage)
  });

  const mutation = useMutation({
    mutationFn: patchUserPreferences,
    onSuccess: (data) => {
      // §11.230c (a) — server 응답으로 cache 갱신 (refetch 0).
      queryClient.setQueryData(QUERY_KEY, data);
    },
    // §11.230c (a) — server PATCH 실패 silent (client localStorage fallback).
    onError: () => {
      // 의도적 silent — UI fallback 으로 충분.
    },
  });

  // §11.230c (a) — debounced mutation. column resize 같은 rapid event 차단.
  const updateColumnPrefs = (patch: ColumnPrefsPatch) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      mutation.mutate({ columnPrefs: { quotes: patch } });
    }, DEBOUNCE_MS);
  };

  // §11.230c (a)-2 — briefingCollapsed server-persist (debounced).
  //   §11.248e-2 localStorage 와 양립 — 두 layer 모두 update.
  //   click 1 회당 1 mutation 이므로 debounce 가 큰 의미는 없지만,
  //   updateColumnPrefs 와 일관성 + queueing pattern 유지.
  const updateBriefingCollapsed = (value: boolean) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      mutation.mutate({ briefingCollapsed: value });
    }, DEBOUNCE_MS);
  };

  // §11.230c (a)-3 — quotesView (mode + sort) server-persist (debounced).
  //   §11.217 Phase 6 localStorage labaxis-quote-view-mode 와 양립 (viewMode).
  //   sortState 는 localStorage 0 → server-only persistence.
  //   partial update — mode 만 변경 시 sort 보존, sort 만 변경 시 mode 보존.
  const updateQuotesView = (patch: QuotesViewPatch) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      mutation.mutate({ quotesView: patch });
    }, DEBOUNCE_MS);
  };

  // §11.230c (a)-4 — quotesFilter (statusFilter + modeChip) server-persist (debounced).
  //   URL search param 우선 (URL > server > default) — page hydration logic 책임.
  //   searchQuery 는 ad-hoc 제외 (호영님 결정).
  //   partial update — status 만 변경 시 modeChip 보존, vice versa.
  const updateQuotesFilter = (patch: QuotesFilterPatch) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      mutation.mutate({ quotesFilter: patch });
    }, DEBOUNCE_MS);
  };

  // §11.230c (a)-5 — inventory page statusFilter server-persist (debounced).
  //   URL `?filter` param 우선. locationFilter / categoryFilter / lotStatusFilter 제외.
  const updateInventoryFilter = (patch: InventoryFilterPatch) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      mutation.mutate({ inventoryFilter: patch });
    }, DEBOUNCE_MS);
  };

  // §11.230c (a)-5 — receiving page activeTab server-persist (debounced).
  //   ModuleBucketKey ("ready" | ... ) 자유 string.
  const updateReceivingFilter = (patch: ReceivingFilterPatch) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      mutation.mutate({ receivingFilter: patch });
    }, DEBOUNCE_MS);
  };

  // §11.230c (a)-6 — purchases page queueTab server-persist (debounced).
  //   QueueTab ("all" | ConversionStatus) 자유 string.
  const updatePurchasesFilter = (patch: PurchasesFilterPatch) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      mutation.mutate({ purchasesFilter: patch });
    }, DEBOUNCE_MS);
  };

  // §11.230c (a)-6 — purchase-orders page activeTab server-persist (debounced).
  const updatePurchaseOrdersFilter = (patch: PurchaseOrdersFilterPatch) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      mutation.mutate({ purchaseOrdersFilter: patch });
    }, DEBOUNCE_MS);
  };

  // §11.230c (a)-7 — safety page activeFrame server-persist (debounced).
  //   StrategyFrame ("balanced_ops" | "cost_first" | ...) 자유 string.
  //   inbox 는 useState 0 → 제외 (호영님 minimum diff 결정).
  const updateSafetyFilter = (patch: SafetyFilterPatch) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      mutation.mutate({ safetyFilter: patch });
    }, DEBOUNCE_MS);
  };

  // §11.250-pref-ui — role-aware notification toggles (7 카테고리, debounced).
  //   default true 보존 — toggle off 시 명시 false 만 server 도달.
  //   dispatch filter (§11.250-pref) 안 false 시 recipient skip.
  const updateNotificationToggles = (patch: NotificationTogglesPatch) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      mutation.mutate({ notificationToggles: patch });
    }, DEBOUNCE_MS);
  };

  // §11.250-pref-silence-ui — silenceWindow (enabled / start / end) debounced patch.
  //   backend isUserInSilenceWindow (§11.250-pref-silence) 안 false 시 push skip.
  //   default off — enabled 미설정 시 silence 적용 0 (기존 사용자 영향 0).
  const updateSilenceWindow = (patch: SilenceWindowPatch) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      mutation.mutate({ silenceWindow: patch });
    }, DEBOUNCE_MS);
  };

  // Cleanup on unmount — pending mutation 발화 차단.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const patchErrorMessage =
    mutation.error instanceof Error
      ? mutation.error.message
      : mutation.error
        ? "Unknown preference update error"
        : null;

  return {
    preferences: query.data?.preferences ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    updateColumnPrefs,
    updateBriefingCollapsed,
    updateQuotesView,
    updateQuotesFilter,
    updateInventoryFilter,
    updateReceivingFilter,
    updatePurchasesFilter,
    updatePurchaseOrdersFilter,
    updateSafetyFilter,
    updateNotificationToggles,
    updateSilenceWindow,
    isPatching: mutation.isPending,
    isPatchError: mutation.isError,
    isPatchSuccess: mutation.isSuccess,
    patchErrorMessage,
  };
}
