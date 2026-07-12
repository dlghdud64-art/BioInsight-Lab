/**
 * §inventory-safety-gauge / §inventory-dday-90 (호영님 재고 지시문 §2) — 테이블 additive 델타.
 *
 * 안전재고 게이지 막대(신호등: 0 red / 미달 yellow / 정상 emerald) +
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

describe("§inventory-safety-gauge — 안전재고 게이지 막대(신호등)", () => {
  it("게이지 트레이스 + 신호등 3색 분기(0 red / 미달 yellow / 정상 emerald)", () => {
    expect(SRC).toMatch(/§inventory-safety-gauge/);
    expect(SRC).toMatch(/group\.totalQuantity === 0 \? "bg-red-500"/);
    expect(SRC).toMatch(/group\.totalQuantity < safety \? "bg-yellow-500" : "bg-emerald-500"/);
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
