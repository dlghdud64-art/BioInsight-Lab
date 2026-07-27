import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * §inventory-delta-label-kpi Phase 2a-2 (핸드오프 §2.3)
 *   COA/SDS 목록 로드 실패 삼킴 금지 — 에러 상태 + 재시도(빈 상태 오표시 방지) ·
 *   공급사 미지정 리스크 섹션 승격.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const SDS = "src/components/safety/sds-documents-section.tsx";
const PANEL = "src/components/inventory/inventory-context-panel.tsx";

describe("§inventory-delta-label-kpi P2a-2 — COA 로드 실패 재시도(삼킴 금지)", () => {
  it("loadError 상태 존재 + load catch 에서 setLoadError(true)", () => {
    const src = read(SDS);
    expect(src).toMatch(/const \[loadError, setLoadError\] = useState\(false\)/);
    expect(src).toMatch(/setLoadError\(true\)/);
    // load 시작 시 에러 리셋(재시도 정합).
    expect(src).toMatch(/setLoading\(true\);\s*\n\s*setLoadError\(false\)/);
  });

  it("에러 분기 렌더 + 재시도 버튼(load 재호출)", () => {
    const src = read(SDS);
    expect(src).toMatch(/\) : loadError \? \(/);
    expect(src).toMatch(/불러오지 못했습니다/);
    expect(src).toMatch(/onClick=\{\(\) => load\(\)\}[\s\S]{0,80}재시도/);
  });

  it("회귀 0 — 빈 상태('파일이 없습니다')는 loadError 아닐 때만", () => {
    const src = read(SDS);
    // 에러 분기가 빈 상태 분기보다 앞(우선).
    expect(src.indexOf("loadError ? (")).toBeLessThan(src.indexOf("파일이 없습니다"));
  });
});

describe("§inventory-delta-label-kpi P2a-2 — 공급사 미지정 리스크 승격", () => {
  it("item.vendor 미지정 시 reorder 관문 리스크 push(canonical, 가짜 아님)", () => {
    const src = read(PANEL);
    expect(src).toMatch(/if \(!item\.vendor\) \{/);
    expect(src).toMatch(/label: "공급사 미지정"/);
    expect(src).toMatch(/재발주 관문/);
  });
});
