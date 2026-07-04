/**
 * §audit-log-enhancement P1 (호영님 2026-07-04) — 감사 신뢰 배지 바(정직 문구).
 * fake compliance 금지: hash chain 미보유 → "해시 검증됨" 가시 주장 없음. append-only·KST·Part11만.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/audit/page.tsx"), "utf8");
const CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§audit-log-enhancement P1 — 신뢰 배지 바", () => {
  it("신뢰 바 존재 + 정직 주장(append-only·KST·Part11)", () => {
    expect(CODE).toMatch(/data-testid="audit-trust-bar"/);
    expect(CODE).toMatch(/append-only/);
    expect(CODE).toMatch(/KST 고정/);
    expect(CODE).toMatch(/21 CFR Part 11 정합/);
  });
  it("fake compliance 금지 — 가시 텍스트에 '해시 검증' 주장 없음(주석 제외)", () => {
    expect(CODE).not.toMatch(/해시 검증/);
  });
  it("중립 톤 — 신뢰 바에 빨강/카테고리 배경색 미사용", () => {
    const bar = CODE.match(/audit-trust-bar[\s\S]{0,600}/)?.[0] ?? "";
    expect(bar).not.toMatch(/bg-red|text-red|bg-\[#c8324f\]/);
  });
});
