import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * §inventory-delta-label-kpi Phase 3c (핸드오프 §2.3) — 규격별 레이아웃 프리셋.
 *   compact(3100/3101): QR + 품명·LOT·EXP, 긴 원시 ID는 QR에만(1D 텍스트 생략).
 *   barcode(3102/3104): QR + 1D(고유번호) + EXP. 인쇄·미리보기 공용 게이트.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const MODAL = "src/components/inventory/LabelPrintModal.tsx";

describe("§inventory-delta-label-kpi P3c — 규격 프리셋 정의", () => {
  it("layout 필드 + resolver(compact/barcode/full)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/layout\?: "compact" \| "barcode"/);
    expect(src).toMatch(/function resolveLabelLayout\(spec\?: LabelSpec\)/);
    expect(src).toMatch(/spec\?\.layout === "compact"\) return \{ showCatalog: false, showLot: true, showBarcodeText: false \}/);
    expect(src).toMatch(/spec\?\.layout === "barcode"\) return \{ showCatalog: false, showLot: false, showBarcodeText: true \}/);
  });

  it("규격 매핑 — 3100/3101=compact, 3102/3104=barcode", () => {
    const src = read(MODAL);
    expect(src).toMatch(/id: "formtec-3100"[\s\S]{0,140}layout: "compact"/);
    expect(src).toMatch(/id: "formtec-3101"[\s\S]{0,140}layout: "compact"/);
    expect(src).toMatch(/id: "formtec-3102"[\s\S]{0,140}layout: "barcode"/);
    expect(src).toMatch(/id: "formtec-3104"[\s\S]{0,140}layout: "barcode"/);
  });
});

describe("§inventory-delta-label-kpi P3c — 프리셋 게이트 적용(인쇄·미리보기)", () => {
  it("인쇄 cellContent: catalog·1D 텍스트 프리셋 게이트", () => {
    const src = read(MODAL);
    expect(src).toMatch(/const layout = resolveLabelLayout\(activeSpec\)/);
    expect(src).toMatch(/layout\.showCatalog && item\.catalogNumber \?/);
    expect(src).toMatch(/layout\.showBarcodeText && includeBarcode \?/);
    // 구 무조건 출력(catalog·barcode) 제거.
    expect(src).not.toMatch(/\$\{item\.catalogNumber \? `<div class="cat">/);
    expect(src).not.toMatch(/\$\{includeBarcode \? `<div class="code">/);
  });

  it("미리보기: 동일 프리셋 게이트(인쇄=미리보기 일치)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/layout\.showCatalog && item\.catalogNumber &&/);
    expect(src).toMatch(/layout\.showBarcodeText && includeBarcode &&/);
  });
});
