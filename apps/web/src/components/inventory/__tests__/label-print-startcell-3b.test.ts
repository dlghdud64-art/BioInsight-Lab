import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * §inventory-delta-label-kpi Phase 3b (핸드오프 §2) — 시작 칸 미니시트 picker + 사용 칸 로컬 기억 +
 *   규격 실비율 미리보기 + 잔여 칸 표시.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const MODAL = "src/components/inventory/LabelPrintModal.tsx";

describe("§inventory-delta-label-kpi P3b — 시작 칸 picker(칸 탭=시작)", () => {
  it("perPage 칸 미니시트 + gridSpec.cols 열 배치 + 칸 클릭 setStartCell", () => {
    const src = read(MODAL);
    expect(src).toMatch(/const gridSpec = !isCustomSpec \? activeSpec\?\.grid : undefined/);
    expect(src).toMatch(/gridTemplateColumns: `repeat\(\$\{gridSpec\.cols\}/);
    expect(src).toMatch(/onClick=\{\(\) => setStartCell\(i\)\}/);
  });

  it("칸 상태 색: 이번 인쇄 파랑 / 사용됨 빗금 / 빈 칸 점선", () => {
    const src = read(MODAL);
    expect(src).toMatch(/isThis/);
    expect(src).toMatch(/bg-blue-600 border-blue-600 text-white/);
    expect(src).toMatch(/repeating-linear-gradient/); // 사용됨 빗금
    expect(src).toMatch(/border-dashed border-slate-300/); // 빈 칸
  });
});

describe("§inventory-delta-label-kpi P3b — 사용 칸 로컬 기억", () => {
  it("규격별 localStorage 키 로드/저장 + 인쇄 후 markUsed", () => {
    const src = read(MODAL);
    expect(src).toMatch(/const \[usedCells, setUsedCells\] = useState<number\[\]>\(\[\]\)/);
    expect(src).toMatch(/label-used-cells:\$\{selectedSpec\}/);
    expect(src).toMatch(/const markUsedCells = \(cells: number\[\]\) =>/);
    expect(src).toMatch(/if \(g && !isCustomSpec && thisPrintCells\.length > 0\) markUsedCells\(thisPrintCells\)/);
  });

  it("사용 칸 초기화(strand 방지) + 로컬 전용(canonical 아님)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/const resetUsedCells = \(\) =>/);
    expect(src).toMatch(/removeItem\(`label-used-cells:\$\{selectedSpec\}`\)/);
  });
});

describe("§inventory-delta-label-kpi P3b — 실비율 미리보기 + 잔여", () => {
  it("규격 실비율(aspectRatio = W/H mm) — 규격 변경 시 갱신", () => {
    const src = read(MODAL);
    expect(src).toMatch(/aspectRatio: `\$\{labelWidthMm\} \/ \$\{labelHeightMm\}`/);
    // 구 고정 minHeight 제거.
    expect(src).not.toMatch(/minHeight: `\$\{Math\.max\(48, Math\.round\(labelHeightMm \* 1\.8\)\)\}px`/);
  });

  it("잔여 칸 + 시작~끝 칸 요약(그리드 규격만)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/const remainingCells = gridSpec/);
    expect(src).toMatch(/번 칸 · 잔여 \{remainingCells\}칸/);
  });
});
