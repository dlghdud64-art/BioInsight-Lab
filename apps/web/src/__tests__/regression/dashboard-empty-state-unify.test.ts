/**
 * §dashboard-empty-state-unify (호영님 2026-07-04) — 빈/0/비활성 카드 회색 채움 제거.
 * 흰 배경 위 "잘린 회색 박스" 해소: 채움색 대신 흰 배경 + 점선 테두리 + 톤다운.
 * 뱃지 틴트·로딩 스켈레톤은 정당(제외).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const R = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(R, p), "utf8");

describe("§dashboard-empty-state-unify — KPI 비활성 카드(흰+점선)", () => {
  for (const f of ["components/dashboard/pipeline.tsx", "components/dashboard/stat-line.tsx"]) {
    it(`${f}: 비활성 회색 채움 제거 + 흰+점선`, () => {
      const s = rd(f);
      expect(s).not.toMatch(/"bg-gray-50 border-gray-200"/);
      expect(s).toMatch(/"bg-white border-dashed border-slate-200"/);
      // 활성 카드는 흰+shadow 유지(회귀 방지)
      expect(s).toMatch(/"bg-white border-slate-300 shadow-sm/);
    });
  }
});

describe("§dashboard-empty-state-unify — 빈상태 박스(흰+점선)", () => {
  it("CategorySpendingWidget empty 박스", () => {
    const s = rd("components/dashboard/CategorySpendingWidget.tsx");
    expect(s).toMatch(/bg-white border border-dashed border-slate-200 rounded-lg p-4 text-center/);
    expect(s).not.toMatch(/bg-slate-50 border border-slate-200 rounded-lg p-4 text-center/);
  });
  it("executive-summary empty KPI 가이드", () => {
    const s = rd("components/dashboard/executive-summary-section.tsx");
    expect(s).toMatch(/rounded-lg bg-white border border-dashed border-slate-200 px-4 py-3/);
  });
});
