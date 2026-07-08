import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * §receiving-post-v2 (호영님 2026-07-08) — 재고 반영 모달 시안(§mPost) 정합.
 *
 * 라이브는 이미 센터 480px·헤더·emerald callout·footer 로 v2와 대부분 일치. v2 대비 안전
 * 추가분만 반영: callout 문구 정합 + checkline("검수 완료 · 필수 문서 확보됨").
 *
 * ⚠ 정직성(입고일→갱신·공급사 제거와 동일): v2 mock 의 "반영 품목 N개·총 수량 N EA·검수
 *   합격/불합격" 수치는 ModuleLandingItem(리스트 projection)에 데이터 부재 → 조작 금지, 미추가.
 *   저장 위치 select 도 postToInventory 미수신 → dead field 금지(미노출 유지).
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const MODAL = "src/components/receiving/receiving-post-modal.tsx";

describe("§receiving-post-v2 — 시안 정합(안전 추가분)", () => {
  it("v2 callout 문구 + checkline(ready 상태 진술)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/재고에 반영할 수 있습니다/);
    expect(src).toMatch(/검수 완료 · 필수 문서 확보됨/);
  });
});

describe("§receiving-post-v2 — 정직성 가드(조작·dead field 금지)", () => {
  it("저장 위치 select 미노출(dead field)", () => {
    const src = read(MODAL);
    expect(src).not.toMatch(/<select/);
  });
  it("데이터 없는 수치(총 수량·합격/불합격) 조작 미추가", () => {
    const src = read(MODAL);
    expect(src).not.toMatch(/총 수량/);
    expect(src).not.toMatch(/불합격/);
  });
});

describe("§receiving-post-v2 — 회귀 0(실 mutation·Esc 보존)", () => {
  it("onConfirm/onClose/Esc wiring 보존", () => {
    const src = read(MODAL);
    expect(src).toMatch(/onClick=\{\(\) => onConfirm\(item\)\}/);
    expect(src).toMatch(/onClick=\{onClose\}/);
    expect(src).toMatch(/e\.key === "Escape"/);
  });
});
