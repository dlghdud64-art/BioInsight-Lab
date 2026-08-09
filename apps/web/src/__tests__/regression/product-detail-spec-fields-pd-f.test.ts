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
    // 호영님 재결정(2026-06-20): 시안대로 내부 등급 노출 → 출처·내부 등급 표시(TESTITEM null·PURCHASEYEARS 빈값 숨김).
    expect(out).toEqual([
      { label: "출처", value: "대장" },
      { label: "내부 등급", value: "E" },
    ]);
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
  it("화이트리스트 핵심 raw 컬럼 매핑(내부 등급 포함 — 호영님 시안대로 노출 재결정)", () => {
    expect(SPEC_FIELD_LABELS.SOURCE).toBe("출처");
    expect(SPEC_FIELD_LABELS.TESTITEM).toBe("시험 항목");
    expect(SPEC_FIELD_LABELS.PURCHASEYEARS).toBe("구매 이력");
    expect(SPEC_FIELD_LABELS.INTERNALGRADE).toBe("내부 등급");
  });
});

describe("§product-detail PD-F — page 배선(raw 렌더 제거)", () => {
  const PAGE = readFileSync(
    join(__dirname, "..", "..", "app/products/[id]/page.tsx"),
    "utf8",
  );
  /* 🔁 은퇴→승계 (§product-detail-sourcing-v21 §2)
   *    추가 스펙(출처·내부 등급) 표면이 삭제되며 PAGE 의 getDisplaySpecs 호출부가 사라졌다.
   *    PD-F 의 본래 계약(raw Object.entries 직접 렌더 금지 = 내부 key 노출 0)은 **강화된 형태로 승계** —
   *    이제 raw 렌더 자체가 존재할 수 없다. 매핑 lib 단언(위 describe)은 전량 존치. */
  it("raw specifications 직접 렌더 0(내부 key 노출 금지 승계)", () => {
    expect(PAGE).not.toMatch(/Object\.entries\(product\.specifications as Record<string, any>\)\.map/);
    expect(PAGE).not.toMatch(/getDisplaySpecs\(product\.specifications\)\.map/);
  });
});
