/**
 * §11.151 #operational-brief-cache-metric — counter behavior.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  incrementCacheStat,
  getBriefCacheStats,
  resetBriefCacheStats,
  computeBriefCacheHitRate,
} from "@/lib/ai/operational-brief-cache-metrics";

describe("§11.151 brief cache metric", () => {
  beforeEach(() => resetBriefCacheStats());

  it("hit/miss/set/evict/invalidate 카운터 increment", () => {
    incrementCacheStat("hit");
    incrementCacheStat("hit");
    incrementCacheStat("miss");
    incrementCacheStat("set");
    incrementCacheStat("evict");
    incrementCacheStat("invalidate");
    const s = getBriefCacheStats();
    expect(s.hit).toBe(2);
    expect(s.miss).toBe(1);
    expect(s.set).toBe(1);
    expect(s.evict).toBe(1);
    expect(s.invalidate).toBe(1);
  });

  it("startedAt ISO date 포맷", () => {
    const s = getBriefCacheStats();
    expect(s.startedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("hit rate 계산: 2 hit + 1 miss → 0.667", () => {
    incrementCacheStat("hit", 2);
    incrementCacheStat("miss", 1);
    expect(computeBriefCacheHitRate()).toBeCloseTo(2 / 3, 3);
  });

  it("0 total → hit rate 0 (divide-by-zero guard)", () => {
    expect(computeBriefCacheHitRate()).toBe(0);
  });

  it("resetBriefCacheStats 가 카운터 초기화", () => {
    incrementCacheStat("hit");
    resetBriefCacheStats();
    expect(getBriefCacheStats().hit).toBe(0);
  });
});
