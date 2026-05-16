/**
 * §11.230c (a)-5 #inventory-receiving-filter-sync — 호영님 §11.230c (a)-4 자연 후속.
 *
 * 호영님 spec: inventory.statusFilter + receiving.activeTab 둘 다 server-persist.
 *   같은 preferences endpoint reuse — schema 변경 0. URL search param 우선 (inventory).
 *
 * Strategy:
 *   - InventoryFilterSchema z.object({ status }) 추가.
 *   - ReceivingFilterSchema z.object({ activeTab }) 추가.
 *   - useUserPreferences hook 안 updateInventoryFilter + updateReceivingFilter 추가.
 *   - inventory-content.tsx + receiving/page.tsx server hydration + persistence useEffect.
 *
 * canonical truth lock:
 *   - §11.230c (a)/(a)-2/(a)-3/(a)-4 모두 보존.
 *   - inventory line 140 URL `?filter` 우선 패턴 보존.
 *   - receiving ModuleBucketKey type 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const ROUTE_PATH = resolve(
  __dirname,
  "../../app/api/user/preferences/route.ts",
);
const HELPER_PATH = resolve(
  __dirname,
  "../../lib/preferences/user-preferences.ts",
);
const INVENTORY_PATH = resolve(
  __dirname,
  "../../app/dashboard/inventory/inventory-content.tsx",
);
const RECEIVING_PATH = resolve(
  __dirname,
  "../../app/dashboard/receiving/page.tsx",
);

const route = safeRead(ROUTE_PATH);
const helper = safeRead(HELPER_PATH);
const inventory = safeRead(INVENTORY_PATH);
const receiving = safeRead(RECEIVING_PATH);

describe("§11.230c (a)-5 #1 — preferences route zod 확장", () => {
  it("inventoryFilter zod object 추가", () => {
    expect(route).toMatch(/inventoryFilter/);
  });

  it("receivingFilter zod object 추가", () => {
    expect(route).toMatch(/receivingFilter/);
  });

  it("inventoryFilter.status z.string optional", () => {
    expect(route).toMatch(/InventoryFilterSchema[\s\S]{0,300}status[\s\S]{0,100}z\.string/);
  });

  it("receivingFilter.activeTab z.string optional", () => {
    expect(route).toMatch(/ReceivingFilterSchema[\s\S]{0,300}activeTab[\s\S]{0,100}z\.string/);
  });

  it("PATCH deep merge 안 inventoryFilter + receivingFilter 적용", () => {
    expect(route).toMatch(/inventoryFilter/);
    expect(route).toMatch(/receivingFilter/);
  });
});

describe("§11.230c (a)-5 #2 — useUserPreferences helper 확장", () => {
  it("updateInventoryFilter function export", () => {
    expect(helper).toMatch(/updateInventoryFilter/);
  });

  it("updateReceivingFilter function export", () => {
    expect(helper).toMatch(/updateReceivingFilter/);
  });

  it("UserPreferencesJson type 안 inventoryFilter + receivingFilter 선언", () => {
    expect(helper).toMatch(/inventoryFilter/);
    expect(helper).toMatch(/receivingFilter/);
  });
});

describe("§11.230c (a)-5 #3 — inventory-content.tsx server hydration", () => {
  it("useUserPreferences import", () => {
    expect(inventory).toMatch(/useUserPreferences/);
  });

  it("server hydration (preferences.inventoryFilter → setStatusFilter)", () => {
    expect(inventory).toMatch(/preferences[\s\S]{0,1000}inventoryFilter[\s\S]{0,1000}setStatusFilter/);
  });

  it("URL `?filter` 우선 (server 적용 전 URL 체크)", () => {
    expect(inventory).toMatch(/searchParams\.get\(["']filter["']/);
  });

  it("persistence — updateInventoryFilter 호출", () => {
    expect(inventory).toMatch(/updateInventoryFilter/);
  });
});

describe("§11.230c (a)-5 #4 — receiving/page.tsx server hydration", () => {
  it("useUserPreferences import", () => {
    expect(receiving).toMatch(/useUserPreferences/);
  });

  it("server hydration (preferences.receivingFilter → setActiveTab)", () => {
    expect(receiving).toMatch(/preferences[\s\S]{0,1000}receivingFilter[\s\S]{0,1000}setActiveTab/);
  });

  it("persistence — updateReceivingFilter 호출", () => {
    expect(receiving).toMatch(/updateReceivingFilter/);
  });
});

describe("§11.230c (a)-5 #5 — invariant 보존", () => {
  it("§11.230c (a) preferences route GET/PATCH 보존", () => {
    expect(route).toMatch(/export\s+async\s+function\s+GET/);
    expect(route).toMatch(/export\s+async\s+function\s+PATCH/);
  });

  it("§11.230c (a)-2 briefingCollapsed 보존", () => {
    expect(route).toMatch(/briefingCollapsed/);
  });

  it("§11.230c (a)-3 quotesView 보존", () => {
    expect(route).toMatch(/quotesView/);
  });

  it("§11.230c (a)-4 quotesFilter 보존", () => {
    expect(route).toMatch(/quotesFilter/);
  });

  it("모든 helper update 함수 보존 (5개)", () => {
    expect(helper).toMatch(/updateColumnPrefs/);
    expect(helper).toMatch(/updateBriefingCollapsed/);
    expect(helper).toMatch(/updateQuotesView/);
    expect(helper).toMatch(/updateQuotesFilter/);
  });

  it("inventory locationFilter / categoryFilter 보존 (별도 cluster)", () => {
    expect(inventory).toMatch(/locationFilter/);
    expect(inventory).toMatch(/categoryFilter/);
  });

  it("receiving activeTab ModuleBucketKey 보존", () => {
    expect(receiving).toMatch(/activeTab/);
    expect(receiving).toMatch(/setActiveTab/);
  });

  it("§11.230c (a)-5 trace marker", () => {
    const combined = route + "\n" + helper + "\n" + inventory + "\n" + receiving;
    expect(combined).toMatch(/§11\.230c \(a\)-5|11\.230c \(a\)-5|§11\.230c-a-5/);
  });
});
