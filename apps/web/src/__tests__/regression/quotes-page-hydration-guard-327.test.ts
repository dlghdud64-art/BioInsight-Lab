/**
 * §11.327 #quotes-page-hydration-guard — Regression sentinel (Phase 3)
 *
 * 호영님 P0 (호영님 spec §11.325, 번호 매핑 §11.327):
 *   /api/user/preferences PATCH 20+ 반복 403 폭주.
 *
 *   Phase 2 sandbox audit 결과 — root cause 확정:
 *   - middleware CSRF gate (Batch 10) — 403 매핑
 *   - csrfFetch race-condition retry 1회 → 20+ 폭주는 useEffect feedback loop 필수
 *   - quotes/page.tsx useEffect 4쌍 (hydration + mutation) — 가설 F 100% 확정
 *     · Mutation 2 dep `[columnPrefs, userPrefs]` — userPrefs 가 매번 새 reference
 *     · mutation → server PATCH → cache update → preferences 새 reference → hydration 재실행 → mutation 재실행 → 무한
 *
 *   Phase 3 Option A (호영님 선택, minimal scope = quotes/page only):
 *   - hydratedRef = useRef(false) 추가
 *   - preferences 도착 시 별도 useEffect 가 flag set
 *   - 4 mutation useEffect 가드: if (!hydratedRef.current) return;
 *   - Mutation 2 dep `[columnPrefs, userPrefs]` → `[columnPrefs]` (userPrefs 제거)
 *
 * canonical 보존:
 *   - useUserPreferences hook 자체 변경 0 (다른 6 caller page 영향 0)
 *   - hydration useEffect 4개 (column/briefing/view/filter) 로직 보존
 *   - debounce 400ms / localStorage fallback 보존
 *   - server-first hydration 원칙 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PAGE_PATH = "src/app/dashboard/quotes/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.327 — hydratedRef 가드 신설 (Phase 3 GREEN target)", () => {
  it("hydratedRef = useRef(false) 신설 + §11.327 trace marker", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/const hydratedRef = useRef\(false\)/);
    expect(src).toMatch(/§11\.327/);
  });

  it("preferences fetch 완료 시 hydratedRef.current = true (별도 useEffect)", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/if \(userPrefs\.preferences\) \{[\s\S]{0,80}hydratedRef\.current = true/);
  });
});

describe("§11.327 — 4 mutation useEffect hydratedRef 가드 (Phase 3 GREEN target)", () => {
  it("Mutation 1 (briefingCollapsed) hydratedRef 가드 + skip pattern", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(
      /if \(!hydratedRef\.current\) return[\s\S]{0,200}userPrefs\.updateBriefingCollapsed/,
    );
  });

  it("Mutation 2 (columnPrefs) hydratedRef 가드 + userPrefs dep 제거", () => {
    const src = read(PAGE_PATH);
    // hydratedRef 가드 + updateColumnPrefs 호출
    expect(src).toMatch(
      /if \(!hydratedRef\.current\) return[\s\S]{0,400}userPrefs\.updateColumnPrefs/,
    );
    // 옛 dep `[columnPrefs, userPrefs]` 제거 → `[columnPrefs]` (userPrefs 미포함)
    expect(src).not.toMatch(/\}, \[columnPrefs, userPrefs\]\)/);
  });

  it("Mutation 3 (quotesView) hydratedRef 가드", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(
      /if \(!hydratedRef\.current\) return[\s\S]{0,200}userPrefs\.updateQuotesView/,
    );
  });

  it("Mutation 4 (quotesFilter) hydratedRef 가드", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(
      /if \(!hydratedRef\.current\) return[\s\S]{0,200}userPrefs\.updateQuotesFilter/,
    );
  });
});

describe("§11.327 — canonical 보존 (hydration + debounce + 다른 caller 영향 0)", () => {
  it("useUserPreferences hook 호출 보존", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/const userPrefs = useUserPreferences\(\)/);
  });

  it("4 hydration useEffect 로직 보존 (columnPrefs/briefingCollapsed/quotesView/quotesFilter)", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/userPrefs\.preferences\?\.columnPrefs\?\.quotes/);
    expect(src).toMatch(/userPrefs\.preferences\?\.briefingCollapsed/);
    expect(src).toMatch(/userPrefs\.preferences\?\.quotesView/);
    expect(src).toMatch(/userPrefs\.preferences\?\.quotesFilter/);
  });

  it("useUserPreferences hook file 변경 0 (다른 6 caller 영향 0 보장)", () => {
    const hookSrc = read("src/lib/preferences/user-preferences.ts");
    // §11.327 Phase 1 mitigation (retry 0 + onError warn) 보존
    expect(hookSrc).toMatch(/retry:\s*0/);
    expect(hookSrc).toMatch(/\[§11\.327\] preferences PATCH 실패/);
  });
});
