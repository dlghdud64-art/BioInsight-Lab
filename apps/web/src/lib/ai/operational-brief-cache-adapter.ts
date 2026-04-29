/**
 * §11.150 #operational-brief-cache-kv
 *
 * Cache backend adapter — 기본 in-memory, 환경변수 OPERATIONAL_BRIEF_KV_URL 설정 시
 * Vercel KV / Redis 로 swap 가능. Single-instance Vercel 에선 in-memory 충분.
 *
 * 인터페이스만 제공 — KV 실제 통합은 infra deps 필요해 별도 트랙 진입.
 */

export interface BriefCacheBackend {
  /** narrative 만 반환 — null 이면 miss */
  get(key: string): Promise<{ narrative: string; sourceUpdatedAtMs: number; createdAt: number } | null>;
  set(key: string, value: { narrative: string; sourceUpdatedAtMs: number; createdAt: number }): Promise<void>;
  delete(key: string): Promise<void>;
  size(): Promise<number>;
  clear(): Promise<void>;
}

/** In-memory backend — Map 기반, single-instance 기본 */
class InMemoryBackend implements BriefCacheBackend {
  private store = new Map<string, { narrative: string; sourceUpdatedAtMs: number; createdAt: number }>();

  async get(key: string) {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: { narrative: string; sourceUpdatedAtMs: number; createdAt: number }) {
    this.store.set(key, value);
  }

  async delete(key: string) {
    this.store.delete(key);
  }

  async size() {
    return this.store.size;
  }

  async clear() {
    this.store.clear();
  }
}

/**
 * Vercel KV 가 설치되었을 때 (`@vercel/kv` 패키지) lazy-load 후 KV adapter 반환.
 * 미설치 또는 env var 부재 시 `null` 반환 (in-memory fallback).
 *
 * 향후 `#operational-brief-cache-kv-impl` 트랙에서 본격 구현.
 */
export async function tryLoadKvBackend(): Promise<BriefCacheBackend | null> {
  if (!process.env.OPERATIONAL_BRIEF_KV_URL) return null;
  // 본 함수는 KV 설치/설정 시 dynamic import 로 swap.
  // dynamic import 비용을 prod hot path 에 두지 않으려고 single-call gating.
  // 현재는 placeholder — 실제 구현은 별도 트랙.
  return null;
}

let _activeBackend: BriefCacheBackend | null = null;

/**
 * 활성 backend 획득 — 첫 호출 시 KV 시도, 실패 시 in-memory fallback.
 * Subsequent calls 재사용.
 */
export async function getBriefCacheBackend(): Promise<BriefCacheBackend> {
  if (_activeBackend) return _activeBackend;
  const kv = await tryLoadKvBackend();
  _activeBackend = kv ?? new InMemoryBackend();
  return _activeBackend;
}

/** Test-only — backend reset */
export function resetBriefCacheBackend(): void {
  _activeBackend = null;
}
