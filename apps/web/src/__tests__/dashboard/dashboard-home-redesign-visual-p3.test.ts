/**
 * §dashboard-home-redesign P3 — 컴포넌트 시각 정합 (호영님 시안)
 *   (PLAN: docs/plans/PLAN_dashboard-home-redesign.md)
 *
 * Pipeline 퍼널 하단 진행바(시안 .pbar) + 0건 value 가독성 slate-500(시안 README L11).
 * NextStep blue gradient·BudgetSpend 도넛 내부는 기존 정합(무변경). §11.302 amber/orange 0.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const PIPELINE = "src/components/dashboard/pipeline.tsx";
const STATLINE = "src/components/dashboard/stat-line.tsx";

describe("§dashboard-home-redesign P3 — Pipeline 퍼널 진행바", () => {
  const src = read(PIPELINE);
  it("active 단계 하단 진행바(폭=total/maxTotal, canonical 파생)", () => {
    expect(src).toMatch(/const maxTotal = Math\.max\(\.\.\.stages\.map\(\(s\) => s\.total\), 1\)/);
    expect(src).toMatch(/active && \(/);
    expect(src).toMatch(/width: `\$\{Math\.min\(\(stage\.total \/ maxTotal\) \* 100, 100\)\}%`/);
  });
  it("진행바 §11.302 정합 — amber/orange 0", () => {
    expect(src).not.toMatch(/-amber-|-orange-/);
  });
  it("회귀 0 — 아이콘 틴트·화살표·0건 흐림(bg-gray-50) 보존", () => {
    expect(src).toMatch(/STAGE_TINT/);
    expect(src).toMatch(/ChevronRight/);
    expect(src).toMatch(/bg-gray-50/);
  });
});

describe("§dashboard-home-redesign P3 — 0건 value 가독성(slate-500)", () => {
  it("Pipeline 0건 value slate-500(active slate-900)", () => {
    expect(read(PIPELINE)).toMatch(/active \? "text-slate-900" : "text-slate-500"/);
  });
  it("StatLine 0건 value slate-500(active slate-900)", () => {
    expect(read(STATLINE)).toMatch(/active \? "text-slate-900" : "text-slate-500"/);
  });
  it("회귀 0 — StatLine 0건 비활성 톤(§11.311 bg-gray-50 + 아이콘/라벨 gray-400) 보존", () => {
    const src = read(STATLINE);
    expect(src).toMatch(/bg-gray-50/);
    expect(src).toMatch(/text-gray-400/); // 아이콘/라벨 de-emphasis 위계 유지
  });
});
