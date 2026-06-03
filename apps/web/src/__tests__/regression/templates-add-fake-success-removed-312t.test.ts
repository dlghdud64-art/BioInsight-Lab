/**
 * §11.312-templates (회귀) — templates "목록에 추가" fake success 제거 sentinel
 *
 * 이전 결함: handleAddToList 가 mutation 없이 toast({title:"추가 완료"}) 호출
 *   → fake success(누르면 성공 뜨는데 실제 추가 0). 직접 URL 도달 시 사용자 속임.
 * 처리(A): fake toast 제거 + 버튼 disabled("준비 중"). add 대상(cart/quote-list)
 *   wiring 은 추측 금지 → b 단계 동선 확정 후.
 * 회귀 0: export/delete 실동작 핸들러는 보존.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const PAGE = "src/app/templates/page.tsx";

describe("§11.312-templates — fake success 제거", () => {
  it("handleAddToList 의 fake 성공 toast(추가 완료) 제거", () => {
    const src = read(PAGE);
    expect(src).not.toContain('title: "추가 완료"');
  });

  it("'목록에 추가' 버튼 disabled (미완 동선 명시)", () => {
    const src = read(PAGE);
    expect(src).toContain("준비 중");
    expect(src).toContain("disabled");
  });

  it("handleAddToList(fake) 호출 wiring 제거", () => {
    const src = read(PAGE);
    expect(src).not.toContain("onClick={() => handleAddToList(template)}");
  });
});

describe("§11.312-templates — 회귀 0 (실동작 핸들러 보존)", () => {
  it("export/delete 핸들러 보존", () => {
    const src = read(PAGE);
    expect(src).toContain("handleExportTemplate");
    expect(src).toContain("handleDeleteTemplate");
  });
});
