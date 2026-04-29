/**
 * §11.156 narrative cache-bust on mutation — endpoint + helper guard.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENDPOINT = resolve(__dirname, "../../../app/api/operational-brief/narrative/route.ts");
const HOOK = resolve(__dirname, "../../../lib/hooks/use-operational-brief.ts");

describe("§11.156 cache-bust on mutation", () => {
  it("endpoint 가 DELETE handler + invalidateCachedBriefNarrative + invalidate metric", () => {
    const src = readFileSync(ENDPOINT, "utf8");
    expect(src).toMatch(/export async function DELETE/);
    expect(src).toMatch(/invalidateCachedBriefNarrative/);
    expect(src).toMatch(/incrementCacheStat\(["']invalidate["']\)/);
  });

  it("hook 가 invalidateBriefNarrative export + DELETE method 호출", () => {
    const src = readFileSync(HOOK, "utf8");
    expect(src).toMatch(/export async function invalidateBriefNarrative/);
    expect(src).toMatch(/method:\s*["']DELETE["']/);
  });
});
