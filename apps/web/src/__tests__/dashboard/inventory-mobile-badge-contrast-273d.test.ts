/**
 * §11.273d #inventory-mobile-badge-contrast — 배지/긴급도 대비 강화.
 *
 * 재앵커 (§web-mobile-reskin + §11.302): 구 6색 shortLabel 배지
 *   (bg-amber-500 text-slate-900 / bg-orange-600 / bg-blue-500 / bg-violet-500)
 *   + border-l-4 톤 매칭 시스템은 카드 재설계로 제거되고, 긴급도 차별화는
 *   (1) STATUS_CONFIG 신호등 (danger = bg-red-600 text-white, 최고 대비)
 *   (2) action.type 기반 색상 (text-red-400 / text-[#b45821])
 *   로 대체. 본 sentinel 은 현행 대비 체계 + canonical invariant 로 재정의하고,
 *   제거된 저대비 클래스 재유입 방지 guard 를 추가.
 *
 * canonical truth lock:
 *   - getRecommendedAction / shortLabel / type / action.label / ChevronRight 보존
 *   - action.type !== "none" 조건 보존
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

describe("§11.273d #2 — 긴급도 대비 (STATUS_CONFIG 신호등 + action.type 색상)", () => {
  it("danger 배지 — bg-red-600 text-white (최고 대비)", () => {
    expect(miv).toContain('bg-red-600 text-white');
  });

  it("action.type 기반 색상 — text-red-400 (reorder/danger)", () => {
    expect(miv).toContain('text-red-400');
  });

  it("action.type 기반 색상 — text-[#b45821] (use_first, §11.302 amber)", () => {
    expect(miv).toContain('text-[#b45821]');
  });

  it("배지/라벨 font-semibold 적용 (WCAG AA 대비)", () => {
    expect(miv).toContain('font-semibold');
  });
});

describe("§11.273d #3 — 제거된 저대비 6색 배지·border-l 재유입 방지", () => {
  it("구 bg-amber-500 text-slate-900 (저대비) 부재", () => {
    expect(miv).not.toMatch(/bg-amber-500 text-slate-900/);
  });

  it("구 shortLabel 단색 배지 (bg-orange-600 / bg-blue-500 / bg-violet-500 text-white) 부재", () => {
    expect(miv).not.toMatch(/bg-orange-600 text-white/);
    expect(miv).not.toMatch(/bg-blue-500 text-white/);
    expect(miv).not.toMatch(/bg-violet-500 text-white/);
  });

  it("구 border-l-4 톤 매칭 시스템 부재", () => {
    expect(miv).not.toMatch(/border-l-(amber|orange|violet)-500/);
  });
});

describe("§11.273d #4 — invariant 보존 (canonical truth)", () => {
  it("action.type !== 'none' 조건 보존", () => {
    expect(miv).toContain('action.type !== "none"');
  });

  it("action.label 노출 보존", () => {
    expect(miv).toContain('{action.label}');
  });

  it("ChevronRight 아이콘 보존", () => {
    expect(miv).toContain('ChevronRight');
  });
});
