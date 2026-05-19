/**
 * §11.258c #sourcing-search-autocomplete — client hook.
 *
 * useAutocomplete(query) → { items, isLoading }
 *
 * 정책:
 *   - debounce 300ms (호영님 spec).
 *   - 2글자 미만 시 fetch 차단 + 빈 items.
 *   - unmount / new query 시 setTimeout cleanup.
 *   - 에러 silent (UI dropdown 만 빈 상태로).
 *
 * 사용처: search/page.tsx 모바일 form (§11.258a) 안 input 변경 시 호출.
 */

"use client";

import { useEffect, useState } from "react";

export interface AutocompleteItem {
  type: "product" | "brand" | "catalog";
  label: string;
  value: string;
}

export function useAutocomplete(query: string): {
  items: AutocompleteItem[];
  isLoading: boolean;
} {
  const [items, setItems] = useState<AutocompleteItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    // §11.258c — 2글자 미만 fetch 차단.
    if (trimmed.length < 2) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    // §11.258c — debounce 300ms (호영님 spec).
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/search/autocomplete?q=${encodeURIComponent(trimmed)}&limit=5`,
        );
        if (!res.ok) throw new Error("autocomplete fetch failed");
        const json = (await res.json()) as { items: AutocompleteItem[] };
        if (!cancelled) {
          setItems(Array.isArray(json.items) ? json.items : []);
        }
      } catch {
        // silent fallback — autocomplete 는 optional UX, dropdown 만 빈 상태.
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return { items, isLoading };
}
