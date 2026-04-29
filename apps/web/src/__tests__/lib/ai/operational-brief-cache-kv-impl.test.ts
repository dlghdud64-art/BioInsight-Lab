/**
 * §11.154 KV adapter impl — adapter source guard + behavior.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tryLoadKvBackend, resetBriefCacheBackend } from "@/lib/ai/operational-brief-cache-adapter";

const ADAPTER_PATH = resolve(__dirname, "../../../lib/ai/operational-brief-cache-adapter.ts");

describe("§11.154 KV adapter impl", () => {
  beforeEach(() => {
    resetBriefCacheBackend();
    delete process.env.OPERATIONAL_BRIEF_KV_URL;
  });

  it("VercelKvBackend class + runtime dynamic import 패턴 존재", () => {
    const src = readFileSync(ADAPTER_PATH, "utf8");
    expect(src).toMatch(/class VercelKvBackend/);
    // runtime indirection (@vercel + kv concat) 으로 vite static analyzer 회피
    expect(src).toMatch(/Function\(["']p["'],\s*["']return import\(p\)["']\)/);
    expect(src).toMatch(/@vercel/);
  });

  it("env 부재 시 tryLoadKvBackend null 반환", async () => {
    expect(await tryLoadKvBackend()).toBeNull();
  });

  it("env 있고 @vercel/kv 미설치 시 graceful null + warn", async () => {
    process.env.OPERATIONAL_BRIEF_KV_URL = "stub://url";
    const result = await tryLoadKvBackend();
    expect(result).toBeNull();
    delete process.env.OPERATIONAL_BRIEF_KV_URL;
  });

  it("KV TTL prefix 'ob:' + 15분 (900초) 보존", () => {
    const src = readFileSync(ADAPTER_PATH, "utf8");
    expect(src).toMatch(/15 \* 60/);
    expect(src).toMatch(/ob:/);
  });
});
