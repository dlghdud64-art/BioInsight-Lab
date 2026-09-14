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
const CANON = readFileSync(
  resolve(__dirname, "../../lib/inventory/reorder-need.ts"),
  "utf8",
);

describe("§inventory-safety-gauge-drawer — 재고 현황 갭 게이지", () => {
  it("게이지 testid + 신호등 3색(0 rose / 미달 yellow / 정상 emerald)", () => {
    expect(SRC).toMatch(/data-testid="inventory-context-safety-gauge"/);
    expect(SRC).toMatch(/item\.currentQuantity === 0 \? "bg-rose-500"/);
  });

  it("🛑 게이지 경계 = 정본 경계 — 안전재고 '이하' yellow", () => {
    /* 🛑 삼항 전체를 문자열로 박지 않는다.
     *   옛 판본이 `item.currentQuantity < safety ? ...` 를 바이트로 핀해,
     *   정본(reorder-need.ts `<=`)에 맞추는 올바른 수정을 막았다(§sentinel-inversion, 2026-09-14).
     *   게이지는 지역변수 safety(:873)와 비교한다 — 이 이름은 게이지 블록에만 있어
     *   qtyTone(:813, item.safetyStock)과 섞이지 않는다. */
    expect(SRC).toMatch(
      /item\.currentQuantity\s*<=\s*safety\s*\?\s*"bg-yellow-500"\s*:\s*"bg-emerald-500"/,
    );
    expect(SRC).not.toMatch(/item\.currentQuantity\s*<\s*safety\s*\?/);
    // 정본과 같은 경계인가 — 양쪽이 함께 < 로 바뀌는 경우까지 잡는다.
    expect(CANON).toMatch(/inv\.currentQuantity\s*<=\s*inv\.safetyStock/);
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

  it("상태 배너 toneClass — §inventory-brief-sian(2026-07-29 시안 정합) 톤 배경 + 재고 현황 게이지 보존", () => {
    // 구 de-red(bg-white+rose) → 시안 톤 배경(bg-red-50) supersede(호영님 승인).
    expect(SRC).toMatch(/danger:\s*"border-red-200 bg-red-50 text-red-700"/);
    expect(SRC).toMatch(/data-testid="inventory-context-status-banner"/);
    // 재고 현황 섹션의 안전재고 게이지는 별도 보존(카드 게이지와 공존).
    expect(SRC).toMatch(/inventory-context-status-banner[\s\S]*?inventory-context-safety-gauge/);
  });
});
