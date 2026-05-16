/**
 * §11.230c (a)-7 #safety-filter-sync — 호영님 §11.230c (a)-6 자연 후속.
 *
 * 호영님 spec: safety/page.tsx activeFrame (StrategyFrame) server-persist.
 *   inbox 는 useState 0 → 제외. preferences endpoint reuse + schema 0.
 *   minimum diff (1-1.5h).
 *
 * Strategy:
 *   - SafetyFilterSchema z.object({ activeFrame }) 추가.
 *   - useUserPreferences hook 안 updateSafetyFilter 추가.
 *   - safety/page.tsx server hydration + persistence useEffect.
 *
 * canonical truth lock:
 *   - §11.230c (a)/(a)-2/(a)-3/(a)-4/(a)-5/(a)-6 모두 보존.
 *   - safety.riskFilter / msdsFilter / locationFilter 보존 (별도 cluster).
 *   - StrategyFrame type 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const ROUTE_PATH = resolve(__dirname, "../../app/api/user/preferences/route.ts");
const HELPER_PATH = resolve(__dirname, "../../lib/preferences/user-preferences.ts");
const SAFETY_PATH = resolve(__dirname, "../../app/dashboard/safety/page.tsx");

const route = safeRead(ROUTE_PATH);
const helper = safeRead(HELPER_PATH);
const safety = safeRead(SAFETY_PATH);

describe("§11.230c (a)-7 #1 — preferences route zod 확장", () => {
  it("safetyFilter zod object 추가", () => {
    expect(route).toMatch(/safetyFilter/);
  });

  it("SafetyFilterSchema activeFrame z.string optional", () => {
    expect(route).toMatch(/SafetyFilterSchema[\s\S]{0,300}activeFrame[\s\S]{0,100}z\.string/);
  });

  it("PATCH deep merge 안 safetyFilter 적용", () => {
    expect(route).toMatch(/safetyFilter/);
  });
});

describe("§11.230c (a)-7 #2 — useUserPreferences helper 확장", () => {
  it("updateSafetyFilter function export", () => {
    expect(helper).toMatch(/updateSafetyFilter/);
  });

  it("UserPreferencesJson type 안 safetyFilter 선언", () => {
    expect(helper).toMatch(/safetyFilter/);
  });
});

describe("§11.230c (a)-7 #3 — safety/page.tsx server hydration", () => {
  it("useUserPreferences import", () => {
    expect(safety).toMatch(/useUserPreferences/);
  });

  it("server hydration (preferences.safetyFilter → setActiveFrame)", () => {
    expect(safety).toMatch(/preferences[\s\S]{0,1000}safetyFilter[\s\S]{0,1000}setActiveFrame/);
  });

  it("persistence — updateSafetyFilter 호출", () => {
    expect(safety).toMatch(/updateSafetyFilter/);
  });
});

describe("§11.230c (a)-7 #4 — invariant 보존", () => {
  it("§11.230c (a) preferences route GET/PATCH 보존", () => {
    expect(route).toMatch(/export\s+async\s+function\s+GET/);
    expect(route).toMatch(/export\s+async\s+function\s+PATCH/);
  });

  it("§11.230c (a)-5 inventoryFilter + receivingFilter 보존", () => {
    expect(route).toMatch(/inventoryFilter/);
    expect(route).toMatch(/receivingFilter/);
  });

  it("§11.230c (a)-6 purchasesFilter + purchaseOrdersFilter 보존", () => {
    expect(route).toMatch(/purchasesFilter/);
    expect(route).toMatch(/purchaseOrdersFilter/);
  });

  it("모든 update 함수 보존 (7개)", () => {
    expect(helper).toMatch(/updateColumnPrefs/);
    expect(helper).toMatch(/updateBriefingCollapsed/);
    expect(helper).toMatch(/updateQuotesView/);
    expect(helper).toMatch(/updateQuotesFilter/);
    expect(helper).toMatch(/updateInventoryFilter/);
    expect(helper).toMatch(/updateReceivingFilter/);
    expect(helper).toMatch(/updatePurchasesFilter/);
    expect(helper).toMatch(/updatePurchaseOrdersFilter/);
  });

  it("safety StrategyFrame type / activeFrame state 보존", () => {
    expect(safety).toMatch(/StrategyFrame/);
    expect(safety).toMatch(/setActiveFrame/);
  });

  it("safety riskFilter / msdsFilter / locationFilter 보존 (별도 cluster)", () => {
    expect(safety).toMatch(/riskFilter/);
    expect(safety).toMatch(/msdsFilter/);
    expect(safety).toMatch(/locationFilter/);
  });

  it("§11.230c (a)-7 trace marker", () => {
    const combined = route + "\n" + helper + "\n" + safety;
    expect(combined).toMatch(/§11\.230c \(a\)-7|11\.230c \(a\)-7|§11\.230c-a-7/);
  });
});
