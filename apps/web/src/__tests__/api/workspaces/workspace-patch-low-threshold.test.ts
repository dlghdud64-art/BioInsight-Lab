/**
 * #approver-routing-multi-tier-threshold Phase 1 — RED test
 *
 * /api/workspaces/[id] PATCH zod schema 에 approvalLowThresholdKrw 추가:
 *   - positive int + max cap (10_000_000_000 = 100억)
 *   - 직전 approvalThresholdKrw 와 함께 정합 (low <= high — form/server 검증)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/workspaces/[id]/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#approver-routing-multi-tier-threshold — /api/workspaces/[id] PATCH zod", () => {
  it("zod schema 에 approvalLowThresholdKrw 필드 추가", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/approvalLowThresholdKrw/);
  });

  it("approvalLowThresholdKrw 가 z.number().int() 타입 검증", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/approvalLowThresholdKrw:\s*z\.[\s\S]*?\.int\(\)/);
  });

  it("approvalLowThresholdKrw 의 max cap 명시 (100억)", () => {
    const src = read(ROUTE);
    // approvalLowThresholdKrw 의 zod 정의 안에 max(10_000_000_000)
    expect(src).toMatch(/approvalLowThresholdKrw:\s*z\.[\s\S]*?max\(10_?000_?000_?000\)/);
  });

  it("기존 approvalThresholdKrw zod 정의 보존", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/approvalThresholdKrw:\s*z\.[\s\S]*?\.int\(\)/);
  });
});
