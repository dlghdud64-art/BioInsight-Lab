import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const VIEW = "src/components/inventory/mobile-inventory-view.tsx";

describe("§11.327 — 재고 상세 권장 액션 톤 개선 (rose 홍수 제거·accent AI 카드)", () => {
  it("reorder 권장 카드 컨테이너가 accent(blue) 톤이다", () => {
    const src = read(VIEW);
    expect(src).toMatch(/rounded-\[18px\] border border-blue-200 bg-blue-50/);
  });

  it("AI 권장 칩이 흰 배경 + blue-200 테두리 + blue-700 텍스트다", () => {
    const src = read(VIEW);
    expect(src).toMatch(/border border-blue-200 bg-white[^"]*text-blue-700/);
    expect(src).toMatch(/AI 권장/);
  });

  it("심각도는 7px 로즈 도트로만 표기한다 (배경/테두리 색 없음)", () => {
    const src = read(VIEW);
    expect(src).toMatch(/h-\[7px\] w-\[7px\] rounded-full bg-rose-500/);
  });

  it("제목은 text-slate-900 (빨간 제목 금지)", () => {
    const src = read(VIEW);
    expect(src).toMatch(/text-base font-extrabold text-slate-900/);
  });

  it("위험 숫자만 rose-700 강조한다", () => {
    const src = read(VIEW);
    expect(src).toMatch(/<b className="font-extrabold text-rose-700">/);
  });

  it("reorder 카드에서 rose/red 배경 홍수 잔재가 없다", () => {
    const src = read(VIEW);
    // 구 reorder flood 제거
    expect(src).not.toMatch(/reorder" \? "border-red-500\/20 bg-red-950\/10"/);
    expect(src).not.toMatch(/reorder" \? "text-red-400"/);
  });
});

describe("§11.327 — 회귀 보호 (dispose/use_first/CTA/wiring 보존)", () => {
  it("dispose/use_first 신호등 톤이 유지된다", () => {
    const src = read(VIEW);
    expect(src).toMatch(/border-red-500\/20 bg-red-900\/10/); // dispose
    expect(src).toMatch(/border-\[#f3d4bf\] bg-\[#fdf3ec\]/); // use_first amber
    expect(src).toMatch(/text-\[#b45821\]/); // use_first 라벨
  });

  it("CTA 'AI 재발주 검토' 실 핸들러가 유지된다", () => {
    const src = read(VIEW);
    expect(src).toMatch(/AI 재발주 검토/);
    expect(src).toMatch(/onReorder\(inv\)/);
  });
});
