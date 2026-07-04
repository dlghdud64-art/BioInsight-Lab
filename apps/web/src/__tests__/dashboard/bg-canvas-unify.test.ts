/**
 * §bg-canvas-unify — 전역 페이지 캔버스 흰색 통일 + 빈 KPI 카드 투명도 제거 (호영님 2026-06-27)
 *
 * 문제: 페이지마다 캔버스 톤 상이(견적=흰색, 구매운영/발주관리/예산 등=bg-slate-50*) → 이동 시 톤 깨짐.
 *       + 구매운영 0건 KPI가 카드 전체 opacity-50으로 흰 캔버스 위 탁한 회색 박스처럼 보임.
 * Fix: 대시보드 라우트 페이지 최상위 래퍼 min-h-screen bg-slate-50* → bg-white(8 페이지).
 *      카드/레일/칩 내부 bg-slate-50 톤은 구획용이라 유지(미변경). KpiCard §B는 260a 진화에서 커버.
 *
 * ⚠ 진화 (§dashboard-surface-unify, 호영님 2026-07-04 결정 반전): 작업 페이지를 다시 회색
 *   캔버스(bg-canvas=#F1F5F9)로 통일. budget·organizations·safety·purchases 는 이제 bg-canvas
 *   → 본 흰색 테스트 대상에서 제외(canvas 검증은 dashboard-surface-unify.test.ts 소유).
 *   stock-risk 는 redirect stub(§stock-risk-consolidation)으로 페이지 래퍼 부재 → 제외.
 *   receiving·purchase-orders·inventory/scan 은 신규 지시 범위 밖이라 흰색 유지(가드 존속).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const PAGES: Array<[string, string]> = [
  // 신규 canvas 지시 범위 밖 — 흰색 유지 대상만 존속.
  ["receiving", "app/dashboard/receiving/page.tsx"],
  ["purchase-orders", "app/dashboard/purchase-orders/page.tsx"],
  ["inventory/scan", "app/dashboard/inventory/scan/page.tsx"],
];

describe("§bg-canvas-unify — 페이지 캔버스 흰색 통일", () => {
  for (const [name, rel] of PAGES) {
    it(`${name} 페이지 래퍼 = min-h-screen bg-white (회색 캔버스 제거)`, () => {
      const src = read(rel);
      expect(src).toMatch(/<div className="min-h-screen bg-white/);
      // 페이지 최상위 래퍼의 회색 캔버스(min-h-screen bg-slate-50*) 잔존 0
      expect(src).not.toMatch(/<div className="min-h-screen bg-slate-50/);
    });
  }
});

describe("§bg-canvas-unify — 회귀 0(카드/칩 내부 톤 보존)", () => {
  it("safety 내부 카드/칩 bg-slate-50 톤 보존(구획용, 패치 명시 유지 대상 — 래퍼만 변경)", () => {
    // 흰 배경 위 구획 톤(rounded-lg bg-slate-50 border) 은 유지 대상 — 페이지 래퍼만 흰색화.
    expect(read("app/dashboard/safety/page.tsx")).toMatch(/rounded-lg bg-slate-50 border border-slate-100/);
  });
});

describe("§bg-canvas-unify §B — 구매운영 빈 KPI 카드 투명도 제거", () => {
  const purchases = read("app/dashboard/purchases/page.tsx");
  it("KpiCard 0건 = 숫자 색 톤다운(text-slate-300), 카드 전체 opacity-50 폐지", () => {
    expect(purchases).toMatch(/text-3xl font-extrabold \$\{isZero \? "text-slate-300" : valueColor\}/);
    expect(purchases).not.toMatch(/isZero \? "opacity-50 hover:opacity-100"/);
  });
  it("KpiCard 흰 카드 + border-slate-200 구획 보존(카드 사라짐 0)", () => {
    expect(purchases).toMatch(/rounded-xl border bg-white p-5 text-left/);
    expect(purchases).toMatch(/border-slate-200 hover:border-slate-300/);
  });
});
