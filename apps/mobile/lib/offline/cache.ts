/**
 * offline/cache.ts — API 응답 캐시 (읽기 전용)
 *
 * 서버에서 받은 데이터를 SQLite에 캐시.
 * 앱 종료 후 재시작해도 캐시가 유지되어 즉시 화면 표시.
 * 네트워크 복구 시 서버 데이터로 자동 갱신 (서버가 truth).
 *
 * TTL 기본값:
 * - inventory: 5분
 * - quotes: 2분
 * - dashboard: 1분
 */

import { getDb } from "./db";

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5분

/**
 * 캐시에서 데이터를 읽습니다.
 * TTL이 만료되지 않은 경우에만 반환합니다.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{
      data: string;
      cached_at: number;
      ttl_ms: number;
    }>(
      "SELECT data, cached_at, ttl_ms FROM cache_entries WHERE key = ?",
      [key],
    );

    if (!row) return null;

    // TTL 만료 체크
    const now = Date.now();
    if (now - row.cached_at > row.ttl_ms) {
      // 만료됨 — 삭제하지는 않음 (stale-while-revalidate 용도)
      return null;
    }

    return JSON.parse(row.data) as T;
  } catch {
    return null;
  }
}

/**
 * stale 캐시를 포함하여 읽습니다.
 * TTL 만료되어도 데이터를 반환 (오프라인 fallback용).
 */
export async function getStaleCached<T>(key: string): Promise<{ data: T; isStale: boolean } | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{
      data: string;
      cached_at: number;
      ttl_ms: number;
    }>(
      "SELECT data, cached_at, ttl_ms FROM cache_entries WHERE key = ?",
      [key],
    );

    if (!row) return null;

    const isStale = Date.now() - row.cached_at > row.ttl_ms;
    return { data: JSON.parse(row.data) as T, isStale };
  } catch {
    return null;
  }
}

/**
 * 캐시에 데이터를 저장합니다.
 */
export async function setCache(key: string, data: unknown, ttlMs: number = DEFAULT_TTL_MS): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO cache_entries (key, data, cached_at, ttl_ms)
       VALUES (?, ?, ?, ?)`,
      [key, JSON.stringify(data), Date.now(), ttlMs],
    );
  } catch (err) {
    console.warn("[cache] setCache failed:", err);
  }
}

/**
 * 특정 패턴의 캐시를 무효화합니다.
 */
export async function invalidateCache(pattern: string): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      "DELETE FROM cache_entries WHERE key LIKE ?",
      [`${pattern}%`],
    );
  } catch (err) {
    console.warn("[cache] invalidateCache failed:", err);
  }
}

/**
 * 만료된 캐시를 정리합니다 (주기적 호출 권장).
 */
export async function pruneExpiredCache(): Promise<number> {
  try {
    const db = await getDb();
    const result = await db.runAsync(
      "DELETE FROM cache_entries WHERE (? - cached_at) > ttl_ms * 10",
      [Date.now()],
    );
    return result.changes;
  } catch {
    return 0;
  }
}
