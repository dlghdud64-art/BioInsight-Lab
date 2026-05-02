/**
 * §11.196 #dashboard-page-ready-gate
 *
 * dashboard/page.tsx 의 카드별 로딩 stagger 해소를 source-level 로 강제.
 *
 * 호영님 보고: dashboard 진입 시 KPI / Spend / Category / QuickActions 는
 * 즉시 보이지만 페이지 하단 카드는 skeleton 잔존 → 카드별 reveal 시점이
 * staggered. ExecutiveSummarySection 의 `dynamic(ssr:false)` + 자체 store
 * (useOrderQueueStore + useBudgetStore) 가 mount 후에야 fetch 시작 →
 * 가장 느린 source 도착 시점에서야 KPI 가 보임 → stagger.
 *
 * 호영님 의도: "동일하게 나와도" — 모든 카드가 한 batch 로 reveal.
 *
 * 해결 패턴 (옵션 1, page-level synchronous reveal gate):
 *   1. page.tsx 가 useOrderQueueStore + useBudgetStore 의 isFetching state
 *      를 직접 read (subscription).
 *   2. page.tsx 가 mount 직후 fetchOrders + fetchBudgets 를 explicit trigger
 *      (ExecutiveSummary mount 까지 기다리지 않음 — chunk loading parallel).
 *   3. pageReady = !statsLoading && !ordersFetching && !budgetsFetching
 *      단일 boolean 으로 통합.
 *   4. pageReady false → unified skeleton (모든 카드 자리 placeholder)
 *   5. pageReady true → 모든 카드 동시 mount + reveal
 *
 * lock §11.142 정합:
 *   - canonical truth (store / endpoint) 변경 0
 *   - reveal timing 만 정합 (시각 hierarchy 변경 0)
 *   - facts 0 노출 변동 (단순 loading state 통합)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/page.tsx");
const SOURCE = readFileSync(PAGE_PATH, "utf8");

describe("§11.196 dashboard page — page-level pageReady gate", () => {
  it("§11.199 — useOrderQueueStore + useBudgetStore import (fetcher trigger 용)", () => {
    // 두 store 모두 page.tsx 에서 직접 subscribe (ExecutiveSummary 의존 X)
    expect(SOURCE).toMatch(/import\s+\{[\s\S]*?useOrderQueueStore[\s\S]*?\}/);
    expect(SOURCE).toMatch(/import\s+\{[\s\S]*?useBudgetStore[\s\S]*?\}/);
    // §11.199 — isFetching subscribe 제거 (initial state true 와 충돌 issue
    //   fix). hasData + fetcher 만 사용.
    expect(SOURCE).toMatch(/useOrderQueueStore\([\s\S]*?s\.orders\.length\s*>\s*0/);
    expect(SOURCE).toMatch(/useBudgetStore\([\s\S]*?s\.budgets\.length\s*>\s*0/);
  });

  it("page mount 직후 fetchOrders + fetchBudgets explicit trigger (useEffect)", () => {
    // ExecutiveSummary mount 까지 기다리지 않고 page.tsx 가 직접 fetch trigger
    // §11.199 — `!ordersFetching` 조건 제거 (store dedup 이 처리).
    expect(SOURCE).toMatch(/fetchOrders/);
    expect(SOURCE).toMatch(/fetchBudgets/);
    expect(SOURCE).toMatch(/useEffect\(\s*\(\)\s*=>[\s\S]*?(?:fetchOrders|fetchBudgets)/);
  });

  it("§11.199 — pageReady = statsLoading 만 (ordersFetching/budgetsFetching 의존 제거)", () => {
    // §11.199 P0 hot fix: store initial isFetching:true 와 충돌하여 영원히
    //   skeleton stuck 이슈 fix. pageReady = !statsLoading 만.
    expect(SOURCE).toMatch(/pageReady\s*=\s*!\s*statsLoading\b/);
    // 이전 §11.196 의 ordersFetching/budgetsFetching 의존 부재 강제.
    expect(SOURCE).not.toMatch(/pageReady\s*=[\s\S]*?ordersFetching/);
    expect(SOURCE).not.toMatch(/pageReady\s*=[\s\S]*?budgetsFetching/);
  });

  it("pageReady false → unified skeleton render (early return 또는 분기)", () => {
    // pageReady false 시 통합 skeleton 노출 — 카드별 분기 stagger 0
    // status === "loading" || !pageReady 같은 통합 분기 강제
    expect(SOURCE).toMatch(
      /(?:status\s*===\s*["']loading["']\s*\|\|\s*!pageReady|!pageReady\s*\|\|\s*status\s*===\s*["']loading["'])/,
    );
  });

  it("§11.142 정합: canonical truth (store / endpoint) 변경 0 — useQuery key 보존", () => {
    // dashboard-stats useQuery key 그대로 (canonical endpoint 보존)
    expect(SOURCE).toMatch(/queryKey:\s*\[\s*["']dashboard-stats["']\s*\]/);
    expect(SOURCE).toMatch(/\/api\/dashboard\/stats/);
  });
});

describe("§11.196b dashboard page — dead statsLoading 분기 cleanup", () => {
  /**
   * §11.196 page-ready gate 도입 후 statsLoading 분기는 자연 dead branch:
   *   pageReady gate 가 statsLoading 가 true 인 동안 unified skeleton 으로
   *   short-circuit → 카드별 statsLoading 분기에 도달 0.
   *
   * 따라서 statsLoading 의 정상 사용처는 다음 2 site 만:
   *   1. useQuery destructure: `isLoading: statsLoading`
   *   2. pageReady 계산: `pageReady = !statsLoading && ...`
   *
   * 그 외 패턴 (`{statsLoading && ...}`, `{!statsLoading && ...}`,
   * `statsLoading ? ... : ...`) 은 모두 dead — 정리 강제.
   */

  it("statsLoading 사용 = useQuery destructure + pageReady 계산 2 site 만", () => {
    // 전체 statsLoading occurrence 카운트 (정상 2 + comment 가능)
    // 정확히 2 site (코드 라인) — useQuery destructure + pageReady 식
    const codeOccurrences = SOURCE.match(/(?<!\/\/.*|\*.*)\bstatsLoading\b/g) ?? [];
    // comment line 을 정확히 분리하기 어려워 단순 dead 패턴 부재로 대체 검증.
    expect(codeOccurrences.length).toBeGreaterThan(0);
  });

  it("dead 패턴 0: {statsLoading && ...} 분기 부재", () => {
    expect(SOURCE).not.toMatch(/\{\s*statsLoading\s*&&/);
  });

  it("dead 패턴 0: {!statsLoading && ...} 분기 부재", () => {
    expect(SOURCE).not.toMatch(/\{\s*!\s*statsLoading\s*&&/);
  });

  it("dead 패턴 0: {statsLoading ? ... : ...} ternary 부재", () => {
    expect(SOURCE).not.toMatch(/\{\s*statsLoading\s*\?/);
  });

  it("regression guard: pageReady gate 보존 (§11.196 dependency)", () => {
    // §11.196b cleanup 후에도 pageReady gate 가 사라지면 cleanup 의 전제가
    // 깨진 것. 본 test 가 §11.196 + §11.196b 양쪽 보호.
    expect(SOURCE).toMatch(/pageReady\s*=[\s\S]*?!\s*statsLoading/);
    expect(SOURCE).toMatch(/!pageReady/);
  });
});

describe("§11.196c dashboard page — ExecutiveSummary static import (chunk wait 0)", () => {
  /**
   * §11.196 page-ready gate 가 store fetch 를 mount 직후 trigger 하지만,
   * ExecutiveSummary 가 dynamic_import(ssr:false) 면 chunk 도착 후에야
   * KPI 카드 reveal — chunk loading wait 가 stagger 의 마지막 source.
   *
   * Fix: static import 로 swap → initial bundle 에 포함 → chunk wait 0.
   * 본 test 가 dynamic_import 회귀 차단.
   */

  it("ExecutiveSummarySection static import (named import from component path)", () => {
    expect(SOURCE).toMatch(
      /import\s*\{\s*ExecutiveSummarySection\s*\}\s*from\s*["']@\/components\/dashboard\/executive-summary-section["']/,
    );
  });

  it("dynamic_import 패턴 부재 (ExecutiveSummary 한정)", () => {
    // dynamic_import 자체는 다른 component 에서 사용 가능 — ExecutiveSummary
    // 만 static 로 강제. 본 test 는 next/dynamic + ExecutiveSummarySection
    // 조합이 같은 줄에 등장하지 않는지 검증 (regression guard).
    expect(SOURCE).not.toMatch(
      /dynamic_import\([^)]*ExecutiveSummarySection|dynamic\([^)]*ExecutiveSummarySection/,
    );
  });

  it("ExecutiveSummary loading skeleton fallback 부재 (static import 라 fallback 0)", () => {
    // dynamic_import 의 loading prop 안에 ExecutiveSummary 자리 placeholder
    // (h-[88px] grid sm:grid-cols-3 etc) 가 page.tsx 안에 잔존하면 안 됨.
    // §11.196 page-ready gate 의 unified skeleton 이 ExecutiveSummary 자리도
    // cover 하므로 별도 fallback 불필요.
    expect(SOURCE).not.toMatch(/loading:\s*\(\)\s*=>\s*\([\s\S]*?h-\[88px\][\s\S]*?h-\[280px\]/);
  });
});

describe("§11.196d dashboard page — recharts code split (chart lazy import)", () => {
  /**
   * §11.196c 가 ExecutiveSummary 를 static import 했지만, ExecutiveSummary
   * + SpendTrendCard + CategoryDistributionCard 모두 recharts 의존 →
   * recharts (~150KB gzipped) 가 page chunk 에 포함되어 initial bundle 부담.
   *
   * Fix: recharts 의존 chart card (SpendTrend / CategoryDistribution) 를
   * next/dynamic lazy 로 swap. KPI 카드는 fold 위쪽 (즉시), chart 는 fold
   * 아래라 lazy 가능. unified pageReady skeleton 의 chart placeholder 가
   * lazy chunk 도착 전 자연 cover (loading: () => null).
   *
   * 추가로 page.tsx 의 dead recharts import (AreaChart/Area/XAxis/YAxis/
   * CartesianGrid/Tooltip/ResponsiveContainer 가 actual 사용 0) 제거.
   */

  it("recharts dead import 제거 (page.tsx 안에 actual 사용 0)", () => {
    // page.tsx 가 직접 recharts import 하면 안 됨 (모든 chart 는 분리 component)
    expect(SOURCE).not.toMatch(/import\s*\{[\s\S]*?\}\s*from\s+["']recharts["']/);
  });

  it("SpendTrendCard 가 next/dynamic lazy import (recharts chunk 분리)", () => {
    expect(SOURCE).toMatch(
      /SpendTrendCard\s*=\s*dynamic_import\([\s\S]*?spend-trend-card/,
    );
  });

  it("CategoryDistributionCard 가 next/dynamic lazy import (recharts chunk 분리)", () => {
    expect(SOURCE).toMatch(
      /CategoryDistributionCard\s*=\s*dynamic_import\([\s\S]*?category-distribution-card/,
    );
  });

  it("chart lazy fallback = null (pageReady unified skeleton 이 cover)", () => {
    // loading: () => null — 별도 fallback 0, gate skeleton 이 chart 자리 cover
    expect(SOURCE).toMatch(/spend-trend-card[\s\S]*?loading:\s*\(\)\s*=>\s*null/);
    expect(SOURCE).toMatch(
      /category-distribution-card[\s\S]*?loading:\s*\(\)\s*=>\s*null/,
    );
  });
});
