/**
 * §inventory-redesign A-①' — 우측 패널 통합 sentinel (PLAN: docs/plans/PLAN_inventory-panel-unify.md)
 *
 * 정본 = InventoryContextPanel. AiAssistantPanel 자산 흡수 + mode 분기로 단일 패널화.
 * Phase별 누적 가드:
 *   P1 — mode:'detail'|'reorder' prop + 헤더 맥락 분기(default detail = 회귀 0).
 *   P2~P4 — reorder 흡수 / 라우팅 전환 / 단일 배너 (배치 진행 시 추가).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const PANEL = "src/components/inventory/inventory-context-panel.tsx";

describe("§inventory-panel-unify P1 — mode prop + 헤더 맥락 분기", () => {
  it("mode prop 정의('detail'|'reorder')", () => {
    const src = read(PANEL);
    expect(src).toMatch(/mode\?:\s*"detail"\s*\|\s*"reorder"/);
    expect(src).toMatch(/mode = "detail"/); // default detail = 회귀 0
  });
  it("헤더 eyebrow mode 분기(재발주 검토 / 운영 브리핑)", () => {
    const src = read(PANEL);
    expect(src).toMatch(/mode === "reorder" \? "재발주 검토" : "운영 브리핑"/);
  });
  it("회귀 0 — '운영 브리핑' eyebrow 문자열 보존", () => {
    expect(read(PANEL)).toContain("운영 브리핑");
  });
});
