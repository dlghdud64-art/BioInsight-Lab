import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const FILE = "src/components/dashboard/executive-summary-section.tsx";

describe("§11.362-3 — System Insight(종합 판단) → KPI(개별 액션) 순서", () => {
  it("SystemInsightCard 가 KPI 그리드보다 위에 렌더된다", () => {
    const src = read(FILE);
    const insightIdx = src.indexOf("<SystemInsightCard");
    const kpiRowIdx = src.indexOf("{/* ── KPI Row");
    expect(insightIdx).toBeGreaterThan(-1);
    expect(kpiRowIdx).toBeGreaterThan(-1);
    // 종합 판단(System Insight) 이 개별 KPI 그리드 위에 위치.
    expect(insightIdx).toBeLessThan(kpiRowIdx);
  });

  it("§11.362-3 마커 주석이 존재한다", () => {
    const src = read(FILE);
    expect(src).toMatch(/§11\.362-3/);
  });

  describe("회귀 0 — 보존 항목", () => {
    it("onboardingMode 시 hide 가드 유지", () => {
      const src = read(FILE);
      expect(src).toMatch(/\{!onboardingMode && \(\s*<SystemInsightCard/);
    });

    it("SystemInsightCard 렌더는 정확히 1곳(중복 이동 아님)", () => {
      const src = read(FILE);
      const matches = src.match(/<SystemInsightCard\b/g) ?? [];
      expect(matches.length).toBe(1);
    });

    it("kpis/ordersCount prop 전달 유지", () => {
      const src = read(FILE);
      expect(src).toMatch(
        /<SystemInsightCard kpis=\{kpis\} ordersCount=\{orders\.length\} \/>/
      );
    });
  });
});
