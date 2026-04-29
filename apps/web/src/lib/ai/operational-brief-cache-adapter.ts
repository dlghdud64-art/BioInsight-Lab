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

/** KV entry 의 TTL — narrative 캐시 라이프사이클 안전 상한 (15분). */
const KV_TTL_SECONDS = 15 * 60;

/** Vercel KV 가 설치되었을 때 (`@vercel/kv`) 사용하는 adapter. dynamic import 로 lazy load. */
class VercelKvBackend implements BriefCacheBackend {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly kv: any, private readonly prefix = "ob:") {}

  private k(key: string) {
    return `${this.prefix}${key}`;
  }

  async get(key: string) {
    try {
      const raw = await this.kv.get(this.k(key));
      if (!raw) return null;
      // KV 는 JSON 자동 직렬화 — 문자열 또는 object 모두 처리
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return parsed as { narrative: string; sourceUpdatedAtMs: number; createdAt: number };
    } catch {
      return null;
    }
  }

  async set(key: string, value: { narrative: string; sourceUpdatedAtMs: number; createdAt: number }) {
    try {
      await this.kv.set(this.k(key), JSON.stringify(value), { ex: KV_TTL_SECONDS });
    } catch {
      // KV 실패 시 silent — caller 는 다음 요청에 재시도
    }
  }

  async delete(key: string) {
    try {
      await this.kv.del(this.k(key));
    } catch {
      // ignore
    }
  }

  async size(): Promise<number> {
    // KV 는 SCAN 지원하나 비용/정확도 trade-off — admin metric 용도이므로 -1 반환 (unknown)
    return -1;
  }

  async clear() {
    // KV 전체 clear 는 위험 + 비용 큰 작업 — 제공 X. 운영자는 prefix 별 SCAN+DEL 운영도구 사용.
    // 미구현은 의도적 — `clear()` 가 prod 에서 호출되면 안 됨.
  }
}

/**
 * Vercel KV 가 설치되었을 때 (`@vercel/kv`) lazy-load 후 KV adapter 반환.
 * 미설치 또는 env var 부재 시 `null` 반환 (in-memory fallback).
 *
 * 환경변수:
 *   OPERATIONAL_BRIEF_KV_URL — KV 사용 시 truthy 값 설정 (실제 KV connection 은 @vercel/kv
 *   가 KV_URL / KV_REST_API_URL / KV_REST_API_TOKEN 자동 감지).
 */
export async function tryLoadKvBackend(): Promise<BriefCacheBackend | null> {
  if (!process.env.OPERATIONAL_BRIEF_KV_URL) return null;
  try {
    // dynamic import via runtime-string indirection — vite static analyzer 회피.
    // `@vercel/kv` 미설치 시 throw → null fallback.
    const pkgName = ["@vercel", "kv"].join("/");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await (Function("p", "return import(p)") as any)(pkgName).catch(() => null);
    if (!mod || !("kv" in mod)) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new VercelKvBackend((mod as any).kv);
  } catch (err) {
    console.warn("[operational-brief] KV backend load 실패 — in-memory fallback", err);
    return null;
  }
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
