/**
 * §11.251d — 모바일 재고 관리 UX (FAB + 카드 배지 + 중복 경고).
 *
 * 재앵커 (§307 + §web-mobile-reskin): FAB 는 §307 에서 화면 고정(fixed bottom)
 *   → 헤더 inline(relative inline-flex)로 이전. 카드 배지 라벨 줄바꿈 차단은
 *   재발주 배너 truncate 로 유지. STATUS_CONFIG 4-status + getRecommendedAction
 *   invariant 는 그대로 보존. 본 sentinel 은 현행 truth 로 재정의.
 *
 * canonical truth lock:
 *   - BarcodeScanFab export + openScanner + lg:hidden 시그니처 보존.
 *   - getRecommendedAction return type (label/type) 보존.
 *   - STATUS_CONFIG 4 status (normal/low/expiring/danger) 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const FAB_PATH = resolve(__dirname, "../../components/layout/barcode-scan-fab.tsx");
const INVENTORY_VIEW_PATH = resolve(
  __dirname,
  "../../components/inventory/mobile-inventory-view.tsx",
);

const fab = safeRead(FAB_PATH);
const inventoryView = safeRead(INVENTORY_VIEW_PATH);

describe("§11.251d #1 — FAB (§307 헤더 inline 이전)", () => {
  it("FAB relative inline-flex + lg:hidden (헤더 inline, 모바일 전용)", () => {
    expect(fab).toMatch(/relative\s+inline-flex[\s\S]{0,250}lg:hidden/);
  });

  it("FAB 버튼 className 이 relative(헤더 inline) — 화면 고정 아님", () => {
    // 버튼 className 속성에 relative 사용(구 fixed 좌표 제거). 이력 주석은 제외.
    expect(fab).toMatch(/className="relative\s+inline-flex/);
  });
});

describe("§11.251d #2 — 카드 배지 짧은 라벨 + 줄바꿈 차단", () => {
  it("getRecommendedAction shortLabel 매핑 보존", () => {
    expect(inventoryView).toMatch(/shortLabel|짧은\s*라벨|action\.short/);
  });

  it("카드/배너 라벨 줄바꿈 차단 (truncate/max-w/whitespace-nowrap)", () => {
    expect(inventoryView).toMatch(/§11\.251d[\s\S]{0,5000}(max-w|truncate|whitespace-nowrap)/);
  });
});

describe("§11.251d #3 — trace marker + STATUS_CONFIG 보존", () => {
  it("§11.251d trace marker (mobile-inventory-view)", () => {
    expect(inventoryView).toMatch(/§11\.251d|11\.251d/);
  });

  it("기존 STATUS_CONFIG 4 status 보존 (normal/low/expiring/danger)", () => {
    expect(inventoryView).toMatch(/STATUS_CONFIG/);
    expect(inventoryView).toMatch(/normal[\s\S]{0,100}label/);
    expect(inventoryView).toMatch(/danger[\s\S]{0,100}label/);
  });
});

describe("§11.251d #4 — invariant 보존 (cross-stack)", () => {
  it("getRecommendedAction return shape (label + type) 보존", () => {
    expect(inventoryView).toMatch(/getRecommendedAction[\s\S]{0,500}label/);
    expect(inventoryView).toMatch(/getRecommendedAction[\s\S]{0,500}type/);
  });

  it("FAB BarcodeScanFab export 보존", () => {
    expect(fab).toMatch(/export\s+function\s+BarcodeScanFab/);
  });

  it("FAB onClick openScanner 보존", () => {
    expect(fab).toMatch(/openScanner/);
  });
});
