import { describe, it, expect } from "vitest";
import { extractCoaFields, matchCoaToLines } from "../coa-recognize";

/**
 * §scan-recognition-upgrade P1 — COA 추출·라인 대조 순수함수 계약.
 *
 * 잠그는 계약:
 *   1) extractCoaFields = 기존 라벨 앵커(Lot/Exp/Cat) 재사용 — 신규 파서 0.
 *      실패 필드 = null (빈값 폴백 — 지어내지 않는다).
 *   2) matchCoaToLines = 라인별 ok|mismatch|unknown. 자동 선택·자동 확정 0 —
 *      결과는 표시용 파생일 뿐, 저장은 사람 확정(PATCH) 후에만.
 */

// ── 픽스처 1 — 영문 COA (Lot/Exp/Cat 전부) ──
const COA_EN = [
  "Certificate of Analysis",
  "Sigma-Aldrich",
  "Product: Gentamicin Sulfate",
  "Cat. No.: G1264-250MG",
  "Lot No.: SLBX5678A",
  "Exp. Date: 2027-03-15",
].join("\n");

// ── 픽스처 2 — 국문 시험성적서 (유효기한 앵커) ──
const COA_KO = [
  "시험성적서",
  "품명: 완충액 키트",
  "Lot: BK2026-081",
  "유효기한: 2026.12.31",
].join("\n");

// ── 픽스처 3 — 실패 필드 (Lot 만, Exp 없음) ──
const COA_PARTIAL = ["Certificate of Analysis", "Lot No.: MKCL4821", "Store at 2-8C"].join("\n");

describe("§scan-recognition-upgrade P1 — extractCoaFields (앵커 재사용)", () => {
  it("영문 COA — Lot·Exp·Cat.No 전부 추출", () => {
    const f = extractCoaFields(COA_EN);
    expect(f.lot).toBe("SLBX5678A");
    expect(f.expiry).toBe("2027-03-15");
    expect(f.catalogNo).toBe("G1264-250MG");
  });

  it("국문 유효기한 앵커 — YYYY-MM-DD 정규화", () => {
    const f = extractCoaFields(COA_KO);
    expect(f.lot).toBe("BK2026-081");
    expect(f.expiry).toBe("2026-12-31");
  });

  it("실패 필드 = null (빈값 폴백 — 지어내지 않는다)", () => {
    const f = extractCoaFields(COA_PARTIAL);
    expect(f.lot).toBe("MKCL4821");
    expect(f.expiry).toBeNull();
    expect(f.catalogNo).toBeNull();
  });
});

describe("§scan-recognition-upgrade P1 — matchCoaToLines (라인 대조)", () => {
  const fieldsEn = extractCoaFields(COA_EN);

  it("catalogNo 가 라인명에 포함 → ok", () => {
    const per = matchCoaToLines(fieldsEn, [
      { id: "i1", name: "Gentamicin Sulfate G1264-250MG" },
    ]);
    expect(per).toEqual([{ itemId: "i1", match: "ok" }]);
  });

  it("라인명에 다른 catalog 형 토큰 → mismatch (경고 표시용 · 차단 아님)", () => {
    const per = matchCoaToLines(fieldsEn, [{ id: "i2", name: "Ampicillin A9518-25G" }]);
    expect(per[0].match).toBe("mismatch");
  });

  it("대조 근거 부족 → unknown (지어내지 않는다)", () => {
    const per = matchCoaToLines(fieldsEn, [{ id: "i3", name: "완충액 키트" }]);
    expect(per[0].match).toBe("unknown");
  });

  it("catalogNo 없어도 품목명 토큰 겹침 → ok (국문)", () => {
    const fieldsKo = extractCoaFields(COA_KO);
    expect(fieldsKo.catalogNo).toBeNull();
    const per = matchCoaToLines(fieldsKo, [{ id: "i4", name: "완충액 키트 (500ml)" }]);
    expect(per[0].match).toBe("ok");
  });

  it("복수 라인 — 라인별 독립 판정 · 자동 선택 0 (선택 필드 없음)", () => {
    const per = matchCoaToLines(fieldsEn, [
      { id: "a", name: "Gentamicin Sulfate G1264-250MG" },
      { id: "b", name: "완충액 키트" },
    ]);
    expect(per.map((p) => p.match)).toEqual(["ok", "unknown"]);
    // 반환 shape 에 selected/apply 류 자동 확정 축 없음
    expect(Object.keys(per[0]).sort()).toEqual(["itemId", "match"]);
  });
});
