/**
 * §11.344 (회귀) — 자사 Grade(A~E) 소싱 UI 표시 제거 sentinel
 *
 * 자사 시약관리 등급(A~E)은 제품 본연 속성 아님 → 소싱 카드/우측 패널 비노출.
 * 데이터(product.grade)는 보존(내부 참조). UI 렌더만 제거. 분류(시약/기구)는 유지.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const ROW = "src/app/_workbench/_components/sourcing-result-row.tsx";
const PANEL = "src/app/_workbench/_components/product-detail-summary.tsx";

describe("§11.344 — 카드 Grade 미표시", () => {
  it("buildStaticMeta 에서 grade push 제거", () => {
    const src = read(ROW);
    expect(src).not.toMatch(/parts\.push\(product\.grade\)/);
    expect(src).not.toMatch(/else if \(product\.grade\)/);
  });
  it("분류(category) push 는 보존", () => {
    const src = read(ROW);
    expect(src).toMatch(/PRODUCT_CATEGORIES\[product\.category/);
  });
});

describe("§11.344 — 우측 패널 Grade 항목 제거", () => {
  it("Grade 렌더 블록 제거", () => {
    const src = read(PANEL);
    expect(src).not.toMatch(/<span className="text-slate-500">Grade<\/span>/);
    expect(src).not.toMatch(/\{data\.grade && \(/);
  });
  it("empty 조건에서 grade 제거(분류는 유지)", () => {
    const src = read(PANEL);
    expect(src).not.toMatch(/!data\.specification && !data\.storageCondition && !data\.grade/);
    expect(src).toMatch(/PRODUCT_CATEGORIES\[data\.category/);
  });
});
