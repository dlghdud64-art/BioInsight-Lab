/**
 * §pricing-refresh P2 (PLAN_pricing-refresh) — Free 한도 enforce 실구현(광고=차단) + grandfather
 *
 * 현재 한도는 광고-only(enforce 0=fake). P2 가 생성 시점 실차단.
 *   - grandfather: env PRICING_ENFORCE_CUTOFF 이후 가입자만 enforce. 미설정=전원 grandfather(무해).
 *   - 3곳: quotes/orders/inventory POST 401 직후 enforcePlanLimit → 초과 시 429 + 한도·사용량 안내.
 *   - 유료/무제한(null) 통과. 기존 security enforceAction(RBAC) 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const HELPER = read("lib/billing/enforce-plan-limit.ts");
const Q = read("app/api/quotes/route.ts");
const O = read("app/api/orders/route.ts");
const I = read("app/api/inventory/route.ts");

describe("§pricing-refresh P2 — enforce helper", () => {
  it("enforcePlanLimit + PlanLimitError export", () => {
    expect(HELPER).toMatch(/export async function enforcePlanLimit/);
    expect(HELPER).toMatch(/export class PlanLimitError/);
  });
  it("grandfather cutoff — env PRICING_ENFORCE_CUTOFF / 미설정 무해 / createdAt 비교", () => {
    expect(HELPER).toMatch(/process\.env\.PRICING_ENFORCE_CUTOFF/);
    expect(HELPER).toMatch(/if \(!cutoffRaw\) return/);
    expect(HELPER).toMatch(/user\.createdAt < cutoff\) return/);
  });
  it("plan 판정(org subscription, FREE 기본) + 무제한 통과", () => {
    expect(HELPER).toMatch(/organizationMember\.findFirst/);
    expect(HELPER).toMatch(/SubscriptionPlan\.FREE/);
    expect(HELPER).toMatch(/if \(limit === null\) return/);
  });
  it("카운트 3종(이번달 quote·order / 누적 productInventory) + 초과 throw", () => {
    expect(HELPER).toMatch(/db\.quote\.count/);
    expect(HELPER).toMatch(/db\.order\.count/);
    expect(HELPER).toMatch(/db\.productInventory\.count/);
    expect(HELPER).toMatch(/throw new PlanLimitError/);
  });
});

describe("§pricing-refresh P2 — 3곳 POST 배선(초과 429 + 안내)", () => {
  const CASES: [string, string, string][] = [
    ["quotes", Q, "quotes"],
    ["orders", O, "orders"],
    ["inventory", I, "inventory"],
  ];
  for (const [name, src, kind] of CASES) {
    it(`${name} POST — enforcePlanLimit("${kind}") + PlanLimitError 429`, () => {
      expect(src).toMatch(/import \{ enforcePlanLimit, PlanLimitError \} from "@\/lib\/billing\/enforce-plan-limit"/);
      expect(src).toMatch(new RegExp(`enforcePlanLimit\\(session\\.user\\.id, "${kind}"\\)`));
      expect(src).toMatch(/instanceof PlanLimitError/);
      expect(src).toMatch(/status: 429/);
    });
  }
});

describe("§pricing-refresh P2 — 회귀 0(security RBAC 보존)", () => {
  it("기존 enforceAction(RBAC) 3곳 보존", () => {
    expect(Q).toMatch(/enforceAction\(\{/);
    expect(O).toMatch(/enforceAction\(\{/);
    expect(I).toMatch(/enforceAction\(\{/);
  });
});
