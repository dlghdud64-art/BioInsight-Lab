/**
 * §11.230c (a)-8 #inventory-location-category-sync — 호영님 §11.230c (a)-7 자연 후속.
 *
 * 호영님 spec: inventory-content.tsx 의 locationFilter + categoryFilter server-persist.
 *   §11.230c (a)-5 의 status 만 server-persist 했던 잔여 백로그 처리.
 *   lotStatusFilter / searchQuery 는 여전히 제외 (호영님 scope).
 *   minimum diff (1-1.5h) — InventoryFilterSchema 확장 + 3 filter unified hydration.
 *
 * Strategy:
 *   - InventoryFilterSchema 안 location + category z.string().max(50).optional() 추가.
 *   - UserPreferencesJson inventoryFilter nested type 확장.
 *   - InventoryFilterPatch type 확장.
 *   - PATCH deep merge 안 location + category 분기 추가.
 *   - inventory-content.tsx 안 server hydration + persistence 3 filter unified.
 *
 * canonical truth lock:
 *   - §11.230c (a)/(a)-2/(a)-3/(a)-4/(a)-5/(a)-6/(a)-7 모두 보존.
 *   - inventory page lotStatusFilter / searchQuery 별도 cluster (제외).
 *   - URL ?filter param 여전히 statusFilter 만 적용 (location/category 는 URL 없음).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const ROUTE_PATH = resolve(__dirname, "../../app/api/user/preferences/route.ts");
const HELPER_PATH = resolve(__dirname, "../../lib/preferences/user-preferences.ts");
const INVENTORY_PATH = resolve(
  __dirname,
  "../../app/dashboard/inventory/inventory-content.tsx",
);

const route = safeRead(ROUTE_PATH);
const helper = safeRead(HELPER_PATH);
const inventory = safeRead(INVENTORY_PATH);

describe("§11.230c (a)-8 #1 — preferences route InventoryFilterSchema 확장", () => {
  it("InventoryFilterSchema location z.string optional", () => {
    expect(route).toMatch(/InventoryFilterSchema[\s\S]{0,400}location[\s\S]{0,100}z\.string/);
  });

  it("InventoryFilterSchema category z.string optional", () => {
    expect(route).toMatch(/InventoryFilterSchema[\s\S]{0,400}category[\s\S]{0,100}z\.string/);
  });

  it("PATCH deep merge 안 inventoryFilter.location 분기", () => {
    expect(route).toMatch(/inventoryFilter[\s\S]{0,500}location/);
  });

  it("PATCH deep merge 안 inventoryFilter.category 분기", () => {
    expect(route).toMatch(/inventoryFilter[\s\S]{0,500}category/);
  });
});

describe("§11.230c (a)-8 #2 — useUserPreferences helper 확장", () => {
  it("UserPreferencesJson inventoryFilter location nested type", () => {
    expect(helper).toMatch(/inventoryFilter[\s\S]{0,200}location/);
  });

  it("UserPreferencesJson inventoryFilter category nested type", () => {
    expect(helper).toMatch(/inventoryFilter[\s\S]{0,200}category/);
  });

  it("InventoryFilterPatch type location 필드", () => {
    expect(helper).toMatch(/InventoryFilterPatch[\s\S]{0,200}location/);
  });

  it("InventoryFilterPatch type category 필드", () => {
    expect(helper).toMatch(/InventoryFilterPatch[\s\S]{0,200}category/);
  });
});

describe("§11.230c (a)-8 #3 — inventory-content.tsx 3 filter unified", () => {
  it("server hydration — preferences.inventoryFilter.location → setLocationFilter", () => {
    expect(inventory).toMatch(/inventoryFilter[\s\S]{0,500}location[\s\S]{0,500}setLocationFilter/);
  });

  it("server hydration — preferences.inventoryFilter.category → setCategoryFilter", () => {
    expect(inventory).toMatch(/inventoryFilter[\s\S]{0,500}category[\s\S]{0,500}setCategoryFilter/);
  });

  it("persistence — updateInventoryFilter location 패치", () => {
    expect(inventory).toMatch(/updateInventoryFilter[\s\S]{0,300}location/);
  });

  it("persistence — updateInventoryFilter category 패치", () => {
    expect(inventory).toMatch(/updateInventoryFilter[\s\S]{0,300}category/);
  });
});

describe("§11.230c (a)-8 #4 — invariant 보존", () => {
  it("§11.230c (a) preferences route GET/PATCH 보존", () => {
    expect(route).toMatch(/export\s+async\s+function\s+GET/);
    expect(route).toMatch(/export\s+async\s+function\s+PATCH/);
  });

  it("§11.230c (a)-5 inventoryFilter status 보존", () => {
    expect(route).toMatch(/InventoryFilterSchema[\s\S]{0,400}status[\s\S]{0,100}z\.string/);
  });

  it("§11.230c (a)-5 receivingFilter 보존", () => {
    expect(route).toMatch(/receivingFilter/);
  });

  it("§11.230c (a)-6 purchasesFilter + purchaseOrdersFilter 보존", () => {
    expect(route).toMatch(/purchasesFilter/);
    expect(route).toMatch(/purchaseOrdersFilter/);
  });

  it("§11.230c (a)-7 safetyFilter 보존", () => {
    expect(route).toMatch(/safetyFilter/);
    expect(helper).toMatch(/updateSafetyFilter/);
  });

  it("모든 update 함수 보존 (8개)", () => {
    expect(helper).toMatch(/updateColumnPrefs/);
    expect(helper).toMatch(/updateBriefingCollapsed/);
    expect(helper).toMatch(/updateQuotesView/);
    expect(helper).toMatch(/updateQuotesFilter/);
    expect(helper).toMatch(/updateInventoryFilter/);
    expect(helper).toMatch(/updateReceivingFilter/);
    expect(helper).toMatch(/updatePurchasesFilter/);
    expect(helper).toMatch(/updatePurchaseOrdersFilter/);
    expect(helper).toMatch(/updateSafetyFilter/);
  });

  it("inventory-content statusFilter / locationFilter / categoryFilter useState 보존", () => {
    expect(inventory).toMatch(/setStatusFilter/);
    expect(inventory).toMatch(/setLocationFilter/);
    expect(inventory).toMatch(/setCategoryFilter/);
  });

  it("URL ?filter param 여전히 statusFilter 만 (location/category 별도 cluster)", () => {
    expect(inventory).toMatch(/searchParams\.get\(["']filter["']\)/);
  });

  it("§11.230c (a)-8 trace marker", () => {
    const combined = route + "\n" + helper + "\n" + inventory;
    expect(combined).toMatch(/§11\.230c \(a\)-8|11\.230c \(a\)-8|§11\.230c-a-8/);
  });
});
