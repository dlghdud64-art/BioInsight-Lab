import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * §inventory-delta-label-kpi P2b-1 (호영님 2026-07-27 핸드오프 §2b) — 소진 추이 패널 섹션.
 *   컨텍스트 패널(same-canvas) 접기 섹션에 품목 소진 추이 그래프 노출.
 *   canonical /api/inventory/usage 파생(useInventoryUsageTrend → computeUsageTrend), 표시 계층 전용.
 *   loading/error/empty/chart 4상태 · recharts 재사용(신규 dep 0) · 값 소유 무접촉.
 */
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
const PANEL = read("src/components/inventory/inventory-context-panel.tsx");
const HOOK = read("src/hooks/use-inventory-usage-trend.ts");

describe("§P2b-1 — 소진 추이 섹션(패널)", () => {
  it("소진 추이 = 재발주 검토 통합 섹션 내부 상시 렌더 — §inventory-brief-sian(호영님 승인 2026-07-29) supersede", () => {
    // 구 접기 섹션(useState(false)+aria-expanded) → 시안 정합: reorder-basis 섹션 안 항상 렌더.
    expect(PANEL).toMatch(/data-testid="inventory-context-usage-trend"/);
    expect(PANEL).toMatch(/data-testid="inventory-context-reorder-basis"[\s\S]*?data-testid="inventory-context-usage-trend"/);
    expect(PANEL).not.toMatch(/isUsageTrendSectionExpanded/);
  });

  it("canonical 파생 — useInventoryUsageTrend(item.id) hook 사용(직접 fetch 아님)", () => {
    expect(PANEL).toMatch(/useInventoryUsageTrend\(item\.id/);
    expect(PANEL).toMatch(/from "@\/hooks\/use-inventory-usage-trend"/);
  });

  it("recharts 재사용(신규 차트 dep 0) — BarChart 렌더", () => {
    expect(PANEL).toMatch(/from "recharts"/);
    expect(PANEL).toMatch(/<BarChart/);
    expect(PANEL).toMatch(/dataKey="total"/);
  });

  it("4상태 존재 — loading/error/empty/chart(dead 0)", () => {
    expect(PANEL).toMatch(/data-testid="inventory-context-usage-trend-loading"/);
    expect(PANEL).toMatch(/data-testid="inventory-context-usage-trend-error"/);
    expect(PANEL).toMatch(/data-testid="inventory-context-usage-trend-empty"/);
    expect(PANEL).toMatch(/data-testid="inventory-context-usage-trend-chart"/);
    // empty gating = recordCount 0
    expect(PANEL).toMatch(/usageTrend\.recordCount === 0/);
  });

  it("주간/일간 라벨 — granularity 파생 표기", () => {
    expect(PANEL).toMatch(/granularity === "week" \? "주간 소진량" : "일간 소진량"/);
  });
});

describe("§P2b-1 — 훅 canonical 계약", () => {
  it("/api/inventory/usage 재사용(inventoryId·limit) + computeUsageTrend 파생", () => {
    expect(HOOK).toMatch(/\/api\/inventory\/usage\?inventoryId=/);
    expect(HOOK).toMatch(/computeUsageTrend/);
    expect(HOOK).toMatch(/from "@\/lib\/inventory\/usage-trend"/);
  });
  it("enabled 게이트(패널 open 시에만) — 불필요 fetch 방지", () => {
    expect(HOOK).toMatch(/enabled: Boolean\(inventoryId\) && opts\.enabled !== false/);
  });
});
