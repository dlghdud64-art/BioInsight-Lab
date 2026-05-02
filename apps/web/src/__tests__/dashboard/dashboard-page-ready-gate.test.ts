/**
 * §11.199b P0 — page-ready gate 자체 revert.
 *
 * §11.196 page-ready gate (fetch parallel + 동시 reveal) → §11.199 store
 * isFetching 의존 제거 → §11.199b 본 batch: gate 자체 revert. prod stuck
 * (Chrome 검증) → 회귀 0 path 우선.
 *
 * 본 test 는 page-ready gate 가 **사라졌음** 강제 (회귀 방지) +
 * §11.196c (ExecutiveSummary static import) + §11.196d (recharts code
 * split) 보존 검증.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/page.tsx");
const SOURCE = readFileSync(PAGE_PATH, "utf8");

describe("§11.199b dashboard page — page-ready gate 자체 revert", () => {
  it("pageReady boolean variable 부재 (gate 자체 제거)", () => {
    // §11.196/§11.199 의 `const pageReady = ...` 패턴 부재.
    // (comment 안의 'pageReady' 단어는 허용 — 회귀 history)
    expect(SOURCE).not.toMatch(/^\s*const\s+pageReady\s*=/m);
  });

  it("status === 'loading' auth skeleton 분기 보존", () => {
    // 인증 wait skeleton 분기는 유지 (필수).
    expect(SOURCE).toMatch(/if\s*\(\s*status\s*===\s*["']loading["']\s*\)/);
  });

  it("§11.196 store fetcher trigger useEffect 부재 (revert)", () => {
    // §11.196/§11.199 의 useEffect 안 fetchOrders/fetchBudgets trigger 패턴 부재.
    expect(SOURCE).not.toMatch(/useEffect\(\s*\(\)\s*=>[\s\S]*?fetchOrders/);
    expect(SOURCE).not.toMatch(/useEffect\(\s*\(\)\s*=>[\s\S]*?fetchBudgets/);
  });

  it("useOrderQueueStore / useBudgetStore import 부재 (page.tsx 수준에서 revert)", () => {
    // §11.196 에서 page.tsx 가 직접 store subscribe 했으나 §11.199b 에서
    // ExecutiveSummarySection 내부로 책임 이관. import 부재.
    expect(SOURCE).not.toMatch(
      /import\s+\{[\s\S]*?useOrderQueueStore[\s\S]*?\}\s+from/,
    );
    expect(SOURCE).not.toMatch(
      /import\s+\{[\s\S]*?useBudgetStore[\s\S]*?\}\s+from/,
    );
  });

  it("dashboard-stats useQuery key 보존 (canonical endpoint)", () => {
    expect(SOURCE).toMatch(/queryKey:\s*\[\s*["']dashboard-stats["']\s*\]/);
    expect(SOURCE).toMatch(/\/api\/dashboard\/stats/);
  });
});

describe("§11.196c dashboard page — ExecutiveSummary static import (보존)", () => {
  /**
   * §11.196c (chunk loading wait 0) 효과는 §11.199b 의 gate revert 와
   * 무관하게 보존 — ExecutiveSummary 가 static import 라 chunk wait 0.
   */
  it("ExecutiveSummarySection static named import 보존", () => {
    expect(SOURCE).toMatch(
      /import\s*\{\s*ExecutiveSummarySection\s*\}\s*from\s*["']@\/components\/dashboard\/executive-summary-section["']/,
    );
  });

  it("dynamic_import(ExecutiveSummarySection) 패턴 부재", () => {
    expect(SOURCE).not.toMatch(
      /dynamic_import\([^)]*ExecutiveSummarySection|dynamic\([^)]*ExecutiveSummarySection/,
    );
  });
});

describe("§11.196d dashboard page — recharts code split (보존)", () => {
  /**
   * §11.196d (page.tsx dead recharts 제거 + chart card lazy) 효과는
   * §11.199b gate revert 와 무관하게 보존.
   */
  it("recharts dead import 부재 (page.tsx 안에 actual 사용 0)", () => {
    expect(SOURCE).not.toMatch(/import\s*\{[\s\S]*?\}\s*from\s+["']recharts["']/);
  });

  it("SpendTrendCard / CategoryDistributionCard lazy import 보존", () => {
    expect(SOURCE).toMatch(
      /SpendTrendCard\s*=\s*dynamic_import\([\s\S]*?spend-trend-card/,
    );
    expect(SOURCE).toMatch(
      /CategoryDistributionCard\s*=\s*dynamic_import\([\s\S]*?category-distribution-card/,
    );
  });

  it("chart lazy fallback null (별도 fallback 부재)", () => {
    expect(SOURCE).toMatch(/spend-trend-card[\s\S]*?loading:\s*\(\)\s*=>\s*null/);
    expect(SOURCE).toMatch(
      /category-distribution-card[\s\S]*?loading:\s*\(\)\s*=>\s*null/,
    );
  });
});
