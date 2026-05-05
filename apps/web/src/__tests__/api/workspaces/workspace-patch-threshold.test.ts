/**
 * #approver-routing-threshold-admin-ui Phase 1 — RED test
 *
 * /api/workspaces/[id] PATCH 의 zod schema 에 approvalThresholdKrw 추가:
 *   - positive int (0 이상)
 *   - max 100억 (10_000_000_000) cap
 *   - ADMIN role 만 변경 가능 (verifyWorkspaceAccess('ADMIN'))
 *
 * Source-level grep — runtime 호출은 별도 integration test 별도 batch.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/workspaces/[id]/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#approver-routing-threshold-admin-ui — /api/workspaces/[id] PATCH zod", () => {
  it("zod schema 에 approvalThresholdKrw 필드 추가", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/approvalThresholdKrw/);
  });

  it("approvalThresholdKrw 가 z.number().int() 또는 비슷한 number 타입 검증", () => {
    const src = read(ROUTE);
    // z.number().int().min(0).max(...) 또는 비슷한 패턴
    expect(src).toMatch(/approvalThresholdKrw:\s*z\.[\s\S]*?\.int\(\)|approvalThresholdKrw:[\s\S]*?z\.number\(\)/);
  });

  it("max cap 명시 (100억 = 10_000_000_000) — 비현실적 큰 값 차단", () => {
    const src = read(ROUTE);
    // max(10000000000) 또는 max(10_000_000_000)
    expect(src).toMatch(/max\(10_?000_?000_?000\)/);
  });

  it("ADMIN role 권한 체크 (verifyWorkspaceAccess 또는 직접 검증)", () => {
    const src = read(ROUTE);
    // PATCH 안에서 ADMIN role 강제 검증 — 직전 코드는 verifyWorkspaceAccess(workspaceId, userId, 'ADMIN')
    expect(src).toMatch(/verifyWorkspaceAccess\([^)]*["']ADMIN["']|role:\s*["']ADMIN["']/);
  });

  it("§11.209d-approver-routing 또는 approvalThresholdKrw 코멘트 명시 (drift 차단)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/§11\.209d-approver-routing|11\.209d-approver-routing|approvalThresholdKrw/);
  });
});
