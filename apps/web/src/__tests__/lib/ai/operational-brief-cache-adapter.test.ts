/**
 * §11.150 #operational-brief-cache-kv adapter — interface guard.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getBriefCacheBackend,
  resetBriefCacheBackend,
  tryLoadKvBackend,
} from "@/lib/ai/operational-brief-cache-adapter";

describe("§11.150 brief cache KV adapter", () => {
  beforeEach(() => resetBriefCacheBackend());

  it("OPERATIONAL_BRIEF_KV_URL 부재 시 KV null", async () => {
    const original = process.env.OPERATIONAL_BRIEF_KV_URL;
    delete process.env.OPERATIONAL_BRIEF_KV_URL;
    expect(await tryLoadKvBackend()).toBeNull();
    if (original) process.env.OPERATIONAL_BRIEF_KV_URL = original;
  });

  it("backend 가 in-memory fallback 으로 동작", async () => {
    const backend = await getBriefCacheBackend();
    expect(backend).toBeDefined();
    expect(typeof backend.get).toBe("function");
    expect(typeof backend.set).toBe("function");
    expect(typeof backend.delete).toBe("function");
    expect(typeof backend.size).toBe("function");
    expect(typeof backend.clear).toBe("function");
  });

  it("backend set/get cycle 동작", async () => {
    const backend = await getBriefCacheBackend();
    await backend.clear();
    await backend.set("k1", { narrative: "n1", sourceUpdatedAtMs: 1, createdAt: Date.now() });
    const got = await backend.get("k1");
    expect(got?.narrative).toBe("n1");
    expect(await backend.size()).toBe(1);
    await backend.delete("k1");
    expect(await backend.size()).toBe(0);
  });

  it("getBriefCacheBackend 첫 호출 후 backend 재사용", async () => {
    const a = await getBriefCacheBackend();
    const b = await getBriefCacheBackend();
    expect(a).toBe(b);
  });
});
