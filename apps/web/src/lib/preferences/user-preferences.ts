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

interface UserPreferencesResponse {
  preferences: UserPreferencesJson | null;
}

type ColumnPrefsPatch = {
  widths?: Record<string, number>;
  visibility?: Record<string, boolean>;
  order?: string[];
};

// §11.230c (a)-2/(a)-3 — PATCH body type 확장 (briefingCollapsed + quotesView optional).
type UserPreferencesPatch = {
  columnPrefs?: { quotes?: ColumnPrefsPatch };
  briefingCollapsed?: boolean;
  quotesView?: QuotesViewPatch;
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

  // Cleanup on unmount — pending mutation 발화 차단.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    preferences: query.data?.preferences ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    updateColumnPrefs,
    updateBriefingCollapsed,
    updateQuotesView,
    isPatching: mutation.isPending,
  };
}
