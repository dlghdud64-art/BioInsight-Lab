/**
 * §product-detail PD-F (§03/§01) — 추가 스펙 raw key 한글화 + null/빈값 숨김
 *
 * 라이브 회귀: 추가 스펙에 SOURCE·TESTITEM:null·INTERNALGRADE·PURCHASEYEARS 가 raw 노출되던 §01 결함.
 *   getDisplaySpecs 가 화이트리스트 매핑 + null/빈값·매핑없는 raw 컬럼 숨김으로 교정.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDisplaySpecs, SPEC_FIELD_LABELS } from "../../lib/product-detail/spec-fields";

describe("§product-detail PD-F — getDisplaySpecs 매핑/숨김(순수함수)", () => {
  it("raw 대문자 컬럼 → 한글 라벨, null/빈값 숨김", () => {
    const out = getDisplaySpecs({
      SOURCE: "대장",
      TESTITEM: null,
      INTERNALGRADE: "E",
      PURCHASEYEARS: "",
    });
    // ★ §11.344(호영님 2026-06-20): INTERNALGRADE(자사 A~E)는 상세 미노출 → 출처만 표시.
    expect(out).toEqual([{ label: "출처", value: "대장" }]);
  });
  it("§11.344 — grade 계열(INTERNALGRADE/GRADE) 숨김", () => {
    expect(getDisplaySpecs({ INTERNALGRADE: "E" })).toEqual([]);
    expect(getDisplaySpecs({ GRADE: "A" })).toEqual([]);
  });
  it('"null" 문자열도 숨김', () => {
    expect(getDisplaySpecs({ TESTITEM: "null" })).toEqual([]);
  });
  it("매핑 없는 raw 대문자 컬럼은 숨김(내부 필드 누출 방지)", () => {
    expect(getDisplaySpecs({ SECRET_COST: "9999" })).toEqual([]);
  });
  it("사람 가독 키(pH 등)는 그대로 노출", () => {
    expect(getDisplaySpecs({ pH: "7.4" })).toEqual([{ label: "pH", value: "7.4" }]);
  });
  it("화이트리스트 핵심 raw 컬럼 매핑 + grade 계열 비매핑(§11.344)", () => {
    expect(SPEC_FIELD_LABELS.SOURCE).toBe("출처");
    expect(SPEC_FIELD_LABELS.TESTITEM).toBe("시험 항목");
    expect(SPEC_FIELD_LABELS.PURCHASEYEARS).toBe("구매 이력");
    expect(SPEC_FIELD_LABELS.INTERNALGRADE).toBeUndefined(); // grade 미노출
    expect(SPEC_FIELD_LABELS.GRADE).toBeUndefined();
  });
});

describe("§product-detail PD-F — page 배선(raw 렌더 제거)", () => {
  const PAGE = readFileSync(
    join(__dirname, "..", "..", "app/products/[id]/page.tsx"),
    "utf8",
  );
  it("getDisplaySpecs 로 렌더(raw Object.entries 직접 렌더 제거)", () => {
    expect(PAGE).toMatch(/getDisplaySpecs\(product\.specifications\)/);
    expect(PAGE).not.toMatch(/Object\.entries\(product\.specifications as Record<string, any>\)\.map/);
  });
});
