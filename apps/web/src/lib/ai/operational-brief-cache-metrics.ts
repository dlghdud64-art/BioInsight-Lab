/**
 * §11.151 #operational-brief-cache-metric
 * §11.168 #operational-brief-llm-fitness-metric — fitness pass/fail counter 추가
 *
 * Cache hit/miss/set/evict counter — admin observability.
 * In-memory (process-local) — multi-instance 시 §11.150 KV adapter 와 함께 통합.
 */

export type BriefCacheStatKey =
  | "hit"
  | "miss"
  | "set"
  | "evict"
  | "invalidate"
  | "fitness_pass"
  | "fitness_fail";

interface BriefCacheStats {
  hit: number;
  miss: number;
  set: number;
  evict: number;
  invalidate: number;
  /** §11.168 LLM narrative fitness 통과 횟수 (canonical token 보존) */
  fitness_pass: number;
  /** §11.168 LLM narrative fitness 실패 → deterministic fallback (hallucination 차단) */
  fitness_fail: number;
  /** Process 시작 시각 — admin 이 instance 수명 가시화용 */
  startedAt: string;
}

const stats: BriefCacheStats = {
  hit: 0,
  miss: 0,
  set: 0,
  evict: 0,
  invalidate: 0,
  fitness_pass: 0,
  fitness_fail: 0,
  startedAt: new Date().toISOString(),
};

export function incrementCacheStat(key: BriefCacheStatKey, delta = 1): void {
  stats[key] += delta;
}

export function getBriefCacheStats(): Readonly<BriefCacheStats> {
  return { ...stats };
}

/** Test-only — 카운터 초기화 */
export function resetBriefCacheStats(): void {
  stats.hit = 0;
  stats.miss = 0;
  stats.set = 0;
  stats.evict = 0;
  stats.invalidate = 0;
  stats.fitness_pass = 0;
  stats.fitness_fail = 0;
  stats.startedAt = new Date().toISOString();
}

/** 운영자용 hit-rate 계산 */
export function computeBriefCacheHitRate(): number {
  const total = stats.hit + stats.miss;
  if (total === 0) return 0;
  return stats.hit / total;
}

/**
 * §11.168 — LLM narrative fitness pass rate.
 * fitness_pass / (fitness_pass + fitness_fail).
 * fail rate 가 높으면 prompt drift 또는 LLM hallucination 빈도 시그널.
 */
export function computeBriefFitnessPassRate(): number {
  const total = stats.fitness_pass + stats.fitness_fail;
  if (total === 0) return 0;
  return stats.fitness_pass / total;
}
