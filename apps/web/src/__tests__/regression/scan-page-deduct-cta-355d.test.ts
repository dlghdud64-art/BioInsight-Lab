/**
 * §11.355-D (회귀) — 전용 스캔 페이지 "사용/차감" CTA sentinel
 *
 * 폐루프 닫힘: 라벨 QR(§11.355-B) → 스캔(§11.349) → 차감(이 슬라이스).
 * 글로벌 스캐너의 /api/inventory/[id]/use 흐름을 전용 스캔 페이지에 재사용
 * (page-per-feature 단편화 해소). 스캔=식별, 차감=사용량 입력 후 실행(사람 확인 게이트).
 * canonical mutation(서버 차감+감사) — front-only 금지.
 *
 * 문자열 매칭은 toContain (esbuild ts-loader 모호성 회피).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const PAGE = "src/app/dashboard/inventory/scan/page.tsx";

describe("§11.355-D — 스캔 페이지 사용/차감 CTA (canonical)", () => {
  it("차감 mutation 이 /api/inventory/[id]/use 호출 (글로벌 스캐너 재사용)", () => {
    const src = read(PAGE);
    expect(src).toContain("/api/inventory/${inventory.id}/use");
    expect(src).toContain("deductMutation");
    expect(src).toContain("quantity: qty");
  });
  it("사용/차감 CTA + 사람 확인 게이트(showUseForm + 차감 확인)", () => {
    const src = read(PAGE);
    expect(src).toContain("사용/차감");
    expect(src).toContain("showUseForm");
    expect(src).toContain("차감 확인");
  });
  it("차감 성공 시 재고 쿼리 무효화(잔여 갱신)", () => {
    const src = read(PAGE);
    expect(src).toContain('queryKey: ["inventory-item", inventoryId]');
    expect(src).toContain("invalidateQueries");
  });
  it("0 재고 시 사용 불가 가드(dead button 방지)", () => {
    const src = read(PAGE);
    expect(src).toContain("재고 없음 — 사용 불가");
  });
});

describe("§11.355-D 회귀 0 — 기존 동작 보존", () => {
  it("입고 처리 / 상세 보기 / 라벨 스캐너 보존", () => {
    const src = read(PAGE);
    expect(src).toContain("입고 처리");
    expect(src).toContain("상세 보기");
    expect(src).toContain("LabelScannerModal");
  });
  it("§11.349 카메라 lifecycle(controlsRef stop) 보존", () => {
    const src = read(PAGE);
    expect(src).toContain("controlsRef");
    expect(src).toContain("stopScanner");
  });
});
