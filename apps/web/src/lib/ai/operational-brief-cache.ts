/**
 * §11.147 #operational-brief-narrative-cache
 *
 * §11.142 운영 브리핑 의 AI narrative 재생성 비용 회피를 위한 in-memory cache.
 * Single-instance Vercel runtime 가정 — Redis/KV 통합은 향후 트랙 (`#operational-brief-cache-kv`).
 *
 * Source contract (호영님 §11.142 lock):
 *   sourceTrace = { quoteId?, orderId?, workQueueTaskId?, aiActionItemId?, inventoryId?, updatedAt }
 *
 * Cache 동작:
 *   - key = stable hash of (quoteId|orderId|workQueueTaskId|aiActionItemId|inventoryId|module).
 *   - hit 조건: cached.sourceUpdatedAt >= input.sourceUpdatedAt + TTL window 내.
 *   - miss 조건: source 가 더 신선 (운영자 편집/회신 도착 등) → 재생성 의무.
 *
 * canonical truth 보호:
 *   - cache 는 narrative (문장) 만 저장. status/금액/회신 수 같은 facts 는 원천 resolver 가
 *     매 요청마다 새로 계산하므로 stale 위험 없음 (§11.142 facts source mapping).
 */

export interface BriefSourceTrace {
  /** Quote.id (RFQ-Quote / Purchase Conversion) */
  quoteId?: string;
  /** Order.id (PO / Dispatch Prep) */
  orderId?: string;
  /** WorkQueueTask.id (Work Queue console) */
  workQueueTaskId?: string;
  /** AiActionItem.id (AI generated next-action) */
  aiActionItemId?: string;
  /** ProductInventory.id (Inventory Reorder) */
  inventoryId?: string;
  /** sourceModule key — disambiguator when 동일 entity 가 다른 surface 에 노출 */
  module: "purchase_conversion" | "work_queue" | "quote_detail" | "inbox" | "inventory" | "po";
  /** Source 의 마지막 변경 시각 (resolver/엔티티 updatedAt). cache hit 판정에 사용 */
  sourceUpdatedAt: Date | string;
}

interface CacheEntry {
  narrative: string;
  /** entry 생성 시각 — TTL 비교용 */
  createdAt: number;
  /** 원천 source 의 updatedAt (ms epoch). source 가 더 신선하면 invalidate */
  sourceUpdatedAtMs: number;
}

/** 기본 TTL — 운영자가 화면 보는 시간 윈도우 (5분) */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** in-memory store. process restart 시 자연 무효화 — Vercel single-instance 라 충분 */
const store = new Map<string, CacheEntry>();

/**
 * Source trace 를 stable cache key 로 변환.
 *
 * - module 별 entity id 우선순위: workQueueTaskId > quoteId > orderId > inventoryId > aiActionItemId
 * - 동일 entity 가 다른 surface 에 노출되어도 module key 가 분리해 다른 narrative 보존.
 */
export function buildBriefCacheKey(input: BriefSourceTrace): string {
  const parts = [
    input.module,
    input.workQueueTaskId ?? "-",
    input.quoteId ?? "-",
    input.orderId ?? "-",
    input.inventoryId ?? "-",
    input.aiActionItemId ?? "-",
  ];
  return parts.join("|");
}

/**
 * Cached narrative lookup.
 *
 * @returns narrative if hit (within TTL + source 변경 없음), null otherwise.
 */
export function getCachedBriefNarrative(
  input: BriefSourceTrace,
  options?: { ttlMs?: number },
): string | null {
  const key = buildBriefCacheKey(input);
  const entry = store.get(key);
  if (!entry) return null;

  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const now = Date.now();

  // TTL 초과 → miss (ttlMs = 0 즉 즉시 무효 forced miss 도 지원)
  if (ttlMs <= 0 || now - entry.createdAt > ttlMs) {
    store.delete(key);
    return null;
  }

  // source 가 더 신선 → invalidate
  const inputUpdatedMs = new Date(input.sourceUpdatedAt).getTime();
  if (inputUpdatedMs > entry.sourceUpdatedAtMs) {
    store.delete(key);
    return null;
  }

  return entry.narrative;
}

/**
 * Cache write. AI 호출 직후 호출.
 */
export function setCachedBriefNarrative(
  input: BriefSourceTrace,
  narrative: string,
): void {
  const key = buildBriefCacheKey(input);
  const sourceUpdatedAtMs = new Date(input.sourceUpdatedAt).getTime();
  store.set(key, {
    narrative,
    createdAt: Date.now(),
    sourceUpdatedAtMs,
  });
}

/**
 * 명시적 invalidation — 운영자 편집 직후 사용 (e.g., select reply, mark in progress).
 */
export function invalidateCachedBriefNarrative(input: BriefSourceTrace): void {
  store.delete(buildBriefCacheKey(input));
}

/**
 * Test/diagnostic only — 전체 cache 비움.
 */
export function clearBriefCache(): void {
  store.clear();
}

/**
 * Test/diagnostic only — entry count.
 */
export function getBriefCacheSize(): number {
  return store.size;
}
