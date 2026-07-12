/**
 * §inventory-safety-gauge-drawer (호영님 재고 지시문 §3.1) — 드로어 갭 게이지.
 *
 * 캐노니컬 정합: 지시문 §3.1은 갭 게이지를 "상태 액션 카드"에 두지만, §11.322(상태 카드 =
 *   결론 only, 정량 숫자는 재고 현황 섹션이 유일 출처) + de-red(P2a) 결정과 충돌 →
 *   게이지를 재고 현황 섹션(정량 canonical 출처)에 배치. 상태 카드는 결론 only 유지.
 * 게이지: 현재/안전 비율, 신호등 0 rose / 미달 yellow / 정상 emerald. 캡션 숫자 중복 0.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../components/inventory/inventory-context-panel.tsx"),
  "utf8",
);

describe("§inventory-safety-gauge-drawer — 재고 현황 갭 게이지", () => {
  it("게이지 testid + 신호등 3색(0 rose / 미달 yellow / 정상 emerald)", () => {
    expect(SRC).toMatch(/data-testid="inventory-context-safety-gauge"/);
    expect(SRC).toMatch(/item\.currentQuantity === 0 \? "bg-rose-500"/);
    expect(SRC).toMatch(/item\.currentQuantity < safety \? "bg-yellow-500" : "bg-emerald-500"/);
  });
  it("현재÷안전 비율 + a11y(role=img·aria)", () => {
    expect(SRC).toMatch(/Math\.min\(100, Math\.round\(\(item\.currentQuantity \/ safety\) \* 100\)\)/);
    expect(SRC).toMatch(/role="img"/);
    expect(SRC).toMatch(/aria-label=\{`안전재고 대비 \$\{pct\}%`\}/);
  });

  it("회귀 0 — 재고 현황 KPI(현재/안전재고) testid 보존", () => {
    expect(SRC).toMatch(/data-testid="inventory-context-kpi-current"/);
    expect(SRC).toMatch(/data-testid="inventory-context-kpi-safety-stock"/);
  });

  it("§11.322 준수 — 상태 배너 결론 only 유지(de-red toneClass 무손상)", () => {
    expect(SRC).toMatch(/danger:\s*"border-rose-200 bg-white text-rose-700"/);
    expect(SRC).toMatch(/data-testid="inventory-context-status-banner"/);
    // 게이지는 상태 배너가 아니라 재고 현황 섹션 소속(배너에 정량 게이지 주입 금지)
    expect(SRC).toMatch(/inventory-context-status-banner[\s\S]*?inventory-context-safety-gauge/);
  });
});
