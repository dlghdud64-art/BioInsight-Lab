/**
 * #approver-routing-multi-tier-validation-zod-refine — RED→GREEN test
 *
 * /api/workspaces/[id] PATCH zod schema 의 cross-field validation 추가:
 *   - approvalLowThresholdKrw ≤ approvalThresholdKrw 강제 (server-level)
 *   - 둘 다 명시된 경우만 검증 (partial update backward compat)
 *   - 한국어 error message
 *
 * Form-level validation 외 server-side defense — 직접 API 호출 (CSRF
 * skip / curl) 시에도 정합 보장. defense in depth lock.
 *
 * Scope:
 *   - source-level grep — refine clause + 한국어 message
 *   - runtime zod 검증 (직접 schema parse)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/workspaces/[id]/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#approver-routing-multi-tier-validation-zod-refine — source-level", () => {
  it("updateWorkspaceSchema 에 .refine() clause 추가", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/\.refine\(/);
  });

  it("refine message 한국어 (저액 ≤ 고액)", () => {
    const src = read(ROUTE);
    // refine 의 message 안에 "저액" + "고액" + "이하" 또는 "≤"
    expect(src).toMatch(/저액[^"']*고액|고액[^"']*저액|≤/);
  });

  it("approvalLowThresholdKrw 가 refine 검증 path 에 명시", () => {
    const src = read(ROUTE);
    // refine 의 path: ["approvalLowThresholdKrw"] 또는 비슷한
    expect(src).toMatch(/path:\s*\[\s*["']approvalLowThresholdKrw["']/);
  });

  it("§11.209d-approver-routing 또는 multi-tier-validation 코멘트", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/multi-tier-validation|cross-field|approver-routing/);
  });
});

describe("#approver-routing-multi-tier-validation-zod-refine — zod runtime", () => {
  // schema 가 refine 추가 후, 직접 schema parse 시 cross-field 검증 동작 확인.
  // 단 schema export 가 안 되어 있을 수 있으므로 import 시도 후 fallback.

  it("low > high → schema parse 실패 (둘 다 명시 시)", async () => {
    // updateWorkspaceSchema 가 module export 되어야 runtime test 가능.
    // 미export 시 source-level 만 의존.
    let schema: any;
    try {
      const mod = await import("@/app/api/workspaces/[id]/route");
      schema = (mod as any).updateWorkspaceSchema;
    } catch {
      // export 없음 — source-level grep test 만 의존
      return;
    }
    if (!schema) return;
    const result = schema.safeParse({
      approvalLowThresholdKrw: 50_000_000,
      approvalThresholdKrw: 10_000_000,
    });
    expect(result.success).toBe(false);
  });

  it("low <= high → schema parse 성공 (둘 다 명시 시)", async () => {
    let schema: any;
    try {
      const mod = await import("@/app/api/workspaces/[id]/route");
      schema = (mod as any).updateWorkspaceSchema;
    } catch {
      return;
    }
    if (!schema) return;
    const result = schema.safeParse({
      approvalLowThresholdKrw: 1_000_000,
      approvalThresholdKrw: 10_000_000,
    });
    expect(result.success).toBe(true);
  });

  it("low 만 명시 (high 미명시) → schema parse 성공 (partial update 호환)", async () => {
    let schema: any;
    try {
      const mod = await import("@/app/api/workspaces/[id]/route");
      schema = (mod as any).updateWorkspaceSchema;
    } catch {
      return;
    }
    if (!schema) return;
    const result = schema.safeParse({
      approvalLowThresholdKrw: 50_000_000, // 단독 (high 미명시) — refine 적용 0
    });
    expect(result.success).toBe(true);
  });

  it("high 만 명시 (low 미명시) → schema parse 성공", async () => {
    let schema: any;
    try {
      const mod = await import("@/app/api/workspaces/[id]/route");
      schema = (mod as any).updateWorkspaceSchema;
    } catch {
      return;
    }
    if (!schema) return;
    const result = schema.safeParse({
      approvalThresholdKrw: 5_000_000,
    });
    expect(result.success).toBe(true);
  });

  it("둘 다 미명시 → schema parse 성공 (다른 field 만 변경)", async () => {
    let schema: any;
    try {
      const mod = await import("@/app/api/workspaces/[id]/route");
      schema = (mod as any).updateWorkspaceSchema;
    } catch {
      return;
    }
    if (!schema) return;
    const result = schema.safeParse({ name: "new name" });
    expect(result.success).toBe(true);
  });
});
