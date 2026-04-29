/**
 * §11.147 #operational-brief-narrative-cache — behavior test.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  buildBriefCacheKey,
  getCachedBriefNarrative,
  setCachedBriefNarrative,
  invalidateCachedBriefNarrative,
  clearBriefCache,
  getBriefCacheSize,
  type BriefSourceTrace,
} from "@/lib/ai/operational-brief-cache";

const fixed = new Date("2026-04-29T10:00:00Z");

const baseTrace: BriefSourceTrace = {
  quoteId: "q-123",
  module: "purchase_conversion",
  sourceUpdatedAt: fixed,
};

describe("§11.147 operational-brief narrative cache", () => {
  beforeEach(() => clearBriefCache());

  it("buildBriefCacheKey 가 module + entity id 결합", () => {
    expect(buildBriefCacheKey(baseTrace)).toContain("purchase_conversion");
    expect(buildBriefCacheKey(baseTrace)).toContain("q-123");
  });

  it("동일 entity 라도 module 다르면 다른 key", () => {
    const a = buildBriefCacheKey({ ...baseTrace, module: "purchase_conversion" });
    const b = buildBriefCacheKey({ ...baseTrace, module: "quote_detail" });
    expect(a).not.toBe(b);
  });

  it("write → read 동일 narrative 반환", () => {
    setCachedBriefNarrative(baseTrace, "회신 2건 도착 · PO 전환 가능");
    expect(getCachedBriefNarrative(baseTrace)).toBe("회신 2건 도착 · PO 전환 가능");
  });

  it("Source updatedAt 가 더 신선하면 cache miss + 자동 evict", () => {
    setCachedBriefNarrative(baseTrace, "stale narrative");
    const fresher: BriefSourceTrace = {
      ...baseTrace,
      sourceUpdatedAt: new Date(fixed.getTime() + 60_000), // 1분 후
    };
    expect(getCachedBriefNarrative(fresher)).toBeNull();
    expect(getBriefCacheSize()).toBe(0); // evicted
  });

  it("Source updatedAt 동일 또는 더 오래되면 hit", () => {
    setCachedBriefNarrative(baseTrace, "narrative A");
    expect(getCachedBriefNarrative(baseTrace)).toBe("narrative A");

    const olderInput: BriefSourceTrace = {
      ...baseTrace,
      sourceUpdatedAt: new Date(fixed.getTime() - 60_000),
    };
    expect(getCachedBriefNarrative(olderInput)).toBe("narrative A");
  });

  it("TTL 초과 시 cache miss + 자동 evict (ttlMs 옵션)", () => {
    setCachedBriefNarrative(baseTrace, "narrative TTL");
    expect(getCachedBriefNarrative(baseTrace, { ttlMs: 0 })).toBeNull();
    expect(getBriefCacheSize()).toBe(0);
  });

  it("invalidate 명시 호출 후 miss", () => {
    setCachedBriefNarrative(baseTrace, "narrative INV");
    invalidateCachedBriefNarrative(baseTrace);
    expect(getCachedBriefNarrative(baseTrace)).toBeNull();
  });

  it("module 별 격리 — work_queue 와 inventory 가 같은 id 라도 다른 entry", () => {
    const wq: BriefSourceTrace = { workQueueTaskId: "id-1", module: "work_queue", sourceUpdatedAt: fixed };
    const inv: BriefSourceTrace = { inventoryId: "id-1", module: "inventory", sourceUpdatedAt: fixed };
    setCachedBriefNarrative(wq, "WQ narrative");
    setCachedBriefNarrative(inv, "INV narrative");
    expect(getCachedBriefNarrative(wq)).toBe("WQ narrative");
    expect(getCachedBriefNarrative(inv)).toBe("INV narrative");
    expect(getBriefCacheSize()).toBe(2);
  });

  it("clearBriefCache 가 전체 비움", () => {
    setCachedBriefNarrative(baseTrace, "x");
    setCachedBriefNarrative({ ...baseTrace, quoteId: "q-456" }, "y");
    expect(getBriefCacheSize()).toBe(2);
    clearBriefCache();
    expect(getBriefCacheSize()).toBe(0);
  });
});
