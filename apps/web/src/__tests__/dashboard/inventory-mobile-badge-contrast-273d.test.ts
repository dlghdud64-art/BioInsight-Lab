/**
 * §11.273d #inventory-mobile-badge-contrast — 배지 대비 강화 + 카드 좌측 보더 매칭
 *   (호영님 P0, mobile-inventory-view.tsx — 긴급도 시각 차별화)
 *
 * 호영님 보고: "배지 색상이 연해서 긴급도 차이가 잘 안 느껴짐".
 * 기존 bg-red-950/30 text-red-400 계열 → 진한 단색 배경 + 흰/검정 텍스트.
 *
 * Fix (minimum diff, 1 file — mobile-inventory-view.tsx):
 *   배지 className shortLabel 기반 6 분기:
 *     긴급 → bg-red-600 text-white
 *     검토 → bg-amber-500 text-slate-900
 *     폐기 → bg-orange-600 text-white
 *     임박 → bg-amber-500 text-slate-900
 *     재주문 → bg-blue-500 text-white
 *     위치 → bg-violet-500 text-white
 *   font-medium → font-semibold (WCAG AA 대비 강화)
 *
 *   카드 wrapper border-l-4 shortLabel 기반 보더 톤 매칭:
 *     긴급/재주문 → border-l-red-500
 *     검토/임박   → border-l-amber-500
 *     폐기        → border-l-orange-500
 *     위치        → border-l-violet-500
 *     none        → border-l-slate-300
 *
 * canonical truth lock:
 *   - getRecommendedAction / shortLabel / type / action.label / ChevronRight 보존
 *   - action.type !== "none" 조건 보존
 *   - onClick onItemTap / onTap 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIV_PATH = resolve(
  __dirname,
  "../../components/inventory/mobile-inventory-view.tsx"
);
const miv = readFileSync(MIV_PATH, "utf8");

describe("§11.273d #1 — trace marker + getRecommendedAction 보존", () => {
  it("§11.273d trace marker comment 존재", () => {
    expect(miv).toMatch(/§11\.273d/);
  });

  it("getRecommendedAction 함수 + shortLabel 필드 보존", () => {
    expect(miv).toContain("getRecommendedAction");
    expect(miv).toContain("shortLabel");
  });

  it("6 shortLabel 반환값 (긴급/검토/폐기/임박/재주문/위치) 보존", () => {
    expect(miv).toContain('"긴급"');
    expect(miv).toContain('"검토"');
    expect(miv).toContain('"폐기"');
    expect(miv).toContain('"임박"');
    expect(miv).toContain('"재주문"');
    expect(miv).toContain('"위치"');
  });
});

describe("§11.273d #2 — 배지 색상 대비 강화 (6 분기 단색)", () => {
  it("긴급 → bg-red-600 text-white 적용", () => {
    expect(miv).toContain('bg-red-600 text-white');
  });

  it("검토/임박 → bg-amber-500 text-slate-900 적용", () => {
    expect(miv).toContain('bg-amber-500 text-slate-900');
  });

  it("폐기 → bg-orange-600 text-white 적용", () => {
    expect(miv).toContain('bg-orange-600 text-white');
  });

  it("재주문 → bg-blue-500 text-white 적용", () => {
    expect(miv).toContain('bg-blue-500 text-white');
  });

  it("위치 → bg-violet-500 text-white 적용", () => {
    expect(miv).toContain('bg-violet-500 text-white');
  });

  it("배지 font-semibold 적용 (WCAG AA 대비)", () => {
    expect(miv).toMatch(/font-semibold[\s\S]{0,300}shortLabel/);
  });
});

describe("§11.273d #3 — 카드 좌측 border-l-4 톤 매칭", () => {
  it("border-l-4 + border-l-red-500 (긴급/재주문) 적용", () => {
    expect(miv).toContain('border-l-4');
    expect(miv).toContain('border-l-red-500');
  });

  it("border-l-amber-500 (검토/임박) 적용", () => {
    expect(miv).toContain('border-l-amber-500');
  });

  it("border-l-orange-500 (폐기) 적용", () => {
    expect(miv).toContain('border-l-orange-500');
  });

  it("border-l-violet-500 (위치) 적용", () => {
    expect(miv).toContain('border-l-violet-500');
  });
});

describe("§11.273d #4 — invariant 보존 (canonical truth)", () => {
  it("action.type !== 'none' 조건 보존", () => {
    expect(miv).toContain('action.type !== "none"');
  });

  it("action.label title 속성 보존", () => {
    expect(miv).toContain('title={action.label}');
  });

  it("ChevronRight 아이콘 보존", () => {
    expect(miv).toContain('ChevronRight');
  });
});
