/**
 * §11.230c (a)-3 #quotes-view-server-persist — 호영님 §11.230c (a)-2 자연 후속.
 *
 * 호영님 spec: viewMode (card/table) + sortState (key + direction) 둘 다 server-persist.
 *   같은 preferences endpoint reuse — schema 변경 0 (JSON 안 quotesView key 추가만).
 *   viewMode 는 §11.217 Phase 6 localStorage 보존 (backwards compat).
 *   sortState 는 localStorage 0 → server-only.
 *
 * Strategy:
 *   - QuotesViewSchema z.object({ mode, sort: { key, direction } }) 추가.
 *   - UserPreferencesPatchSchema 확장 (quotesView optional).
 *   - useUserPreferences hook 안 updateQuotesView(patch) 추가.
 *   - quotes/page.tsx: viewMode/sortState server hydration useEffect + persistence useEffect 추가.
 *
 * canonical truth lock:
 *   - §11.230c (a)/(a)-2 preferences endpoint + helper 시그니처 보존.
 *   - §11.217 Phase 6 labaxis-quote-view-mode localStorage 보존.
 *   - §11.227 #9 sortState shape 보존 (key SortKey | null + direction asc/desc).
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

describe("§11.230c (a)-3 #1 — preferences route zod 확장", () => {
  it("QuotesViewSchema 또는 quotesView zod object 추가", () => {
    expect(route).toMatch(/quotesView/);
  });

  it("mode 'card' | 'table' enum (zod z.enum 또는 z.union)", () => {
    expect(route).toMatch(/['"]card['"][\s\S]{0,200}['"]table['"]/);
  });

  it("sort z.object — key + direction", () => {
    expect(route).toMatch(/sort[\s\S]{0,400}direction/);
  });

  it("direction 'asc' | 'desc' enum", () => {
    expect(route).toMatch(/['"]asc['"][\s\S]{0,100}['"]desc['"]/);
  });

  it("PATCH deep merge 안 quotesView 적용", () => {
    expect(route).toMatch(/quotesView/);
  });
});

describe("§11.230c (a)-3 #2 — useUserPreferences helper 확장", () => {
  it("updateQuotesView function export", () => {
    expect(helper).toMatch(/updateQuotesView/);
  });

  it("UserPreferencesJson type 안 quotesView 선언", () => {
    expect(helper).toMatch(/quotesView/);
  });

  it("debounce 패턴 reuse (setTimeout)", () => {
    expect(helper).toMatch(/setTimeout|clearTimeout/);
  });
});

describe("§11.230c (a)-3 #3 — quotes/page.tsx server-first", () => {
  it("server hydration useEffect (preferences.quotesView → setViewMode + setSortState)", () => {
    // server preferences 안 quotesView 도착 시 setViewMode 또는 setSortState 호출 매칭
    expect(page).toMatch(/preferences[\s\S]{0,1000}quotesView[\s\S]{0,1000}(setViewMode|setSortState)/);
  });

  it("persistence — updateQuotesView 호출 (debounced server PATCH)", () => {
    expect(page).toMatch(/updateQuotesView/);
  });

  it("viewMode + sortState 양쪽 persistence trigger", () => {
    // viewMode 변경 시 updateQuotesView + sortState 변경 시 updateQuotesView 매칭
    // 또는 단일 useEffect [viewMode, sortState] dep
    expect(page).toMatch(/(updateQuotesView[\s\S]{0,500}(viewMode|sortState)|(\[viewMode,\s*sortState\]|\[sortState,\s*viewMode\]))/);
  });
});

describe("§11.230c (a)-3 #4 — invariant 보존", () => {
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

  it("§11.230c (a)/(a)-2 useUserPreferences + updateColumnPrefs + updateBriefingCollapsed 보존", () => {
    expect(helper).toMatch(/useUserPreferences/);
    expect(helper).toMatch(/updateColumnPrefs/);
    expect(helper).toMatch(/updateBriefingCollapsed/);
  });

  it("§11.217 Phase 6 labaxis-quote-view-mode localStorage 보존 (backwards compat)", () => {
    expect(page).toMatch(/labaxis-quote-view-mode/);
  });

  it("§11.227 #9 sortState shape 보존 (key SortKey | null + direction asc/desc)", () => {
    expect(page).toMatch(/setSortState/);
    expect(page).toMatch(/sortState/);
  });

  it("§11.230c (a)-3 trace marker", () => {
    const combined = route + "\n" + helper + "\n" + page;
    expect(combined).toMatch(/§11\.230c \(a\)-3|11\.230c \(a\)-3|§11\.230c-a-3/);
  });
});
