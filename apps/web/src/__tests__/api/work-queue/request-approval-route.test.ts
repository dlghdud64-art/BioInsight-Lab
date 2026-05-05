/**
 * §11.209d-pr-auto-create Phase 1 #request-approval-route — RED test
 *
 * /api/work-queue/purchase-conversion/[quoteId]/request-approval POST.
 * Quote → PurchaseRequest 자동 INSERT (R&D Operations / Enterprise 만).
 *
 * canonical truth:
 *   - workspace.plan + stripePriceId → resolveApprovalPolicyForPlan
 *   - in_app_approval policy 만 허용 (Lab Team / Starter → 400)
 *   - approver 매핑: workspace 첫 ADMIN/OWNER member
 *   - PR INSERT (PENDING + quoteId + totalAmount + items)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/work-queue/purchase-conversion/[quoteId]/request-approval/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209d-pr-auto-create Phase 1 — request-approval route", () => {
  it("route file 존재 + POST handler", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/export\s+async\s+function\s+POST/);
  });

  it("dynamic = 'force-dynamic'", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/);
  });

  it("workspace.plan + stripePriceId 조회 (workspaceMember.findFirst)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/workspaceMember\.findFirst/);
    expect(src).toMatch(/stripePriceId/);
  });

  it("resolveApprovalPolicyForPlan import + in_app_approval check", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/resolveApprovalPolicyForPlan/);
    expect(src).toMatch(/in_app_approval/);
  });

  it("Lab Team / Starter → 400 (graceful, 운영자 친화 메시지)", () => {
    const src = read(ROUTE);
    // approvalPolicy !== "in_app_approval" → 400 + "결재 정책이 활성화되지 않았습니다" or 동등
    expect(src).toMatch(/status:\s*400/);
    expect(src).toMatch(/APPROVAL_POLICY_NOT_ENABLED|결재\s*정책|결재가\s*활성/);
  });

  it("approver 자동 매핑 (selectApproverByAmount helper 호출)", () => {
    // §11.209d-approver-routing 이후 직접 role grep → helper 호출로 swap.
    // 매트릭스 (multi-tier) 는 helper 안에서 처리.
    const src = read(ROUTE);
    expect(src).toMatch(/selectApproverByAmount/);
  });

  it("approver 미설정 → 400 (graceful)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/APPROVER_NOT_FOUND|결재자가\s*없|결재자\s*미설정/);
  });

  it("PR INSERT — PENDING + quoteId + approverId + requesterId", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/purchaseRequest\.create/);
    expect(src).toMatch(/PurchaseRequestStatus\.PENDING|status:\s*["']PENDING["']/);
    expect(src).toMatch(/quoteId/);
    expect(src).toMatch(/approverId/);
    expect(src).toMatch(/requesterId/);
  });

  it("enforceAction (purchase_request_create)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/enforceAction/);
    expect(src).toMatch(/purchase_request_create/);
  });

  it("§11.209d-pr-auto-create 코멘트 명시 (drift 차단)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/§11\.209d-pr-auto-create|11\.209d-pr-auto-create/);
  });
});
