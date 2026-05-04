/**
 * §11.209c Phase 2 #resolve-approval-policy-stripe-discriminator — RED test
 *
 * resolveApprovalPolicyForPlan(plan, stripePriceId?) signature 확장 검증.
 * stripePriceId 분기로 TEAM SKU 분리 → approvalPolicy 결정.
 *
 * canonical truth:
 *   - workspacePlanToIntent (§11.209c Phase 1) 통과
 *   - PLAN_DESCRIPTOR.{intent}.approvalPolicy → 반환
 */

import { describe, it, expect } from "vitest";
import { resolveApprovalPolicyForPlan } from "@/lib/billing/plan-descriptor";

describe("§11.209c Phase 2 — resolveApprovalPolicyForPlan stripePriceId 분기", () => {
  it("FREE → 'none' (stripePriceId 무관)", () => {
    expect(resolveApprovalPolicyForPlan("FREE", "price_anything")).toBe("none");
  });

  it("TEAM + STRIPE_PRICE_ID_BUSINESS_MONTHLY 매칭 → 'in_app_approval' (R&D Operations)", () => {
    const originalEnv = process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY;
    process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY = "price_business_test";
    try {
      expect(resolveApprovalPolicyForPlan("TEAM", "price_business_test")).toBe("in_app_approval");
    } finally {
      if (originalEnv === undefined) delete process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY;
      else process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY = originalEnv;
    }
  });

  it("TEAM + TEAM_MONTHLY priceId → 'none' (Lab Team — 결재 약속 0)", () => {
    expect(resolveApprovalPolicyForPlan("TEAM", "price_team_monthly")).toBe("none");
  });

  it("TEAM + null stripePriceId → 'none' (보수적 Lab Team)", () => {
    expect(resolveApprovalPolicyForPlan("TEAM", null)).toBe("none");
  });

  it("TEAM + undefined (1-arg 호환) → 'none' (기존 caller 호환)", () => {
    expect(resolveApprovalPolicyForPlan("TEAM")).toBe("none");
    expect(resolveApprovalPolicyForPlan("TEAM", undefined)).toBe("none");
  });

  it("ENTERPRISE → 'in_app_approval' (stripePriceId 무관)", () => {
    expect(resolveApprovalPolicyForPlan("ENTERPRISE")).toBe("in_app_approval");
    expect(resolveApprovalPolicyForPlan("ENTERPRISE", null)).toBe("in_app_approval");
  });
});
