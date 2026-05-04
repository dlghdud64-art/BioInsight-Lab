/**
 * §11.209d-pr-auto-create Phase 2 — detail panel "결재 요청" CTA
 *
 * R&D Operations / Enterprise + NOT_REQUIRED + ready_for_po 시 button visible.
 * mutation 호출 시 /api/work-queue/purchase-conversion/[quoteId]/request-approval
 * POST. 성공 시 invalidateQueries(['purchase-conversion-queue']).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PURCHASES = "src/app/dashboard/purchases/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209d-pr-auto-create Phase 2 — '결재 요청' CTA", () => {
  it("requestApprovalMutation 정의 — /api/work-queue/purchase-conversion/[id]/request-approval POST", () => {
    const src = read(PURCHASES);
    expect(src).toMatch(/requestApprovalMutation/);
    expect(src).toMatch(/\/api\/work-queue\/purchase-conversion\/[\s\S]*?\/request-approval/);
  });

  it("approvalPolicy === 'in_app_approval' + internalApprovalStatus === 'NOT_REQUIRED' 시 visible", () => {
    const src = read(PURCHASES);
    // visibility 조건 — approvalPolicy + internalApprovalStatus check
    expect(src).toMatch(/approvalPolicy\s*===?\s*["']in_app_approval["']/);
    expect(src).toMatch(/internalApprovalStatus\s*===?\s*["']NOT_REQUIRED["']/);
  });

  it("결재 요청 button label '결재 요청'", () => {
    const src = read(PURCHASES);
    expect(src).toMatch(/결재\s*요청/);
  });

  it("mutation 성공 시 invalidateQueries(['purchase-conversion-queue'])", () => {
    const src = read(PURCHASES);
    // requestApprovalMutation 의 onSuccess 안에 invalidateQueries
    expect(src).toMatch(/requestApprovalMutation[\s\S]*?invalidateQueries[\s\S]*?["']purchase-conversion-queue["']/);
  });

  it("§11.209d-pr-auto-create 코멘트 명시", () => {
    const src = read(PURCHASES);
    expect(src).toMatch(/§11\.209d-pr-auto-create|11\.209d-pr-auto-create/);
  });
});
