/**
 * §11.209b Phase 2 #po-candidates-approval-policy-fallback — RED test
 *
 * /api/po-candidates POST 가 body.approvalPolicy 부재 시 user 의 workspace
 * .plan 으로부터 PLAN_DESCRIPTOR.approvalPolicy fallback 하는지 source-level
 * 검증. 옵션 1 보수적 wiring.
 *
 * canonical truth:
 *   - workspaceMember.findFirst → workspace.plan 조회 패턴 (billing/checkout
 *     route 와 동일 패턴 정합)
 *   - resolveApprovalPolicyForPlan 통과 (plan-descriptor single source)
 *   - body.approvalPolicy 명시 시 그대로 사용 (caller override 우선)
 *
 * 또한 dashboard/pricing/page.tsx 의 inline workspacePlanToIntent 제거 —
 * single source of truth (plan-descriptor.ts) import 정합.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/po-candidates/route.ts";
const PRICING_PAGE = "src/app/dashboard/pricing/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209b Phase 2 — po-candidates POST approvalPolicy fallback", () => {
  describe("route wiring", () => {
    it("plan-descriptor 의 resolveApprovalPolicyForPlan import", () => {
      const src = read(ROUTE);
      expect(src).toMatch(/import[\s\S]*resolveApprovalPolicyForPlan[\s\S]*from\s+["']@\/lib\/billing\/plan-descriptor["']/);
    });

    it("workspaceMember.findFirst 통한 workspace.plan 조회 (billing/checkout 패턴)", () => {
      const src = read(ROUTE);
      expect(src).toMatch(/workspaceMember\.findFirst/);
      expect(src).toMatch(/include:\s*\{[\s\S]*workspace:\s*true/);
    });

    it("input.approvalPolicy fallback 패턴 (body.approvalPolicy ?? resolveApprovalPolicyForPlan(...))", () => {
      const src = read(ROUTE);
      // body.approvalPolicy 또는 spread 정합
      expect(src).toMatch(/approvalPolicy[\s\S]*resolveApprovalPolicyForPlan/);
    });

    it("§11.209b Phase 2 코멘트 명시 (drift 차단)", () => {
      const src = read(ROUTE);
      expect(src).toMatch(/§11\.209b\s+Phase\s+2|§11\.209b/);
    });
  });

  describe("inline workspacePlanToIntent 제거 (single source 정합)", () => {
    it("dashboard/pricing/page.tsx 의 inline 정의 제거", () => {
      const src = read(PRICING_PAGE);
      // function workspacePlanToIntent(plan: ...) 정의 패턴 0
      expect(src).not.toMatch(/function\s+workspacePlanToIntent\s*\(/);
    });

    it("plan-descriptor utility import 사용", () => {
      const src = read(PRICING_PAGE);
      expect(src).toMatch(/workspacePlanToIntent[\s\S]*from\s+["']@\/lib\/billing\/plan-descriptor["']|import[\s\S]*workspacePlanToIntent[\s\S]*plan-descriptor/);
    });
  });
});
