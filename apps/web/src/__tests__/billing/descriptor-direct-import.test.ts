/**
 * #pricing-descriptor-direct-import — RED test
 *
 * §11.201d hand-copy → PLAN_DESCRIPTOR.features 직접 import 정합.
 * future drift 차단 lock — caller 가 hand-copy array 보유 0,
 * PLAN_DESCRIPTOR single source 만 사용.
 *
 * canonical mapping (§11.201d ADR 의 의도):
 *   - SubscriptionPlan.FREE → PLAN_DESCRIPTOR.starter
 *   - SubscriptionPlan.TEAM → PLAN_DESCRIPTOR.team (Lab Team 보수)
 *   - SubscriptionPlan.ORGANIZATION → PLAN_DESCRIPTOR.business
 *     (R&D Operations — Stripe ORGANIZATION price 가 business 가격)
 *
 * source: api/billing/route.ts PLAN_INFO + settings/plans/page.tsx PLAN_CARDS.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const BILLING = "src/app/api/billing/route.ts";
const SETTINGS = "src/app/dashboard/settings/plans/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#pricing-descriptor-direct-import — drift 차단 lock", () => {
  describe("api/billing/route.ts — PLAN_INFO features", () => {
    it("PLAN_DESCRIPTOR import (single source)", () => {
      const src = read(BILLING);
      expect(src).toMatch(/import[\s\S]*PLAN_DESCRIPTOR[\s\S]*from\s+["']@\/lib\/billing\/plan-descriptor["']|PLAN_DESCRIPTOR[\s\S]*from\s+["']@\/lib\/billing\/plan-descriptor/);
    });

    it("FREE.features = PLAN_DESCRIPTOR.starter.features", () => {
      const src = read(BILLING);
      // FREE entry 안에 features 가 PLAN_DESCRIPTOR.starter.features 참조
      expect(src).toMatch(/FREE:\s*\{[\s\S]*?features:\s*PLAN_DESCRIPTOR\.starter\.features/);
    });

    it("TEAM.features = PLAN_DESCRIPTOR.team.features", () => {
      const src = read(BILLING);
      expect(src).toMatch(/TEAM:\s*\{[\s\S]*?features:\s*PLAN_DESCRIPTOR\.team\.features/);
    });

    it("ORGANIZATION.features = PLAN_DESCRIPTOR.business.features (R&D Operations 매핑)", () => {
      const src = read(BILLING);
      expect(src).toMatch(/ORGANIZATION:\s*\{[\s\S]*?features:\s*PLAN_DESCRIPTOR\.business\.features/);
    });

    it("hand-copy hardcoded features array 잔존 0", () => {
      const src = read(BILLING);
      // PLAN_INFO 안에 hardcoded "통합 검색 / 카탈로그" 또는 "Starter 전체 +"
      // 같은 features 문자열 잔존 0
      expect(src).not.toMatch(/PLAN_INFO[\s\S]*?features:\s*\[\s*["']통합 검색/);
    });
  });

  describe("settings/plans/page.tsx — PLAN_CARDS features", () => {
    it("PLAN_DESCRIPTOR import", () => {
      const src = read(SETTINGS);
      expect(src).toMatch(/PLAN_DESCRIPTOR[\s\S]*from\s+["']@\/lib\/billing\/plan-descriptor/);
    });

    it("FREE 카드 features = PLAN_DESCRIPTOR.starter.features", () => {
      const src = read(SETTINGS);
      expect(src).toMatch(/SubscriptionPlan\.FREE[\s\S]*?features:\s*PLAN_DESCRIPTOR\.starter\.features/);
    });

    it("TEAM 카드 features = PLAN_DESCRIPTOR.team.features", () => {
      const src = read(SETTINGS);
      expect(src).toMatch(/SubscriptionPlan\.TEAM[\s\S]*?features:\s*PLAN_DESCRIPTOR\.team\.features/);
    });

    it("ORGANIZATION 카드 features = PLAN_DESCRIPTOR.business.features", () => {
      const src = read(SETTINGS);
      expect(src).toMatch(/SubscriptionPlan\.ORGANIZATION[\s\S]*?features:\s*PLAN_DESCRIPTOR\.business\.features/);
    });

    it("hand-copy hardcoded features array 잔존 0 (settings)", () => {
      const src = read(SETTINGS);
      expect(src).not.toMatch(/PLAN_CARDS[\s\S]*?features:\s*\[\s*["']통합 검색/);
    });
  });

  describe("#pricing-descriptor-direct-import 코멘트", () => {
    it("billing 또는 settings 에 코멘트 명시", () => {
      const a = read(BILLING);
      const b = read(SETTINGS);
      expect(a + b).toMatch(/#pricing-descriptor-direct-import|descriptor-direct-import/);
    });
  });
});
