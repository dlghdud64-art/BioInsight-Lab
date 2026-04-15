/**
 * offline/index.ts — 오프라인 영속화 public API
 *
 * 사용법:
 *
 * 읽기 (캐시):
 *   const data = await offlineQuery("inventory_list", () => apiClient.get("/api/inventory"));
 *   // 온라인: API 호출 → 캐시 저장 → 반환
 *   // 오프라인: 캐시에서 반환 (stale 포함)
 *
 * 쓰기 (mutation queue):
 *   await offlineMutate("inspection_create", "/api/inventory/123/inspections", payload);
 *   // 온라인: 즉시 전송
 *   // 오프라인: queue에 저장 → 재연결 시 자동 전송
 */

export { getDb, closeDb } from "./db";
export { getCached, getStaleCached, setCache, invalidateCache, pruneExpiredCache } from "./cache";
export {
  enqueueMutation,
  getPendingMutations,
  getPendingCount,
  flushMutationQueue,
  pruneCompletedMutations,
  getFailedMutations,
  type MutationType,
  type QueuedMutation,
} from "./mutation-queue";
export {
  isOnline,
  hasPendingSync,
  onSyncComplete,
  startSyncManager,
  stopSyncManager,
  triggerSync,
} from "./sync-manager";

import { apiClient } from "../api";
import { getCached, getStaleCached, setCache } from "./cache";
import { enqueueMutation, type MutationType } from "./mutation-queue";
import { isOnline } from "./sync-manager";

// ═══════════════════════════════════════════
// 고수준 헬퍼
// ═══════════════════════════════════════════

interface OfflineQueryOptions {
  /** 캐시 TTL (ms). 기본 5분. */
  ttlMs?: number;
  /** stale 캐시도 허용 (오프라인 fallback). 기본 true. */
  allowStale?: boolean;
}

/**
 * 오프라인 지원 GET 쿼리.
 * 온라인: API 호출 → 캐시 갱신 → 반환
 * 오프라인: 캐시 반환 (stale 포함)
 */
export async function offlineQuery<T>(
  cacheKey: string,
  fetcher: () => Promise<{ data: T }>,
  options?: OfflineQueryOptions,
): Promise<{ data: T; fromCache: boolean; isStale: boolean }> {
  const { ttlMs = 5 * 60 * 1000, allowStale = true } = options ?? {};

  // 1. 온라인이면 서버에서 가져오기
  if (isOnline()) {
    try {
      const response = await fetcher();
      // 캐시 갱신
      await setCache(cacheKey, response.data, ttlMs);
      return { data: response.data, fromCache: false, isStale: false };
    } catch {
      // 네트워크 에러 시 캐시 fallback
    }
  }

  // 2. 캐시에서 가져오기
  if (allowStale) {
    const stale = await getStaleCached<T>(cacheKey);
    if (stale) {
      return { data: stale.data, fromCache: true, isStale: stale.isStale };
    }
  } else {
    const fresh = await getCached<T>(cacheKey);
    if (fresh) {
      return { data: fresh, fromCache: true, isStale: false };
    }
  }

  // 3. 캐시도 없으면 에러
  throw new Error("오프라인 상태이며 캐시된 데이터가 없습니다.");
}

interface OfflineMutateOptions {
  method?: string;
  entityType?: string;
  entityId?: string;
}

/**
 * 오프라인 지원 mutation.
 * 온라인: 즉시 전송
 * 오프라인: queue에 저장 → 재연결 시 자동 전송
 *
 * @returns { queued: boolean } — true면 대기열에 저장됨
 */
export async function offlineMutate(
  type: MutationType,
  endpoint: string,
  payload: Record<string, unknown>,
  options?: OfflineMutateOptions,
): Promise<{ queued: boolean; data?: unknown }> {
  // 온라인이면 즉시 전송 시도
  if (isOnline()) {
    try {
      const method = options?.method ?? "POST";
      const response = await apiClient.request({
        url: endpoint,
        method,
        data: payload,
      });
      return { queued: false, data: response.data };
    } catch (err: any) {
      // 네트워크 에러 시에만 queue에 추가
      if (!err.response) {
        // 서버 응답 없음 = 네트워크 문제
        const queueId = await enqueueMutation(type, endpoint, payload, options);
        return { queued: true };
      }
      // 서버 에러(4xx, 5xx)는 queue에 넣지 않고 바로 throw
      throw err;
    }
  }

  // 오프라인이면 queue에 저장
  await enqueueMutation(type, endpoint, payload, options);
  return { queued: true };
}
