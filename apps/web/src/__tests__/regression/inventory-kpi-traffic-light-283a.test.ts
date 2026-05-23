/**
 * §11.283a #inventory-kpi-traffic-light — 재고 KPI 4 카드 가로 스크롤 제거
 *   + 신호등 색상 (red/yellow/gray) 도입 + 0건 회색 톤다운 (호영님 P0 spec).
 *
 * 호영님 P0 spec (대화 메시지, 2026-05-23):
 *   (a) "KPI 3개가 가로 스크롤 → 폐기 검토 카드가 잘림. 한 화면에 모두 보여야 함."
 *   (b) "긴급 배지 브라운/베이지 → 빨강/노랑 신호등 체계 (위험/긴급/검토 시각 구분)."
 *   (c) "0건 카드 회색 톤다운 (모든 카드 동일 톤 회피)."
 *
 * Truth Reconciliation (Phase 0 audit):
 *   - 위치: apps/web/src/components/inventory/mobile-inventory-view.tsx:198-225
 *   - 4 카드 (재주문 필요 / 만료 임박 / 폐기 검토 / 점검 이슈) — 호영님 "3개"
 *     보고는 모바일 viewport 에서 4번째 잘림 = 3개만 보임.
 *   - 기존 wrapper: `flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide`
 *   - 기존 색상: red-400/amber-400/orange-400/violet-400 (브라운/베이지 톤)
 *
 * Fix (minimum diff, 1 file 1 block swap):
 *   (a) wrapper `flex overflow-x-auto` → `grid grid-cols-2 sm:grid-cols-4 gap-2`
 *       모바일 2×2 + 데스크탑 4-column 그리드. 가로 스크롤 0.
 *   (b) 색상 토큰 신호등 swap:
 *       - 재주문 필요: red-700/red-100/red-200 (긴급)
 *       - 만료 임박: yellow-700/yellow-100/yellow-200 (검토)
 *       - 폐기 검토: red-700/red-100/red-200 (긴급 - 폐기 처리 필요)
 *       - 점검 이슈: yellow-700/yellow-100/yellow-200 (검토)
 *   (c) 0건 카드 회색 톤다운 (border-gray-200 / bg-gray-50 / icon bg-gray-100 /
 *       icon text-gray-400 / count text-gray-400) — count > 0 분기 추가.
 *
 * canonical truth 보존:
 *   - 4 카드 label / count source (reorderCount/expiringCount/disposeCount/issueCount) 보존
 *   - icon (ShoppingCart/Clock/Trash2/AlertTriangle) 보존
 *   - "건" 단위 표시 + text-slate-500 label color 보존
 *   - text-xl font-bold count 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const VIEW = readFileSync(
  resolve(__dirname, "../../components/inventory/mobile-inventory-view.tsx"),
  "utf8",
);

describe("§11.283a — 재고 KPI 4 카드 가로 스크롤 제거 + 신호등 색상", () => {
  it("§11.283a trace marker 존재", () => {
    expect(VIEW).toMatch(/§11\.283a/);
  });

  it("KPI wrapper grid grid-cols-2 sm:grid-cols-4 명시 (가로 스크롤 제거)", () => {
    expect(VIEW).toMatch(/grid grid-cols-2 sm:grid-cols-4/);
  });

  it("기존 가로 스크롤 wrapper (overflow-x-auto + scrollbar-hide) 제거", () => {
    // KPI 카드 wrapper 가 더 이상 가로 스크롤 안 함.
    // 다른 곳 overflow-x-auto 잔존 허용 (다른 component), KPI cards wrapper 만 검증.
    expect(VIEW).not.toMatch(/cards\.map[\s\S]{0,50}overflow-x-auto/);
  });
});

describe("§11.283a 신호등 색상 토큰 swap (amber/orange/violet → red/yellow)", () => {
  it("만료 임박 카드 yellow 톤 (amber → yellow 검토 신호등)", () => {
    expect(VIEW).toMatch(/만료 임박[\s\S]{0,100}text-yellow-700/);
    expect(VIEW).toMatch(/만료 임박[\s\S]{0,100}bg-yellow-100/);
  });

  it("재주문 필요 카드 red 톤 (긴급 신호등)", () => {
    expect(VIEW).toMatch(/재주문 필요[\s\S]{0,100}text-red-700/);
    expect(VIEW).toMatch(/재주문 필요[\s\S]{0,100}bg-red-100/);
  });

  it("폐기 검토 카드 red 톤 (orange → red 긴급 신호등)", () => {
    expect(VIEW).toMatch(/폐기 검토[\s\S]{0,100}text-red-700/);
    expect(VIEW).toMatch(/폐기 검토[\s\S]{0,100}bg-red-100/);
  });

  it("점검 이슈 카드 yellow 톤 (violet → yellow 검토 신호등)", () => {
    expect(VIEW).toMatch(/점검 이슈[\s\S]{0,100}text-yellow-700/);
  });

  it("amber-400 / orange-400 / violet-400 cards 정의 안 잔존 부재 (brown/beige tone 폐지)", () => {
    // cards 배열 안 amber-400/orange-400/violet-400 잔존 안함 (다른 section 의 잔존 허용)
    expect(VIEW).not.toMatch(/cards\s*=\s*\[[\s\S]{0,500}text-amber-400/);
    expect(VIEW).not.toMatch(/cards\s*=\s*\[[\s\S]{0,500}text-orange-400/);
    expect(VIEW).not.toMatch(/cards\s*=\s*\[[\s\S]{0,500}text-violet-400/);
  });
});

describe("§11.283a 0건 카드 회색 톤다운 분기", () => {
  it("isZero 분기 + bg-gray-50 / text-gray-400 적용", () => {
    expect(VIEW).toMatch(/isZero[\s\S]{0,300}bg-gray-50/);
    expect(VIEW).toMatch(/isZero[\s\S]{0,300}text-gray-400/);
  });

  it("isZero 분기 + border-gray-200 + bg-gray-100 (icon bg)", () => {
    expect(VIEW).toMatch(/isZero[\s\S]{0,300}border-gray-200/);
    expect(VIEW).toMatch(/isZero[\s\S]{0,300}bg-gray-100/);
  });
});

describe("§11.283a invariant 보존 (canonical truth)", () => {
  it("4 KPI 카드 source 보존 (reorderCount / expiringCount / disposeCount / issueCount)", () => {
    expect(VIEW).toMatch(/reorderCount/);
    expect(VIEW).toMatch(/expiringCount/);
    expect(VIEW).toMatch(/disposeCount/);
    expect(VIEW).toMatch(/issueCount/);
  });

  it("4 icon (ShoppingCart / Clock / Trash2 / AlertTriangle) 보존", () => {
    expect(VIEW).toMatch(/ShoppingCart/);
    expect(VIEW).toMatch(/Clock/);
    expect(VIEW).toMatch(/Trash2/);
    expect(VIEW).toMatch(/AlertTriangle/);
  });

  it("\"건\" 단위 표시 보존", () => {
    expect(VIEW).toMatch(/{c\.count}[\s\S]{0,80}건/);
  });

  it("text-xl font-bold count display 보존", () => {
    expect(VIEW).toMatch(/text-xl font-bold tracking-tight/);
  });
});
