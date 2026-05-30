/**
 * §11.326 Phase 4 — 의심 입고 데이터 배너/필터 배선 sentinel
 *
 * 결정(호영님 2026-05-30): A안(라운드 숫자) + 세션 dismiss + 의심 0건 미노출 + 닫기 후 칩 재진입.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const INV = "src/app/dashboard/inventory/inventory-content.tsx";
const CORE = "src/lib/inventory/suspect-received-quantity.ts";

describe("§11.326 Phase 4 — 탐지 코어", () => {
  it("순수 함수 export + 임계 상수", () => {
    const src = read(CORE);
    expect(src).toMatch(/export function isSuspectReceivedQuantity/);
    expect(src).toMatch(/export function countSuspectInventories/);
    expect(src).toMatch(/SUSPECT_MIN_QTY\s*=\s*100/);
  });
});

describe("§11.326 Phase 4 — inventory-content 배선", () => {
  it("탐지 import + 집계 + 필터 state", () => {
    const src = read(INV);
    expect(src).toMatch(/isSuspectReceivedQuantity/);
    expect(src).toMatch(/countSuspectInventories/);
    expect(src).toMatch(/suspectCount/);
    expect(src).toMatch(/suspectFilterActive/);
    expect(src).toMatch(/suspectBannerDismissed/);
  });

  it("의심 0건 미노출 + 세션 dismiss 조건", () => {
    const src = read(INV);
    expect(src).toMatch(/suspectCount > 0 && !suspectBannerDismissed/);
  });

  it("재고 검토하기 CTA(필터 활성) + 닫기(dismiss)", () => {
    const src = read(INV);
    expect(src).toMatch(/재고 검토하기/);
    expect(src).toMatch(/setSuspectFilterActive\(true\)/);
    expect(src).toMatch(/setSuspectBannerDismissed\(true\)/);
  });

  it("닫기 후 재진입 칩(필터 해제 + N건 표시) — dead-end 방지", () => {
    const src = read(INV);
    expect(src).toMatch(/검토 권장 \{suspectCount\}건/);
    expect(src).toMatch(/setSuspectFilterActive\(false\)/);
  });
});
