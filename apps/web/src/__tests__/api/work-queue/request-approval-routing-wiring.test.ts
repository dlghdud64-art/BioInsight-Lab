/**
 * §11.209d-approver-routing Phase 1 — RED test
 *
 * request-approval/route.ts 가 selectApproverByAmount helper 사용.
 * 직전 자동 매핑 (workspaceMember.findFirst + fallbackAdmin) → helper swap.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const ROUTE =
  "src/app/api/work-queue/purchase-conversion/[quoteId]/request-approval/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209d-approver-routing — request-approval route swap", () => {
  it("selectApproverByAmount import (lib/billing/approver-routing)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/selectApproverByAmount/);
    expect(src).toMatch(/from\s+["']@\/lib\/billing\/approver-routing["']/);
  });

  it("selectApproverByAmount 호출 — totalAmount + workspaceId + organizationId + requesterId 전달", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/selectApproverByAmount\(\s*\{[\s\S]*?workspaceId/);
    expect(src).toMatch(/selectApproverByAmount\(\s*\{[\s\S]*?organizationId/);
    expect(src).toMatch(/selectApproverByAmount\(\s*\{[\s\S]*?totalAmount/);
    expect(src).toMatch(/selectApproverByAmount\(\s*\{[\s\S]*?requesterId/);
  });

  it("workspaceMember.workspace select 에 organizationId 추가 (helper 인자 위해)", () => {
    const src = read(ROUTE);
    // workspace 의 select 에 organizationId 포함
    expect(src).toMatch(/workspace:\s*\{\s*select:\s*\{[^}]*organizationId/);
  });

  it("직전 자동 매핑 (db.workspaceMember.findFirst + role: ADMIN + adminMember/fallbackAdmin) 잔존 0", () => {
    const src = read(ROUTE);
    // 직전 패턴: const adminMember = await db.workspaceMember.findFirst({where: { workspaceId, role: "ADMIN", userId: { not: ... } }})
    // 이게 helper 안으로 이동 → route 에 잔존 0
    expect(src).not.toMatch(/const\s+adminMember\s*=\s*await\s+db\.workspaceMember\.findFirst/);
    expect(src).not.toMatch(/const\s+fallbackAdmin\s*=/);
    expect(src).not.toMatch(/const\s+resolvedAdmin\s*=/);
  });

  it("§11.209d-approver-routing 코멘트 명시 (drift 차단)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/§11\.209d-approver-routing|11\.209d-approver-routing/);
  });
});
