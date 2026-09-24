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
/* 🛑 은퇴 §po-ui-removed(2026-09-24 · 호영님 판정) — 발주 화면 자체가 삭제됐다. purchaseOrdersFilter 를 **저장하는 쪽**
 *    (route zod · useUserPreferences helper)은 #1·#2 가 계속 잠근다. 읽어서 탭으로 복원하던
 *    화면이 없을 뿐이다. 실제 발주 화면이 다시 생기면 #4 를 그때 되살린다. */
const _RETIRED_PURCHASE_ORDERS_PATH = resolve(
  __dirname,
  "../../app/dashboard/purchase-orders/page.tsx",
);

const route = safeRead(ROUTE_PATH);
const helper = safeRead(HELPER_PATH);
void PURCHASES_PATH; // §purchases-ui-removed (2026-09-24 · 호영님 판정) — 표면 삭제로 읽지 않는다.
void _RETIRED_PURCHASE_ORDERS_PATH;

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

/* 🛑 은퇴 §purchases-ui-removed (2026-09-24 · 호영님 판정) — #3 구매 운영 화면 hydration.
 *    #4(발주)와 같은 이유다: 저장하는 쪽(route zod · useUserPreferences helper)은 #1·#2 가
 *    계속 잠그고, 읽어서 탭으로 복원하던 **화면**만 사라졌다. */

/* 🛑 은퇴 §po-ui-removed(2026-09-24 · 호영님 판정) — #4 발주 화면 hydration.
 *    purchaseOrdersFilter 를 **저장하는 쪽**(route zod · useUserPreferences helper)은
 *    #1·#2 가 계속 잠근다. 읽어서 탭으로 복원하던 화면만 사라졌다. */

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

  /* 🛑 은퇴 §purchases-ui-removed (2026-09-24 · 호영님 판정) — 「purchases QueueTab / setQueueTab 보존」. 잴 화면이 삭제됐다. */

  /* 🛑 은퇴 §po-ui-removed — 「purchase-orders ModuleBucketKey / setActiveTab 보존」. 잴 화면이 삭제됐다. */

  it("§11.230c (a)-6 trace marker", () => {
    const combined = route + "\n" + helper;
    expect(combined).toMatch(/§11\.230c \(a\)-6|11\.230c \(a\)-6|§11\.230c-a-6/);
  });
});
