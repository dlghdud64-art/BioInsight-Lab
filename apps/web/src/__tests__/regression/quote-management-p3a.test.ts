/**
 * §quote-management P3a (PLAN_quote-management) — 공급사 실명 아바타(익명 점 폐기)
 *
 * 지시문 §05. vendorRequests → Supplier[] 파생, 실명 이니셜, 회신 색구분.
 *   - 회신=파랑(bg-blue-600)/미회신=회색(bg-slate-200). 앞 3 + N 축약. 0=공급사 미정.
 *   - 이름 없으면 이메일 도메인/fallback(가짜 0). hover 툴팁(회신 ✓).
 *   (현행 테이블 흡수는 공급사 셀 정밀 특정 후 P3b 테이블 작업과 함께.)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(
  join(__dirname, "..", "..", "components/quotes/supplier-avatars.tsx"),
  "utf8",
);

describe("§quote-management P3a — toSuppliers 파생", () => {
  it("vendorRequests → Supplier(이름·회신), 이름 없으면 이메일 도메인 fallback", () => {
    expect(SRC).toMatch(/export function toSuppliers/);
    expect(SRC).toMatch(/v\.vendorName\?\.trim\(\)/);
    expect(SRC).toMatch(/vendorEmail\.split\("@"\)\[1\]/);
    expect(SRC).toMatch(/respondedAt != null \|\| v\.status === "RESPONDED"/);
  });
});

describe("§quote-management P3a — SupplierAvatars 표시", () => {
  it("회신=파랑 / 미회신=회색", () => {
    expect(SRC).toMatch(/s\.replied \? "bg-blue-600 text-white" : "bg-slate-200/);
  });
  it("앞 3 + N 축약, 0=공급사 미정(가짜 0)", () => {
    expect(SRC).toMatch(/suppliers\.slice\(0, 3\)/);
    expect(SRC).toMatch(/\+\{extra\}/);
    expect(SRC).toMatch(/공급사 미정/);
  });
  it("hover 툴팁(회신 ✓)", () => {
    expect(SRC).toMatch(/\$\{s\.replied \? " ✓" : ""\}/);
    expect(SRC).toMatch(/title=\{tooltip\}/);
  });
  it("§11.302 정합 — amber/orange 0", () => {
    expect(SRC).not.toMatch(/-amber-|-orange-/);
  });
});
