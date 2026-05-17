/**
 * §11.251d — 모바일 재고 관리 UX (FAB + 카드 배지 + 중복 경고).
 *
 * 호영님 spec (이미지4):
 *   - FAB ⇄ 버튼이 BottomNav "재고" 위 겹침 → bottom 72px+ 마진 확보.
 *   - "긴급 재발주 필요" 배지 줄바꿈 → 짧은 라벨 ("긴급") + max-w 처리.
 *   - 카드 안 status dot + currentQuantity 빨강 + action 배지 중복 경고 정리
 *     → quantity 는 톤다운, action 배지는 유지.
 *
 * canonical truth lock:
 *   - BarcodeScanFab fixed bottom + right + lg:hidden 시그니처 보존.
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

describe("§11.251d #1 — FAB bottom 72px+ (탭 바 위 16px 간격)", () => {
  it("FAB bottom-[72px] 또는 bottom-24 이상 (BottomNav h-14=56 + 16px=72)", () => {
    // 기존 bottom-20 (80px) 가 호영님 spec "72px+" 충족이지만 시각적으로 약함
    //   → bottom-[72px] (정확 spec) 또는 bottom-24 (96px) 으로 명시.
    expect(fab).toMatch(/fixed\s+bottom-\[72px\]|fixed\s+bottom-24/);
  });

  it("FAB lg:hidden + right-4 보존 (모바일 전용 위치)", () => {
    expect(fab).toMatch(/right-4[\s\S]{0,200}lg:hidden/);
  });
});

describe("§11.251d #2 — 카드 배지 짧은 라벨 (호영님 spec '긴급' 축약)", () => {
  it("getRecommendedAction 또는 별도 helper 안 'shortLabel' 또는 짧은 라벨 매핑", () => {
    // 짧은 라벨 매핑 — 카드 안 노출용. 상세 (권장 액션) 섹션은 기존 라벨 유지.
    expect(inventoryView).toMatch(/shortLabel|짧은\s*라벨|action\.short/);
  });

  it("카드 안 action 배지 max-w + truncate (긴 한국어 줄바꿈 차단)", () => {
    // 카드 안 inline-block badge 가 max-w + truncate 으로 줄바꿈 안 됨.
    //   §11.251d 안 max-w 또는 truncate 추가.
    expect(inventoryView).toMatch(/§11\.251d[\s\S]{0,5000}(max-w|truncate|whitespace-nowrap)/);
  });
});

describe("§11.251d #3 — 카드 안 중복 경고 톤다운 (호영님 spec '0 bottle 빨강 + 위험 배지' 중 하나만)", () => {
  it("§11.251d trace marker (mobile-inventory-view 안 톤다운 정합)", () => {
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
