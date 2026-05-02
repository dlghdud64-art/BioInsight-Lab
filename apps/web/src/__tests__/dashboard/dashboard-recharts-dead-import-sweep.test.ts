/**
 * §11.196e #dashboard-recharts-dead-import-sweep
 *
 * 14 surface 의 recharts import 가 actual JSX 사용 중인지 정기 audit.
 * dead import 발견 시 즉시 제거 (zero-risk, bundle 즉시 ↓).
 *
 * §11.196d (page.tsx dead import 제거 ~150KB ↓) 와 동일 패턴 — recharts
 * 같은 large dependency 는 named import 만으로도 chunk 에 포함되어 dead
 * import 가 있으면 bundle 부담 ↑.
 *
 * 본 test 는 source-level regex — 빠른 vitest, surface 추가 시 file 만 등록.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * recharts dead import detect helper.
 *
 * 각 surface 별로 import block 에서 named symbol 추출 → JSX `<Symbol`
 * 패턴 grep → 사용되지 않으면 fail.
 *
 * alias (`X as Y`) 는 본 helper 가 처리 못하므로 alias 사용 surface 는
 * 별도 case 에서 manual 검증 (예: safety/page.tsx 의 Tooltip as RechartsTooltip).
 */
function assertNoDeadRechartsImport(filePath: string): void {
  const source = readFileSync(filePath, "utf8");
  // import { ... } from "recharts" block 추출 (multi-line)
  const importMatch = source.match(/import\s*\{([^}]+)\}\s*from\s*["']recharts["']/);
  if (!importMatch) return; // recharts import 부재 — 검증 skip

  const symbols = importMatch[1]
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    // alias `X as Y` 형태는 Y 가 actual usage symbol — Y 추출
    .map((s) => {
      const aliasMatch = s.match(/^\w+\s+as\s+(\w+)$/);
      return aliasMatch ? aliasMatch[1] : s;
    });

  const dead: string[] = [];
  for (const sym of symbols) {
    // JSX `<Symbol` 패턴 — word boundary 로 substring 회피
    const pattern = new RegExp(`<${sym}\\b`);
    if (!pattern.test(source)) {
      dead.push(sym);
    }
  }

  expect(
    dead,
    `${filePath}: recharts dead import 발견 — JSX 사용 0 인 symbol: ${dead.join(", ")}`,
  ).toEqual([]);
}

describe("§11.196e recharts dead import sweep — 14 surface", () => {
  // §11.196d page.tsx 가 이미 처리 (dead import 통째 제거)
  // §11.196e Phase 1 — 2 surface 의 dead 제거 후 regression guard
  const SURFACES = [
    "src/components/dashboard/analytics-dashboard.tsx",
    "src/components/dashboard/BudgetPredictionWidget.tsx",
    "src/components/dashboard/category-distribution-card.tsx",
    "src/components/dashboard/executive-dashboard.tsx",
    // executive-summary-section.tsx — §11.196e 에서 recharts import 통째 제거됨,
    // 본 helper 가 import block 부재 detect → 검증 skip
    "src/components/dashboard/executive-summary-section.tsx",
    "src/components/dashboard/spend-trend-card.tsx",
    "src/app/dashboard/analytics/category/page.tsx",
    "src/app/dashboard/analytics/monthly/page.tsx",
    "src/app/dashboard/analytics/page.tsx",
    "src/app/dashboard/analytics/_components/team-analytics-view.tsx",
    "src/app/dashboard/budget/page.tsx",
    "src/app/dashboard/reports/page.tsx",
    "src/app/dashboard/safety/page.tsx",
  ];

  for (const surface of SURFACES) {
    it(`${surface} — recharts dead import 0`, () => {
      assertNoDeadRechartsImport(resolve(__dirname, "../../..", surface));
    });
  }

  it("§11.196d regression guard — dashboard/page.tsx 에 recharts import 부재", () => {
    const source = readFileSync(
      resolve(__dirname, "../../app/dashboard/page.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/import\s*\{[\s\S]*?\}\s*from\s+["']recharts["']/);
  });

  it("§11.196e regression guard — executive-summary-section.tsx 에 recharts import 부재", () => {
    const source = readFileSync(
      resolve(
        __dirname,
        "../../components/dashboard/executive-summary-section.tsx",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/import\s*\{[\s\S]*?\}\s*from\s+["']recharts["']/);
  });
});
