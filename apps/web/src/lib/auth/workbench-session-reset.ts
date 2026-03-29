/**
 * Auth Boundary Reset Coordinator
 *
 * logout 시 workbench 전체 세션 상태를 완전히 끊는 단일 진입점.
 * store clear + query cache + URL reset + hydration guard.
 *
 * CLEAR 범위:
 * - compare store (productIds, productMeta, stash)
 * - compare analysis open/expanded state
 * - shortlist / hold / exclude local draft
 * - AI compare draft
 * - quote request local draft
 * - ephemeral filter/sort/view state
 * - TanStack Query cache (search/compare/request)
 * - sessionStorage ephemeral keys
 * - localStorage ephemeral keys
 *
 * 보존:
 * - DB-persisted saved objects (compare sessions, quotes, POs)
 * - account-level settings
 */

import { useCompareStore } from "@/lib/store/compare-store";

// ── localStorage ephemeral keys (session-scope) ──
const EPHEMERAL_LOCALSTORAGE_KEYS = [
  "compare-storage",
  "quote-draft-storage",
  "ai-suggestion-storage",
  "compare-analysis-state",
  "search-filter-state",
  "search-sort-state",
  "compare-candidate-actions",
  "compare-shortlist-draft",
];

// ── sessionStorage ephemeral keys ──
const EPHEMERAL_SESSIONSTORAGE_KEYS = [
  "compare-rail-open",
  "compare-analysis-open",
  "search-query-state",
  "last-search-query",
  "compare-scroll-position",
  "workbench-view-mode",
];

/**
 * resetWorkbenchSessionOnLogout — auth boundary 전체 리셋
 *
 * 이 함수는 signOut() 호출 직전에 실행.
 * store/cache/storage/URL을 모두 초기화.
 */
export function resetWorkbenchSessionOnLogout(): void {
  if (typeof window === "undefined") return;

  // 1. Zustand compare store 초기화
  try {
    const store = useCompareStore.getState();
    store.clearProducts();
    store.clearStash();
  } catch {
    // store 미초기화 상태에서도 안전
  }

  // 2. localStorage ephemeral keys 제거
  for (const key of EPHEMERAL_LOCALSTORAGE_KEYS) {
    try { window.localStorage.removeItem(key); } catch { /* ignore */ }
  }

  // 3. sessionStorage ephemeral keys 제거
  for (const key of EPHEMERAL_SESSIONSTORAGE_KEYS) {
    try { window.sessionStorage.removeItem(key); } catch { /* ignore */ }
  }

  // 4. Reset timestamp 기록 (hydration guard용)
  try {
    window.localStorage.setItem("workbench-reset-at", new Date().toISOString());
  } catch { /* ignore */ }
}

/**
 * invalidateWorkbenchQueryCache — TanStack Query cache 초기화
 *
 * QueryClient를 직접 참조할 수 없으므로, 호출부에서 queryClient를 넘겨야 함.
 */
export function invalidateWorkbenchQueryCache(queryClient: {
  removeQueries: (options: { predicate: (query: { queryKey: readonly unknown[] }) => boolean }) => void;
}): void {
  const workbenchPrefixes = ["search", "compare", "quote", "request", "approval", "products"];

  queryClient.removeQueries({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key) || key.length === 0) return false;
      return workbenchPrefixes.some(prefix =>
        typeof key[0] === "string" && key[0].includes(prefix)
      );
    },
  });
}

/**
 * getCleanRouteAfterLogout — logout 후 안전한 route
 */
export function getCleanRouteAfterLogout(): string {
  return "/";
}

/**
 * shouldBlockHydration — hydration guard
 *
 * session reset 이후 생성되지 않은 local draft는 hydrate 금지.
 * compare store persist middleware가 hydrate하기 전에 이 함수로 체크.
 */
export function shouldBlockHydration(): boolean {
  if (typeof window === "undefined") return false;

  const resetAt = window.localStorage.getItem("workbench-reset-at");
  if (!resetAt) return false;

  const compareStorage = window.localStorage.getItem("compare-storage");
  if (!compareStorage) return false;

  try {
    const parsed = JSON.parse(compareStorage);
    const state = parsed?.state;
    // compare store에 productIds가 남아있으면서 reset 이후라면 hydration 차단
    if (state?.productIds?.length > 0) {
      // Reset timestamp 이후 저장된 것인지 확인 불가 → 안전하게 차단
      return true;
    }
  } catch { /* ignore */ }

  return false;
}

/**
 * clearHydrationBlock — 로그인 후 명시적으로 hydration block 해제
 */
export function clearHydrationBlock(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("workbench-reset-at");
}
