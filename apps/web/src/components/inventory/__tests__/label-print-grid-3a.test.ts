import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * §inventory-delta-label-kpi Phase 3a (핸드오프 §2) — 라벨 인쇄 mm 절대 그리드 + EXP 포맷.
 *   세로 1열 흐름 버그 → 규격별 A4 그리드(칸 절대 배치, @page margin 0)로 물리 1:1.
 *   EXP는 YYYY.MM.DD(원시 ISO 금지). 시작 칸 offset(3b picker 대비 state 확보).
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const MODAL = "src/components/inventory/LabelPrintModal.tsx";

describe("§inventory-delta-label-kpi P3a — mm 절대 그리드 배치(세로 1열 버그 해소)", () => {
  it("규격별 grid geometry(cols·rows·여백·피치) — 3100=5×13", () => {
    const src = read(MODAL);
    expect(src).toMatch(/interface LabelGrid \{/);
    expect(src).toMatch(/grid: \{ cols: 5, rows: 13, marginTopMm: 10\.7, marginLeftMm: 4\.7, pitchXMm: 40\.6, pitchYMm: 21\.2 \}/);
  });

  it("@page margin 0 + 칸 절대 좌표 배치(흐름 아님)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/@page \{ size: A4; margin: 0; \}/);
    expect(src).toMatch(/left:\$\{left\}mm;top:\$\{top\}mm/);
    expect(src).toMatch(/position: absolute/);
    // col/row → mm 좌표 파생.
    expect(src).toMatch(/const left = g\.marginLeftMm \+ col \* g\.pitchXMm/);
    expect(src).toMatch(/const top = g\.marginTopMm \+ row \* g\.pitchYMm/);
  });

  it("시작 칸 offset(앞칸 빈칸) + 페이지 채움(perPage 청크)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/const \[startCell, setStartCell\] = useState\(0\)/);
    expect(src).toMatch(/const perPage = g\.cols \* g\.rows/);
    expect(src).toMatch(/Array\.from\(\{ length: offset \}, \(\) => null\)/);
  });

  it("그리드 없는 규격(롤/커스텀)은 흐름 폴백", () => {
    const src = read(MODAL);
    expect(src).toMatch(/cell flow/);
    expect(src).toMatch(/if \(g && !isCustomSpec\)/);
  });
});

describe("§inventory-delta-label-kpi P3a — EXP YYYY.MM.DD 포맷", () => {
  it("formatExp 헬퍼(ISO → YYYY.MM.DD, 파싱 실패 시 원문)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/function formatExp\(raw\?: string\)/);
    expect(src).toMatch(/Number\.isNaN\(d\.getTime\(\)\)/);
    expect(src).toMatch(/\$\{d\.getFullYear\(\)\}\.\$\{String\(d\.getMonth\(\) \+ 1\)\.padStart\(2, "0"\)\}/);
  });

  it("인쇄·미리보기 모두 formatExp 경유(원시 ISO 직접 출력 제거)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/EXP: \$\{escapeHtml\(formatExp\(item\.expiryDate\)\)\}/);
    expect(src).toMatch(/EXP: \{formatExp\(item\.expiryDate\)\}/);
    // 구 원시 출력 제거.
    expect(src).not.toMatch(/EXP: \$\{escapeHtml\(item\.expiryDate\)\}/);
    expect(src).not.toMatch(/EXP: \{item\.expiryDate\}/);
  });
});
