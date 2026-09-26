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

  it("상태 배너 톤 배경 — §inventory-brief-sian(호영님 승인 2026-07-29, 시안 정합)로 de-red supersede", () => {
    // 구 de-red(흰 카드) → 시안 톤 배경 채움 복귀. §9 amber 금지 유지(주의=yellow).
    /* 🛑 재앵커 §inventory-state-tone (2026-09-26 · 호영님 판정) — **명제 불변, 앵커 이동.**
     *   옛 판본은 패널 안의 로컬 색 맵(`toneClass` 의 danger/warn/ok 리터럴)을 물었다.
     *   색 판정이 `lib/inventory/state-tone.ts` 정본으로 모였으므로 앵커를 **정본 호출 + 정본 팔레트**로 옮긴다.
     *   배너가 상태별 3색 톤 배경을 갖는다는 명제는 그대로다(위험 red · 만료 임박 yellow · 정상 emerald).
     *   팔레트 값 자체는 regression/inventory-state-tone-single-source.test.ts 가 든다. */
    expect(SRC).toMatch(/const cardTone = inventoryToneClass\(cardState\);/);
    expect(SRC).toMatch(/const toneClass = `\$\{cardTone\.card\} \$\{cardTone\.text\}`;/);
    expect(SRC).toMatch(/cardState: InventoryToneState = isOutOfStock/);
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
