/**
 * §11.209b Phase 2 #workspace-plan-mapper — RED test
 *
 * canonical workspace.plan (FREE / TEAM / ENTERPRISE) → PlanIntent →
 * PLAN_DESCRIPTOR.approvalPolicy 매핑 검증.
 *
 * 옵션 1 (보수적 wiring) 정합:
 *   - workspace.plan 만으로 Lab Team vs R&D Operations 구분 불가
 *     (TEAM enum 2 SKU 분리 — workspace tier discriminator schema 0)
 *   - TEAM 은 보수적으로 "team" (Lab Team) 매핑 → approvalPolicy "none"
 *   - 미래 workspace tier discriminator 추가 시 즉시 R&D Operations 분기
 *     활성 (caller wiring 자체는 정상)
 *
 * canonical truth: PLAN_DESCRIPTOR single source (§11.201 lock).
 */

import { describe, it, expect } from "vitest";
import {
  workspacePlanToIntent,
  resolveApprovalPolicyForPlan,
} from "@/lib/billing/plan-descriptor";

describe("§11.209b Phase 2 — workspacePlanToIntent (utility 추출)", () => {
  it("FREE → 'starter'", () => {
    expect(workspacePlanToIntent("FREE")).toBe("starter");
  });

  it("TEAM → 'team' (Lab Team 보수적 매핑)", () => {
    expect(workspacePlanToIntent("TEAM")).toBe("team");
  });

  it("ENTERPRISE → 'enterprise'", () => {
    expect(workspacePlanToIntent("ENTERPRISE")).toBe("enterprise");
  });

  it("ORGANIZATION → 'enterprise' (canonical alias)", () => {
    // schema 의 SubscriptionPlan.ORGANIZATION 도 enterprise 로 매핑
    expect(workspacePlanToIntent("ORGANIZATION")).toBe("enterprise");
  });

  it("null / undefined / unknown → null (defensive)", () => {
    expect(workspacePlanToIntent(null)).toBeNull();
    expect(workspacePlanToIntent(undefined)).toBeNull();
    expect(workspacePlanToIntent("UNKNOWN")).toBeNull();
  });

  it("대소문자 둔감 — lowercase 입력 정합", () => {
    expect(workspacePlanToIntent("free")).toBe("starter");
    expect(workspacePlanToIntent("team")).toBe("team");
    expect(workspacePlanToIntent("enterprise")).toBe("enterprise");
  });
});

describe("§11.209b Phase 2 — resolveApprovalPolicyForPlan", () => {
  it("FREE → 'none' (Starter Tier default)", () => {
    expect(resolveApprovalPolicyForPlan("FREE")).toBe("none");
  });

  it("TEAM → 'none' (Lab Team 보수적 매핑 — 옵션 1)", () => {
    expect(resolveApprovalPolicyForPlan("TEAM")).toBe("none");
  });

  it("ENTERPRISE → 'in_app_approval' (§11.209 헤더 약속 정합)", () => {
    expect(resolveApprovalPolicyForPlan("ENTERPRISE")).toBe("in_app_approval");
  });

  it("null / undefined / unknown → 'none' (defensive default)", () => {
    expect(resolveApprovalPolicyForPlan(null)).toBe("none");
    expect(resolveApprovalPolicyForPlan(undefined)).toBe("none");
    expect(resolveApprovalPolicyForPlan("UNKNOWN")).toBe("none");
  });
});
