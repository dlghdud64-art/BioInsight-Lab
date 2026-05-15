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
  [key: string]: unknown;
}

interface UserPreferencesResponse {
  preferences: UserPreferencesJson | null;
}

type ColumnPrefsPatch = {
  widths?: Record<string, number>;
  visibility?: Record<string, boolean>;
  order?: string[];
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
  patch: { columnPrefs?: { quotes?: ColumnPrefsPatch } },
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
    isPatching: mutation.isPending,
  };
}
