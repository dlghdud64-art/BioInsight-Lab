/**
 * §11.209c Phase 1 #workspace-plan-mapper-stripe-discriminator — RED test
 *
 * workspacePlanToIntent(plan, stripePriceId?) signature 확장 검증.
 * TEAM enum 의 2 SKU 분리 (Lab Team vs R&D Operations) 를 stripePriceId
 * 분기로 해소.
 *
 * canonical truth:
 *   - Workspace.stripePriceId (Stripe webhook canonical)
 *   - PLAN_DESCRIPTOR (§11.201 lock)
 *   - 기존 caller 호환 — stripePriceId optional (미전달 시 보수적
 *     "team" 매핑)
 */

import { describe, it, expect } from "vitest";
import { workspacePlanToIntent } from "@/lib/billing/plan-descriptor";

describe("§11.209c Phase 1 — workspacePlanToIntent stripePriceId 분기", () => {
  describe("FREE / ENTERPRISE — stripePriceId 무관", () => {
    it("FREE → 'starter' (stripePriceId 무시)", () => {
      expect(workspacePlanToIntent("FREE")).toBe("starter");
      expect(workspacePlanToIntent("FREE", "price_anything")).toBe("starter");
    });

    it("ENTERPRISE → 'enterprise'", () => {
      expect(workspacePlanToIntent("ENTERPRISE")).toBe("enterprise");
      expect(workspacePlanToIntent("ENTERPRISE", null)).toBe("enterprise");
    });

    it("ORGANIZATION → 'enterprise' (canonical alias)", () => {
      expect(workspacePlanToIntent("ORGANIZATION")).toBe("enterprise");
    });
  });

  describe("TEAM enum 의 2 SKU 분리", () => {
    it("TEAM + STRIPE_PRICE_ID_BUSINESS_MONTHLY env 매칭 → 'business' (R&D Operations)", () => {
      const businessPriceId = process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY ?? "price_business_monthly_test";
      // env 정의 시 그 값 사용, 미정의 시 fallback
      const originalEnv = process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY;
      process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY = "price_business_monthly_test";
      try {
        expect(workspacePlanToIntent("TEAM", "price_business_monthly_test")).toBe("business");
      } finally {
        if (originalEnv === undefined) {
          delete process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY;
        } else {
          process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY = originalEnv;
        }
      }
    });

    it("TEAM + STRIPE_PRICE_ID_TEAM_MONTHLY env 매칭 → 'team' (Lab Team)", () => {
      const originalEnv = process.env.STRIPE_PRICE_ID_TEAM_MONTHLY;
      process.env.STRIPE_PRICE_ID_TEAM_MONTHLY = "price_team_monthly_test";
      try {
        expect(workspacePlanToIntent("TEAM", "price_team_monthly_test")).toBe("team");
      } finally {
        if (originalEnv === undefined) {
          delete process.env.STRIPE_PRICE_ID_TEAM_MONTHLY;
        } else {
          process.env.STRIPE_PRICE_ID_TEAM_MONTHLY = originalEnv;
        }
      }
    });

    it("TEAM + null stripePriceId → 'team' (보수적 — 미결제 무료 trial 등)", () => {
      expect(workspacePlanToIntent("TEAM", null)).toBe("team");
    });

    it("TEAM + undefined (signature 호환) → 'team' (기존 caller 호환)", () => {
      expect(workspacePlanToIntent("TEAM")).toBe("team");
      expect(workspacePlanToIntent("TEAM", undefined)).toBe("team");
    });

    it("TEAM + unknown stripePriceId (env 매칭 0) → 'team' (보수적 fallback)", () => {
      const originalBusinessEnv = process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY;
      const originalTeamEnv = process.env.STRIPE_PRICE_ID_TEAM_MONTHLY;
      process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY = "price_business_test";
      process.env.STRIPE_PRICE_ID_TEAM_MONTHLY = "price_team_test";
      try {
        expect(workspacePlanToIntent("TEAM", "price_unknown_random")).toBe("team");
      } finally {
        if (originalBusinessEnv === undefined) delete process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY;
        else process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY = originalBusinessEnv;
        if (originalTeamEnv === undefined) delete process.env.STRIPE_PRICE_ID_TEAM_MONTHLY;
        else process.env.STRIPE_PRICE_ID_TEAM_MONTHLY = originalTeamEnv;
      }
    });
  });

  describe("backward compat — 기존 caller (1 인자) 호환", () => {
    it("1 인자만 전달 시 §11.209b Phase 2 정합 (signature 확장 호환)", () => {
      // 기존 caller 들이 깨지지 않음 — 모든 1-arg 호출은 §11.209b Phase 2
      // 결과 그대로
      expect(workspacePlanToIntent("FREE")).toBe("starter");
      expect(workspacePlanToIntent("TEAM")).toBe("team");
      expect(workspacePlanToIntent("ENTERPRISE")).toBe("enterprise");
      expect(workspacePlanToIntent(null)).toBeNull();
      expect(workspacePlanToIntent(undefined)).toBeNull();
    });
  });
});
