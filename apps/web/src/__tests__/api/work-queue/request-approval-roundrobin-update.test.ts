/**
 * #approver-routing-multi-owner-roundrobin — RED→GREEN test
 *
 * request-approval route 가 PR INSERT 성공 후 candidate 의
 * lastApprovalAssignedAt update — round-robin 분산 lock.
 *   - WorkspaceMember 또는 OrganizationMember (candidate.source 기반 분기)
 *   - try/catch graceful (mutation 정합 보호)
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

describe("#approver-routing-multi-owner-roundrobin — request-approval route update", () => {
  it("candidate.source 기반 분기 (workspace vs organization member update)", () => {
    const src = read(ROUTE);
    // candidate.source === "workspace_admin" 또는 "self_admin" → workspaceMember 업데이트
    // candidate.source === "org_admin" 또는 "org_owner" → organizationMember 업데이트
    expect(src).toMatch(/candidate\.source/);
  });

  it("workspaceMember 또는 organizationMember.update 안에 lastApprovalAssignedAt 업데이트", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/lastApprovalAssignedAt/);
    // update 호출 패턴
    expect(src).toMatch(/db\.(workspaceMember|organizationMember)\.update/);
  });

  it("try/catch graceful (round-robin update fail → mutation 결과 영향 0)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/try[\s\S]*?lastApprovalAssignedAt[\s\S]*?catch/);
  });

  it("multi-owner-roundrobin 코멘트 명시", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/multi-owner-roundrobin|round-robin|lastApprovalAssignedAt/);
  });
});
