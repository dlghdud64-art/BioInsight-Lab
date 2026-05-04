/**
 * §11.209b Phase 1 #plan-descriptor-approval-policy — RED test
 *
 * PLAN_DESCRIPTOR 에 approvalPolicy field 추가 검증 (Tier 별 default).
 * §11.209 헤더 카피 약속 ("결재가 필요한 항목은 자동으로 결재 라인에
 * 올라갑니다") 의 dead promise 차단 — Lab Team 은 약속 0, R&D Operations
 * 부터 약속 visible.
 *
 * canonical truth 보호:
 *   - PLAN_DESCRIPTOR 가 single source of truth (§11.201 Phase 1 lock)
 *   - schema 변경 0 (§11.209b-pre 의 enum 활용, workspace 확장 0)
 *   - display layer 만 — 실 enforcement 는 Phase 2-3 에서 wiring
 */

import { describe, it, expect } from "vitest";
import {
  PLAN_DESCRIPTOR,
  type PlanDescriptor,
} from "@/lib/billing/plan-descriptor";

describe("§11.209b Phase 1 — PLAN_DESCRIPTOR.approvalPolicy", () => {
  it("PlanDescriptor 의 모든 entry 에 approvalPolicy field 존재", () => {
    for (const intent of ["starter", "team", "business", "enterprise"] as const) {
      const desc: PlanDescriptor = PLAN_DESCRIPTOR[intent];
      expect(desc).toHaveProperty("approvalPolicy");
    }
  });

  it("approvalPolicy 값이 ApprovalPolicy enum 정합 (none / in_app_approval / external_approval)", () => {
    const validValues = ["none", "in_app_approval", "external_approval"];
    for (const intent of ["starter", "team", "business", "enterprise"] as const) {
      expect(validValues).toContain(PLAN_DESCRIPTOR[intent].approvalPolicy);
    }
  });

  describe("Tier 별 default (호영님 §11.209 헤더 약속 정합)", () => {
    it("Starter Tier — approvalPolicy 'none' (결재 약속 0)", () => {
      expect(PLAN_DESCRIPTOR.starter.approvalPolicy).toBe("none");
    });

    it("Lab Team Tier — approvalPolicy 'none' (Lab Team 헤더 카피에 결재 약속 0)", () => {
      expect(PLAN_DESCRIPTOR.team.approvalPolicy).toBe("none");
    });

    it("R&D Operations Tier — approvalPolicy 'in_app_approval' (§11.209 헤더 약속 본문)", () => {
      expect(PLAN_DESCRIPTOR.business.approvalPolicy).toBe("in_app_approval");
    });

    it("Enterprise Tier — approvalPolicy 'in_app_approval' (외부 옵션은 §11.209c 후속)", () => {
      expect(PLAN_DESCRIPTOR.enterprise.approvalPolicy).toBe("in_app_approval");
    });
  });
});
