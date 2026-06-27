/**
 * §safety-redesign 마무리 — 톤 통일 · empty-state · mockup 잔재 0 (호영님 2026-06-27)
 *
 * 핸드오프 §7: 경고는 muted yellow 톤(채도 높은 형광 노랑·tailwind amber- / orange- 미사용).
 * 핸드오프 §8 mockup scaffolding(current/improved 토글·localStorage view) 미이식(실배선 페이지).
 * 파일럿 0% empty-state: 데이터 0종 vs 필터 0건 구분.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(
  join(__dirname, "..", "..", "app/dashboard/safety/page.tsx"),
  "utf8",
);
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§safety-redesign 마무리 — 톤(형광 노랑·amber/orange 미사용)", () => {
  it("tailwind amber-*/orange-* 색상 클래스 0", () => {
    expect(CODE).not.toMatch(/\b(amber|orange)-(50|100|200|300|400|500|600|700|800)\b/);
  });
});

describe("§safety-redesign 마무리 — mockup scaffolding 미이식", () => {
  it("current/improved 토글·localStorage view 부재", () => {
    expect(CODE).not.toMatch(/localStorage/);
    expect(CODE).not.toMatch(/labaxis_safety_view/);
  });
});

describe("§safety-redesign 마무리 — 파일럿 empty-state", () => {
  it("데이터 0종 vs 필터 0건 구분", () => {
    expect(CODE).toMatch(/totalCount === 0 \? "등록된 화학물질이 없습니다/);
    expect(CODE).toMatch(/조건에 맞는 데이터가 없습니다/);
  });
});
