/**
 * §inventory-safety-gauge / §inventory-dday-90 (호영님 재고 지시문 §2) — 테이블 additive 델타.
 *
 * 안전재고 게이지 막대(신호등: 0 red / 미달 red / 정상 emerald · 2026-09-26 판정으로 미달 yellow→red) +
 * 최단 유효기간 D-day ≤90 노출(≤30 red, 31–90 yellow). dot-status·기존 셀 구조 무변경.
 * amber/orange Tailwind class 0(app-wide-amber-removed 정합) 유지.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../components/inventory/InventoryTable.tsx"),
  "utf8",
);
const CANON = readFileSync(
  resolve(__dirname, "../../lib/inventory/reorder-need.ts"),
  "utf8",
);
const TONE = readFileSync(
  resolve(__dirname, "../../lib/inventory/state-tone.ts"),
  "utf8",
);

describe("§inventory-safety-gauge — 안전재고 게이지 막대(신호등)", () => {
  /* 🛑 재앵커 §inventory-state-tone (2026-09-26 · 호영님 판정) — **결정이 바뀌었다.**
   *   옛 명제는 「0 red / 미달 **yellow** / 정상 emerald」 였다. 호영님 판정으로 미달도 red 다:
   *     「안전재고는 정의상 재주문을 시작하는 선이라, 그 아래로 내려갔다는 건 곧 조치가 필요하다는 뜻」.
   *   경계(`<=`)는 그대로다 — 바뀐 것은 색뿐이고, 경계를 정본과 맞춘 2026-09-15 수정은 무손상이다.
   *   판정은 이제 `lib/inventory/state-tone.ts` 한 곳에서만 일어나므로 이 자리는 **게이지가 그 정본을
   *   부르는지**와 **경계가 정본과 같은지** 두 가지만 본다. */
  it("게이지가 정본 톤 함수를 부른다 (색 판정을 표면에서 하지 않는다)", () => {
    expect(SRC).toMatch(/§inventory-safety-gauge/);
    expect(SRC).toMatch(
      /const barColor = inventoryToneClass\(inventoryQuantityState\(group\.totalQuantity, group\.safetyStock\)\)\.bar;/,
    );
    /* 구 표면 삼항 부활 차단 — 0=red/미달=yellow 세대가 돌아오면 RED. */
    expect(SRC).not.toMatch(/group\.totalQuantity === 0 \? "bg-red-500"/);
    expect(SRC).not.toMatch(/totalQuantity <= safety \? "bg-yellow-500"/);
  });

  it("🛑 경계 = 정본 경계 · 안전재고 '이하'는 미달이다 (색은 red)", () => {
    /* 경계는 정본 함수 안에 있다 — 표면이 아니라 여기서 잠근다. */
    expect(TONE).toMatch(/if \(safetyStock != null && currentQuantity <= safetyStock\) return "below_safety";/);
    expect(TONE).not.toMatch(/currentQuantity < safetyStock\)/);
    /* 0 이 먼저다 — 품절과 미달은 색이 아니라 라벨로 구분한다(둘 다 red). */
    expect(TONE).toMatch(/if \(currentQuantity <= 0\) return "out_of_stock";/);
    // 정본과 같은 경계인가 — 양쪽이 함께 < 로 바뀌는 경우까지 잡는다.
    expect(CANON).toMatch(/inv\.currentQuantity\s*<=\s*inv\.safetyStock/);
  });
  it("현재÷안전 비율 게이지 + a11y 라벨", () => {
    expect(SRC).toMatch(/Math\.min\(100, Math\.round\(\(group\.totalQuantity \/ safety\) \* 100\)\)/);
    expect(SRC).toMatch(/aria-label=\{`안전재고 대비 \$\{pct\}%`\}/);
  });
});

describe("§inventory-dday-90 — 최단 유효기간 D-day ≤90 티어", () => {
  it("≤90 노출 + ≤30 red / 31–90 yellow(신호등)", () => {
    expect(SRC).toMatch(/§inventory-dday-90/);
    expect(SRC).toMatch(/expiryDays !== null && expiryDays <= 90/);
    expect(SRC).toMatch(/expiryDays <= 30 \? "text-red-500" : "text-yellow-500"/);
  });
});

describe("§inventory-table-delta — 회귀 0(amber 금지·기존 구조 보존)", () => {
  it("amber/orange Tailwind class 0(신규 델타 정합)", () => {
    // 게이지·D-day 델타가 amber/orange class 도입 안 함
    const gaugeBlock = SRC.match(/§inventory-safety-gauge[\s\S]{0,700}/);
    expect(gaugeBlock).not.toBeNull();
    expect(gaugeBlock![0]).not.toMatch(/-(amber|orange)-[0-9]/);
  });
  it("기존 dot-status(StatusBadge) 보존 — pill 미전환", () => {
    expect(SRC).toMatch(/function StatusBadge\(/);
  });
});
