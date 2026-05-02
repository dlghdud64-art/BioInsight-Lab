/**
 * §11.196f #dashboard-lucide-dead-import-sweep
 *
 * §11.196e (recharts) 의 dead import sweep helper 패턴을 lucide-react 에
 * 적용. icon library 는 prop pattern (`icon={Icon}`, `icon: Icon`) 도
 * usage 로 카운트해야 false positive 방지 — recharts (`<Component>` JSX
 * only) 와 detect 방식 다름.
 *
 * Detection rule (icon style):
 *   import block 의 named symbol 별로 `\bSymbol\b` count > 1 이면 사용 중
 *   (import line 1 + 사용처 1+).
 *
 * §11.196f Phase 1 — 4 surface dead 정리 후 regression guard 4 case.
 *
 * §11.196g (deferred) — 나머지 28 surface 의 dead lucide 정리 (1 file 당
 * 1-9 symbol, 총 ~64 symbol). 본 helper 가 정리 후 regression 자동 보호.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * lucide-react dead import detect helper.
 *
 * 알고리즘:
 *   1. import block (multi-line) 추출
 *   2. named symbol 추출 (alias `X as Y` → Y 사용)
 *   3. 각 symbol 별 `\bSymbol\b` 전체 file count > 1 면 OK
 *      (import line 자체 1 + 사용처 1+ = 2+)
 *   4. count == 1 (import line 만) 이면 dead → fail
 *
 * Icon library 는 `<Icon>` JSX 외에도 `icon={Icon}`, `icon: Icon`,
 * `as={Icon}` 같은 prop/object pattern 도 흔한 사용. word-boundary count
 * 가 가장 robust.
 */
function assertNoDeadLucideImport(filePath: string): void {
  const source = readFileSync(filePath, "utf8");
  // multiple import block 가능 (한 file 에 여러 lucide import)
  const importBlocks = source.matchAll(
    /import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']/g,
  );
  const allSymbols: string[] = [];
  for (const m of importBlocks) {
    const symbols = m[1]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => {
        // alias `X as Y` → Y
        const aliasMatch = s.match(/^\w+\s+as\s+(\w+)$/);
        return aliasMatch ? aliasMatch[1] : s;
      });
    allSymbols.push(...symbols);
  }

  if (allSymbols.length === 0) return; // lucide import 부재

  const dead: string[] = [];
  for (const sym of allSymbols) {
    const pattern = new RegExp(`\\b${sym}\\b`, "g");
    const matches = source.match(pattern);
    const count = matches ? matches.length : 0;
    // count <= import block 안 등장 횟수면 dead.
    // 단순 heuristic: import block 안에 1번만 등장하므로 count <= 1 이면 dead.
    // 한 file 에 같은 symbol 이 2 import block 에 중복 import 되는 경우는
    // 매우 드물고 그 자체가 정리 대상.
    if (count <= 1) {
      dead.push(sym);
    }
  }

  expect(
    dead,
    `${filePath}: lucide-react dead import 발견 — \\b${"$"}{Symbol}\\b 사용 0 (import line 외): ${dead.join(", ")}`,
  ).toEqual([]);
}

describe("§11.196f/g lucide-react dead import sweep — 31 cleaned surface regression guard", () => {
  /**
   * §11.196f Phase 1 (4 manually cleaned surface) + §11.196g (27 batch
   * cleaned via perl one-liner) = 31 total. regression guard — 새 dead
   * import 추가 시 즉시 fail.
   *
   * 자동화 패턴: §11.196g 의 perl `s{}{}gex` 가 import block 의 dead
   * symbol 만 filter — alias `X as Y` 보존, 형식 보존, multi-line 안전.
   */
  const SURFACES = [
    // §11.196f Phase 1 — 4 manually cleaned
    "src/app/dashboard/inventory/inventory-content.tsx",
    "src/app/dashboard/analytics/page.tsx",
    "src/app/dashboard/organizations/[id]/page.tsx",
    "src/app/dashboard/support-center/page.tsx",
    // §11.196g — 27 batch cleaned
    "src/app/dashboard/analytics/_components/team-analytics-view.tsx",
    "src/app/dashboard/budget/details/[id]/page.tsx",
    "src/app/dashboard/budget/page.tsx",
    "src/app/dashboard/budget/[id]/page.tsx",
    "src/app/dashboard/inventory/blocks/inventory-table-block.tsx",
    "src/app/dashboard/inventory/scan/page.tsx",
    "src/app/dashboard/notifications/page.tsx",
    "src/app/dashboard/organizations/page.tsx",
    "src/app/dashboard/page.tsx",
    "src/app/dashboard/purchase-orders/page.tsx",
    "src/app/dashboard/purchase-orders/[poId]/page.tsx",
    "src/app/dashboard/quotes/page.tsx",
    "src/app/dashboard/receiving/page.tsx",
    "src/app/dashboard/reports/page.tsx",
    "src/app/dashboard/safety/page.tsx",
    "src/app/dashboard/safety-spend/page.tsx",
    "src/app/dashboard/settings/enterprise/page.tsx",
    "src/app/dashboard/settings/page.tsx",
    "src/app/dashboard/shared-links/page.tsx",
    "src/app/dashboard/stock-risk/page.tsx",
    "src/app/dashboard/supplier/page.tsx",
    "src/app/dashboard/vendor/quotes/page.tsx",
    "src/components/dashboard/command-palette.tsx",
    "src/components/dashboard/draggable-widget.tsx",
    "src/components/dashboard/Header.tsx",
    "src/components/dashboard/overlay/workbench-full-overlay.tsx",
    "src/components/dashboard/work-queue-inbox.tsx",
  ];

  for (const surface of SURFACES) {
    it(`${surface} — lucide dead import 0`, () => {
      assertNoDeadLucideImport(resolve(__dirname, "../../..", surface));
    });
  }
});
