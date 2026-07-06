import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const WB = "src/components/quotes/dispatch/vendor-dispatch-workbench.tsx";

describe("§11.330 — 이메일 공급사 추가 입력칸 폭 버그 수정", () => {
  it("이메일 input이 최소폭을 보장한다 (flex 축소로 0폭 되던 버그 방지)", () => {
    const src = read(WB);
    expect(src).toMatch(/h-9 w-full min-w-\[10rem\] flex-1 border-slate-200 bg-white text-xs text-slate-900/);
  });

  it("공급사명 input은 가로에서 고정 보조폭이다", () => {
    const src = read(WB);
    expect(src).toMatch(/placeholder="공급사명 \(선택\)"[\s\S]{0,220}min-\[561px\]:w-32 min-\[561px\]:flex-none/);
  });

  it("추가 핸들러·disabled 가드가 유지된다 (회귀 0)", () => {
    const src = read(WB);
    expect(src).toMatch(/onClick=\{addManualVendor\}/);
    expect(src).toMatch(/disabled=\{!manualEmail\.trim\(\)\}/);
  });
});
