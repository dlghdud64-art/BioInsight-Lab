/**
 * §11.230c (a)-6 #purchases-orders-filter-sync — 호영님 §11.230c (a)-5 자연 후속.
 *
 * 호영님 spec: purchases.queueTab + purchase-orders.activeTab 둘 다 server-persist.
 *   orders 는 redirect-only (구매 운영 으로 흡수) — 제외. preferences endpoint reuse.
 *
 * Strategy:
 *   - PurchasesFilterSchema z.object({ queueTab }) 추가.
 *   - PurchaseOrdersFilterSchema z.object({ activeTab }) 추가.
 *   - useUserPreferences hook 안 updatePurchasesFilter + updatePurchaseOrdersFilter.
 *   - purchases/page.tsx + purchase-orders/page.tsx server hydration + persistence useEffect.
 *
 * canonical truth lock:
 *   - §11.230c (a)/(a)-2/(a)-3/(a)-4/(a)-5 모두 보존.
 *   - purchases QueueTab type ("all" | ConversionStatus) 보존.
 *   - purchase-orders ModuleBucketKey type 보존.
 *   - orders redirect-only 유지 (state 없음, 본 cluster 제외).
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
const PURCHASES_PATH = resolve(
  __dirname,
  "../../app/dashboard/purchases/page.tsx",
);
const PURCHASE_ORDERS_PATH = resolve(
  __dirname,
  "../../app/dashboard/purchase-orders/page.tsx",
);

const route = safeRead(ROUTE_PATH);
const helper = safeRead(HELPER_PATH);
const purchases = safeRead(PURCHASES_PATH);
const purchaseOrders = safeRead(PURCHASE_ORDERS_PATH);

describe("§11.230c (a)-6 #1 — preferences route zod 확장", () => {
  it("purchasesFilter zod object 추가", () => {
    expect(route).toMatch(/purchasesFilter/);
  });

  it("purchaseOrdersFilter zod object 추가", () => {
    expect(route).toMatch(/purchaseOrdersFilter/);
  });

  it("PurchasesFilterSchema queueTab z.string optional", () => {
    expect(route).toMatch(/PurchasesFilterSchema[\s\S]{0,300}queueTab[\s\S]{0,100}z\.string/);
  });

  it("PurchaseOrdersFilterSchema activeTab z.string optional", () => {
    expect(route).toMatch(/PurchaseOrdersFilterSchema[\s\S]{0,300}activeTab[\s\S]{0,100}z\.string/);
  });

  it("PATCH deep merge 안 purchasesFilter + purchaseOrdersFilter 적용", () => {
    expect(route).toMatch(/purchasesFilter/);
    expect(route).toMatch(/purchaseOrdersFilter/);
  });
});

describe("§11.230c (a)-6 #2 — useUserPreferences helper 확장", () => {
  it("updatePurchasesFilter function export", () => {
    expect(helper).toMatch(/updatePurchasesFilter/);
  });

  it("updatePurchaseOrdersFilter function export", () => {
    expect(helper).toMatch(/updatePurchaseOrdersFilter/);
  });

  it("UserPreferencesJson type 안 purchasesFilter + purchaseOrdersFilter 선언", () => {
    expect(helper).toMatch(/purchasesFilter/);
    expect(helper).toMatch(/purchaseOrdersFilter/);
  });
});

describe("§11.230c (a)-6 #3 — purchases/page.tsx server hydration", () => {
  it("useUserPreferences import", () => {
    expect(purchases).toMatch(/useUserPreferences/);
  });

  it("server hydration (preferences.purchasesFilter → setQueueTab)", () => {
    expect(purchases).toMatch(/preferences[\s\S]{0,1000}purchasesFilter[\s\S]{0,1000}setQueueTab/);
  });

  it("persistence — updatePurchasesFilter 호출", () => {
    expect(purchases).toMatch(/updatePurchasesFilter/);
  });
});

describe("§11.230c (a)-6 #4 — purchase-orders/page.tsx server hydration", () => {
  it("useUserPreferences import", () => {
    expect(purchaseOrders).toMatch(/useUserPreferences/);
  });

  it("server hydration (preferences.purchaseOrdersFilter → setActiveTab)", () => {
    expect(purchaseOrders).toMatch(/preferences[\s\S]{0,1000}purchaseOrdersFilter[\s\S]{0,1000}setActiveTab/);
  });

  it("persistence — updatePurchaseOrdersFilter 호출", () => {
    expect(purchaseOrders).toMatch(/updatePurchaseOrdersFilter/);
  });
});

describe("§11.230c (a)-6 #5 — invariant 보존", () => {
  it("§11.230c (a) preferences route GET/PATCH 보존", () => {
    expect(route).toMatch(/export\s+async\s+function\s+GET/);
    expect(route).toMatch(/export\s+async\s+function\s+PATCH/);
  });

  it("§11.230c (a)-5 inventoryFilter + receivingFilter 보존", () => {
    expect(route).toMatch(/inventoryFilter/);
    expect(route).toMatch(/receivingFilter/);
  });

  it("모든 update 함수 보존 (6개)", () => {
    expect(helper).toMatch(/updateColumnPrefs/);
    expect(helper).toMatch(/updateBriefingCollapsed/);
    expect(helper).toMatch(/updateQuotesView/);
    expect(helper).toMatch(/updateQuotesFilter/);
    expect(helper).toMatch(/updateInventoryFilter/);
    expect(helper).toMatch(/updateReceivingFilter/);
  });

  it("purchases QueueTab type / setQueueTab 보존", () => {
    expect(purchases).toMatch(/QueueTab/);
    expect(purchases).toMatch(/setQueueTab/);
  });

  it("purchase-orders ModuleBucketKey / setActiveTab 보존", () => {
    expect(purchaseOrders).toMatch(/ModuleBucketKey/);
    expect(purchaseOrders).toMatch(/setActiveTab/);
  });

  it("§11.230c (a)-6 trace marker", () => {
    const combined = route + "\n" + helper + "\n" + purchases + "\n" + purchaseOrders;
    expect(combined).toMatch(/§11\.230c \(a\)-6|11\.230c \(a\)-6|§11\.230c-a-6/);
  });
});
