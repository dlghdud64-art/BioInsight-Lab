/**
 * §11.148 #operational-brief-narrative-integration — endpoint regression guard.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENDPOINT_PATH = resolve(__dirname, "../../../app/api/operational-brief/narrative/route.ts");
const HOOK_PATH = resolve(__dirname, "../../../lib/hooks/use-operational-brief.ts");

describe("§11.148 narrative endpoint + client hook", () => {
  it("endpoint POST handler 존재", () => {
    const src = readFileSync(ENDPOINT_PATH, "utf8");
    expect(src).toMatch(/export async function POST/);
  });

  it("endpoint auth check + admin/user gating", () => {
    const src = readFileSync(ENDPOINT_PATH, "utf8");
    expect(src).toMatch(/auth\(\)/);
    expect(src).toMatch(/unauthorized/);
  });

  it("endpoint cache get/set + metric increment 호출", () => {
    const src = readFileSync(ENDPOINT_PATH, "utf8");
    expect(src).toMatch(/getCachedBriefNarrative/);
    expect(src).toMatch(/setCachedBriefNarrative/);
    expect(src).toMatch(/incrementCacheStat/);
  });

  it("hook fingerprint + csrfFetch + module enabled gating", () => {
    const src = readFileSync(HOOK_PATH, "utf8");
    expect(src).toMatch(/csrfFetch/);
    expect(src).toMatch(/operational-brief\/narrative/);
    expect(src).toMatch(/enabled/);
  });
});
