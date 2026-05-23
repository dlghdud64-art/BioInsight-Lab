/**
 * §11.283c-2 #inventory-app-wide-traffic-light — components/inventory + dashboard/
 *   inventory 하위 file 전체 amber/orange → yellow/red 신호등 sweep (§11.283c
 *   회귀 마무리, 호영님 production smoke 결과 amber/orange 잔존 발견).
 *
 * 호영님 production smoke 결과 (2026-05-23):
 *   Chrome MCP labaxis.co.kr/dashboard/inventory amber-26 + orange-9 + yellow-0
 *   잔존. §11.283c sweep 가 inventory-content.tsx 한정 적용 → mobile-inventory-
 *   view.tsx + inventory-context-panel.tsx + 기타 inventory/* component 미적용.
 *
 * Fix (Python script byte-level sweep, 19 file ~222 spot):
 *   - apps/web/src/components/inventory/ 13 file (mobile-inventory-view 27 spot
 *     + InventoryTable 33 + lot-disposal-panel 21 + inventory-context-panel 13
 *     + import-staging-workbench 13 + storage-location-view 14 + 기타)
 *   - apps/web/src/app/dashboard/inventory/ 4 file (inventory-main 54 spot +
 *     scan 3 + blocks 7)
 *
 * §11.283c (inventory-content.tsx) 와 동일 mapping:
 *   amber-* 9 magnitude → yellow-*
 *   orange-* 9 magnitude → red-*
 *   amber-950 → yellow-900 / orange-950 → red-900 (다크 변형)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MOBILE_VIEW = readFileSync(
  resolve(__dirname, "../../components/inventory/mobile-inventory-view.tsx"),
  "utf8",
);
const CONTEXT_PANEL = readFileSync(
  resolve(__dirname, "../../components/inventory/inventory-context-panel.tsx"),
  "utf8",
);
const INVENTORY_TABLE = readFileSync(
  resolve(__dirname, "../../components/inventory/InventoryTable.tsx"),
  "utf8",
);
const INVENTORY_MAIN = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-main.tsx"),
  "utf8",
);

describe("§11.283c-2 — components/inventory/* + dashboard/inventory/* amber/orange 잔존 부재", () => {
  it("mobile-inventory-view.tsx amber/orange 토큰 잔존 부재", () => {
    expect(MOBILE_VIEW).not.toMatch(/amber-\d+/);
    expect(MOBILE_VIEW).not.toMatch(/orange-\d+/);
  });

  it("inventory-context-panel.tsx amber/orange 토큰 잔존 부재", () => {
    expect(CONTEXT_PANEL).not.toMatch(/amber-\d+/);
    expect(CONTEXT_PANEL).not.toMatch(/orange-\d+/);
  });

  it("InventoryTable.tsx amber/orange 토큰 잔존 부재", () => {
    expect(INVENTORY_TABLE).not.toMatch(/amber-\d+/);
    expect(INVENTORY_TABLE).not.toMatch(/orange-\d+/);
  });

  it("inventory-main.tsx amber/orange 토큰 잔존 부재", () => {
    expect(INVENTORY_MAIN).not.toMatch(/amber-\d+/);
    expect(INVENTORY_MAIN).not.toMatch(/orange-\d+/);
  });
});

describe("§11.283c-2 — yellow/red 신호등 토큰 잔존 (swap 검증)", () => {
  it("mobile-inventory-view yellow-* 또는 red-* 다수 잔존", () => {
    const yellow = MOBILE_VIEW.match(/yellow-\d+/g) || [];
    const red = MOBILE_VIEW.match(/red-\d+/g) || [];
    expect(yellow.length + red.length).toBeGreaterThan(10);
  });

  it("inventory-main yellow-* + red-* 다수 잔존", () => {
    const yellow = INVENTORY_MAIN.match(/yellow-\d+/g) || [];
    const red = INVENTORY_MAIN.match(/red-\d+/g) || [];
    expect(yellow.length + red.length).toBeGreaterThan(20);
  });
});
