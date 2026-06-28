/**
 * §11.230c (a)-2 #briefing-collapsed-server-persist — 호영님 §11.230c (a) 자연 후속.
 *
 * 호영님 spec: §11.248e-2 BRIEFING_COLLAPSED_LS_KEY localStorage only →
 *   §11.230c (a) preferences endpoint reuse 으로 server-persist. cross-device
 *   sync. schema 변경 0 (User.preferences Json field 안 briefingCollapsed key
 *   추가만).
 *
 * Strategy:
 *   - UserPreferencesPatchSchema 확장 (briefingCollapsed: z.boolean().optional()).
 *   - PATCH route deep merge logic 확장.
 *   - useUserPreferences hook 안 updateBriefingCollapsed(value) 추가.
 *   - quotes/page.tsx isBriefingCollapsed useEffect 2개 swap (server hydration +
 *     debounced server PATCH).
 *
 * canonical truth lock:
 *   - §11.230c (a) preferences endpoint + useUserPreferences hook 시그니처 보존.
 *   - §11.248e-2 BRIEFING_COLLAPSED_LS_KEY localStorage 보존 (backwards compat).
 *   - §11.230c (a) columnPrefs cross-device sync 보존 (양립).
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

describe("§11.230c (a)-2 #1 — preferences route zod 확장", () => {
  it("UserPreferencesPatchSchema 안 briefingCollapsed boolean optional", () => {
    expect(route).toMatch(/briefingCollapsed:\s*z\.boolean\(\)\.optional/);
  });

  it("PATCH deep merge 안 briefingCollapsed 적용", () => {
    // 명시적 patch 안 briefingCollapsed 또는 spread 매칭
    expect(route).toMatch(/briefingCollapsed/);
  });
});

describe("§11.230c (a)-2 #2 — useUserPreferences hook 확장", () => {
  it("updateBriefingCollapsed function export", () => {
    expect(helper).toMatch(/updateBriefingCollapsed/);
  });

  it("UserPreferencesJson type 안 briefingCollapsed 선언", () => {
    expect(helper).toMatch(/briefingCollapsed/);
  });

  it("debounce 패턴 reuse (setTimeout 또는 clearTimeout)", () => {
    expect(helper).toMatch(/setTimeout|clearTimeout/);
  });
});

// §11.230c (a)-2 #3 — [RETIRED by §quote-briefing-rail-overlay, 호영님 2026-06-29]
//   접기(collapse) 메커니즘 폐기로 quotes/page.tsx 의 isBriefingCollapsed client
//   wiring(server hydration + debounced updateBriefingCollapsed PATCH) 제거.
//   server 필드(route zod + helper hook)는 backwards-compat 으로 보존(#1/#2 GREEN 유지).
describe("§quote-briefing-rail-overlay — page client 접기 wiring 폐기(RETIRED)", () => {
  it("page.tsx 에 setIsBriefingCollapsed / updateBriefingCollapsed 호출 0", () => {
    expect(page).not.toMatch(/setIsBriefingCollapsed/);
    expect(page).not.toMatch(/updateBriefingCollapsed/);
  });
});

describe("§11.230c (a)-2 #4 — invariant 보존", () => {
  it("§11.230c (a) preferences route GET/PATCH 보존", () => {
    expect(route).toMatch(/export\s+async\s+function\s+GET/);
    expect(route).toMatch(/export\s+async\s+function\s+PATCH/);
  });

  it("§11.230c (a) ColumnPrefsSchema zod 보존", () => {
    expect(route).toMatch(/ColumnPrefsSchema/);
  });

  it("§11.230c (a) useUserPreferences + updateColumnPrefs 보존", () => {
    expect(helper).toMatch(/useUserPreferences/);
    expect(helper).toMatch(/updateColumnPrefs/);
  });

  // §11.248e-2 BRIEFING_COLLAPSED_LS_KEY — [RETIRED] 접기 폐기로 page LS key 제거.
  it("page.tsx BRIEFING_COLLAPSED_LS_KEY / labaxis-briefing-collapsed 0", () => {
    expect(page).not.toMatch(/BRIEFING_COLLAPSED_LS_KEY/);
    expect(page).not.toMatch(/labaxis-briefing-collapsed/);
  });

  it("§11.230c (a) columnPrefs server hydration 보존", () => {
    expect(page).toMatch(/columnPrefs[\s\S]{0,500}preferences|preferences[\s\S]{0,500}columnPrefs/);
  });

  it("§11.230c (a)-2 trace marker", () => {
    const combined = route + "\n" + helper + "\n" + page;
    expect(combined).toMatch(/§11\.230c \(a\)-2|11\.230c \(a\)-2|§11\.230c-a-2/);
  });
});
