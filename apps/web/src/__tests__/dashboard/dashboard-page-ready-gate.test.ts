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
  it("useOrderQueueStore + useBudgetStore import + fetching state read", () => {
    // 두 store 모두 page.tsx 에서 직접 subscribe (ExecutiveSummary 의존 X)
    expect(SOURCE).toMatch(/import\s+\{[\s\S]*?useOrderQueueStore[\s\S]*?\}/);
    expect(SOURCE).toMatch(/import\s+\{[\s\S]*?useBudgetStore[\s\S]*?\}/);
    // isFetching state read (page-level pageReady 계산 input).
    // [\s\S]*? 사용 — selector arrow `(s) => s.isFetching` 안의 `)` 가
    // [^)] 와 충돌하지 않도록.
    expect(SOURCE).toMatch(/useOrderQueueStore\([\s\S]*?s\.isFetching/);
    expect(SOURCE).toMatch(/useBudgetStore\([\s\S]*?s\.isFetching/);
  });

  it("page mount 직후 fetchOrders + fetchBudgets explicit trigger (useEffect)", () => {
    // ExecutiveSummary mount 까지 기다리지 않고 page.tsx 가 직접 fetch trigger
    // → store fetching=true 상태로 진입 → unified skeleton 유지
    expect(SOURCE).toMatch(/fetchOrders/);
    expect(SOURCE).toMatch(/fetchBudgets/);
    expect(SOURCE).toMatch(/useEffect\(\s*\(\)\s*=>[\s\S]*?(?:fetchOrders|fetchBudgets)/);
  });

  it("pageReady 단일 boolean 통합 (statsLoading + ordersFetching + budgetsFetching)", () => {
    // pageReady (또는 동등 이름) = 모든 source 의 fetching state 통합
    // 명시적으로 !statsLoading && !ordersFetching && !budgetsFetching 패턴
    expect(SOURCE).toMatch(
      /pageReady\s*=[\s\S]*?!\s*statsLoading[\s\S]*?!\s*ordersFetching[\s\S]*?!\s*budgetsFetching/,
    );
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
