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

/* 🪦 §11.230c (a)-5 #4 — receiving/page.tsx server hydration · 은퇴 (2026-09-17 §receiving-filter-retire)
 *
 *   은퇴한 단언 3건: useUserPreferences import · preferences.receivingFilter → setActiveTab · updateReceivingFilter 호출
 *   (+ 아래 #5 의 "receiving activeTab ModuleBucketKey 보존" 1건)
 *
 *   왜 은퇴인가 (승계 아님)
 *     d8156765 §receiving-list-redesign(2026-08-31 · 호영님 2026-08-30 핸드오프)이 입고 화면을
 *     리스트 canonical + 인라인 펼침으로 재설계하며 **탭 자체를 없앴다**. 복원할 activeTab 이 없다.
 *     시간순: 이 파일(§11.230c)이 먼저 · 재설계가 나중 → 이 단언들은 폐기된 설계를 요구한다.
 *     승계자가 필요 없다 — 명제("입고 탭 선택이 서버에서 복원된다")의 대상이 사라졌다.
 *   🛑 이 RED 를 "회귀" 로 읽고 입고 화면에 탭을 되살리지 말 것.
 *
 *   명제 §11.230c("설정이 서버에서 하이드레이션된다")는 receiving 밖에서 유효하다 — #3(inventory)는 그대로 둔다.
 *
 *   ⚠️ 남은 것 — 죽은 설정 필드
 *     api/user/preferences/route.ts(ReceivingFilterSchema · nested merge) 와
 *     lib/preferences/user-preferences.ts(타입 · updateReceivingFilter)는 아직 receivingFilter 를 받고 저장한다.
 *     읽는 화면도 쓰는 화면도 0 이다. 위 #1·#2 의 receivingFilter 단언이 그 필드의 **존재**를 핀하고 있고,
 *     preferences-inventory-locationcategory · preferences-purchases-orders · preferences-safety 도 같은 필드를 핀한다.
 *     필드 제거(§receiving-filter-retire ②)는 그 핀들을 함께 승계해야 해서 이 커밋 범위 밖으로 뺐다.
 */

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

  // 🪦 "receiving activeTab ModuleBucketKey 보존" 은퇴 — 위 #4 주석 참조(d8156765 로 탭 제거).

  it("§11.230c (a)-5 trace marker", () => {
    const combined = route + "\n" + helper + "\n" + inventory + "\n" + receiving;
    expect(combined).toMatch(/§11\.230c \(a\)-5|11\.230c \(a\)-5|§11\.230c-a-5/);
  });
});
