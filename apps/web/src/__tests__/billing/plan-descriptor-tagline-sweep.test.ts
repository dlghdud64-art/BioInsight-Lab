/**
 * §11.209b Phase 4 #plan-descriptor-tagline-sweep — RED test
 *
 * Lab Team tagline 의 dead promise 차단. Lab Team Tier 는
 * approvalPolicy='none' 이므로 tagline 에 "승인" / "결재" 단어 잔존 시
 * dead promise. R&D Operations / Enterprise 는 in_app_approval 이라 가능.
 *
 * canonical truth 보호 — PLAN_DESCRIPTOR single source. UI 카피와
 * approvalPolicy 매트릭스 정합.
 */

import { describe, it, expect } from "vitest";
import { PLAN_DESCRIPTOR } from "@/lib/billing/plan-descriptor";

describe("§11.209b Phase 4 — PLAN_DESCRIPTOR tagline dead promise sweep", () => {
  describe("approvalPolicy='none' Tier — 결재/승인 약속 0", () => {
    it("Starter tagline 에 '승인' / '결재' 단어 0", () => {
      const t = PLAN_DESCRIPTOR.starter.tagline;
      expect(t).not.toMatch(/승인|결재/);
    });

    it("Lab Team tagline 에 '승인' / '결재' 단어 0 (dead promise 차단)", () => {
      const t = PLAN_DESCRIPTOR.team.tagline;
      expect(t).not.toMatch(/승인|결재/);
    });
  });

  describe("approvalPolicy='in_app_approval' Tier — 결재 약속 가능", () => {
    it("R&D Operations features 에 '승인' 또는 '매트릭스' 단어 visible (가치 약속)", () => {
      const f = PLAN_DESCRIPTOR.business.features.join(" ");
      expect(f).toMatch(/승인|매트릭스/);
    });
  });
});
