/**
 * §11.230c (a)-4 #quotes-filter-server-persist — 호영님 §11.230c (a)-3 자연 후속.
 *
 * 호영님 spec: statusFilter + modeChip 둘 다 server-persist. searchQuery 는 ad-hoc 제외.
 *   같은 preferences endpoint reuse — schema 변경 0. URL search param 우선 (URL > server > default).
 *
 * Strategy:
 *   - QuotesFilterSchema z.object({ status, modeChip }) 추가.
 *   - useUserPreferences hook 안 updateQuotesFilter(patch) 추가.
 *   - quotes/page.tsx: server hydration useEffect — URL param 없을 때만 server 적용.
 *     persistence useEffect — statusFilter/modeChip 변경 시 debounced PATCH.
 *
 * canonical truth lock:
 *   - §11.230c (a)/(a)-2/(a)-3 preferences endpoint + helper 시그니처 보존.
 *   - URL search param 우선순위 (line 851 `searchParams.get("status") ?? "all"` 패턴).
 *   - MODE_CHIPS / setStatusFilter / setModeChip 시그니처 보존.
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
const PAGE_PATH = resolve(__dirname, "../../app/dashboard/quotes/page.tsx");

const route = safeRead(ROUTE_PATH);
const helper = safeRead(HELPER_PATH);
const page = safeRead(PAGE_PATH);

describe("§11.230c (a)-4 #1 — preferences route zod 확장", () => {
  it("QuotesFilterSchema 또는 quotesFilter zod object 추가", () => {
    expect(route).toMatch(/quotesFilter/);
  });

  it("status z.string optional (statusFilter)", () => {
    expect(route).toMatch(/status[\s\S]{0,200}z\.string/);
  });

  it("modeChip z.string nullable optional", () => {
    expect(route).toMatch(/modeChip[\s\S]{0,200}(nullable|null)/);
  });

  it("PATCH deep merge 안 quotesFilter 적용", () => {
    expect(route).toMatch(/quotesFilter/);
  });
});

describe("§11.230c (a)-4 #2 — useUserPreferences helper 확장", () => {
  it("updateQuotesFilter function export", () => {
    expect(helper).toMatch(/updateQuotesFilter/);
  });

  it("UserPreferencesJson type 안 quotesFilter 선언", () => {
    expect(helper).toMatch(/quotesFilter/);
  });

  it("debounce 패턴 reuse (setTimeout)", () => {
    expect(helper).toMatch(/setTimeout|clearTimeout/);
  });
});

describe("§11.230c (a)-4 #3 — quotes/page.tsx server hydration", () => {
  it("server hydration useEffect (preferences.quotesFilter → setStatusFilter/setModeChip)", () => {
    expect(page).toMatch(/preferences[\s\S]{0,1500}quotesFilter[\s\S]{0,1500}(setStatusFilter|setModeChip)/);
  });

  it("URL search param 우선 (server 적용 전 URL 체크)", () => {
    // searchParams.get("status") 패턴 보존 매칭
    expect(page).toMatch(/searchParams\.get\(["']status["']/);
  });

  it("persistence — updateQuotesFilter 호출", () => {
    expect(page).toMatch(/updateQuotesFilter/);
  });
});

describe("§11.230c (a)-4 #4 — invariant 보존", () => {
  it("§11.230c (a) preferences route GET/PATCH 보존", () => {
    expect(route).toMatch(/export\s+async\s+function\s+GET/);
    expect(route).toMatch(/export\s+async\s+function\s+PATCH/);
  });

  it("§11.230c (a) ColumnPrefsSchema 보존", () => {
    expect(route).toMatch(/ColumnPrefsSchema/);
  });

  it("§11.230c (a)-2 briefingCollapsed 보존", () => {
    expect(route).toMatch(/briefingCollapsed:\s*z\.boolean\(\)\.optional/);
  });

  it("§11.230c (a)-3 QuotesViewSchema/quotesView 보존", () => {
    expect(route).toMatch(/QuotesViewSchema|quotesView/);
  });

  it("§11.230c (a)/(a)-2/(a)-3 helper 모든 update 함수 보존", () => {
    expect(helper).toMatch(/updateColumnPrefs/);
    expect(helper).toMatch(/updateBriefingCollapsed/);
    expect(helper).toMatch(/updateQuotesView/);
  });

  it("§11.227 setStatusFilter 시그니처 보존 (§quotes-quick-filter-4a: MODE_CHIPS/setModeChip page 제거)", () => {
    // §quotes-quick-filter-4a P2 — page.tsx 의 MODE_CHIPS/setModeChip 및 modeChip persist 제거(의도).
    //   statusFilter server-persist 는 유지(setStatusFilter). schema-level modeChip(route/helper zod)
    //   는 그대로 보존 — 위 #1/#2 describe 가 계속 잠금.
    expect(page).toMatch(/setStatusFilter/);
    // MODE_CHIPS.map/setModeChip 라이브 참조 제거 확인(잔여 MODE_CHIPS 문자열은 주석 1건뿐).
    expect(page).not.toMatch(/MODE_CHIPS\.map/);
    expect(page).not.toMatch(/setModeChip/);
  });

  it("§11.230c (a)-4 trace marker", () => {
    const combined = route + "\n" + helper + "\n" + page;
    expect(combined).toMatch(/§11\.230c \(a\)-4|11\.230c \(a\)-4|§11\.230c-a-4/);
  });
});
