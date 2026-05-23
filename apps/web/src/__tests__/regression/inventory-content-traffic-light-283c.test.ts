/**
 * §11.283c #inventory-content-traffic-light — inventory-content.tsx amber/orange
 *   토큰 일괄 swap (호영님 P0 spec, §11.283 cluster C, 30+ spot byte-level sweep).
 *
 * 호영님 P0 spec (대화 메시지, 2026-05-23):
 *   "긴급 배지 브라운/베이지 → 빨강/노랑 신호등 체계 (위험/긴급/검토 시각 구분).
 *    재고 화면 amber/orange 토큰 전체 신호등으로 교체."
 *
 * §11.283 cluster 진행:
 *   - §11.283a (KPI grid + 신호등 + 0건 톤다운) ✅
 *   - §11.283b (배경 흰색 통일) ✅
 *   - §11.283c (current = inventory-content.tsx amber/orange sweep) ✅
 *
 * Truth Reconciliation (Phase 0 audit):
 *   - inventory-content.tsx 안 amber-* 60 spot + orange-* 20 spot = 80 spot
 *   - 모두 Tailwind class 안 색상 토큰 (lot_issue strip / 카드 보더 / 배지 / KPI 등)
 *   - 의미: amber = 검토 / 만료 / 점검, orange = 긴급 / 폐기 / 위험
 *
 * Fix (Python script byte-level swap, 1 file ~80 spot + 1 trace marker comment):
 *   amber-50 → yellow-50
 *   amber-100 → yellow-100
 *   amber-200 → yellow-200
 *   amber-300 → yellow-300
 *   amber-400 → yellow-700 (가독성 향상)
 *   amber-500 → yellow-600
 *   amber-600 → yellow-600
 *   amber-700 → yellow-700
 *   amber-800 → yellow-700
 *   orange-50 → red-50
 *   orange-100 → red-100
 *   orange-200 → red-200
 *   orange-300 → red-300
 *   orange-400 → red-600
 *   orange-500 → red-600
 *   orange-600 → red-600
 *   orange-700 → red-700
 *   orange-800 → red-800
 *
 * canonical truth 보존:
 *   - 모든 className 의 다른 토큰 (slate / blue / red 기존) 보존
 *   - JSX 구조 변경 0 — 색상 키워드만 swap
 *   - data-testid / state / handler 변경 0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§11.283c — inventory-content.tsx amber/orange → yellow/red sweep", () => {
  it("§11.283c trace marker comment 존재", () => {
    expect(PAGE).toMatch(/§11\.283c/);
  });

  it("amber-* 토큰 전면 부재 (60 spot swap 완료)", () => {
    expect(PAGE).not.toMatch(/amber-\d+/);
  });

  it("orange-* 토큰 전면 부재 (20 spot swap 완료)", () => {
    expect(PAGE).not.toMatch(/orange-\d+/);
  });

  it("yellow-* 토큰 다수 잔존 (amber → yellow swap 검증)", () => {
    // 정확한 count 보다 존재 확인
    const matches = PAGE.match(/yellow-\d+/g) || [];
    expect(matches.length).toBeGreaterThan(10);
  });

  it("red-* 토큰 다수 잔존 (orange → red swap + 기존 red 보존)", () => {
    const matches = PAGE.match(/red-\d+/g) || [];
    expect(matches.length).toBeGreaterThan(10);
  });
});
