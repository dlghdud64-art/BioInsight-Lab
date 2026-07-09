import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * §inventory-redesign P2a (호영님 2026-07-09) — 품목 브리핑 패널 정합.
 *   PLAN_inventory-redesign Phase 2. 핸드오프 §4.
 *
 * ① rename: 헤더 "운영 브리핑" → "품목 브리핑"(품목 하나의 브리핑).
 * ② de-red 상태 배너: 신호등 배경 채움 제거 → 흰 카드 + 톤 border/텍스트(위험=rose).
 * 접이식 Sec는 이미 §11.320 Phase 3에서 구현됨(회귀 0로 보존만).
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SRC = readFileSync(
  join(REPO_ROOT, "src/components/inventory/inventory-context-panel.tsx"),
  "utf8",
);

describe("§inventory-redesign P2a — 품목 브리핑 rename + de-red 배너", () => {
  it("헤더 명칭 '품목 브리핑'(구 '운영 브리핑' UI 텍스트 제거)", () => {
    expect(SRC).toMatch(/: "품목 브리핑"\}/);
    expect(SRC).not.toMatch(/: "운영 브리핑"\}/);
  });

  it("de-red 상태 배너 — 위험=흰 카드+rose(bg-red-50 채움 제거)", () => {
    expect(SRC).toMatch(/danger:\s*"border-rose-200 bg-white text-rose-700"/);
    expect(SRC).toMatch(/ok:\s*"border-emerald-200 bg-white text-emerald-700"/);
    expect(SRC).toMatch(/warn:\s*"border-yellow-200 bg-white text-yellow-700"/);
  });
});

describe("§inventory-redesign P2a — 회귀 0(§11.320 보존)", () => {
  it("상태 배너 testid + 접이식 Sec state 보존", () => {
    expect(SRC).toMatch(/data-testid="inventory-context-status-banner"/);
    expect(SRC).toMatch(/isLotSectionExpanded/);
    expect(SRC).toMatch(/isFlowSectionExpanded/);
    expect(SRC).toMatch(/isHistorySectionExpanded/);
  });

  it("no-AI 보존 — '재발주안 검토'(AI 라벨 없음)", () => {
    expect(SRC).toMatch(/재발주안 검토/);
    expect(SRC).not.toMatch(/AI 재발주/);
  });
});
