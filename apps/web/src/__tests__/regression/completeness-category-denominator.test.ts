/**
 * §completeness-category-denominator — 완성도 분모 카테고리 조건부화
 *
 * CEO 결정 교체(호영님 2026-07-26): PD-B `분모 8 고정` → `카테고리 적용 필드 분모`.
 *   구 정직론(모든 제품 동일 잣대) → 신 정직론(제품 성격별 잣대).
 *   부풀리기 방지는 3중 가드로 계승: ①하한 5(universal) ②category=DB canonical ③null→8.
 *
 * 계획서: docs/plans/PLAN_completeness-category-denominator.md
 * 본 파일 Phase 1 = RED. 분모 8 고정 코드에서 전 계약 FAIL 이 정상.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  computeCompleteness,
  applicableFields,
  COMPLETENESS_FIELDS,
} from "../../lib/product-detail/completeness";

const root = (rel: string) => readFileSync(join(__dirname, "..", "..", rel), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
const LIB = root("lib/product-detail/completeness.ts");
const LIB_CODE = stripComments(LIB);

/* ── 필드 정의 불변 (교체하는 건 분모지 필드가 아니다) ── */
describe("§denominator 계약① — 8필드 정의 불변", () => {
  it("COMPLETENESS_FIELDS 는 여전히 8개, 같은 key·순서", () => {
    expect(COMPLETENESS_FIELDS.map((f) => f.key)).toEqual([
      "catalogNumber", "specification", "regulatoryCompliance", "grade",
      "manufacturer", "usageDescription", "storageCondition", "msdsUrl",
    ]);
  });
});

/* ── 분모 파생 ── */
describe("§denominator 계약② — applicableFields(category)", () => {
  const total = (cat: string | null | undefined) => applicableFields(cat).length;

  it("REAGENT·RAW_MATERIAL = 8 (전 필드)", () => {
    expect(total("REAGENT")).toBe(8);
    expect(total("RAW_MATERIAL")).toBe(8);
  });
  it("TOOL·EQUIPMENT = 5 (universal 만)", () => {
    expect(total("TOOL")).toBe(5);
    expect(total("EQUIPMENT")).toBe(5);
  });
  it("CONSUMABLE = 6 (universal 5 + 보관 조건)", () => {
    expect(total("CONSUMABLE")).toBe(6);
    expect(applicableFields("CONSUMABLE").map((f) => f.key)).toContain("storageCondition");
    expect(applicableFields("CONSUMABLE").map((f) => f.key)).not.toContain("msdsUrl");
  });
  it("null·미상·미정의 → 8 (보수적 폴백, 부풀리기 0)", () => {
    expect(total(null)).toBe(8);
    expect(total(undefined)).toBe(8);
    expect(total("NONEXISTENT_CAT")).toBe(8);
  });
});

/* ── 안티-부풀리기 가드 (구 정직론 계승) ── */
describe("§denominator 계약③ — 부풀리기 방지 가드", () => {
  it("어떤 category 도 분모 ≥ 5 (하한)", () => {
    for (const cat of ["TOOL", "EQUIPMENT", "REAGENT", "CONSUMABLE", "RAW_MATERIAL", null, undefined, "X"]) {
      expect(applicableFields(cat as any).length).toBeGreaterThanOrEqual(5);
    }
  });
  it("universal 5 는 전 category 분모에 항상 포함", () => {
    const universal = ["catalogNumber", "specification", "grade", "manufacturer", "usageDescription"];
    for (const cat of ["TOOL", "EQUIPMENT", "REAGENT", "CONSUMABLE", null]) {
      const keys = applicableFields(cat as any).map((f) => f.key);
      for (const u of universal) expect(keys).toContain(u);
    }
  });
  it("조건부 3필드는 universal 이 아니다(SDS·규제규격·보관조건)", () => {
    const toolKeys = applicableFields("TOOL").map((f) => f.key);
    expect(toolKeys).not.toContain("msdsUrl");
    expect(toolKeys).not.toContain("regulatoryCompliance");
    expect(toolKeys).not.toContain("storageCondition");
  });
});

/* ── computeCompleteness 통합 ── */
describe("§denominator 계약④ — computeCompleteness 가 category 분모 사용", () => {
  it("TOOL 빈 제품: total 5 (SDS·규제규격·보관조건 미포함)", () => {
    const r = computeCompleteness({ category: "TOOL", catalogNumber: "T-1" });
    expect(r.total).toBe(5);
    expect(r.missingLabels).not.toContain("SDS/MSDS");
    expect(r.missingLabels).not.toContain("규제 규격");
  });
  it("REAGENT 빈 제품: total 8 (무변화)", () => {
    const r = computeCompleteness({ category: "REAGENT" });
    expect(r.total).toBe(8);
  });
  it("category 없는 제품: total 8 (폴백)", () => {
    const r = computeCompleteness({ catalogNumber: "X" });
    expect(r.total).toBe(8);
  });
  it("% = known/total 식 불변(계산 방식 유지)", () => {
    // TOOL, universal 5 중 1개(catalogNumber) 채움 → 1/5 = 20%
    const r = computeCompleteness({ category: "TOOL", catalogNumber: "T-1" });
    expect(r.known).toBe(1);
    expect(r.total).toBe(5);
    expect(r.pct).toBe(20);
  });
  it("100% 판정도 category 분모 기준(TOOL universal 5 다 채우면 100)", () => {
    const r = computeCompleteness({
      category: "TOOL", catalogNumber: "T", specification: "s",
      grade: "A", manufacturer: "m", usageDescription: "u",
    });
    expect(r.pct).toBe(100);
  });
});

/* ── 소스 구조 단언 (하드코딩 8 제거) ── */
describe("§denominator 계약⑤ — 하드코딩 분모 8 제거", () => {
  it("total 이 COMPLETENESS_FIELDS.length 하드코딩이 아니다", () => {
    expect(LIB_CODE).not.toMatch(/const total = COMPLETENESS_FIELDS\.length/);
    expect(LIB_CODE).toMatch(/applicableFields\(/);
  });
  it("appliesTo 메타로 조건부 필드 표기(별도 매트릭스 분산 금지)", () => {
    expect(LIB).toMatch(/appliesTo/);
  });
  it("하한 가드가 코드에 존재(universal 수 = 파생 하한)", () => {
    // 하한은 리터럴 5 가 아니라 UNIVERSAL_COUNT(파생) — universal 필드가 늘면 하한도 따라 오른다.
    expect(LIB_CODE).toMatch(/UNIVERSAL_COUNT|>= 5|Math\.max\(5/);
  });
});
